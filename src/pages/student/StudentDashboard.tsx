import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

interface Course { id: string; title: string; program: string; description: string; }

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchCourses(); }, [user]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('cohort_id').eq('id', user.id).single();
      if (!profile?.cohort_id) return setLoading(false);
      const { data: cohort } = await supabase.from('cohorts').select('course').eq('id', profile.cohort_id).single();
      if (!cohort?.course) return setLoading(false);
      const { data } = await supabase.from('courses').select('*').eq('program', cohort.course);
      if (data) setCourses(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="p-10">Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">My Courses</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length === 0 ? <p>No courses found.</p> : courses.map(c => (
          <Card key={c.id}>
            <div className="h-20 bg-blue-600 flex items-center justify-center p-4 text-white font-bold text-center">{c.title}</div>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-2">{c.program}</p>
              <p className="text-sm mb-4 line-clamp-2">{c.description}</p>
              <Link to={`/student/courses/${c.id}`}>
                <Button className="w-full"><BookOpen className="w-4 h-4 mr-2"/> Start</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}