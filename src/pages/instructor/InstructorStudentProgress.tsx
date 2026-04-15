import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2, Clock, Target, Award, BookOpen, BarChart3,
  CalendarDays, Star, Loader2, HelpCircle,
  ClipboardList, FileText, Video, Globe, Trophy,
  Flame, Lock, AlertCircle, Users, ArrowLeft,
  GraduationCap, UserCheck, XCircle, Search, ChevronRight, Mail
} from 'lucide-react';

interface Module   { id: string; title: string; order_index: number; unlock_date?: string; }
interface Lesson   { id: string; title: string; type: string; module_id: string; order_index: number; }
interface Progress { lesson_id: string; completed: boolean; score?: number | null; completed_at?: string | null; time_spent?: number | null; }
interface Schedule { id: string; days: string[]; time: string; meeting_url: string; }
interface SurveyResp { lesson_id: string; rating: number | null; answers: any[]; created_at: string; }
interface AssignSub  { id?: string; lesson_id: string | null; assignment_id?: string; score: number | null; total_marks?: number; status: string; submitted_at: string; feedback: string | null; submission_type: string; }
interface QuizResultRow { id: string; user_id: string; lesson_id: string; course_id: string; score: number; total_questions: number; passed: boolean; created_at: string; }
interface StudentOption {
  id: string; full_name: string; email: string; cohort_name: string;
  course: string; cohort_id: string; course_id: string; progress: number;
}
interface CourseAssessment {
  id: string; title: string; type: string; total_marks?: number;
  questions?: { q: string; a: string[]; correct: number }[];
}
interface AssessmentSub {
  user_id: string; assessment_id: string; score: number | null;
  feedback: string | null; status: string; submitted_at: string;
  submission_type: string; content: string | null; file_url: string | null;
}

const LESSON_ICONS: Record<string, React.ElementType> = {
  text: FileText, video: Video, quiz: HelpCircle,
  survey: ClipboardList, assignment: ClipboardList, url: Globe,
  final_exam: Trophy,
};

// -- Grade helpers (same as StudentGradebook) --
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

