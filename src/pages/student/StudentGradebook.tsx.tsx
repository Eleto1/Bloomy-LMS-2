import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  Loader2, ArrowLeft, GraduationCap, HelpCircle,
  ClipboardList, Trophy, CheckCircle2, Clock, UserCheck, XCircle
} from 'lucide-react';

interface Lesson { id: string; title: string; type: string; module_id: string; order_index: number; }
interface Module { id: string; title: string; order_index: number; }
interface LessonProgress { lesson_id: string; completed: boolean; score: number | null; completed_at: string | null; }
interface AssignSub { lesson_id: string; score: number | null; status: string; submitted_at: string; }
interface CourseAssessment {
  id: string; title: string; type: string; total_marks?: number;
  questions?: { q: string; a: string[]; correct: number }[];
}
interface AssessmentSub {
  user_id: string; assessment_id: string; score: number | null;
  feedback: string | null; status: string; submitted_at: string;
  submission_type: string; content: string | null; file_url: string | null;
}

function getLetterGrade(score: number): string {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}
function getGradeColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  if (score >= 45) return 'bg-orange-100 text-orange-800';
  if (score >= 40) return 'bg-red-100 text-red-700';
  return 'bg-red-200 text-red-900';
}
function getGPA(score: number): number {
  if (score >= 70) return 5.0;
  if (score >= 60) return 4.0;
  if (score >= 50) return 3.0;
  if (score >= 45) return 2.0;
  if (score >= 40) return 1.0;
  return 0.0;
}

