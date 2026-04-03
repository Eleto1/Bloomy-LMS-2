import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import {
  Users, BookOpen, GraduationCap, Star, Layers, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, CalendarDays, Activity,
  Award, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const PROGRAM_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const pct = (val: number, max: number) => (max > 0 ? Math.round((val / max) * 100) : 0);

interface StatCardProps {
  title: string; value: string | number; icon: React.ElementType;
  color: string; trend?: number | null; sub?: string;
}
interface RecentStudent { id: string; full_name: string; email: string; created_at: string; cohort_name?: string; program?: string; }
interface CohortRow { id: string; name: string; course: string; start_date: string; student_count: number; }

function StatCard({ title, value, icon: Icon, color, trend, sub }: StatCardProps) {
  const trendPositive = trend !== null && trend !== undefined && trend > 0;
  const trendNeutral  = trend === null || trend === undefined || trend === 0;
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color.replace('-500', '-100')}`}>
          <Icon className={`h-4 w-4 ${color.replace('bg-', 'text-')}`} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {(sub || trend !== undefined) && (
          <div className="flex items-center gap-1 mt-1">
            {!trendNeutral && (trendPositive
              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />)}
            {trendNeutral && trend === 0 && <Minus className="w-3.5 h-3.5 text-gray-400" />}
            {trend !== null && trend !== undefined && (
              <span className={`text-xs font-medium ${trendPositive ? 'text-emerald-600' : trend === 0 ? 'text-gray-400' : 'text-red-500'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const [stats,          setStats]          = useState({ students: 0, courses: 0, instructors: 0, cohorts: 0, avgRating: 0 });
  const [programStats,   setProgramStats]   = useState<{ name: string; rating: number; responses: number }[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<{ month: string; students: number }[]>([]);
  const [cohortData,     setCohortData]     = useState<CohortRow[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [programDist,    setProgramDist]    = useState<{ name: string; value: number }[]>([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCoreStats(),
        fetchEnrollmentTrend(),
        fetchCohortBreakdown(),
        fetchRecentStudents(),
        fetchProgramDistribution(),
      ]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── 1. Core KPIs ─────────────────────────────────────────────────────────
  const fetchCoreStats = async () => {
    const [{ count: students }, { count: courses }, { count: instructors }, { count: cohorts }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'instructor'),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }),
    ]);

    // ✅ FIX: Only use the `rating` column from survey_responses.
    // This column is populated ONLY from rating-type survey questions
    // (extracted in StudentLearn when a student submits a survey).
    const { data: ratingData, error: ratingErr } = await supabase
      .from('survey_responses')
      .select('rating')
      .not('rating', 'is', null);   // exclude rows where rating wasn't applicable

    let avgRating = 0;
    if (!ratingErr && ratingData && ratingData.length > 0) {
      const sum = ratingData.reduce((acc, r) => acc + (r.rating || 0), 0);
      avgRating = parseFloat((sum / ratingData.length).toFixed(1));
    }

    // ✅ Program performance: avg rating per program
    // Join survey_responses → lessons → modules → courses to get program name
    const { data: progRatings, error: progErr } = await supabase
      .from('survey_responses')
      .select('rating, lessons!inner(modules!inner(courses!inner(program)))')
      .not('rating', 'is', null);

    if (!progErr && progRatings) {
      const map: Record<string, { total: number; count: number }> = {};
      progRatings.forEach((item: any) => {
        // Navigate the nested join result
        const program = item?.lessons?.modules?.courses?.program
          || item?.lessons?.modules?.courses?.[0]?.program
          || 'General';
        if (!map[program]) map[program] = { total: 0, count: 0 };
        map[program].total += item.rating || 0;
        map[program].count += 1;
      });
      setProgramStats(
        Object.entries(map).map(([name, d]) => ({
          name,
          rating:    d.count > 0 ? parseFloat((d.total / d.count).toFixed(1)) : 0,
          responses: d.count,
        })).sort((a, b) => b.rating - a.rating)
      );
    } else {
      // Fallback: try the alias-based join if the above fails
      const { data: fallbackData } = await supabase
        .from('survey_responses')
        .select('rating, lesson:lesson_id ( module:module_id ( course:course_id ( program ) ) )')
        .not('rating', 'is', null);

      if (fallbackData) {
        const map: Record<string, { total: number; count: number }> = {};
        fallbackData.forEach((item: any) => {
          const program = item?.lesson?.module?.course?.program || 'General';
          if (!map[program]) map[program] = { total: 0, count: 0 };
          map[program].total += item.rating || 0;
          map[program].count += 1;
        });
        setProgramStats(
          Object.entries(map).map(([name, d]) => ({
            name,
            rating: d.count > 0 ? parseFloat((d.total / d.count).toFixed(1)) : 0,
            responses: d.count,
          })).sort((a, b) => b.rating - a.rating)
        );
      }
    }

    setStats({ students: students || 0, courses: courses || 0, instructors: instructors || 0, cohorts: cohorts || 0, avgRating });
  };

  // ── 2. Monthly enrollment trend ───────────────────────────────────────────
  const fetchEnrollmentTrend = async () => {
    const { data } = await supabase
      .from('profiles').select('created_at').eq('role', 'student').order('created_at', { ascending: true });
    if (!data) return;

    const monthMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap[d.toLocaleString('default', { month: 'short', year: '2-digit' })] = 0;
    }
    data.forEach(row => {
      const key = new Date(row.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (key in monthMap) monthMap[key]++;
    });
    setEnrollmentData(Object.entries(monthMap).map(([month, students]) => ({ month, students })));
  };

  // ── 3. Cohort breakdown ───────────────────────────────────────────────────
  const fetchCohortBreakdown = async () => {
    const { data: cohorts } = await supabase.from('cohorts').select('*').order('created_at', { ascending: false }).limit(6);
    const { data: students } = await supabase.from('profiles').select('cohort_id').eq('role', 'student');
    if (!cohorts) return;
    const countMap: Record<string, number> = {};
    (students || []).forEach(s => { if (s.cohort_id) countMap[s.cohort_id] = (countMap[s.cohort_id] || 0) + 1; });
    setCohortData(cohorts.map(c => ({ ...c, student_count: countMap[c.id] || 0 })));
  };

  // ── 4. Recent students ────────────────────────────────────────────────────
  const fetchRecentStudents = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, cohort_id, cohorts(name, course)')
      .eq('role', 'student').order('created_at', { ascending: false }).limit(5);

    if (data) {
      setRecentStudents(data.map((s: any) => ({
        id: s.id, full_name: s.full_name, email: s.email, created_at: s.created_at,
        cohort_name: s.cohorts?.[0]?.name || s.cohorts?.name || '—',
        program:     s.cohorts?.[0]?.course || s.cohorts?.course || '—',
      })));
    }
  };

  // ── 5. Program distribution ───────────────────────────────────────────────
  const fetchProgramDistribution = async () => {
    const { data: students } = await supabase
      .from('profiles').select('cohort_id, cohorts(course)').eq('role', 'student');
    if (!students) return;
    const map: Record<string, number> = {};
    students.forEach((s: any) => {
      const prog = s.cohorts?.[0]?.course || s.cohorts?.course || 'Unknown';
      map[prog] = (map[prog] || 0) + 1;
    });
    setProgramDist(Object.entries(map).map(([name, value]) => ({ name, value })));
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const maxStudentsInCohort = Math.max(...cohortData.map(c => c.student_count), 1);
  const currentMonth     = enrollmentData[enrollmentData.length - 1]?.students ?? 0;
  const prevMonth        = enrollmentData[enrollmentData.length - 2]?.students ?? 0;
  const enrollmentTrend  = prevMonth > 0 ? Math.round(((currentMonth - prevMonth) / prevMonth) * 100) : null;

  if (loading) return (
    <div className="p-10 flex flex-col items-center justify-center gap-3 min-h-[400px]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="space-y-6 p-6 bg-gray-50/50 min-h-screen">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back — here's what's happening at Bloomy.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white border rounded-lg px-3 py-2 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          {new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Students"   value={stats.students}    icon={Users}         color="bg-indigo-500" trend={enrollmentTrend} sub="vs last month" />
        <StatCard title="Instructors"      value={stats.instructors} icon={GraduationCap} color="bg-amber-500" />
        <StatCard title="Courses"          value={stats.courses}     icon={BookOpen}      color="bg-emerald-500" />
        <StatCard title="Active Cohorts"   value={stats.cohorts}     icon={Layers}        color="bg-blue-500" />
        <StatCard
          title="Avg Rating"
          value={stats.avgRating > 0 ? `${stats.avgRating} ★` : '—'}
          icon={Star} color="bg-yellow-500"
          sub={stats.avgRating > 0 ? 'from student surveys' : 'No ratings yet'}
        />
      </div>

      {/* ── Enrollment + Pie ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Student Enrollment Trend
            </CardTitle>
            <CardDescription>New students per month (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentData.every(d => d.students === 0) ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No enrollment data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enrollmentData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="students" name="Students" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Students by Program
            </CardTitle>
            <CardDescription>Distribution across programs</CardDescription>
          </CardHeader>
          <CardContent>
            {programDist.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={programDist} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {programDist.map((_, i) => <Cell key={i} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Program Satisfaction + Recent Students ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Program Satisfaction
            </CardTitle>
            {/* ✅ Clear note: only rating-type question answers are used */}
            <CardDescription>Avg rating from student survey responses (⭐ questions only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {programStats.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No survey ratings yet.</div>
            ) : (
              programStats.map((prog, i) => (
                <div key={prog.name} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: PROGRAM_COLORS[i % PROGRAM_COLORS.length] }} />
                      <span className="font-medium">{prog.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">{prog.responses} responses</span>
                      <span className="font-semibold text-gray-800 flex items-center gap-0.5">
                        {prog.rating}
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{ width: `${prog.rating * 20}%`, background: PROGRAM_COLORS[i % PROGRAM_COLORS.length] }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Recent Enrolments
            </CardTitle>
            <CardDescription>Last 5 students who joined</CardDescription>
          </CardHeader>
          <CardContent>
            {recentStudents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No students yet.</div>
            ) : (
              <div className="space-y-3">
                {recentStudents.map((s) => {
                  const initials = s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                  const daysAgo  = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.program || s.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{s.cohort_name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Cohort Breakdown ──────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" /> Cohort Breakdown
          </CardTitle>
          <CardDescription>Student count across most recent cohorts</CardDescription>
        </CardHeader>
        <CardContent>
          {cohortData.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No cohorts found.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cohortData.map((c, i) => {
                const fill  = pct(c.student_count, maxStudentsInCohort);
                const color = PROGRAM_COLORS[i % PROGRAM_COLORS.length];
                return (
                  <div key={c.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.course}</p>
                      </div>
                      <span className="text-lg font-bold" style={{ color }}>{c.student_count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fill}%`, background: color }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No start date'}
                      </span>
                      <span className="text-xs text-muted-foreground">{fill}% of max</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Health Checks ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Student–Instructor Ratio',
            value: stats.instructors > 0 ? `${Math.round(stats.students / stats.instructors)}:1` : 'N/A',
            icon: Users,
            status: stats.instructors > 0 && stats.students / stats.instructors <= 20 ? 'good' : 'warn',
            note: 'Ideal is ≤ 20:1',
          },
          {
            label: 'Courses per Program',
            value: programStats.length > 0 ? (stats.courses / programStats.length).toFixed(1) : '—',
            icon: BookOpen, status: 'info',
            note: `Across ${programStats.length} programs`,
          },
          {
            label: 'Overall Satisfaction',
            value: stats.avgRating >= 4 ? 'Excellent' : stats.avgRating >= 3 ? 'Good' : stats.avgRating > 0 ? 'Needs Work' : '—',
            icon: Star,
            status: stats.avgRating >= 4 ? 'good' : stats.avgRating >= 3 ? 'warn' : 'info',
            note: stats.avgRating > 0 ? `${stats.avgRating}/5.0 avg` : 'No ratings yet',
          },
          {
            label: 'Avg Students / Cohort',
            value: stats.cohorts > 0 ? Math.round(stats.students / stats.cohorts) : '—',
            icon: Layers, status: 'info',
            note: `${stats.cohorts} active cohorts`,
          },
        ].map(({ label, value, icon: Icon, status, note }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-xl font-bold mt-1">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                </div>
                <div className={`p-2 rounded-lg ${status === 'good' ? 'bg-emerald-50' : status === 'warn' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  {status === 'good' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : status === 'warn' ? <AlertCircle className="w-4 h-4 text-amber-500" />
                  : <Icon className="w-4 h-4 text-blue-500" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}