function formatTime(s: number): string {
  if (!s || s <= 0) return '0s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function InstructorStudentProgress() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Student list
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected student's progress data
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentCohortId, setStudentCohortId] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [surveys, setSurveys] = useState<SurveyResp[]>([]);
  const [assignments, setAssignments] = useState<AssignSub[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResultRow[]>([]);
  // Enriched map: lesson_id -> assignment submission data (handles both lesson_id and assignment_id linking)
  const [assignScoreByLesson, setAssignScoreByLesson] = useState<Record<string, { score: number | null; status: string; submitted_at: string; feedback: string | null; submission_type: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedMod, setExpandedMod] = useState<string | null>(null);

  // Gradebook data
  const [quizAvg, setQuizAvg] = useState<number | null>(null);
  const [assignAvg, setAssignAvg] = useState<number | null>(null);
  const [attendAvg, setAttendAvg] = useState<number | null>(null);
  const [finalAvg, setFinalAvg] = useState<number | null>(null);
  const [weighted, setWeighted] = useState<number | null>(null);
  const [totalClasses, setTotalClasses] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [attendDetails, setAttendDetails] = useState<{ date: string; status: string }[]>([]);
  const [finalDetails, setFinalDetails] = useState<{ title: string; type: string; score: number | null; maxScore: number; status: string }[]>([]);

  // Load instructor's students
  useEffect(() => {
    if (user) loadStudents();
  }, [user]);

  // Load selected student's progress
  useEffect(() => {
    if (selectedStudentId) loadStudentProgress(selectedStudentId);
    else {
      setCourseId(''); setCourseName(''); setStudentName(''); setStudentCohortId('');
      setModules([]); setLessons([]); setProgress([]);
      setSchedules([]); setSurveys([]); setAssignments([]); setQuizResults([]); setAssignScoreByLesson({});
      setQuizAvg(null); setAssignAvg(null); setAttendAvg(null);
      setFinalAvg(null); setWeighted(null); setTotalClasses(0);
      setPresentCount(0); setAttendDetails([]); setFinalDetails([]);
      setError('');
    }
  }, [selectedStudentId]);

  const loadStudents = async () => {
    if (!user) return;
    setLoadingStudents(true);
    try {
      const courseMap: Record<string, { id: string; program: string }> = {};
      const programNames = new Set<string>();

      const { data: directCourses } = await supabase
        .from('courses').select('id, program').eq('instructor_id', user.id);
      directCourses?.forEach(c => { courseMap[c.id] = c; if (c.program) programNames.add(c.program); });

      const { data: junc } = await supabase
        .from('course_instructors').select('course_id').eq('instructor_id', user.id);
      if (junc && junc.length > 0) {
        const { data: juncDetails } = await supabase
          .from('courses').select('id, program').in('id', junc.map(j => j.course_id));
        juncDetails?.forEach(c => { courseMap[c.id] = c; if (c.program) programNames.add(c.program); });
      }

      try {
        const { data: createdCourses } = await supabase
          .from('courses').select('id, program').eq('created_by', user.id);
        createdCourses?.forEach(c => { courseMap[c.id] = c; if (c.program) programNames.add(c.program); });
      } catch { /* column may not exist */ }

      const myCourseIds = Object.keys(courseMap);
      const myPrograms = Array.from(programNames);

      if (myCourseIds.length === 0) { setStudents([]); setLoadingStudents(false); return; }

      const { data: allCohorts } = await supabase.from('cohorts').select('id, name, course').order('name');
      const cohortMap: Record<string, { id: string; name: string; course: string }> = {};
      (allCohorts || []).forEach(c => { cohortMap[c.id] = c; });

      const matchingCohorts = (allCohorts || []).filter(c =>
        myPrograms.includes(c.course) ||
        myPrograms.some(p => c.course?.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(c.course?.toLowerCase() || ''))
      );
      const matchingCohortIds = [...new Set(matchingCohorts.map(c => c.id))];

      let studentList: { id: string; full_name: string; email: string; cohort_id: string; course_id?: string }[] = [];

      if (matchingCohortIds.length > 0) {
        const { data: studs } = await supabase
          .from('profiles').select('id, full_name, email, cohort_id')
          .eq('role', 'student').in('cohort_id', matchingCohortIds);
        studentList = (studs || []).filter(s => {
          const cohort = cohortMap[s.cohort_id];
          return cohort && (myPrograms.includes(cohort.course) ||
            myPrograms.some(p => cohort.course?.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(cohort.course?.toLowerCase() || '')));
        });
      }

      const programToCourseId: Record<string, string> = {};
      myCourseIds.forEach(cid => {
        const prog = courseMap[cid]?.program;
        if (prog && !programToCourseId[prog]) programToCourseId[prog] = cid;
      });

      const activeCourseIds = Object.values(programToCourseId);
      const progressMap: Record<string, number> = {};

      if (activeCourseIds.length > 0) {
        const { data: mods } = await supabase.from('modules').select('id, course_id').in('course_id', activeCourseIds);
        const modList = mods || [];
        const modIds = modList.map(m => m.id);

        if (modIds.length > 0) {
          const { data: allLessons } = await supabase
            .from('lessons').select('id, type, module_id').in('module_id', modIds);
          const modCourseMap: Record<string, string> = {};
          modList.forEach(m => { modCourseMap[m.id] = m.course_id; });
          const nonHeader = (allLessons || []).filter(l => l.type !== 'header');
          const studentIds = studentList.map(s => s.id);
          const lessonIds = nonHeader.map(l => l.id);

          if (lessonIds.length > 0 && studentIds.length > 0) {
            const { data: allProg } = await supabase
              .from('lesson_progress').select('user_id, lesson_id, completed')
              .in('user_id', studentIds).in('lesson_id', lessonIds);

            studentList.forEach(s => {
              const cohort = cohortMap[s.cohort_id];
              const progName = cohort?.course || '';
              const cid = programToCourseId[progName] || '';
              if (!cid) { progressMap[s.id] = 0; return; }
              const total = nonHeader.filter(l => modCourseMap[l.module_id] === cid).length;
              if (total === 0) { progressMap[s.id] = 0; return; }
              const done = (allProg || []).filter(p => p.user_id === s.id && p.completed && lessonIds.includes(p.lesson_id)).length;
              progressMap[s.id] = Math.round((done / total) * 100);
            });
          }
        }
      }

      const options: StudentOption[] = studentList.map(s => {
        const cohort = cohortMap[s.cohort_id];
        const courseName = cohort?.course || 'Unknown';
        return {
          id: s.id, full_name: s.full_name || 'Unknown', email: s.email || '',
          cohort_name: cohort?.name || '--', course: courseName,
          cohort_id: s.cohort_id || '', course_id: programToCourseId[courseName] || '',
          progress: progressMap[s.id] || 0,
        };
      });

      setStudents(options);
    } catch (e: any) {
      console.error('[InstructorStudentProgress] loadStudents error:', e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadStudentProgress = async (studentId: string) => {
    setLoading(true); setError('');
    try {
      // Profile
      let prof: { id: string; full_name: string | null; cohort_id: string | null; cohorts?: { name: string; course: string } | null } | null = null;
      const { data: profJoined, error: joinErr } = await supabase
        .from('profiles').select('id, full_name, cohort_id, cohorts(name, course)')
        .eq('id', studentId).maybeSingle();
      if (!joinErr && profJoined) { prof = profJoined; }
      else {
        const { data: profSimple } = await supabase
          .from('profiles').select('id, full_name, cohort_id').eq('id', studentId).maybeSingle();
        prof = profSimple as any;
      }
      if (!prof) {
        const { data: fallback } = await supabase.from('profiles').select('id, full_name, cohort_id').eq('id', studentId);
        if (fallback && fallback.length > 0) prof = fallback[0];
        else { setError('Student not found in profiles table'); setLoading(false); return; }
      }

      const studentFullName = prof.full_name || 'Unknown';
      setStudentName(studentFullName);

      let program = (prof as any).cohorts?.course || '';
      let cohortId = prof.cohort_id || '';
      setStudentCohortId(cohortId);

      if (!program && cohortId) {
        const { data: cohort } = await supabase
          .from('cohorts').select('id, name, course').eq('id', cohortId).maybeSingle();
        if (cohort) program = cohort.course;
      }
      if (!program) { setError('No program linked to this student'); setLoading(false); return; }

      // Course
      let courseData: { id: string; title: string } | null = null;
      const { data: active } = await supabase
        .from('courses').select('id, title').eq('program', program).eq('status', 'Active').maybeSingle();
      if (active) courseData = active;
      else {
        const { data: fallback } = await supabase
          .from('courses').select('id, title').eq('program', program).order('created_at', { ascending: false }).limit(1).maybeSingle();
        courseData = fallback;
      }
      if (!courseData) { setError(`No course found for "${program}"`); setLoading(false); return; }

      setCourseId(courseData.id); setCourseName(courseData.title);

      // Modules + Lessons
      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', courseData.id).order('order_index');
      const modList = mods || [];
      setModules(modList);
      if (!modList.length) { setLoading(false); return; }

      const { data: lessData } = await supabase
        .from('lessons').select('id, title, type, module_id, order_index')
        .in('module_id', modList.map(m => m.id)).order('order_index');
      const lessonList = lessData || [];
      setLessons(lessonList);

      // All data in parallel - NOW INCLUDES quiz_results
      const [progRes, schedRes, survRes, assignRes, faAssessRes, quizRes] = await Promise.all([
        supabase.from('lesson_progress').select('*').eq('user_id', studentId),
        supabase.from('schedules').select('*').eq('course_id', courseData.id),
        supabase.from('survey_responses').select('lesson_id, rating, answers, created_at').eq('user_id', studentId),
        // FIX: Also fetch assignment_id to handle cases where lesson_id is null
        supabase.from('assignment_submissions').select('id, lesson_id, assignment_id, score, total_marks, status, submitted_at, feedback, submission_type').eq('user_id', studentId),
        supabase.from('assessments').select('id, title, type, total_marks, questions').eq('course_id', courseData.id).eq('status', 'published'),
        // FIX: Fetch quiz results from the quiz_results table instead of relying on lesson_progress.score
        supabase.from('quiz_results').select('id, user_id, lesson_id, course_id, score, total_questions, passed, created_at')
          .eq('user_id', studentId),
      ]);

      setProgress(progRes.data || []);
      setSchedules(schedRes.data || []);
      setSurveys(survRes.data || []);
      setAssignments(assignRes.data || []);
      setQuizResults((quizRes.data || []) as QuizResultRow[]);

      // -- Gradebook calculations --
      const progRows = (progRes.data || []) as Progress[];
      const assignRows = (assignRes.data || []) as AssignSub[];
      const faList = (faAssessRes.data || []) as CourseAssessment[];
      const qrList = (quizRes.data || []) as QuizResultRow[];

      console.log('[InstructorStudentProgress] quiz_results fetched:', qrList.length, qrList);
      console.log('[InstructorStudentProgress] lesson_progress rows:', progRows.length);
      console.log('[InstructorStudentProgress] assignment_submissions raw:', assignRows.length, assignRows);

      // Final assessment submissions
      let faSubs: AssessmentSub[] = [];
      if (faList.length > 0) {
        const { data: subs } = await supabase.from('assessment_submissions')
          .select('*').eq('user_id', studentId).in('assessment_id', faList.map(a => a.id));
        faSubs = (subs || []) as AssessmentSub[];
      }

      // Quizzes - FIX: Use quiz_results table instead of lesson_progress.score
      const quizLessons = lessonList.filter(l => l.type === 'quiz');
      // Build a map: lesson_id -> best percentage score from quiz_results
      const quizScoreByLesson: Record<string, number> = {};
      qrList.forEach(qr => {
        if (qr.lesson_id && qr.total_questions > 0) {
          const pct = Math.round((qr.score / qr.total_questions) * 100);
          // Keep the highest score if multiple attempts
          if (!(qr.lesson_id in quizScoreByLesson) || pct > quizScoreByLesson[qr.lesson_id]) {
            quizScoreByLesson[qr.lesson_id] = pct;
          }
        }
      });
      console.log('[InstructorStudentProgress] quiz scores by lesson:', quizScoreByLesson);
      const quizScores = quizLessons
        .map(l => quizScoreByLesson[l.id])
        .filter((s): s is number => s !== undefined && s !== null);
      const calcQuizAvg: number | null = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

      // Assignments - FIX: Handle both lesson_id and assignment_id linking
      const assignLessons = lessonList.filter(l => l.type === 'assignment');
      console.log('[InstructorStudentProgress] assignment lessons in course:', assignLessons.map(l => ({ id: l.id, title: l.title })));
      console.log('[InstructorStudentProgress] assignRows lesson_id values:', assignRows.map(r => ({ lesson_id: r.lesson_id, assignment_id: (r as any).assignment_id, score: r.score })));

      // Build lesson_id -> score map from assignment_submissions
      // First pass: direct lesson_id match
      const assignScoreByLesson: Record<string, { score: number | null; status: string; submitted_at: string; feedback: string | null; submission_type: string }> = {};
      assignRows.forEach(row => {
        if (row.lesson_id) {
          assignScoreByLesson[row.lesson_id] = {
            score: row.score,
            status: row.status,
            submitted_at: row.submitted_at,
            feedback: row.feedback,
            submission_type: row.submission_type,
          };
        }
      });

      // Second pass: if any assignment submissions lack lesson_id but have assignment_id,
      // look up the assignments table to find the lesson_id
      const assignIdsWithNullLesson = assignRows.filter(r => !r.lesson_id && (r as any).assignment_id).map(r => (r as any).assignment_id);
      if (assignIdsWithNullLesson.length > 0) {
        console.log('[InstructorStudentProgress] Some assignment_submissions have null lesson_id, looking up assignments table for:', assignIdsWithNullLesson);
        const { data: assignLookup } = await supabase
          .from('assignments')
          .select('id, lesson_id, title')
          .in('id', assignIdsWithNullLesson);
        if (assignLookup && assignLookup.length > 0) {
          console.log('[InstructorStudentProgress] assignments table lookup result:', assignLookup);
          assignLookup.forEach(a => {
            const matchingSub = assignRows.find(r => (r as any).assignment_id === a.id);
            if (matchingSub && a.lesson_id && !(a.lesson_id in assignScoreByLesson)) {
              assignScoreByLesson[a.lesson_id] = {
                score: matchingSub.score,
                status: matchingSub.status,
                submitted_at: matchingSub.submitted_at,
                feedback: matchingSub.feedback,
                submission_type: matchingSub.submission_type,
              };
            }
          });
        }
      }

      // Also try: fetch assignments directly for this course and match
      const { data: courseAssignments } = await supabase
        .from('assignments')
        .select('id, lesson_id, title, course_id')
        .eq('course_id', courseData.id);
      if (courseAssignments && courseAssignments.length > 0) {
        console.log('[InstructorStudentProgress] Course assignments from assignments table:', courseAssignments);
        courseAssignments.forEach(ca => {
          if (ca.lesson_id && !(ca.lesson_id in assignScoreByLesson)) {
            // Check if there's a submission for this assignment_id
            const matchingSub = assignRows.find(r => (r as any).assignment_id === ca.id);
            if (matchingSub) {
              assignScoreByLesson[ca.lesson_id] = {
                score: matchingSub.score,
                status: matchingSub.status,
                submitted_at: matchingSub.submitted_at,
                feedback: matchingSub.feedback,
                submission_type: matchingSub.submission_type,
              };
            }
          }
        });
      }

      console.log('[InstructorStudentProgress] Final assignScoreByLesson:', assignScoreByLesson);
      // Store in state so derived section and UI can use it
      setAssignScoreByLesson(assignScoreByLesson);
      const assignScores = assignLessons
        .map(l => assignScoreByLesson[l.id]?.score)
        .filter((s): s is number => s !== null && s !== undefined);
      const calcAssignAvg: number | null = assignScores.length > 0 ? Math.round(assignScores.reduce((a, b) => a + b, 0) / assignScores.length) : null;

      // Final Assessments
      const finalItems = faList.map(assessment => {
        const sub = faSubs.find(s => s.assessment_id === assessment.id);
        const isQuiz = assessment.type === 'Quiz';
        const maxScore = isQuiz ? (assessment.questions?.length || 0) : (assessment.total_marks || 100);
        const pct = sub && sub.score !== null ? Math.round((sub.score / maxScore) * 100) : null;
        return { title: assessment.title, type: assessment.type, score: pct, maxScore, status: sub ? sub.status : 'none' };
      });
      const finalPcts = finalItems.map(f => f.score).filter((s): s is number => s !== null);
      const calcFinalAvg: number | null = finalPcts.length > 0 ? Math.round(finalPcts.reduce((a, b) => a + b, 0) / finalPcts.length) : null;

      // Attendance
      let calcAttendAvg: number | null = null;
      let calcTotalClasses = 0;
      let calcPresentCount = 0;
      let calcAttendDetails: { date: string; status: string }[] = [];

      if (cohortId) {
        const { data: attendRows, error: attendErr } = await supabase
          .from('attendance').select('student_id, status, date')
          .eq('student_id', studentId).eq('cohort_id', cohortId);
        if (!attendErr && attendRows) {
          const attendList = attendRows.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          calcTotalClasses = attendList.length;
          calcPresentCount = attendList.filter((r: any) => r.status === 'present' || r.status === 'Present').length;
          calcAttendDetails = attendList.map((r: any) => ({ date: r.date, status: r.status }));
          if (calcTotalClasses > 0) calcAttendAvg = Math.round((calcPresentCount / calcTotalClasses) * 100);
        }
      }

      // Weighted Grade (using local variables)
      let wSum = 0;
      let wTot = 0;
      if (calcQuizAvg !== null) { wSum += calcQuizAvg * 0.25; wTot += 0.25; }
      if (calcAssignAvg !== null) { wSum += calcAssignAvg * 0.25; wTot += 0.25; }
      if (calcAttendAvg !== null) { wSum += calcAttendAvg * 0.10; wTot += 0.10; }
      if (calcFinalAvg !== null) { wSum += calcFinalAvg * 0.40; wTot += 0.40; }

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

      console.log('[InstructorStudentProgress] Gradebook calc:', {
        quizAvg: calcQuizAvg, assignAvg: calcAssignAvg, attendAvg: calcAttendAvg,
        finalAvg: calcFinalAvg, weighted: calcWeighted,
        quizScoresCount: quizScores.length, assignScoresCount: assignScores.length,
        assignScoreByLessonKeys: Object.keys(assignScoreByLesson),
      });

      // Set gradebook state
      setQuizAvg(calcQuizAvg);
      setAssignAvg(calcAssignAvg);
      setAttendAvg(calcAttendAvg);
      setFinalAvg(calcFinalAvg);
      setWeighted(calcWeighted);
      setTotalClasses(calcTotalClasses);
      setPresentCount(calcPresentCount);
      setAttendDetails(calcAttendDetails);
      setFinalDetails(finalItems);

    } catch (e: any) {
      console.error('[InstructorStudentProgress] loadStudentProgress error:', e);
      setError(e.message || 'Failed to load progress');
    } finally { setLoading(false); }
  };

  // -- Derived --
  const nonHeaders = lessons.filter(l => l.type !== 'header');
  const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const totalLessons = nonHeaders.length;
  const doneLessons = nonHeaders.filter(l => completedIds.has(l.id)).length;
  const overallPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  // FIX: Derive quiz scores from quiz_results table, not lesson_progress
  const quizLessonList = nonHeaders.filter(l => l.type === 'quiz');
  const quizScoreMap = useMemo(() => {
    const map: Record<string, { pct: number; passed: boolean; totalQuestions: number; rawScore: number; createdAt: string }> = {};
    quizResults.forEach(qr => {
      if (qr.lesson_id && qr.total_questions > 0) {
        const pct = Math.round((qr.score / qr.total_questions) * 100);
        // Keep the latest attempt by lesson_id
        if (!(qr.lesson_id in map) || new Date(qr.created_at) > new Date(map[qr.lesson_id].createdAt)) {
          map[qr.lesson_id] = {
            pct,
            passed: qr.passed,
            totalQuestions: qr.total_questions,
            rawScore: qr.score,
            createdAt: qr.created_at,
          };
        }
      }
    });
    return map;
  }, [quizResults]);

  const quizProgressLessons = quizLessonList.filter(l => quizScoreMap[l.id] !== undefined);
  const avgScore = quizProgressLessons.length > 0
    ? Math.round(quizProgressLessons.reduce((a, l) => a + quizScoreMap[l.id].pct, 0) / quizProgressLessons.length)
    : null;

  const totalSecs = progress.reduce((a, p) => a + (p.time_spent || 0), 0);

  const surveyLessons = nonHeaders.filter(l => l.type === 'survey');
  const surveysDone = surveyLessons.filter(l => completedIds.has(l.id)).length;
  const ratings = surveys.map(s => s.rating).filter((r): r is number => r !== null && r > 0);
  const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;

  const assignLessonList = nonHeaders.filter(l => l.type === 'assignment');
  // FIX: Use assignScoreByLesson for proper assignment score derivation
  const assignDerivedScores = assignLessonList
    .map(l => assignScoreByLesson[l.id]?.score)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgAssignScore = assignDerivedScores.length > 0
    ? Math.round(assignDerivedScores.reduce((a, b) => a + b, 0) / assignDerivedScores.length)
    : null;

  const modProgress = modules.map(mod => {
    const modLess = nonHeaders.filter(l => l.module_id === mod.id);
    const done = modLess.filter(l => completedIds.has(l.id)).length;
    const pct = modLess.length > 0 ? Math.round((done / modLess.length) * 100) : 0;
    const complete = pct === 100 && modLess.length > 0;
    const locked = !!mod.unlock_date && new Date(mod.unlock_date) > new Date();
    return { mod, lessons: modLess, done, total: modLess.length, pct, complete, locked };
  });
  const completedMods = modProgress.filter(m => m.complete).length;

  // Activity chart
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: d.toDateString(), label: d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }), count: 0 };
  });
  progress.filter(p => p.completed && p.completed_at).forEach(p => {
    const slot = last14.find(d => d.date === new Date(p.completed_at!).toDateString());
    if (slot) slot.count++;
  });
  const maxCount = Math.max(...last14.map(d => d.count), 1);

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toDateString(); });
  const streak = last7.filter(day => progress.some(p => p.completed_at && new Date(p.completed_at).toDateString() === day)).length;

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const grade = weighted !== null ? getLetterGrade(weighted) : '--';
  const gpa = weighted !== null ? getGPA(weighted) : 0;

  // Filtered students for search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.cohort_name.toLowerCase().includes(q) ||
      s.course.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // -- Renders --
  if (loadingStudents) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <span className="text-gray-500">Loading students...</span>
    </div>
  );

  if (students.length === 0) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No students found</p>
        <p className="text-gray-400 text-sm mt-1">You don't have any students assigned to your courses yet.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6 bg-gray-50/40 min-h-screen">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Progress</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor your students&apos; learning progress &amp; grades</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border">
          <Users className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-gray-800">{students.length}</span> students
        </div>
      </div>

      {/* Student List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> All Students
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, cohort..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b">
            <div className="col-span-4 sm:col-span-3">Student</div>
            <div className="col-span-3 sm:col-span-2 hidden sm:block">Cohort</div>
            <div className="col-span-3 sm:col-span-2 hidden sm:block">Course</div>
            <div className="col-span-3 sm:col-span-2">Progress</div>
            <div className="col-span-2 sm:col-span-2">Grade</div>
            <div className="col-span-1"></div>
          </div>
          {/* Student rows */}
          <div className="max-h-[360px] overflow-y-auto">
            {filteredStudents.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No students match your search</div>
            )}
            {filteredStudents.map(s => {
              const isSelected = s.id === selectedStudentId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(isSelected ? '' : s.id)}
                  className={`w-full grid grid-cols-12 gap-2 px-4 py-3 border-b last:border-b-0 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border-l-3 border-l-indigo-500'
                      : 'bg-white hover:bg-gray-50 border-l-3 border-l-transparent'
                  }`}
                >
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>{s.full_name}</p>
                      <p className="text-[11px] text-gray-400 truncate sm:hidden">{s.cohort_name}</p>
                    </div>
                  </div>
                  <div className="col-span-3 sm:col-span-2 hidden sm:flex items-center">
                    <span className="text-xs text-gray-500 truncate">{s.cohort_name}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-2 hidden sm:flex items-center">
                    <span className="text-xs text-gray-500 truncate">{s.course}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex items-center">
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            s.progress >= 70 ? 'bg-emerald-500' : s.progress >= 40 ? 'bg-indigo-400' : 'bg-gray-300'
                          }`}
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ${
                        s.progress >= 70 ? 'text-emerald-600' : s.progress >= 40 ? 'text-indigo-600' : 'text-gray-400'
                      }`}>{s.progress}%</span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-2 flex items-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.progress >= 70 ? 'bg-emerald-100 text-emerald-700' :
                      s.progress >= 50 ? 'bg-blue-100 text-blue-700' :
                      s.progress >= 40 ? 'bg-amber-100 text-amber-700' :
                      s.progress > 0 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {s.progress >= 70 ? 'A' : s.progress >= 60 ? 'B' : s.progress >= 50 ? 'C' : s.progress >= 45 ? 'D' : s.progress >= 40 ? 'E' : s.progress > 0 ? 'F' : '--'}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-500 rotate-90' : 'text-gray-300'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Loading progress */}
      {selectedStudentId && loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-gray-500">Loading {studentName}&apos;s progress...</span>
        </div>
      )}

      {/* Error */}
      {selectedStudentId && error && !loading && (
        <div className="flex items-center justify-center py-10">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-500 font-medium">{error}</p>
            <Button onClick={() => loadStudentProgress(selectedStudentId)} className="mt-4" variant="outline">Retry</Button>
          </div>
        </div>
      )}

      {/* Progress Dashboard */}
      {selectedStudentId && !loading && !error && (
        <>

          {/* Student header pill */}
          <div className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
              {studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{studentName}</p>
              <p className="text-xs text-gray-400">{selectedStudent?.cohort_name} &bull; {courseName}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedStudentId('')}>
              <Users className="w-4 h-4 mr-1" /> All Students
            </Button>
          </div>

          {/* ======== GRADEBOOK CARD ======== */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className={`p-6 text-white ${
              weighted !== null && weighted >= 70 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700'
              : weighted !== null ? 'bg-gradient-to-br from-amber-500 to-orange-600'
              : 'bg-gradient-to-br from-gray-400 to-gray-500'
            }`}>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black bg-white/20 backdrop-blur-sm">
                  {grade}
                </div>
                <div className="flex-1">
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Overall Weighted Grade</p>
                  <p className="text-3xl font-black">{weighted !== null ? `${weighted}%` : 'N/A'}</p>
                  <p className="text-white/70 text-sm mt-0.5">GPA: {gpa.toFixed(2)} &bull; Course: {courseName}</p>
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
                    <p className="text-white font-bold">{value !== null ? `${value}%` : '--'}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Hero progress card */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke="white" strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 58}`}
                      strokeDashoffset={`${2 * Math.PI * 58 * (1 - overallPct / 100)}`}
                      strokeLinecap="round" transform="rotate(-90 70 70)" className="transition-all duration-1000" />
                    <text x="70" y="62" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">{overallPct}%</text>
                    <text x="70" y="78" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">COMPLETE</text>
                  </svg>
                </div>
                <div className="flex-1 w-full">
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-3">{studentName}&apos;s Progress</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Lessons Done', value: `${doneLessons}/${totalLessons}` },
                      { label: 'Time Spent', value: formatTime(totalSecs) },
                      { label: 'Modules Done', value: `${completedMods}/${modules.length}` },
                      { label: 'Streak', value: `${streak} day${streak !== 1 ? 's' : ''}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/10 rounded-xl p-3">
                        <p className="text-xl font-bold">{value}</p>
                        <p className="text-white/60 text-xs mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x border-t bg-white">
              {[
                { label: 'Quiz Average', value: avgScore !== null ? `${avgScore}%` : '--', color: avgScore !== null && avgScore >= 70 ? 'text-emerald-600' : avgScore !== null ? 'text-red-500' : 'text-gray-400', icon: HelpCircle },
                { label: 'Surveys Done', value: `${surveysDone}/${surveyLessons.length}`, color: 'text-purple-600', icon: ClipboardList },
                { label: 'Avg Rating', value: avgRating !== null ? `${avgRating}` : '--', color: 'text-amber-500', icon: Star },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="p-4 text-center">
                  <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" /> Activity - Last 14 Days
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-medium">
                  <Flame className="w-3.5 h-3.5" /> {streak}-day streak
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-20">
                {last14.map((day, i) => {
                  const h = day.count > 0 ? Math.max((day.count / maxCount) * 100, 12) : 0;
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

          {/* Module Breakdown */}
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
                        {complete ? '\u2713' : locked ? <Lock className="w-3.5 h-3.5" /> : mod.order_index + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${complete ? 'text-emerald-800' : 'text-gray-800'}`}>{mod.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {locked && mod.unlock_date ? `Unlocks ${new Date(mod.unlock_date).toLocaleDateString()}` : `${done}/${total} lessons`}
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
                        const prog = progress.find(p => p.lesson_id === lesson.id);
                        const done_ = completedIds.has(lesson.id);
                        const Icon = LESSON_ICONS[lesson.type] || FileText;
                        const assign = assignScoreByLesson[lesson.id] || assignments.find(a => a.lesson_id === lesson.id);
                        const survey = surveys.find(s => s.lesson_id === lesson.id);
                        // FIX: For quiz lessons, get score from quiz_results (quizScoreMap)
                        const quizData = lesson.type === 'quiz' ? quizScoreMap[lesson.id] : null;
                        const displayScore = quizData ? quizData.pct : prog?.score ?? null;
                        const displayPassed = quizData ? quizData.passed : null;
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
                              {/* FIX: Show quiz score from quiz_results */}
                              {lesson.type === 'quiz' && quizData && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${quizData.pct >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                  {quizData.rawScore}/{quizData.totalQuestions} ({quizData.pct}%)
                                </span>
                              )}
                              {lesson.type === 'final_exam' && prog?.score !== null && prog?.score !== undefined && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prog.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{prog.score}%</span>
                              )}
                              {lesson.type === 'survey' && survey?.rating && (
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map(r => <Star key={r} className={`w-3 h-3 ${r <= survey.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />)}
                                </div>
                              )}
                              {lesson.type === 'assignment' && assign && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  assign.score !== null ? (assign.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600') : 'bg-amber-100 text-amber-700'
                                }`}>{assign.score !== null ? `${assign.score}%` : 'Submitted'}</span>
                              )}
                              {lesson.type === 'final_exam' && prog?.completed && prog?.score === null && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Awaiting Grade</span>
                              )}
                              {prog?.completed_at && (
                                <span className="text-[10px] text-gray-400">{new Date(prog.completed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
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

          {/* Quiz Results */}
          {quizLessonList.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" /> Quiz Results
                  {avgScore !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${avgScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>Avg: {avgScore}%</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quizProgressLessons.length === 0 ? (
                  <div className="text-center py-6"><Target className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No quizzes completed yet.</p></div>
                ) : (
                  <div className="space-y-2">
                    {quizLessonList.map(lesson => {
                      // FIX: Get quiz data from quiz_results, not lesson_progress
                      const quizData = quizScoreMap[lesson.id];
                      const done = !!quizData;
                      const score = quizData?.pct ?? null;
                      const rawScore = quizData?.rawScore ?? null;
                      const totalQ = quizData?.totalQuestions ?? null;
                      const passed = quizData?.passed ?? null;
                      const completedAt = quizData?.createdAt ?? null;
                      return (
                        <div key={lesson.id} className={`flex items-center justify-between p-3 rounded-xl border ${done ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!done ? 'bg-gray-100' : score !== null && score >= 70 ? 'bg-emerald-100' : score !== null ? 'bg-red-100' : 'bg-purple-100'}`}>
                              <HelpCircle className={`w-4 h-4 ${!done ? 'text-gray-400' : score !== null && score >= 70 ? 'text-emerald-600' : score !== null ? 'text-red-500' : 'text-purple-600'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{lesson.title}</p>
                              <p className="text-xs text-gray-400">
                                {!done ? 'Not attempted' : completedAt ? new Date(completedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Completed'}
                              </p>
                            </div>
                          </div>
                          {done && score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${score >= s*20 ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />)}</div>
                              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                {rawScore}/{totalQ} ({score}%)
                              </span>
                              {passed !== null && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {passed ? 'Passed' : 'Failed'}
                                </span>
                              )}
                            </div>
                          ) : done ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">No score</span> : <span className="text-xs text-gray-300">--</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Survey Responses */}
          {surveyLessons.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-purple-500" /> Survey Responses
                  {avgRating && <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{avgRating}/5 avg</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {surveys.length === 0 ? (
                  <div className="text-center py-6"><ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No surveys submitted yet.</p></div>
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
                              {sr ? <p className="text-xs text-gray-400 mt-0.5">Submitted {new Date(sr.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p> : <p className="text-xs text-gray-400 mt-0.5">Not submitted</p>}
                            </div>
                            {sr?.rating && (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex gap-0.5">{[1,2,3,4,5].map(r => <Star key={r} className={`w-4 h-4 ${r <= sr.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />)}</div>
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

          {/* Assignment Status */}
          {assignLessonList.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-500" /> Assignments
                  {avgAssignScore !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${avgAssignScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>Avg: {avgAssignScore}%</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assignLessonList.map(lesson => {
                    const sub = assignScoreByLesson[lesson.id] || assignments.find(a => a.lesson_id === lesson.id);
                    return (
                      <div key={lesson.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sub ? sub.score !== null ? (sub.score >= 70 ? 'bg-emerald-100' : 'bg-red-100') : 'bg-amber-100' : 'bg-gray-100'}`}>
                            <ClipboardList className={`w-4 h-4 ${sub ? sub.score !== null ? (sub.score >= 70 ? 'text-emerald-600' : 'text-red-500') : 'text-amber-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{lesson.title}</p>
                            <p className="text-xs text-gray-400">{sub ? `Submitted ${new Date(sub.submitted_at).toLocaleDateString()}` : 'Not submitted'}</p>
                            {sub?.feedback && <p className="text-xs text-indigo-600 mt-0.5 italic">&quot;{sub.feedback}&quot;</p>}
                          </div>
                        </div>
                        {sub ? (
                          sub.score !== null
                            ? <span className={`text-sm font-bold px-3 py-1 rounded-lg ${sub.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{sub.score}%</span>
                            : <span className="text-xs bg-amber-100 text-amber-700 font-medium px-3 py-1 rounded-lg">Awaiting grade</span>
                        ) : <span className="text-xs text-gray-300">--</span>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Final Exams / Assessments */}
          {finalDetails.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-rose-500" /> Final Exam
                  {finalAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${finalAvg >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      Avg: {finalAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {finalDetails.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.score !== null ? (f.score >= 70 ? 'bg-emerald-100' : 'bg-red-100') : 'bg-gray-100'}`}>
                          <Trophy className={`w-4 h-4 ${f.score !== null ? (f.score >= 70 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-medium">
                              {f.type === 'Quiz' ? 'Quiz' : f.type === 'File' ? 'File' : 'Exam'}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{f.title}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">Max score: {f.maxScore}</p>
                        </div>
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
                        <span className="text-xs text-gray-300">--</span>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-500" /> Attendance
                  {attendAvg !== null && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${attendAvg >= 75 ? 'bg-emerald-100 text-emerald-700' : attendAvg >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                      {presentCount}/{totalClasses} - {attendAvg}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
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

          {/* Weekly Schedule */}
          {schedules.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-violet-500" /> Weekly Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {schedules.map(sched => (
                    <div key={sched.id} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100">
                          <CalendarDays className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{sched.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}</p>
                          <p className="text-xs text-gray-400">{sched.time}</p>
                        </div>
                      </div>
                      {sched.meeting_url && (
                        <a href={sched.meeting_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          Join Meeting
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
