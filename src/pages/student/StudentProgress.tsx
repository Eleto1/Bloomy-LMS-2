import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, Clock, Target, Award, BookOpen, BarChart3,
  CalendarDays, Star, Loader2, ChevronRight, HelpCircle,
  ClipboardList, FileText, Video, Globe, Trophy, TrendingUp,
  Flame, Lock, AlertCircle, GraduationCap
} from 'lucide-react';

interface Module   { id: string; title: string; order_index: number; unlock_date?: string; }
interface Lesson   { id: string; title: string; type: string; module_id: string; order_index: number; }
interface Progress { lesson_id: string; completed: boolean; score?: number | null; completed_at?: string | null; time_spent?: number | null; }
interface Schedule { id: string; days: string[]; time: string; meeting_url: string; }
interface SurveyResp { lesson_id: string; rating: number | null; answers: any[]; created_at: string; }
interface AssignSub  { lesson_id: string; score: number | null; status: string; submitted_at: string; feedback: string | null; submission_type: string; }

const LESSON_ICONS: Record<string, React.ElementType> = {
  text: FileText, video: Video, quiz: HelpCircle,
  survey: ClipboardList, assignment: ClipboardList, url: Globe,
  final_exam: Trophy,
};

function getTypeLabel(type: string): string {
  if (type === 'quiz') return 'Quiz';
  if (type === 'assignment') return 'Assignment';
  if (type === 'final_exam') return 'Final Exam';
  return type;
}

function getTypeBadgeColor(type: string): string {
  if (type === 'quiz') return 'bg-amber-50 text-amber-700';
  if (type === 'assignment') return 'bg-blue-50 text-blue-700';
  if (type === 'final_exam') return 'bg-rose-50 text-rose-700';
  return 'bg-gray-50 text-gray-700';
}

function getTypeSmallBadgeColor(type: string): string {
  if (type === 'quiz') return 'bg-amber-50 text-amber-600';
  if (type === 'assignment') return 'bg-blue-50 text-blue-600';
  if (type === 'final_exam') return 'bg-rose-50 text-rose-600';
  return 'bg-gray-50 text-gray-600';
}

