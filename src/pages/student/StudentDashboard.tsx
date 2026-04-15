import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  BookOpen, CheckCircle2, Clock, CalendarDays, TrendingUp,
  PlayCircle, Award, ChevronRight, Star, Zap, Target,
  Flame, HelpCircle, ClipboardList, FileText, Video,
  BarChart3, Trophy, ArrowRight, Loader2
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Profile   { id: string; full_name: string; email: string; cohort_id: string; cohorts?: { name: string; course: string } | null; }
interface Course    { id: string; title: string; program: string; description: string; status: string; }
interface Module    { id: string; title: string; order_index: number; }
interface Lesson    { id: string; title: string; type: string; module_id: string; }
interface Progress  { lesson_id: string; completed: boolean; score?: number | null; completed_at?: string | null; time_spent?: number | null; }
interface Schedule  { id: string; days: string[]; time: string; meeting_url: string; }
interface SurveyResp{ lesson_id: string; rating: number | null; created_at: string; }

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText, video: Video, quiz: HelpCircle,
  survey: ClipboardList, assignment: ClipboardList,
};

// ── Time-based greeting ───────────────────────────────────────────────────────
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Mini progress ring ─────────────────────────────────────────────────────────
function Ring({ pct, size = 56, stroke = 5, color = '#6366f1' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size*0.22} fontWeight="bold">{pct}%</text>
    </svg>
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [course,    setCourse]    = useState<Course | null>(null);
  const [modules,   setModules]   = useState<Module[]>([]);
  const [lessons,   setLessons]   = useState<Lesson[]>([]);
  const [progress,  setProgress]  = useState<Progress[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [surveys,   setSurveys]   = useState<SurveyResp[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }
      console.log('[Dashboard] Logged in as:', user.email, 'id:', user.id);

      // ── 1. Profile + cohort ──────────────────────────────────────────────
      let { data: prof, error: profErr } = await supabase
        .from('profiles').select('*, cohorts(name, course)').eq('id', user.id).single();

      if (profErr) {
        console.warn('[Dashboard] Profile+cohort join failed:', profErr.message, profErr.code);
        const retry = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (retry.error) {
          console.error('[Dashboard] Profile row missing entirely:', retry.error.message);
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
            console.error('[Dashboard] Auto-create failed:', insertErr.message);
            setError('Profile not found. Please contact your administrator.'); setLoading(false); return;
          }
          prof = newProf;
          console.log('[Dashboard] Auto-created profile for:', user.email);
        } else {
          prof = retry.data;
          console.log('[Dashboard] Profile found (cohort join failed, loaded without it)');
        }
      }

      if (!prof) { setError('Profile not found'); setLoading(false); return; }
      setProfile(prof as Profile);
      console.log('[Dashboard] Profile:', {
        full_name: prof.full_name,
        email: prof.email,
        role: (prof as any).role,
        cohort_id: prof.cohort_id,
      });

      // ── 1b. Resolve program from cohort ─────────────────────────────────
      let program = '';
      let cohortData = (prof as any).cohorts;

      if (cohortData?.course) {
        program = cohortData.course;
        console.log('[Dashboard] Program from cohort join:', program);
      } else if (prof.cohort_id) {
        console.log('[Dashboard] cohort_id exists but join returned nothing. Fetching cohort manually...');
        const { data: cohort } = await supabase
          .from('cohorts').select('name, course').eq('id', prof.cohort_id).single();
        if (cohort) {
          cohortData = cohort;
          program = cohort.course;
          console.log('[Dashboard] Program from manual cohort fetch:', program);
        } else {
          console.error('[Dashboard] Cohort not found for id:', prof.cohort_id);
        }
      } else {
        console.warn('[Dashboard] Profile has no cohort_id. Trying to auto-assign...');
        const { data: allCohorts } = await supabase
          .from('cohorts').select('id, name, course').limit(10);
        if (allCohorts && allCohorts.length > 0) {
          const firstCohort = allCohorts[0];
          cohortData = firstCohort;
          program = firstCohort.course;
          const { error: updateErr } = await supabase
            .from('profiles').update({ cohort_id: firstCohort.id }).eq('id', user.id);
          if (updateErr) console.error('[Dashboard] Could not update cohort_id:', updateErr.message);
          else console.log('[Dashboard] Auto-assigned cohort:', firstCohort.name, '→ program:', program);
        }
      }

      if (!program) {
        console.error('[Dashboard] No program could be determined. Full profile:', JSON.stringify(prof));
        setError('Your profile is not linked to a cohort. Please contact your administrator.');
        setLoading(false); return;
      }

      // ── 2. Course — try Active first, fall back to any status ────────────
      console.log('[Dashboard] Searching courses for program:', program);
      let courseData: Course | null = null;
      const { data: activeCourse, error: activeErr } = await supabase
        .from('courses').select('*').eq('program', program).eq('status', 'Active').maybeSingle();
      if (activeErr) console.warn('[Dashboard] Active course query error:', activeErr.message);

      if (activeCourse) {
        courseData = activeCourse;
        console.log('[Dashboard] Found active course:', activeCourse.title, 'id:', activeCourse.id);
      } else {
        const { data: anyCourse, error: anyErr } = await supabase
          .from('courses').select('*').eq('program', program).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (anyErr) console.warn('[Dashboard] Any course query error:', anyErr.message);
        courseData = anyCourse;
        if (courseData) console.log('[Dashboard] Found fallback course:', courseData.title);
      }

      if (!courseData) {
        const { data: allCourses } = await supabase.from('courses').select('id, title, program, status').limit(20);
        console.error('[Dashboard] No course found for program:', program);
        console.log('[Dashboard] All courses in DB:', allCourses);
        setError(`No course found for "${program}". Available: ${(allCourses || []).map((c: any) => c.program).join(', ') || 'none'}`);
        setLoading(false); return;
      }
      setCourse(courseData);

      // ── 3. Modules ───────────────────────────────────────────────────────
      const { data: mods, error: modsErr } = await supabase
        .from('modules').select('id, title, order_index').eq('course_id', courseData.id).order('order_index');
      if (modsErr) console.warn('[Dashboard] Modules query error:', modsErr.message);
      const modList = mods || [];
      setModules(modList);
      console.log('[Dashboard] Modules found:', modList.length);
      if (!modList.length) {
        console.warn('[Dashboard] No modules for course:', courseData.id, courseData.title);
      }

      // ── 4. Lessons ───────────────────────────────────────────────────────
      if (modList.length > 0) {
        const { data: lessData, error: lessErr } = await supabase
          .from('lessons').select('id, title, type, module_id')
          .in('module_id', modList.map(m => m.id)).order('order_index');
        if (lessErr) console.warn('[Dashboard] Lessons query error:', lessErr.message);
        setLessons(lessData || []);
        console.log('[Dashboard] Lessons found:', (lessData || []).length);
      }

      // ── 5. Progress, schedules, survey responses — all in parallel ────────
      const [progRes, schedRes, survRes] = await Promise.all([
        supabase.from('lesson_progress').select('lesson_id, completed, score, completed_at, time_spent').eq('user_id', user.id),
        supabase.from('schedules').select('id, days, time, meeting_url').eq('course_id', courseData.id),
        supabase.from('survey_responses').select('lesson_id, rating, created_at').eq('user_id', user.id),
      ]);
      setProgress(progRes.data || []);
      setSchedules(schedRes.data || []);
      setSurveys(survRes.data || []);
      console.log('[Dashboard] Progress:', (progRes.data || []).length, 'Schedules:', (schedRes.data || []).length, 'Surveys:', (survRes.data || []).length);
      console.log('[Dashboard] ✅ Data load complete');

    } catch (e: any) { console.error('[Dashboard] Uncaught error:', e); setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const countableLessons = lessons.filter(l => l.type !== 'header');
  const completedIds     = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const totalLessons     = countableLessons.length;
  const doneLessons      = countableLessons.filter(l => completedIds.has(l.id)).length;
  const completionPct    = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  const quizLessonIds = new Set(lessons.filter(l => l.type === 'quiz').map(l => l.id));
  const quizProgress  = progress.filter(p => quizLessonIds.has(p.lesson_id) && p.score !== null && p.score !== undefined);
  const avgQuizScore  = quizProgress.length > 0
    ? Math.round(quizProgress.reduce((a, c) => a + (c.score || 0), 0) / quizProgress.length)
    : null;

  const ratings       = surveys.map(s => s.rating).filter((r): r is number => r !== null && r > 0);
  const avgRating     = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;

  const surveyLessonIds = new Set(lessons.filter(l => l.type === 'survey').map(l => l.id));
  const surveysDone = [...completedIds].filter(id => surveyLessonIds.has(id)).length;
  const surveysTotal = lessons.filter(l => l.type === 'survey').length;

  const totalSecs = progress.reduce((a, p) => a + (p.time_spent || 0), 0);
  const timeStr   = totalSecs < 60 ? `${totalSecs}s` : totalSecs < 3600
    ? `${Math.floor(totalSecs / 60)}m` : `${(totalSecs / 3600).toFixed(1)}h`;

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toDateString(); });
  const streak = last7.filter(day => progress.some(p => p.completed_at && new Date(p.completed_at).toDateString() === day)).length;

  const nextLesson = countableLessons.find(l => !completedIds.has(l.id));

  const todayDay   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
  const todaySched = schedules.filter(s => s.days?.includes(todayDay));

  const recentDone = progress
    .filter(p => p.completed && p.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 5)
    .map(p => ({ ...p, lesson: countableLessons.find(l => l.id === p.lesson_id) }))
    .filter(p => p.lesson);

  const moduleProgress = modules.map(mod => {
    const modLessons = countableLessons.filter(l => l.module_id === mod.id);
    const modDone    = modLessons.filter(l => completedIds.has(l.id)).length;
    const pct        = modLessons.length > 0 ? Math.round((modDone / modLessons.length) * 100) : 0;
    return { mod, done: modDone, total: modLessons.length, pct, complete: pct === 100 && modLessons.length > 0 };
  });

  const completedModules = moduleProgress.filter(m => m.complete).length;

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={fetchAll} className="mt-4">Retry</Button>
      </div>
    </div>
  );

  const cohort = (profile?.cohorts as any);
  const cohortName = cohort?.name || cohort?.[0]?.name || '';
  const cohortCourse = cohort?.course || cohort?.[0]?.course || '';

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">

      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-white/5 rounded-full translate-y-20" />

        <div className="relative flex flex-col sm:flex-row justify-between gap-6">
          {/* Left: greeting + cohort */}
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {profile?.full_name || 'Student'}
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Here&apos;s an overview of your classes at Bloomy Technologies.</p>

            {cohortName && (
              <div className="flex items-center gap-2 mt-3">
                <span className="bg-white/15 text-white text-xs px-3 py-1 rounded-full font-medium">{cohortName}</span>
                <span className="bg-white/15 text-white text-xs px-3 py-1 rounded-full font-medium">{cohortCourse}</span>
              </div>
            )}

            {/* Overall progress bar */}
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-xs text-indigo-200 mb-1.5">
                <span>Course Progress</span>
                <span className="font-semibold">{doneLessons}/{totalLessons} lessons</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${completionPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-indigo-200">
                <span>{completionPct}% complete</span>
                <span>{completedModules}/{modules.length} modules done</span>
              </div>
            </div>
          </div>

          {/* Right: ring + CTA */}
          <div className="flex flex-col items-center gap-3">
            <Ring pct={completionPct} size={96} stroke={7} color="white" />
            {course && (
              <Button className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow-lg"
                onClick={() => navigate(`/student/courses/${course.id}${nextLesson ? `?lesson=${nextLesson.id}` : ''}`)}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {nextLesson ? 'Continue' : 'Review Course'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Lessons Done', value: `${doneLessons}/${totalLessons}`,
            sub: `${totalLessons - doneLessons} remaining`,
            icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600',
            bar: completionPct, barColor: '#10b981',
          },
          {
            label: 'Quiz Average', value: avgQuizScore !== null ? `${avgQuizScore}%` : '—',
            sub: `${quizProgress.length} quiz${quizProgress.length !== 1 ? 'zes' : ''} taken`,
            icon: Target, bg: 'bg-amber-50', color: 'text-amber-600',
            bar: avgQuizScore ?? 0, barColor: '#f59e0b',
          },
          {
            label: 'Surveys Done', value: `${surveysDone}/${surveysTotal}`,
            sub: avgRating ? `Avg rating: ${avgRating}★` : 'No ratings yet',
            icon: ClipboardList, bg: 'bg-purple-50', color: 'text-purple-600',
            bar: surveysTotal > 0 ? Math.round((surveysDone / surveysTotal) * 100) : 0, barColor: '#8b5cf6',
          },
          {
            label: '7-Day Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`,
            sub: `${timeStr} total time`,
            icon: Flame, bg: 'bg-orange-50', color: 'text-orange-600',
            bar: Math.round((streak / 7) * 100), barColor: '#f97316',
          },
        ].map(({ label, value, sub, icon: Icon, bg, color, bar, barColor }) => (
          <Card key={label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(bar, 100)}%`, background: barColor }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Module Progress + Schedule ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Module breakdown */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Module Progress
              {completedModules > 0 && (
                <span className="ml-auto text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {completedModules} completed
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {modules.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No modules yet.</p>
              </div>
            ) : moduleProgress.map(({ mod, done, total, pct, complete }) => (
              <div key={mod.id} className={`p-3 rounded-xl border transition-all ${complete ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${complete ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {complete ? '✓' : mod.order_index + 1}
                    </div>
                    <span className={`text-sm font-medium ${complete ? 'text-emerald-800' : 'text-gray-800'}`}>{mod.title}</span>
                  </div>
                  <span className={`text-xs font-bold ${complete ? 'text-emerald-600' : pct > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {done}/{total}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: complete ? '#10b981' : pct > 0 ? '#6366f1' : '#e5e7eb' }} />
                </div>
              </div>
            ))}

            {course && (
              <Button variant="outline" size="sm" className="w-full mt-1"
                onClick={() => navigate(`/student/courses/${course.id}`)}>
                Open Course <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" /> Today&apos;s Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySched.length === 0 ? (
              <div className="text-center py-5">
                <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No classes today</p>
                <p className="text-xs text-gray-300 mt-0.5 capitalize">{todayDay}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySched.map(s => (
                  <div key={s.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-blue-800">{s.time}</span>
                    </div>
                    {s.meeting_url && (
                      <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8">Join Class →</Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {schedules.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-gray-400 mb-2">Weekly schedule</p>
                <div className="grid grid-cols-7 gap-1">
                  {['M','T','W','T','F','S','S'].map((d, i) => {
                    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                    const has = schedules.some(s => s.days?.includes(dayNames[i]));
                    const isToday = dayNames[i] === todayDay;
                    return (
                      <div key={i} className={`h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                        isToday && has ? 'bg-blue-600 text-white'
                        : has          ? 'bg-blue-100 text-blue-700'
                        :                'bg-gray-100 text-gray-300'
                      }`}>{d}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Next Up + Recent Activity ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Next lesson */}
        <Card className={`border-0 shadow-sm ${nextLesson ? 'bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" /> Up Next
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!nextLesson || !course ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <Trophy className="w-10 h-10 text-amber-400" />
                <p className="font-bold text-gray-800">Course Complete!</p>
                <p className="text-xs text-gray-500 text-center">You&apos;ve finished all lessons. Great work!</p>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${
                    nextLesson.type === 'quiz' ? 'bg-amber-100 text-amber-700'
                    : nextLesson.type === 'survey' ? 'bg-purple-100 text-purple-700'
                    : nextLesson.type === 'assignment' ? 'bg-blue-100 text-blue-700'
                    : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {React.createElement(TYPE_ICONS[nextLesson.type] || FileText, { className: 'w-3 h-3' })}
                    <span className="ml-1 capitalize">{nextLesson.type === 'url' ? 'Link' : nextLesson.type}</span>
                  </div>
                  <p className="font-bold text-gray-900 leading-snug">{nextLesson.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {modules.find(m => m.id === nextLesson.module_id)?.title}
                  </p>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
                  onClick={() => navigate(`/student/courses/${course.id}?lesson=${nextLesson.id}`)}>
                  Start <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent completions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Recently Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentDone.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No lessons completed yet.</p>
                <p className="text-xs text-gray-300 mt-0.5">Start learning to see your activity here!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentDone.map(({ lesson, completed_at, score }) => lesson && (
                  <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      lesson.type === 'quiz' ? 'bg-amber-100' : lesson.type === 'survey' ? 'bg-purple-100' : 'bg-emerald-100'
                    }`}>
                      {React.createElement(lesson.type === 'quiz' ? HelpCircle : lesson.type === 'survey' ? ClipboardList : CheckCircle2, {
                        className: `w-4 h-4 ${lesson.type === 'quiz' ? 'text-amber-600' : lesson.type === 'survey' ? 'text-purple-600' : 'text-emerald-600'}`
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{lesson.title}</p>
                      <p className="text-xs text-gray-400">
                        {completed_at ? new Date(completed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''}
                      </p>
                    </div>
                    {score !== null && score !== undefined && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                        score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{score}%</span>
                    )}
                    {lesson.type === 'survey' && score === null && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">Done</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Survey Ratings (if any) ─────────────────────────────────────────── */}
      {surveys.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Your Survey Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {surveys.filter(s => s.rating).map((s, i) => {
                const surveyLesson = lessons.find(l => l.id === s.lesson_id);
                return (
                  <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                    <div className="flex justify-center gap-0.5 mb-1.5">
                      {[1,2,3,4,5].map(r => (
                        <Star key={r} className={`w-3.5 h-3.5 ${r <= (s.rating||0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <p className="text-sm font-bold text-amber-700">{s.rating}/5</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{surveyLesson?.title || 'Survey'}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}