import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2, BookOpen, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

export default function StudentCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<Record<string, { done: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }
      console.log('[StudentCourses] Logged in as:', user.email, 'id:', user.id);

      // ── 1. Get Profile + Cohort ─────────────────────────────────────────
      let program = '';

      // Try with cohort join first
      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('*, cohorts(name, course)').eq('id', user.id).single();

      if (profErr) {
        console.warn('[StudentCourses] Profile+cohort join failed:', profErr.message);
        // Retry without cohort join
        const retry = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (retry.error) {
          console.error('[StudentCourses] Profile missing entirely:', retry.error.message);
          // Auto-create profile
          const meta = user.user_metadata || {};
          const fullName = meta.full_name || meta.name || user.email?.split('@')[0] || 'Student';
          const { data: newProf, error: insertErr } = await supabase
            .from('profiles').upsert({
              id: user.id,
              full_name: fullName,
              email: user.email,
              role: 'student',
            }, { onConflict: 'id' }).select().single();
          if (insertErr) {
            console.error('[StudentCourses] Auto-create failed:', insertErr.message);
            setError('Profile not found. Please contact your administrator.');
            setLoading(false); return;
          }
          console.log('[StudentCourses] Auto-created profile for:', user.email);
          // No cohort_id on auto-created profile, try to find one below
        } else {
          console.log('[StudentCourses] Profile found without cohort join');
        }

        // If profile has cohort_id, fetch cohort manually
        const profData = retry.data || null;
        if (profData?.cohort_id) {
          const { data: cohort } = await supabase
            .from('cohorts').select('name, course').eq('id', profData.cohort_id).single();
          if (cohort) {
            program = cohort.course;
            console.log('[StudentCourses] Program from manual cohort fetch:', program);
          } else {
            console.error('[StudentCourses] Cohort not found for id:', profData.cohort_id);
          }
        } else if (!retry.error) {
          console.warn('[StudentCourses] Profile has no cohort_id');
        }
      } else if (profile) {
        const cohortData = (profile as any).cohorts;
        program = cohortData?.course || '';
        console.log('[StudentCourses] Program from join:', program, '| cohort_id:', profile.cohort_id);

        if (!program && profile.cohort_id) {
          // Join returned data but no course field — fetch manually
          const { data: cohort } = await supabase
            .from('cohorts').select('name, course').eq('id', profile.cohort_id).single();
          if (cohort) program = cohort.course;
        }
      }

      // Last resort: no cohort_id at all — try to auto-assign
      if (!program) {
        console.warn('[StudentCourses] No program found. Trying to auto-assign cohort...');
        const { data: allCohorts } = await supabase
          .from('cohorts').select('id, name, course').limit(10);
        if (allCohorts && allCohorts.length > 0) {
          const firstCohort = allCohorts[0];
          program = firstCohort.course;
          const { error: updateErr } = await supabase
            .from('profiles').update({ cohort_id: firstCohort.id }).eq('id', user.id);
          if (updateErr) console.error('[StudentCourses] Could not update cohort_id:', updateErr.message);
          else console.log('[StudentCourses] Auto-assigned cohort:', firstCohort.name, '→ program:', program);
        }
      }

      if (!program) {
        // List available programs for debugging
        const { data: allCohorts } = await supabase.from('cohorts').select('name, course').limit(20);
        console.error('[StudentCourses] No program determined. Available cohorts:', allCohorts);
        setError('Your profile is not linked to a cohort. Please contact your administrator.');
        setLoading(false); return;
      }

      // ── 2. Get Courses ─────────────────────────────────────────────────
      console.log('[StudentCourses] Searching courses for program:', program);
      const { data: courseData, error: courseErr } = await supabase
        .from('courses').select('*').eq('program', program);
      if (courseErr) console.warn('[StudentCourses] Course query error:', courseErr.message);

      const courseList = courseData || [];
      setCourses(courseList);
      console.log('[StudentCourses] Courses found:', courseList.length, courseList.map((c: any) => c.title));

      // ── 3. Get Progress for each course ────────────────────────────────
      if (courseList.length > 0) {
        const progMap: Record<string, any> = {};
        for (const c of courseList) {
          const { data: mods } = await supabase.from('modules').select('id').eq('course_id', c.id);
          const ids = mods?.map(m => m.id) || [];
          const { data: less } = await supabase.from('lessons').select('id').in('module_id', ids);
          const total = less?.length || 0;

          // FIXED: Use lesson_progress table (not 'progress') and user_id (not 'student_id')
          const { data: prog } = await supabase
            .from('lesson_progress')
            .select('lesson_id')
            .eq('user_id', user.id)
            .in('lesson_id', less?.map(l => l.id) || [])
            .eq('completed', true);
          const done = prog?.length || 0;
          progMap[c.id] = { done, total };
        }
        setProgressData(progMap);
        console.log('[StudentCourses] Progress loaded for', courseList.length, 'courses');
      }

      console.log('[StudentCourses] ✅ Data load complete');
    } catch (e: any) {
      console.error('[StudentCourses] Uncaught error:', e);
      setError(e.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-500">Loading your courses...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={fetchCourses} className="mt-4" variant="outline">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Courses</h1>
        <p className="text-gray-500">Select a course to start learning</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-400 border-dashed border-2 rounded-lg">
            <BookOpen className="w-12 h-12 mx-auto mb-2" />
            <p>No courses assigned yet.</p>
          </div>
        ) : (
          courses.map(c => {
            const prog = progressData[c.id] || { done: 0, total: 0 };
            const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;

            return (
              <Card key={c.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-t-4 border-blue-600">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    {prog.total > 0 && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {pct}%
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-lg mb-1">{c.title}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{c.description || 'No description'}</p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progress</span>
                      <span>{prog.done}/{prog.total} Lessons</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  <Button
                    className="w-full mt-6 group-hover:bg-blue-700"
                    onClick={() => navigate(`/student/courses/${c.id}`)}
                  >
                    {prog.done > 0 ? 'Continue' : 'Start'} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