export default function StudentGradebook() {
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [quizAvg, setQuizAvg] = useState<number | null>(null);
  const [assignAvg, setAssignAvg] = useState<number | null>(null);
  const [attendAvg, setAttendAvg] = useState<number | null>(null);
  const [finalAvg, setFinalAvg] = useState<number | null>(null);
  const [weighted, setWeighted] = useState<number | null>(null);
  const [totalClasses, setTotalClasses] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [attendDetails, setAttendDetails] = useState<{ date: string; status: string }[]>([]);

  const [quizDetails, setQuizDetails] = useState<{ title: string; score: number | null; completed: boolean }[]>([]);
  const [assignDetails, setAssignDetails] = useState<{ title: string; score: number | null; status: string }[]>([]);
  const [finalDetails, setFinalDetails] = useState<{ title: string; type: string; score: number | null; maxScore: number; status: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }

      // 1. Profile + Cohort (resilient 3-layer fallback)
      let program = '';
      let cohortId = '';
      let cohortData: any = null;

      const { data: prof, error: profErr } = await supabase
        .from('profiles').select('*, cohorts(name, course)').eq('id', user.id).single();

      if (profErr) {
        console.warn('[StudentGradebook] Profile+cohort join failed:', profErr.message);
        const retry = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (retry.error) {
          console.error('[StudentGradebook] Profile missing entirely:', retry.error.message);
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
            console.error('[StudentGradebook] Auto-create failed:', insertErr.message);
            setError('Profile not found. Please contact your administrator.');
            setLoading(false); return;
          }
          console.log('[StudentGradebook] Auto-created profile for:', user.email);
          const reRead = await supabase.from('profiles').select('cohort_id').eq('id', user.id).single();
          if (reRead.data?.cohort_id) cohortId = reRead.data.cohort_id;
        } else {
          console.log('[StudentGradebook] Profile found, cohort_id:', retry.data?.cohort_id);
          cohortId = retry.data?.cohort_id || '';
          if (cohortId) {
            const { data: cohort } = await supabase
              .from('cohorts').select('id, name, course').eq('id', cohortId).single();
            if (cohort) {
              cohortData = cohort;
              program = cohort.course;
              console.log('[StudentGradebook] Program from manual cohort fetch:', program);
            }
          }
        }
      } else if (prof) {
        cohortId = prof.cohort_id || '';
        cohortData = (prof as any).cohorts;
        if (!cohortId && cohortData?.id) cohortId = cohortData.id;
        program = cohortData?.course || '';
        console.log('[StudentGradebook] Program from join:', program, '| cohort_id:', cohortId);

        if (!program && cohortId) {
          const { data: cohort } = await supabase
            .from('cohorts').select('id, name, course').eq('id', cohortId).single();
          if (cohort) { program = cohort.course; cohortData = cohort; console.log('[StudentGradebook] Program from manual fetch:', program); }
        }
      }

      // Auto-assign cohort if none found
      if (!program) {
        console.warn('[StudentGradebook] No program found. Trying to auto-assign cohort...');
        const { data: allCohorts } = await supabase.from('cohorts').select('id, name, course').limit(10);
        if (allCohorts && allCohorts.length > 0) {
          const firstCohort = allCohorts[0];
          program = firstCohort.course;
          cohortData = firstCohort;
          cohortId = firstCohort.id;
          const { error: updateErr } = await supabase
            .from('profiles').update({ cohort_id: firstCohort.id }).eq('id', user.id);
          if (updateErr) console.error('[StudentGradebook] Could not update cohort_id:', updateErr.message);
          else console.log('[StudentGradebook] Auto-assigned cohort:', firstCohort.name, '→ program:', program);
        }
      }

      if (!program) {
        console.error('[StudentGradebook] No program could be determined');
        setError('Your profile is not linked to a cohort. Please contact your administrator.');
        setLoading(false); return;
      }

      // One last attempt to get cohortId if still missing
      if (!cohortId) {
        const { data: profRead } = await supabase.from('profiles').select('cohort_id').eq('id', user.id).single();
        cohortId = profRead?.cohort_id || '';
        console.log('[StudentGradebook] Fallback cohortId from profile:', cohortId);
      }

      // 2. Course — try Active, fall back to any
      console.log('[StudentGradebook] Searching courses for program:', program);
      let course: { id: string; title: string } | null = null;
      const { data: active, error: activeErr } = await supabase
        .from('courses').select('id, title').eq('program', program).eq('status', 'Active').maybeSingle();
      if (activeErr) console.warn('[StudentGradebook] Active course query error:', activeErr.message);
      if (active) {
        course = active;
        console.log('[StudentGradebook] Found active course:', active.title);
      } else {
        const { data: fallback, error: fbErr } = await supabase
          .from('courses').select('id, title').eq('program', program).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (fbErr) console.warn('[StudentGradebook] Fallback course query error:', fbErr.message);
        course = fallback;
        if (course) console.log('[StudentGradebook] Found fallback course:', course.title);
      }
      if (!course) {
        const { data: allCourses } = await supabase.from('courses').select('id, title, program, status').limit(20);
        console.error('[StudentGradebook] No course for program:', program, '| All courses:', allCourses);
        setError(`No course found for "${program}".`);
        setLoading(false); return;
      }
      setCourseId(course.id); setCourseName(course.title);

      // 3. Modules + Lessons
      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
      const modList = mods || [];
      const modIds = modList.map(m => m.id);
      if (modIds.length === 0) { setLoading(false); return; }

      const { data: lessData } = await supabase
        .from('lessons').select('id, title, type, module_id, order_index')
        .in('module_id', modIds).order('order_index');
      const lessonList = lessData || [];

      // 4. All scores in parallel
      const [progRes, assignRes, faAssessRes] = await Promise.all([
        supabase.from('lesson_progress').select('lesson_id, completed, score').eq('user_id', user.id),
        supabase.from('assignment_submissions').select('lesson_id, score, status').eq('user_id', user.id),
        supabase.from('assessments').select('id, title, type, total_marks, questions').eq('course_id', course.id).eq('status', 'published'),
      ]);

      const progRows = (progRes.data || []) as LessonProgress[];
      const assignRows = (assignRes.data || []) as AssignSub[];
      const faList = (faAssessRes.data || []) as CourseAssessment[];

      // Final assessment submissions
      let faSubs: AssessmentSub[] = [];
      if (faList.length > 0) {
        const { data: subs } = await supabase.from('assessment_submissions')
          .select('*').eq('user_id', user.id).in('assessment_id', faList.map(a => a.id));
        faSubs = (subs || []) as AssessmentSub[];
      }

      // ── Quizzes ──
      const quizLessons = lessonList.filter(l => l.type === 'quiz');
      const quizItems = quizLessons.map(l => {
        const p = progRows.find(r => r.lesson_id === l.id);
        return { title: l.title, score: p?.score ?? null, completed: p?.completed ?? false };
      });
      const quizScores = quizItems.map(q => q.score).filter((s): s is number => s !== null);
      const calcQuizAvg: number | null = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

      // ── Assignments ──
      const assignLessons = lessonList.filter(l => l.type === 'assignment');
      const assignItems = assignLessons.map(l => {
        const a = assignRows.find(r => r.lesson_id === l.id);
        return { title: l.title, score: a?.score ?? null, status: a?.status || 'none' };
      });
      const gradedAssigns = assignItems.filter(a => a.score !== null);
      const calcAssignAvg: number | null = gradedAssigns.length > 0 ? Math.round(gradedAssigns.reduce((a, c) => a + c.score!, 0) / gradedAssigns.length) : null;

      // ── Final Assessments ──
      const finalItems = faList.map(assessment => {
        const sub = faSubs.find(s => s.assessment_id === assessment.id);
        const isQuiz = assessment.type === 'Quiz';
        const maxScore = isQuiz ? (assessment.questions?.length || 0) : (assessment.total_marks || 100);
        const pct = sub && sub.score !== null ? Math.round((sub.score / maxScore) * 100) : null;
        return { title: assessment.title, type: assessment.type, score: pct, maxScore, status: sub ? sub.status : 'none' };
      });
      const finalPcts = finalItems.map(f => f.score).filter((s): s is number => s !== null);
      const calcFinalAvg: number | null = finalPcts.length > 0 ? Math.round(finalPcts.reduce((a, b) => a + b, 0) / finalPcts.length) : null;

      // ── Attendance ──
      let calcAttendAvg: number | null = null;
      let calcTotalClasses = 0;
      let calcPresentCount = 0;
      let calcAttendDetails: { date: string; status: string }[] = [];

      if (cohortId) {
        console.log('[StudentGradebook] Fetching attendance for user:', user.id, '| cohort:', cohortId);
        const { data: attendRows, error: attendErr } = await supabase
          .from('attendance')
          .select('student_id, status, date')
          .eq('student_id', user.id)
          .eq('cohort_id', cohortId);
        if (attendErr) console.warn('[StudentGradebook] Attendance error:', attendErr.message);
        const attendList = (attendRows || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        calcTotalClasses = attendList.length;
        calcPresentCount = attendList.filter((r: any) => r.status === 'present' || r.status === 'Present').length;
        calcAttendDetails = attendList.map((r: any) => ({ date: r.date, status: r.status }));
        if (calcTotalClasses > 0) {
          calcAttendAvg = Math.round((calcPresentCount / calcTotalClasses) * 100);
        }
        console.log('[StudentGradebook] Attendance results:', calcPresentCount, '/', calcTotalClasses, '| rows:', attendList.length);
      } else {
        console.warn('[StudentGradebook] No cohortId available — skipping attendance fetch');
      }

      // ── Weighted Grade using LOCAL variables ──
      let wSum = 0;
      let wTot = 0;

      if (calcQuizAvg !== null) { wSum += calcQuizAvg * 0.25; wTot += 0.25; }
      if (calcAssignAvg !== null) { wSum += calcAssignAvg * 0.25; wTot += 0.25; }
      if (calcAttendAvg !== null) { wSum += calcAttendAvg * 0.10; wTot += 0.10; }
      if (calcFinalAvg !== null) { wSum += calcFinalAvg * 0.40; wTot += 0.40; }

      // Redistribute weight if not all 4 categories present
      if (wTot > 0 && wTot < 1) {
        const remaining = 1 - wTot;
        const availableCount = [calcQuizAvg, calcAssignAvg, calcAttendAvg, calcFinalAvg].filter(v => v !== null).length;
        if (availableCount > 0) {
          const perItem = remaining / availableCount;
          if (calcQuizAvg !== null) { wSum += calcQuizAvg * perItem; wTot += perItem; }
          if (calcAssignAvg !== null) { wSum += calcAssignAvg * perItem; wTot += perItem; }
          if (calcAttendAvg !== null) { wSum += calcAttendAvg * perItem; wTot += perItem; }
          if (calcFinalAvg !== null) { wSum += calcFinalAvg * perItem; wTot += perItem; }
        }
      }

      const calcWeighted: number | null = wTot > 0 ? Math.round(wSum) : null;

      console.log('[StudentGradebook] Final calc:', {
        calcQuizAvg, calcAssignAvg, calcAttendAvg, calcFinalAvg,
        wSum, wTot, calcWeighted,
        calcTotalClasses, calcPresentCount
      });

      // ── NOW set all state at once ──
      setQuizDetails(quizItems);
      setAssignDetails(assignItems);
      setFinalDetails(finalItems);
      setQuizAvg(calcQuizAvg);
      setAssignAvg(calcAssignAvg);
      setAttendAvg(calcAttendAvg);
      setFinalAvg(calcFinalAvg);
      setTotalClasses(calcTotalClasses);
      setPresentCount(calcPresentCount);
      setAttendDetails(calcAttendDetails);
      setWeighted(calcWeighted);

    } catch (e: any) {
      console.error('[StudentGradebook] Uncaught error:', e);
      setError(e.message || 'Failed to load gradebook');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      <span className="text-gray-500">Loading gradebook...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={fetchData} className="mt-4" variant="outline">Retry</Button>
      </div>
    </div>
  );

  const grade = weighted !== null ? getLetterGrade(weighted) : '—';
  const gpa = weighted !== null ? getGPA(weighted) : 0;
  const gradeColor = weighted !== null ? getGradeColor(weighted) : 'bg-gray-100 text-gray-500';
  const hasGradedItems = quizDetails.length > 0 || assignDetails.length > 0 || finalDetails.length > 0 || totalClasses > 0;

  return (
    <div className="space-y-5 p-6 bg-gray-50/40 min-h-screen max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" /> My Gradebook
          </h1>
          <p className="text-gray-500 text-sm">{courseName}</p>
        </div>
      </div>

      {!hasGradedItems ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No graded items yet</p>
            <p className="text-gray-400 text-sm mt-1">Your grades will appear here once you complete quizzes, assignments, or exams.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overall Grade */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className={`p-6 text-white ${weighted !== null && weighted >= 70 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : weighted !== null ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black bg-white/20 backdrop-blur-sm`}>
                  {grade}
                </div>
                <div className="flex-1">
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Overall Weighted Grade</p>
                  <p className="text-3xl font-black">{weighted !== null ? `${weighted}%` : 'N/A'}</p>
                  <p className="text-white/70 text-sm mt-0.5">GPA: {gpa.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4 text-sm">
                {[
                  { label: 'Quiz (25%)', value: quizAvg },
                  { label: 'Assign (25%)', value: assignAvg },
                  { label: 'Attend (10%)', value: attendAvg },
                  { label: 'Final (40%)', value: finalAvg },
                ].map(({ label, value }) => (
                  <div key={label} className="flex-1 bg-white/10 rounded-lg px-3 py-2">
                    <p className="text-white/60 text-[10px]">{label}</p>
                    <p className="text-white font-bold">{value !== null ? `${value}%` : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Quizzes */}
          {quizDetails.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" /> Quizzes
                  {quizAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${quizAvg >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      Avg: {quizAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {quizDetails.map((q, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        {q.completed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : <Clock className="w-3.5 h-3.5 text-gray-300" />}
                        <span className="text-sm text-gray-700">{q.title}</span>
                      </div>
                      {q.score !== null ? (
                        <span className={`text-sm font-bold ${q.score >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>{q.score}%</span>
                      ) : q.completed ? (
                        <span className="text-xs text-gray-400">Completed</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assignments */}
          {assignDetails.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-500" /> Assignments
                  {assignAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${assignAvg >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      Avg: {assignAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {assignDetails.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <span className="text-sm text-gray-700">{a.title}</span>
                      {a.score !== null ? (
                        <span className={`text-sm font-bold ${a.score >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>{a.score}%</span>
                      ) : a.status === 'graded' ? (
                        <span className="text-xs text-amber-600">Graded</span>
                      ) : a.status !== 'none' ? (
                        <span className="text-xs text-gray-400">Submitted</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Final Exams / Assessments */}
          {finalDetails.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-rose-500" /> Final Exam
                  {finalAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${finalAvg >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      Avg: {finalAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {finalDetails.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-medium">
                          {f.type === 'Quiz' ? 'Quiz' : f.type === 'File' ? 'File' : 'Exam'}
                        </span>
                        <span className="text-sm text-gray-700">{f.title}</span>
                      </div>
                      {f.score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${f.score >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>{f.score}%</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getGradeColor(f.score)}`}>
                            {getLetterGrade(f.score)}
                          </span>
                        </div>
                      ) : f.status !== 'none' ? (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Awaiting Grade</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance */}
          {totalClasses > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-500" /> Attendance
                  {attendAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${attendAvg >= 75 ? 'bg-emerald-100 text-emerald-700' : attendAvg >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                      {presentCount}/{totalClasses} — {attendAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {attendDetails.map((a, i) => {
                    const isPresent = a.status === 'present' || a.status === 'Present';
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex items-center gap-2">
                          {isPresent
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          <span className="text-sm text-gray-700">
                            {new Date(a.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {isPresent ? 'Present' : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* GPA Summary */}
          {weighted !== null && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Overall Score</p>
                    <p className="text-2xl font-black text-indigo-700">{weighted}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Letter Grade</p>
                    <span className={`text-2xl font-black px-3 py-0.5 rounded-lg ${getGradeColor(weighted)}`}>{grade}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">GPA</p>
                    <p className={`text-2xl font-black ${weighted >= 70 ? 'text-emerald-600' : weighted >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {gpa.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400">out of 5.00</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-4 gap-y-1 justify-center">
                  {[
                    { l: 'A', g: '5.00', c: 'text-emerald-600' },
                    { l: 'B', g: '4.00', c: 'text-blue-600' },
                    { l: 'C', g: '3.00', c: 'text-amber-600' },
                    { l: 'D', g: '2.00', c: 'text-orange-600' },
                    { l: 'E', g: '1.00', c: 'text-red-600' },
                    { l: 'F', g: '0.00', c: 'text-red-800' },
                  ].map(({ l, g, c }) => (
                    <span key={l} className={`text-[10px] font-semibold ${c}`}>
                      {l} = {g}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grade Scale */}
          <div className="flex flex-wrap gap-2 justify-center pt-1 pb-2">
            {[
              { letter: 'A', range: '70-100%', color: 'bg-emerald-100 text-emerald-700' },
              { letter: 'B', range: '60-69%', color: 'bg-blue-100 text-blue-700' },
              { letter: 'C', range: '50-59%', color: 'bg-amber-100 text-amber-700' },
              { letter: 'D', range: '45-49%', color: 'bg-orange-100 text-orange-700' },
              { letter: 'E', range: '40-44%', color: 'bg-red-100 text-red-700' },
              { letter: 'F', range: 'Below 40%', color: 'bg-red-200 text-red-900' },
            ].map(({ letter, range, color }) => (
              <div key={letter} className="flex items-center gap-1">
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${color}`}>{letter}</span>
                <span className="text-[11px] text-gray-400">{range}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
