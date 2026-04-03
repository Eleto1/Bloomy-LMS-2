import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstitute } from '@/lib/institute-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, ClipboardCheck, CalendarDays, TrendingUp,
  Clock, CheckCircle2, AlertCircle, ArrowRight, GraduationCap,
  BarChart3, FileText, Layers, Eye, Pencil, Loader2,
  HandMetal, UserCheck, CircleDot
} from 'lucide-react';

interface Cohort {
  id: string;
  name: string;
  course: string;
}

interface PendingSub {
  id: string;
  user_id: string;
  lesson_id: string;
  lesson_title: string;
  student_name: string;
  submitted_at: string;
  submission_type: string;
  cohort_name: string;
}

interface CohortStat {
  id: string;
  name: string;
  course: string;
  studentCount: number;
  avgProgress: number;
  avgAttendance: number;
  pendingCount: number;
}

interface Profile {
  id: string;
  full_name: string;
  email?: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function ProgressBar({ value, color = '#6366f1', height = 'h-2' }: { value: number; color?: string; height?: string }) {
  return (
    <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { name: instituteName } = useInstitute();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [pendingGrades, setPendingGrades] = useState<PendingSub[]>([]);
  const [avgAttendance, setAvgAttendance] = useState<number | null>(null);
  const [cohortStats, setCohortStats] = useState<CohortStat[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [schemaMode, setSchemaMode] = useState<string | null>(null);

  // ✅ FIX: Deduplicate cohorts by name for UI display
  const uniqueCohorts = useMemo(() => {
    const map = new Map<string, Cohort>();
    cohorts.forEach(c => {
      if (!map.has(c.name)) {
        map.set(c.name, c);
      }
    });
    return Array.from(map.values());
  }, [cohorts]);

  useEffect(() => {
    if (user) {
      loadData();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;
      if (data) setProfile(data);
    } catch (err) {
      console.error('Could not fetch profile name', err);
    }
  };

  const fetchInstructorCohorts = async (userId: string): Promise<{ cohorts: Cohort[]; mode: string }> => {
    const { data: directCohorts, error: err1 } = await supabase
      .from('cohorts')
      .select('id, name, course')
      .eq('instructor_id', userId)
      .order('name');

    if (!err1 && directCohorts && directCohorts.length > 0) {
      return { cohorts: directCohorts, mode: 'direct-instructor_id' };
    }

    const { data: instructorCourses, error: err2 } = await supabase
      .from('courses')
      .select('id, program, title')
      .eq('instructor_id', userId);

    if (!err2 && instructorCourses && instructorCourses.length > 0) {
      const programs = [...new Set(instructorCourses.map(c => c.program).filter(Boolean))];
      if (programs.length > 0) {
        const { data: courseCohorts, error: err2b } = await supabase
          .from('cohorts')
          .select('id, name, course')
          .in('course', programs)
          .order('name');

        if (!err2b && courseCohorts && courseCohorts.length > 0) {
          return { cohorts: courseCohorts, mode: 'via-courses-instructor_id' };
        }
      }
    }

    const { data: createdByCourses, error: err3 } = await supabase
      .from('courses')
      .select('id, program, title')
      .eq('created_by', userId);

    if (!err3 && createdByCourses && createdByCourses.length > 0) {
      const programs = [...new Set(createdByCourses.map(c => c.program).filter(Boolean))];
      if (programs.length > 0) {
        const { data: createdByCohorts, error: err3b } = await supabase
          .from('cohorts')
          .select('id, name, course')
          .in('course', programs)
          .order('name');

        if (!err3b && createdByCohorts && createdByCohorts.length > 0) {
          return { cohorts: createdByCohorts, mode: 'via-courses-created_by' };
        }
      }
    }

    const { data: junctionRows, error: err4 } = await supabase
      .from('cohort_instructors')
      .select('cohort_id')
      .eq('instructor_id', userId);

    if (!err4 && junctionRows && junctionRows.length > 0) {
      const cIds = junctionRows.map(r => r.cohort_id);
      const { data: junctionCohorts, error: err4b } = await supabase
        .from('cohorts')
        .select('id, name, course')
        .in('id', cIds)
        .order('name');

      if (!err4b && junctionCohorts && junctionCohorts.length > 0) {
        return { cohorts: junctionCohorts, mode: 'via-cohort_instructors-table' };
      }
    }

    const { data: profileRef, error: err5 } = await supabase
      .from('cohorts')
      .select('id, name, course')
      .eq('teacher_id', userId)
      .order('name');

    if (!err5 && profileRef && profileRef.length > 0) {
      return { cohorts: profileRef, mode: 'direct-teacher_id' };
    }

    return { cohorts: [], mode: 'none' };
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { cohorts: foundCohorts, mode } = await fetchInstructorCohorts(user.id);
      setSchemaMode(mode);
      const cohortList = foundCohorts;
      setCohorts(cohortList);

      if (cohortList.length === 0) {
        setLoading(false);
        return;
      }

      const cohortIds = cohortList.map(c => c.id);
      const cohortMap: Record<string, Cohort> = {};
      cohortList.forEach(c => { cohortMap[c.id] = c; });

      // 2. Students in these cohorts
      const { data: studData } = await supabase
        .from('profiles')
        .select('id, full_name, email, cohort_id')
        .eq('role', 'student')
        .in('cohort_id', cohortIds);

      const studentList = studData || [];
      setTotalStudents(studentList.length);
      if (studentList.length === 0) { setLoading(false); return; }

      const studentIds = studentList.map(s => s.id);
      const studentMap: Record<string, { name: string; cohort_id: string }> = {};
      studentList.forEach(s => { studentMap[s.id] = { name: s.full_name, cohort_id: s.cohort_id }; });

      // 3. Pending (ungraded) submissions — top 8
      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('id, user_id, lesson_id, submitted_at, submission_type, status')
        .in('user_id', studentIds)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(8);

      const subs = subData || [];
      setTotalPending(subs.length);

      if (subs.length > 0) {
        const lessonIds = [...new Set(subs.map(s => s.lesson_id))];
        const { data: lessData } = await supabase
          .from('lessons')
          .select('id, title')
          .in('id', lessonIds);
        const lessonMap: Record<string, string> = {};
        (lessData || []).forEach(l => { lessonMap[l.id] = l.title; });

        const enriched: PendingSub[] = subs.map(sub => ({
          id: sub.id,
          user_id: sub.user_id,
          lesson_id: sub.lesson_id,
          lesson_title: lessonMap[sub.lesson_id] || 'Unknown Lesson',
          student_name: studentMap[sub.user_id]?.name || 'Unknown',
          submitted_at: sub.submitted_at,
          submission_type: sub.submission_type,
          cohort_name: cohortMap[studentMap[sub.user_id]?.cohort_id]?.name || '',
        }));
        setPendingGrades(enriched);
      }

      // 4. Overall attendance
      const { data: attendData } = await supabase
        .from('attendance')
        .select('student_id, status')
        .in('student_id', studentIds);

      const attendRows = attendData || [];
      if (attendRows.length > 0) {
        setAvgAttendance(Math.round((attendRows.filter(a => a.status === 'present').length / attendRows.length) * 100));
      }

      // 5. Per-cohort stats
      const programs = [...new Set(cohortList.map(c => c.course))];
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, program')
        .in('program', programs);
      const programToCourseIds: Record<string, string[]> = {};
      (courseData || []).forEach(c => {
        if (!programToCourseIds[c.program]) programToCourseIds[c.program] = [];
        programToCourseIds[c.program].push(c.id);
      });

      const pendingByCohort: Record<string, number> = {};
      subs.forEach(sub => {
        const cid = studentMap[sub.user_id]?.cohort_id;
        if (cid) pendingByCohort[cid] = (pendingByCohort[cid] || 0) + 1;
      });

      const stats = await Promise.all(cohortList.map(async (cohort) => {
        const cStudents = studentList.filter(s => s.cohort_id === cohort.id);
        const cStudentIds = cStudents.map(s => s.id);
        let avgProgress = 0;
        let cAvgAttend = 0;

        if (cStudentIds.length > 0 && programToCourseIds[cohort.course]?.length) {
          const { data: mods } = await supabase
            .from('modules')
            .select('id')
            .in('course_id', programToCourseIds[cohort.course]);
          const modIds = (mods || []).map(m => m.id);

          if (modIds.length > 0) {
            const { data: lessons } = await supabase
              .from('lessons')
              .select('id, type')
              .in('module_id', modIds);
            const nonHeader = (lessons || []).filter(l => l.type !== 'header');
            const lIds = nonHeader.map(l => l.id);

            if (lIds.length > 0) {
              const { data: prog } = await supabase
                .from('lesson_progress')
                .select('user_id, lesson_id, completed')
                .in('user_id', cStudentIds)
                .in('lesson_id', lIds);
              const progRows = prog || [];
              avgProgress = progRows.length > 0
                ? Math.round((progRows.filter(p => p.completed).length / progRows.length) * 100)
                : 0;
            }
          }

          const { data: cAttend } = await supabase
            .from('attendance')
            .select('status')
            .in('student_id', cStudentIds);
          const cARows = cAttend || [];
          cAvgAttend = cARows.length > 0
            ? Math.round((cARows.filter(a => a.status === 'present').length / cARows.length) * 100)
            : 0;
        }

        return {
          id: cohort.id,
          name: cohort.name,
          course: cohort.course,
          studentCount: cStudents.length,
          avgProgress,
          avgAttendance: cAvgAttend,
          pendingCount: pendingByCohort[cohort.id] || 0,
        };
      }));

      setCohortStats(stats);
    } catch (e: any) {
      toast({ title: 'Error loading dashboard', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  if (cohorts.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
          <GraduationCap className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Cohorts Assigned Yet</h2>
        <p className="text-gray-500 mb-4">
          We couldn&apos;t find any cohorts linked to your account.
        </p>

        {schemaMode === 'none' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Debug Info
            </p>
            <p className="text-xs text-amber-700 mb-2">
              We tried these strategies to find your cohorts:
            </p>
            <ul className="text-[11px] text-amber-600 space-y-1 list-disc list-inside">
              <li><code className="bg-amber-100 px-1 rounded">cohorts.instructor_id</code></li>
              <li><code className="bg-amber-100 px-1 rounded">cohorts.teacher_id</code></li>
              <li><code className="bg-amber-100 px-1 rounded">courses.instructor_id</code></li>
              <li><code className="bg-amber-100 px-1 rounded">cohort_instructors</code> junction table</li>
            </ul>
          </div>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={loadData}>
            <CircleDot className="w-4 h-4 mr-2" /> Retry
          </Button>
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Instructor';

  return (
    <div className="space-y-6">
      {/* ── Welcome Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-0.5">{formatDate()}</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s an overview of your classes at {instituteName || 'the academy'}.
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" className="gap-2 shrink-0">
          <CircleDot className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            // ✅ FIX: Use uniqueCohorts.length
            label: 'My Cohorts',
            value: uniqueCohorts.length,
            icon: Layers,
            bg: 'bg-indigo-50',
            fg: 'text-indigo-600',
          },
          {
            label: 'Total Students',
            value: totalStudents,
            icon: Users,
            bg: 'bg-emerald-50',
            fg: 'text-emerald-600',
          },
          {
            label: 'Pending Grades',
            value: totalPending,
            icon: ClipboardCheck,
            bg: totalPending > 0 ? 'bg-amber-50' : 'bg-gray-50',
            fg: totalPending > 0 ? 'text-amber-600' : 'text-gray-400',
            alert: totalPending > 0,
          },
          {
            label: 'Avg Attendance',
            value: avgAttendance !== null ? `${avgAttendance}%` : '—',
            icon: UserCheck,
            bg: 'bg-blue-50',
            fg: 'text-blue-600',
          },
        ].map(({ label, value, icon: Icon, bg, fg, alert }) => (
          <Card key={label} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-start justify-between p-4 pb-3">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${fg}`} />
                </div>
              </div>
              {alert && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                  <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Needs attention
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid - Pending Grading & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-sm h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-amber-500" />
                  <h2 className="font-bold text-gray-900">Pending Grading</h2>
                  {totalPending > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
                      {totalPending}
                    </Badge>
                  )}
                </div>
                {totalPending > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-indigo-600 gap-1 hover:text-indigo-700" onClick={() => navigate('/grades')}>
                    View all <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {pendingGrades.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-0.5">No pending submissions to grade.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingGrades.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-indigo-50/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {sub.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{sub.student_name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400">
                            <span className="truncate">{sub.lesson_title}</span>
                            {sub.cohort_name && (
                              <>
                                <span className="shrink-0">·</span>
                                <span className="shrink-0">{sub.cohort_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[11px] text-gray-400 hidden sm:block">
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => navigate('/grades')}
                        >
                          <Pencil className="w-3 h-3" /> Grade
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <HandMetal className="w-4 h-4 text-indigo-500" /> Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Take Attendance', icon: CalendarDays, href: '/attendance', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
                  { label: 'Grade Work', icon: ClipboardCheck, href: '/grades', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
                  { label: 'View Progress', icon: BarChart3, href: '/progress', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
                  { label: 'My Students', icon: Users, href: '/students', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
                ].map(({ label, icon: Icon, href, color }) => (
                  <Link key={label} to={href}>
                    <Button
                      variant="outline"
                      className={`w-full h-auto py-3 flex flex-col items-center gap-2 border-0 ${color} transition-colors`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{label}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-500" /> My Cohorts
                </h2>
                {/* ✅ FIX: Use uniqueCohorts.length */}
                <Badge variant="secondary" className="text-[11px] font-semibold">{uniqueCohorts.length}</Badge>
              </div>
              <div className="space-y-2">
                {/* ✅ FIX: Map over uniqueCohorts */}
                {uniqueCohorts.map(c => {
                  // Aggregate stats for cohorts with the same name
                  const relevantStats = cohortStats.filter(s => s.name === c.name);
                  const totalStudents = relevantStats.reduce((sum, s) => sum + s.studentCount, 0);
                  // Average progress/attendance across duplicates
                  const avgProg = relevantStats.length > 0 
                    ? Math.round(relevantStats.reduce((sum, s) => sum + s.avgProgress, 0) / relevantStats.length) 
                    : 0;
                  const avgAtt = relevantStats.length > 0 
                    ? Math.round(relevantStats.reduce((sum, s) => sum + s.avgAttendance, 0) / relevantStats.length) 
                    : 0;
                  const totalPending = relevantStats.reduce((sum, s) => sum + s.pendingCount, 0);

                  return (
                    <div
                      key={c.id} // Use ID from the first occurrence
                      className="p-3 rounded-xl bg-gray-50 hover:bg-indigo-50/40 transition-colors cursor-pointer"
                      onClick={() => navigate('/students')}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                          {totalStudents} students
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {avgProg}%
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {avgAtt}%
                        </span>
                        {totalPending > 0 && (
                          <span className="flex items-center gap-1 text-amber-500 font-medium">
                            <Clock className="w-3 h-3" /> {totalPending}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}