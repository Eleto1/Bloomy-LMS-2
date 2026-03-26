import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, CheckCircle } from 'lucide-react';

interface Course { id: string; title: string; program: string; description: string; }
interface Lesson { id: string; module_id: string; }
interface Module { id: string; course_id: string; }
interface LessonProgress { lesson_id: string; }

export default function StudentCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchStudentCourses();
    }
  }, [user]);

  const fetchStudentCourses = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile?.cohort_id) {
        setLoading(false);
        return;
      }

      const { data: cohort, error: cohortErr } = await supabase
        .from('cohorts')
        .select('course')
        .eq('id', profile.cohort_id)
        .single();

      if (cohortErr || !cohort?.course) {
        setLoading(false);
        return;
      }

      const { data: coursesData, error: courseErr } = await supabase
        .from('courses')
        .select('*')
        .eq('program', cohort.course);

      if (courseErr) throw courseErr;
      if (coursesData) setCourses(coursesData);

      const progress: Record<string, number> = {};
      
      for (const course of coursesData || []) {
        const { data: mods } = await supabase.from('modules').select('id').eq('course_id', course.id);
        if (!mods || mods.length === 0) {
          progress[course.id] = 0;
          continue;
        }

        const moduleIds = mods.map(m => m.id);
        const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', moduleIds);
        const totalLessons = lessons?.length || 0;

        if (totalLessons === 0) {
          progress[course.id] = 0;
          continue;
        }

        const lessonIds = lessons!.map(l => l.id);
        const { data: completed } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds);

        const completedCount = completed?.length || 0;
        progress[course.id] = Math.round((completedCount / totalLessons) * 100);
      }

      setProgressMap(progress);

    } catch (err) {
      console.error(err);
      toast({ title: 'Error loading courses', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin mr-2" /> Loading your courses...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">My Courses</h2>
        <p className="text-gray-500">Your enrolled programs and progress.</p>
      </div>

      {courses.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">
          You are not enrolled in any courses yet.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden border-border hover:shadow-lg transition-shadow">
              <div className="h-24 gradient-hero flex items-center justify-center p-4">
                <h3 className="font-display font-bold text-lg text-primary-foreground text-center">{course.title}</h3>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">{course.description}</p>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-bold">{progressMap[course.id] || 0}%</span>
                  </div>
                  <Progress value={progressMap[course.id] || 0} className="h-2" />
                </div>

                <Link to={`/student/courses/${course.id}`}>
                  <Button className="w-full mt-2">
                    {progressMap[course.id] === 100 ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Review</>
                    ) : (
                      <><BookOpen className="w-4 h-4 mr-2" /> Continue Learning</>
                    )}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}