function formatTime(s: number): string {
  if (!s || s <= 0) return '0s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function StudentProgress() {
  const navigate = useNavigate();
  const [userId,      setUserId]      = useState('');
  const [courseId,    setCourseId]    = useState('');
  const [courseName,  setCourseName]  = useState('');
  const [modules,     setModules]     = useState<Module[]>([]);
  const [lessons,     setLessons]     = useState<Lesson[]>([]);
  const [progress,    setProgress]    = useState<Progress[]>([]);
  const [schedules,   setSchedules]   = useState<Schedule[]>([]);
  const [surveys,     setSurveys]     = useState<SurveyResp[]>([]);
  const [assignments, setAssignments] = useState<AssignSub[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [expandedMod, setExpandedMod] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }
      setUserId(user.id);
      console.log('[StudentProgress] Logged in as:', user.email, 'id:', user.id);

      // ── 1. Profile + Cohort (resilient 3-layer fallback) ──────────────────
      let program = '';
      let cohortData: any = null;

      // Step 1: Try with cohort join
      const { data: prof, error: profErr } = await supabase
        .from('profiles').select('*, cohorts(name, course)').eq('id', user.id).single();

      if (profErr) {
        console.warn('[StudentProgress] Profile+cohort join failed:', profErr.message);
        // Step 2: Retry without cohort join
        const retry = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (retry.error) {
          console.error('[StudentProgress] Profile missing entirely:', retry.error.message);
          // Auto-create profile from auth metadata
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
            console.error('[StudentProgress] Auto-create failed:', insertErr.message);
            setError('Profile not found. Please contact your administrator.');
            setLoading(false); return;
          }
          console.log('[StudentProgress] Auto-created profile for:', user.email);
          // No cohort_id on auto-created profile — try to auto-assign below
        } else {
          console.log('[StudentProgress] Profile found without cohort join, cohort_id:', retry.data?.cohort_id);
          // Profile exists but join failed — fetch cohort manually if cohort_id exists
          if (retry.data?.cohort_id) {
            const { data: cohort } = await supabase
              .from('cohorts').select('name, course').eq('id', retry.data.cohort_id).single();
            if (cohort) {
              cohortData = cohort;
              program = cohort.course;
              console.log('[StudentProgress] Program from manual cohort fetch:', program);
            } else {
              console.error('[StudentProgress] Cohort not found for id:', retry.data.cohort_id);
            }
          }
        }
      } else if (prof) {
        cohortData = (prof as any).cohorts;
        program = cohortData?.course || '';
        console.log('[StudentProgress] Program from join:', program, '| cohort_id:', prof.cohort_id);

        if (!program && prof.cohort_id) {
          // Join returned data but no course field — fetch manually
          const { data: cohort } = await supabase
            .from('cohorts').select('name, course').eq('id', prof.cohort_id).single();
          if (cohort) { program = cohort.course; console.log('[StudentProgress] Program from manual fetch:', program); }
        }
      }

      // Step 3: No cohort_id at all — try to auto-assign
      if (!program) {
        console.warn('[StudentProgress] No program found. Trying to auto-assign cohort...');
        const { data: allCohorts } = await supabase.from('cohorts').select('id, name, course').limit(10);
        if (allCohorts && allCohorts.length > 0) {
          const firstCohort = allCohorts[0];
          program = firstCohort.course;
          cohortData = firstCohort;
          const { error: updateErr } = await supabase
            .from('profiles').update({ cohort_id: firstCohort.id }).eq('id', user.id);
          if (updateErr) console.error('[StudentProgress] Could not update cohort_id:', updateErr.message);
          else console.log('[StudentProgress] Auto-assigned cohort:', firstCohort.name, '→ program:', program);
        }
      }

      if (!program) {
        console.error('[StudentProgress] No program could be determined');
        setError('Your profile is not linked to a cohort. Please contact your administrator.');
        setLoading(false); return;
      }

      // ── 2. Course — try Active, fall back to any ───────────────────────────
      console.log('[StudentProgress] Searching courses for program:', program);
      let courseData: { id: string; title: string } | null = null;
      const { data: active, error: activeErr } = await supabase
        .from('courses').select('id, title').eq('program', program).eq('status', 'Active').maybeSingle();
      if (activeErr) console.warn('[StudentProgress] Active course query error:', activeErr.message);

      if (active) {
        courseData = active;
        console.log('[StudentProgress] Found active course:', active.title);
      } else {
        const { data: any_, error: anyErr } = await supabase
          .from('courses').select('id, title').eq('program', program).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (anyErr) console.warn('[StudentProgress] Fallback course query error:', anyErr.message);
        courseData = any_;
        if (courseData) console.log('[StudentProgress] Found fallback course:', courseData.title);
      }

      if (!courseData) {
        const { data: allCourses } = await supabase.from('courses').select('id, title, program, status').limit(20);
        console.error('[StudentProgress] No course for program:', program, '| All courses:', allCourses);
        setError(`No course found for "${program}".`);
        setLoading(false); return;
      }
      setCourseId(courseData.id);
      setCourseName(courseData.title);

      // ── 3. Modules ────────────────────────────────────────────────────────
      const { data: mods, error: modsErr } = await supabase
        .from('modules').select('*').eq('course_id', courseData.id).order('order_index');
      if (modsErr) console.warn('[StudentProgress] Modules error:', modsErr.message);
      const modList = mods || [];
      setModules(modList);
      console.log('[StudentProgress] Modules found:', modList.length);
      if (!modList.length) { setLoading(false); return; }

      // ── 4. Lessons ────────────────────────────────────────────────────────
      const { data: lessData, error: lessErr } = await supabase
        .from('lessons').select('id, title, type, module_id, order_index')
        .in('module_id', modList.map(m => m.id)).order('order_index');
      if (lessErr) console.warn('[StudentProgress] Lessons error:', lessErr.message);
      setLessons(lessData || []);
      console.log('[StudentProgress] Lessons found:', (lessData || []).length);
      // Debug: show all unique lesson types
      const allTypes = [...new Set((lessData || []).map(l => l.type))];
      console.log('[StudentProgress] Lesson types found:', allTypes);
      // Debug: show all lessons with their types
      (lessData || []).forEach(l => console.log('  Lesson:', l.title, '| type:', l.type, '| id:', l.id));

      // ── 5. All remaining data in parallel ─────────────────────────────────
      const [progRes, schedRes, survRes, assignRes] = await Promise.all([
        supabase.from('lesson_progress').select('*').eq('user_id', user.id),
        supabase.from('schedules').select('*').eq('course_id', courseData.id),
        supabase.from('survey_responses').select('lesson_id, rating, answers, created_at').eq('user_id', user.id),
        supabase.from('assignment_submissions').select('lesson_id, score, status, submitted_at, feedback, submission_type').eq('user_id', user.id),
      ]);
      setProgress(progRes.data || []);
      setSchedules(schedRes.data || []);
      setSurveys(survRes.data || []);
      setAssignments(assignRes.data || []);
      console.log('[StudentProgress] Progress:', (progRes.data || []).length, 'Schedules:', (schedRes.data || []).length, 'Surveys:', (survRes.data || []).length, 'Assignments:', (assignRes.data || []).length);
      // Debug: show all progress records with scores
      (progRes.data || []).forEach(p => console.log('  Progress: lesson_id=', p.lesson_id, '| score=', p.score, '| completed=', p.completed, '| completed_at=', p.completed_at));
      (assignRes.data || []).forEach(a => console.log('  Assignment: lesson_id=', a.lesson_id, '| score=', a.score, '| status=', a.status, '| type=', a.submission_type));
      console.log('[StudentProgress] ✅ Data load complete');

    } catch (e: any) {
      console.error('[StudentProgress] Uncaught error:', e);
      setError(e.message || 'Failed to load progress');
    } finally { setLoading(false); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const nonHeaders     = lessons.filter(l => l.type !== 'header');
  const completedIds   = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const totalLessons   = nonHeaders.length;
  const doneLessons    = nonHeaders.filter(l => completedIds.has(l.id)).length;
  const overallPct     = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  // Quizzes
  const quizLessons    = nonHeaders.filter(l => l.type === 'quiz');
  const quizProgress   = quizLessons.map(l => progress.find(p => p.lesson_id === l.id && p.score !== null)).filter(Boolean) as Progress[];
  const avgScore       = quizProgress.length > 0 ? Math.round(quizProgress.reduce((a, c) => a + (c.score || 0), 0) / quizProgress.length) : null;
  const passedQuizzes  = quizProgress.filter(q => (q.score || 0) >= 70).length;

  // Time
  const totalSecs      = progress.reduce((a, p) => a + (p.time_spent || 0), 0);

  // Surveys
  const surveyLessons  = nonHeaders.filter(l => l.type === 'survey');
  const surveysDone    = surveyLessons.filter(l => completedIds.has(l.id)).length;
  const ratings        = surveys.map(s => s.rating).filter((r): r is number => r !== null && r > 0);
  const avgRating      = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;

  // Assignments
  const assignLessons  = nonHeaders.filter(l => l.type === 'assignment');
  const assignDone     = assignLessons.filter(l => assignments.some(a => a.lesson_id === l.id)).length;
  const gradedAssigns  = assignments.filter(a => a.score !== null);
  const avgAssignScore = gradedAssigns.length > 0 ? Math.round(gradedAssigns.reduce((a, c) => a + (c.score || 0), 0) / gradedAssigns.length) : null;

  // Module progress
  const modProgress = modules.map(mod => {
    const modLess   = nonHeaders.filter(l => l.module_id === mod.id);
    const done      = modLess.filter(l => completedIds.has(l.id)).length;
    const pct       = modLess.length > 0 ? Math.round((done / modLess.length) * 100) : 0;
    const complete  = pct === 100 && modLess.length > 0;
    const locked    = !!mod.unlock_date && new Date(mod.unlock_date) > new Date();
    return { mod, lessons: modLess, done, total: modLess.length, pct, complete, locked };
  });
  const completedMods = modProgress.filter(m => m.complete).length;

  // Activity chart — last 14 days
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: d.toDateString(), label: d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }), count: 0 };
  });
  progress.filter(p => p.completed && p.completed_at).forEach(p => {
    const slot = last14.find(d => d.date === new Date(p.completed_at!).toDateString());
    if (slot) slot.count++;
  });
  const maxCount = Math.max(...last14.map(d => d.count), 1);

  // 7-day streak
  const last7  = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toDateString(); });
  const streak = last7.filter(day => progress.some(p => p.completed_at && new Date(p.completed_at).toDateString() === day)).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-500">Loading your progress...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={fetchData} className="mt-4" variant="outline">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6 bg-gray-50/40 min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>
          <p className="text-gray-500 text-sm mt-0.5">{courseName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/student/gradebook')} variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
            <GraduationCap className="w-4 h-4 mr-1.5" /> View Gradebook
          </Button>
          {courseId && (
            <Button onClick={() => navigate(`/student/learn/${courseId}`)} className="bg-indigo-600 hover:bg-indigo-700">
              Continue Learning <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Hero progress card ──────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Big ring */}
            <div className="flex-shrink-0">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                <circle cx="70" cy="70" r="58" fill="none" stroke="white" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - overallPct / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" className="transition-all duration-1000" />
                <text x="70" y="62" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">{overallPct}%</text>
                <text x="70" y="78" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">COMPLETE</text>
                {overallPct === 100 && (
                  <text x="70" y="96" textAnchor="middle" fontSize="16">🏆</text>
                )}
              </svg>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 flex-1 w-full">
              {[
                { label: 'Lessons Done',    value: `${doneLessons}/${totalLessons}` },
                { label: 'Time Spent',      value: formatTime(totalSecs) },
                { label: 'Modules Done',    value: `${completedMods}/${modules.length}` },
                { label: 'Streak',          value: `${streak} day${streak !== 1 ? 's' : ''}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 rounded-xl p-3">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-white/60 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score row */}
        <div className="grid grid-cols-3 divide-x border-t bg-white">
          {[
            { label: 'Quiz Average',    value: avgScore !== null ? `${avgScore}%` : '—',  color: avgScore !== null && avgScore >= 70 ? 'text-emerald-600' : avgScore !== null ? 'text-red-500' : 'text-gray-400', icon: HelpCircle },
            { label: 'Surveys Done',    value: `${surveysDone}/${surveyLessons.length}`,   color: 'text-purple-600',  icon: ClipboardList },
            { label: 'Avg Rating',      value: avgRating !== null ? `${avgRating}★` : '—', color: 'text-amber-500',   icon: Star },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="p-4 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Activity Chart ──────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> Activity — Last 14 Days
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-medium">
              <Flame className="w-3.5 h-3.5" /> {streak}-day streak
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-20">
            {last14.map((day, i) => {
              const h     = day.count > 0 ? Math.max((day.count / maxCount) * 100, 12) : 0;
              const today = day.date === new Date().toDateString();
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  {day.count > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {day.count} lesson{day.count > 1 ? 's' : ''}
                    </div>
                  )}
                  <div className="w-full flex items-end h-16">
                    <div className={`w-full rounded-t-md transition-all duration-500 ${
                      day.count === 0 ? 'h-px bg-gray-100' : today ? 'bg-indigo-600' : 'bg-indigo-300'
                    }`} style={{ height: day.count > 0 ? `${h}%` : '2px' }} />
                  </div>
                  {(i === 0 || i === 7 || i === 13 || today) && (
                    <span className={`text-[9px] whitespace-nowrap mt-1 ${today ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                      {today ? 'Today' : day.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Module Breakdown (expandable) ───────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" /> Module Breakdown
            <span className="ml-auto text-xs font-normal text-gray-400">{completedMods}/{modules.length} complete</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {modProgress.map(({ mod, lessons: modLess, done, total, pct, complete, locked }) => (
            <div key={mod.id} className={`rounded-xl border overflow-hidden transition-all ${complete ? 'border-emerald-200' : 'border-gray-100'}`}>
              <button
                className={`w-full flex items-center justify-between p-3.5 text-left transition-colors ${
                  complete ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-white hover:bg-gray-50'
                } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => !locked && setExpandedMod(expandedMod === mod.id ? null : mod.id)}
                disabled={locked}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    complete ? 'bg-emerald-500 text-white' : locked ? 'bg-gray-200 text-gray-400' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {complete ? '✓' : locked ? <Lock className="w-3.5 h-3.5" /> : mod.order_index + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${complete ? 'text-emerald-800' : 'text-gray-800'}`}>{mod.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {locked && mod.unlock_date
                        ? `Unlocks ${new Date(mod.unlock_date).toLocaleDateString()}`
                        : `${done}/${total} lessons`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${complete ? 'text-emerald-600' : pct > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>{pct}%</p>
                  </div>
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="10" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                    <circle cx="14" cy="14" r="10" fill="none"
                      stroke={complete ? '#10b981' : '#6366f1'} strokeWidth="3.5"
                      strokeDasharray={`${2 * Math.PI * 10}`}
                      strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct / 100)}`}
                      strokeLinecap="round" transform="rotate(-90 14 14)" />
                  </svg>
                </div>
              </button>

              {expandedMod === mod.id && !locked && (
                <div className="border-t bg-gray-50/50">
                  {modLess.map(lesson => {
                    const prog   = progress.find(p => p.lesson_id === lesson.id);
                    const done_  = completedIds.has(lesson.id);
                    const Icon   = LESSON_ICONS[lesson.type] || FileText;
                    const assign = assignments.find(a => a.lesson_id === lesson.id);
                    const survey = surveys.find(s => s.lesson_id === lesson.id);
                    return (
                      <div key={lesson.id} className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 ${done_ ? 'opacity-70' : ''}`}>
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${done_ ? 'bg-emerald-100' : 'bg-white border'}`}>
                          {done_ ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Icon className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${done_ ? 'text-gray-500 line-through' : 'text-gray-800'} truncate`}>{lesson.title}</p>
                          <p className="text-xs text-gray-400 capitalize">{lesson.type === 'url' ? 'Link' : lesson.type}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(lesson.type === 'quiz' || lesson.type === 'final_exam') && prog?.score !== null && prog?.score !== undefined && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prog.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {prog.score}%
                            </span>
                          )}
                          {lesson.type === 'survey' && survey?.rating && (
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(r => <Star key={r} className={`w-3 h-3 ${r<=survey.rating!?'text-amber-400 fill-amber-400':'text-gray-200'}`}/>)}
                            </div>
                          )}
                          {lesson.type === 'assignment' && assign && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              assign.score !== null ? (assign.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')
                              : 'bg-amber-100 text-amber-700'}`}>
                              {assign.score !== null ? `${assign.score}%` : 'Submitted'}
                            </span>
                          )}
                          {lesson.type === 'final_exam' && prog?.completed && prog?.score === null && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              Awaiting Grade
                            </span>
                          )}
                          {prog?.completed_at && (
                            <span className="text-[10px] text-gray-400">
                              {new Date(prog.completed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Quiz Results ────────────────────────────────────────────────────── */}
      {quizLessons.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500" /> Quiz Results
              {avgScore !== null && (
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${avgScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  Avg: {avgScore}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizProgress.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No quizzes completed yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quizLessons.map(lesson => {
                  const prog = progress.find(p => p.lesson_id === lesson.id);
                  const done = !!prog?.completed;
                  const score = prog?.score ?? null;
                  return (
                    <div key={lesson.id} className={`flex items-center justify-between p-3 rounded-xl border ${done ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          !done ? 'bg-gray-100' : score !== null && score >= 70 ? 'bg-emerald-100' : score !== null ? 'bg-red-100' : 'bg-purple-100'
                        }`}>
                          <HelpCircle className={`w-4 h-4 ${!done ? 'text-gray-400' : score !== null && score >= 70 ? 'text-emerald-600' : score !== null ? 'text-red-500' : 'text-purple-600'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{lesson.title}</p>
                          <p className="text-xs text-gray-400">
                            {!done ? 'Not attempted' : prog?.completed_at ? new Date(prog.completed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Completed'}
                          </p>
                        </div>
                      </div>
                      {done && score !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${score >= s*20 ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}/>)}
                          </div>
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{score}%</span>
                        </div>
                      ) : done ? (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">No score</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Survey Responses ────────────────────────────────────────────────── */}
      {surveyLessons.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-500" /> Survey Responses
              {avgRating && <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{avgRating}★ avg</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {surveys.length === 0 ? (
              <div className="text-center py-6">
                <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No surveys submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {surveyLessons.map(lesson => {
                  const sr = surveys.find(s => s.lesson_id === lesson.id);
                  const done = completedIds.has(lesson.id);
                  return (
                    <div key={lesson.id} className={`p-4 rounded-xl border ${done ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{lesson.title}</p>
                          {sr ? (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Submitted {new Date(sr.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">Not submitted</p>
                          )}
                        </div>
                        {sr?.rating && (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(r => <Star key={r} className={`w-4 h-4 ${r<=sr.rating!?'text-amber-400 fill-amber-400':'text-gray-200'}`}/>)}
                            </div>
                            <span className="text-xs font-bold text-amber-600">{sr.rating}/5</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Assignment Status ────────────────────────────────────────────────── */}
      {assignLessons.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-500" /> Assignments
              {avgAssignScore !== null && (
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${avgAssignScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  Avg: {avgAssignScore}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignLessons.map(lesson => {
                const sub = assignments.find(a => a.lesson_id === lesson.id);
                return (
                  <div key={lesson.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sub ? sub.score !== null ? (sub.score >= 70 ? 'bg-emerald-100' : 'bg-red-100') : 'bg-amber-100' : 'bg-gray-100'}`}>
                        <ClipboardList className={`w-4 h-4 ${sub ? sub.score !== null ? (sub.score >= 70 ? 'text-emerald-600' : 'text-red-500') : 'text-amber-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{lesson.title}</p>
                        <p className="text-xs text-gray-400">
                          {sub ? `Submitted ${new Date(sub.submitted_at).toLocaleDateString()}` : 'Not submitted'}
                        </p>
                        {sub?.feedback && <p className="text-xs text-indigo-600 mt-0.5 italic">"{sub.feedback}"</p>}
                      </div>
                    </div>
                    {sub ? (
                      sub.score !== null
                        ? <span className={`text-sm font-bold px-3 py-1 rounded-lg ${sub.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{sub.score}%</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 font-medium px-3 py-1 rounded-lg">Awaiting grade</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Weekly Schedule ─────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" /> Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No classes scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                const daySched = schedules.filter(s => s.days?.includes(day));
                if (daySched.length === 0) return null;
                const isToday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()] === day;
                return (
                  <div key={day} className={`flex items-center gap-4 p-3 rounded-xl ${isToday ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'}`}>
                    <div className={`w-12 text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {day}{isToday && <span className="block text-[10px] font-normal text-indigo-400">Today</span>}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {daySched.map(s => (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">{s.time}</span>
                          {s.meeting_url && (
                            <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="text-xs h-7 px-3">Join</Button>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
