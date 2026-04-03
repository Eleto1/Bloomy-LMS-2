import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, Download, RefreshCw, X, Eye, Star,
  CheckCircle2, Clock, Users, BookOpen, Award,
  HelpCircle, ClipboardList, Calendar, FileText, Globe,
  BarChart3, Pencil, Save, AlertCircle
} from 'lucide-react';

interface Student {
  id: string; full_name: string; email: string; cohort_id: string;
  cohorts: { name: string; course: string } | null;
}
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface Lesson { id: string; title: string; type: string; module_id: string; order_index: number; }
interface Module { id: string; title: string; order_index: number; }

interface LessonProgress {
  user_id: string; lesson_id: string; completed: boolean;
  score: number | null; completed_at: string | null; time_spent: number | null;
}
interface AssignmentSub {
  user_id: string; lesson_id: string; score: number | null;
  status: string; submitted_at: string; feedback: string | null;
  submission_type: string; content: string | null; file_url: string | null;
  total_marks?: number | null;
}
interface AttendanceRow { student_id: string; status: string; }

interface CourseAssessment {
  id: string; title: string; type: string; total_marks?: number;
  questions?: { q: string; a: string[]; correct: number }[];
}
interface AssessmentSub {
  id: string; user_id: string; assessment_id: string;
  submission_type: string; content: string | null; file_url: string | null;
  score: number | null; feedback: string | null; status: string;
  submitted_at: string; quiz_answers?: { questionIndex: number; selectedOption: number | null }[];
}

interface StudentGrade {
  quizAvg: number | null;
  assignAvg: number | null;
  attendPct: number | null;
  finalAvg: number | null;
  lessonsPct: number;
  weighted: number | null;
  grade: string;
  gpa: number;
  color: string;
  quizDetails: { lesson: Lesson; score: number | null; completed: boolean }[];
  assignDetails: { lesson: Lesson; sub: AssignmentSub | null }[];
  moduleProgress: { module: Module; done: number; total: number }[];
  finalDetails: { assessment: CourseAssessment; sub: AssessmentSub | null }[];
}

function calcGrade(pct: number | null): { grade: string; gpa: number; color: string } {
  if (pct === null) return { grade: '—', gpa: 0, color: 'bg-gray-100 text-gray-500' };
  if (pct >= 70) return { grade: 'A', gpa: 5.0, color: 'bg-emerald-100 text-emerald-800' };
  if (pct >= 60) return { grade: 'B', gpa: 4.0, color: 'bg-blue-100 text-blue-800' };
  if (pct >= 50) return { grade: 'C', gpa: 3.0, color: 'bg-amber-100 text-amber-800' };
  if (pct >= 45) return { grade: 'D', gpa: 2.0, color: 'bg-orange-100 text-orange-800' };
  if (pct >= 40) return { grade: 'E', gpa: 1.0, color: 'bg-red-100 text-red-700' };
  return { grade: 'F', gpa: 0.0, color: 'bg-red-200 text-red-900' };
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n));
  return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

function ScoreBadge({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-xs text-gray-300 font-medium">—</span>;
  const color = value >= 70 ? 'text-emerald-600' : value >= 50 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-sm font-bold ${color}`}>{value}{suffix}</span>;
}

function MiniBar({ value, color = '#6366f1' }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-medium text-gray-500 w-8 text-right">{value}%</span>
    </div>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  if (status === 'graded')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Graded</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Pending</span>;
}

async function fetchGradesData(
  studentIds: string[],
  courseId: string
): Promise<{ gradeMap: Record<string, StudentGrade>; modList: Module[]; lessonList: Lesson[] }> {
  const empty = { gradeMap: {} as Record<string, StudentGrade>, modList: [] as Module[], lessonList: [] as Lesson[] };

  const { data: mods } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order_index');
  const modList = mods || [];
  if (modList.length === 0) return empty;
  const modIds = modList.map(m => m.id);

  const { data: lessData } = await supabase.from('lessons').select('id,title,type,module_id,order_index')
    .in('module_id', modIds).order('order_index');
  const lessonList = lessData || [];
  const lessonIds = lessonList.map(l => l.id);
  if (lessonIds.length === 0) return { gradeMap: {}, modList, lessonList };

  const [progRes, assignRes, attendRes, faAssessRes] = await Promise.all([
    supabase.from('lesson_progress')
      .select('user_id,lesson_id,completed,score,completed_at,time_spent')
      .in('user_id', studentIds).in('lesson_id', lessonIds),
    supabase.from('assignment_submissions')
      .select('user_id,lesson_id,score,status,submitted_at,feedback,submission_type,content,file_url,total_marks')
      .in('user_id', studentIds).in('lesson_id', lessonIds),
    supabase.from('attendance')
      .select('student_id,status')
      .in('student_id', studentIds),
    supabase.from('assessments')
      .select('id,title,type,total_marks,questions')
      .eq('course_id', courseId).eq('status', 'published'),
  ]);

  const progRows = (progRes.data || []) as LessonProgress[];
  const assignRows = (assignRes.data || []) as AssignmentSub[];
  const attendRows = (attendRes.data || []) as AttendanceRow[];
  const faAssessList = (faAssessRes.data || []) as CourseAssessment[];
  const faIdList = faAssessList.map(a => a.id);

  let faSubRows: AssessmentSub[] = [];
  if (faIdList.length > 0 && studentIds.length > 0) {
    const { data: subsData } = await supabase.from('assessment_submissions')
      .select('*').in('user_id', studentIds).in('assessment_id', faIdList);
    faSubRows = (subsData || []) as AssessmentSub[];
  }

  const quizLessons = lessonList.filter(l => l.type === 'quiz');
  const assignLessons = lessonList.filter(l => l.type === 'assignment');
  const nonHeaders = lessonList.filter(l => l.type !== 'header');
  const gradeMap: Record<string, StudentGrade> = {};

  studentIds.forEach(sid => {
    const quizDetails = quizLessons.map(l => {
      const pr = progRows.find(p => p.user_id === sid && p.lesson_id === l.id);
      return { lesson: l, score: pr?.score ?? null, completed: pr?.completed ?? false };
    });
    const quizScores = quizDetails.map(q => q.score).filter((s): s is number => s !== null && !isNaN(s));
    const quizAvg = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

    const assignDetails = assignLessons.map(l => {
      const sub = assignRows.find(a => a.user_id === sid && a.lesson_id === l.id) ?? null;
      return { lesson: l, sub };
    });
    const gradedAssigns = assignDetails.filter(a => a.sub?.score !== null && a.sub?.score !== undefined);
    const assignAvg = gradedAssigns.length > 0
      ? Math.round(gradedAssigns.reduce((acc, a) => acc + (a.sub!.score || 0), 0) / gradedAssigns.length) : null;

    const stdAttend = attendRows.filter(a => a.student_id === sid);
    const attendPct = stdAttend.length > 0
      ? Math.round((stdAttend.filter(a => a.status === 'present').length / stdAttend.length) * 100) : null;

    const finalDetails = faAssessList.map(assessment => {
      const sub = faSubRows.find(f => f.user_id === sid && f.assessment_id === assessment.id) ?? null;
      return { assessment, sub };
    });
    const finalPcts: number[] = [];
    finalDetails.forEach(({ assessment, sub }) => {
      if (sub && sub.score !== null) {
        if (assessment.type === 'Quiz' && assessment.questions) {
          const total = assessment.questions.length;
          finalPcts.push(total > 0 ? Math.round((sub.score / total) * 100) : 0);
        } else {
          const total = assessment.total_marks || 100;
          finalPcts.push(total > 0 ? Math.round((sub.score / total) * 100) : 0);
        }
      }
    });
    const finalAvg = finalPcts.length > 0 ? Math.round(finalPcts.reduce((a, b) => a + b, 0) / finalPcts.length) : null;

    const stdProg = progRows.filter(p => p.user_id === sid && p.completed);
    const doneIds = new Set(stdProg.map(p => p.lesson_id));
    const doneCount = nonHeaders.filter(l => doneIds.has(l.id)).length;
    const lessonsPct = nonHeaders.length > 0 ? Math.round((doneCount / nonHeaders.length) * 100) : 0;

    const moduleProgress = modList.map(mod => {
      const modLessons = nonHeaders.filter(l => l.module_id === mod.id);
      const done = modLessons.filter(l => doneIds.has(l.id)).length;
      return { module: mod, done, total: modLessons.length };
    });

    let weightSum = 0, weightTot = 0;
    if (quizAvg !== null) { weightSum += quizAvg * 0.25; weightTot += 0.25; }
    if (assignAvg !== null) { weightSum += assignAvg * 0.25; weightTot += 0.25; }
    if (attendPct !== null) { weightSum += attendPct * 0.10; weightTot += 0.10; }
    if (finalAvg !== null) { weightSum += finalAvg * 0.40; weightTot += 0.40; }
    const weighted = weightTot > 0 ? Math.round(weightSum / weightTot) : null;
    const { grade, gpa, color } = calcGrade(weighted);

    gradeMap[sid] = { quizAvg, assignAvg, attendPct, finalAvg, lessonsPct, weighted, grade, gpa, color, quizDetails, assignDetails, moduleProgress, finalDetails };
  });

  return { gradeMap, modList, lessonList };
}

export default function AdminGradebook() {
  const [filterCohortName, setFilterCohortName] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterCourseId, setFilterCourseId] = useState('all');
  const [search, setSearch] = useState('');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [grades, setGrades] = useState<Record<string, StudentGrade>>({});

  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searchGradeStudent, setSearchGradeStudent] = useState<Student | null>(null);
  const [activeSearchStudent, setActiveSearchStudent] = useState<Student | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradingSubject, setGradingSubject] = useState<{ student: Student; lesson: Lesson; sub: AssignmentSub | null } | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  const [faGradeOpen, setFaGradeOpen] = useState(false);
  const [faGradingSubject, setFaGradingSubject] = useState<{ student: Student; assessment: CourseAssessment; sub: AssessmentSub | null } | null>(null);
  const [faGradeInput, setFaGradeInput] = useState('');
  const [faFeedbackInput, setFaFeedbackInput] = useState('');
  const [savingFaGrade, setSavingFaGrade] = useState(false);

  const gradesRef = useRef(grades);
  useEffect(() => { gradesRef.current = grades; }, [grades]);

  const { toast } = useToast();

  const uniqueCohortNames = Array.from(new Set(cohorts.map(c => c.name)));
  const availablePrograms = filterCohortName !== 'all'
    ? Array.from(new Set(cohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : Array.from(new Set(cohorts.map(c => c.course)));

  useEffect(() => { setFilterProgram('all'); }, [filterCohortName]);
  useEffect(() => { setFilterCourseId('all'); }, [filterProgram]);

  useEffect(() => {
    Promise.all([
      supabase.from('cohorts').select('id,name,course').order('name'),
      supabase.from('profiles').select('id, full_name, email, cohort_id, cohorts!cohort_id(name, course)').eq('role', 'student'),
    ]).then(([cohortsRes, studentsRes]) => {
      setCohorts(cohortsRes.data || []);
      setAllStudents((studentsRes.data || []) as Student[]);
      setLoadingInit(false);
    });
  }, []);

  useEffect(() => {
    if (filterProgram === 'all') { setCourses([]); return; }
    supabase.from('courses').select('id,title,program').eq('program', filterProgram)
      .then(({ data }) => setCourses(data || []));
  }, [filterProgram]);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      setSearchGradeStudent(null);
      setActiveSearchStudent(null);
      return;
    }
    if (filterCourseId !== 'all') {
      setSearchResults([]);
      setSearchGradeStudent(null);
      return;
    }

    const q = search.toLowerCase();
    const matches = allStudents.filter(s =>
      s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
    setSearchResults(matches);

    if (matches.length === 1) {
      const student = matches[0];
      setSearchGradeStudent(student);
      setActiveSearchStudent(student);
      if (!gradesRef.current[student.id]) {
        const timer = setTimeout(() => loadSearchStudent(student), 400);
        return () => clearTimeout(timer);
      }
    } else {
      setSearchGradeStudent(null);
      setActiveSearchStudent(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allStudents, filterCourseId]);

  useEffect(() => {
    if (filterCourseId !== 'all') {
      setSearchResults([]);
      setSearchGradeStudent(null);
      setActiveSearchStudent(null);
    }
  }, [filterCourseId]);

  const loadData = async () => {
    if (filterCourseId === 'all') {
      setStudents([]); setModules([]); setLessons([]); setGrades({});
      return;
    }
    setLoading(true);
    try {
      const cohortIds = filterCohortName !== 'all'
        ? cohorts.filter(c => c.name === filterCohortName).map(c => c.id)
        : cohorts.map(c => c.id);

      const { data: studs, error: studErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, cohort_id, cohorts!cohort_id(name, course)')
        .eq('role', 'student')
        .in('cohort_id', cohortIds);
      if (studErr) throw studErr;
      const studentList = (studs || []) as Student[];
      setStudents(studentList);
      if (studentList.length === 0) { setLoading(false); return; }

      const result = await fetchGradesData(studentList.map(s => s.id), filterCourseId);
      setModules(result.modList);
      setLessons(result.lessonList);
      setGrades(result.gradeMap);
    } catch (e: any) {
      toast({ title: 'Error loading gradebook', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (filterCourseId === 'all') return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCourseId, filterCohortName, cohorts]);

  const loadSearchStudent = async (student: Student) => {
    const program = student.cohorts?.course;
    if (!program) {
      toast({ title: 'No program linked to this student', variant: 'destructive' });
      return;
    }
    setActiveSearchStudent(student);
    setDirectLoading(true);
    try {
      const { data: courseData } = await supabase.from('courses').select('id,title,program').eq('program', program).limit(1);
      if (!courseData || courseData.length === 0) {
        toast({ title: 'No course found for program: ' + program, variant: 'destructive' });
        return;
      }
      const result = await fetchGradesData([student.id], courseData[0].id);
      setModules(result.modList);
      setLessons(result.lessonList);
      setGrades(prev => ({ ...prev, ...result.gradeMap }));
    } catch (e: any) {
      toast({ title: 'Error loading grades', description: e.message, variant: 'destructive' });
    } finally { setDirectLoading(false); }
  };

  const handleSearchClick = (student: Student) => {
    setSearchGradeStudent(student);
    loadSearchStudent(student);
  };

  const clearSearch = () => {
    setSearch('');
    setSearchResults([]);
    setSearchGradeStudent(null);
    setActiveSearchStudent(null);
  };

  const reloadGrades = () => {
    if (activeSearchStudent) {
      loadSearchStudent(activeSearchStudent);
    } else {
      loadData();
    }
  };

  const filtered = students.filter(s => {
    const matchSearch = search
      ? (s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
      : true;
    const matchProgram = filterProgram !== 'all' ? s.cohorts?.course === filterProgram : true;
    return matchSearch && matchProgram;
  });

  const classAvg = (() => {
    const values = Object.values(grades);
    if (values.length === 0) return null;
    return {
      quiz: avg(values.map(g => g.quizAvg)),
      assign: avg(values.map(g => g.assignAvg)),
      attend: avg(values.map(g => g.attendPct)),
      final: avg(values.map(g => g.finalAvg)),
      weighted: avg(values.map(g => g.weighted)),
      completed: Math.round(values.reduce((a, g) => a + g.lessonsPct, 0) / values.length),
    };
  })();

  const openGradeModal = (student: Student, lesson: Lesson, sub: AssignmentSub | null) => {
    setGradingSubject({ student, lesson, sub });
    setGradeInput(sub?.score?.toString() ?? '');
    setFeedbackInput(sub?.feedback ?? '');
    setGradeOpen(true);
  };

  const saveGrade = async () => {
    if (!gradingSubject) return;
    const scoreVal = parseInt(gradeInput);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      return toast({ title: 'Score must be 0–100', variant: 'destructive' });
    }
    setSavingGrade(true);
    try {
      const { error } = await supabase.from('assignment_submissions').upsert({
        user_id: gradingSubject.student.id,
        lesson_id: gradingSubject.lesson.id,
        score: scoreVal,
        feedback: feedbackInput || null,
        status: 'graded',
        graded_at: new Date().toISOString(),
        total_marks: gradingSubject.sub?.total_marks ?? 100,
      }, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;
      toast({ title: 'Grade saved ✓' });
      setGradeOpen(false);
      reloadGrades();
    } catch (e: any) {
      toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
    } finally { setSavingGrade(false); }
  };

  const openFaGradeModal = (student: Student, assessment: CourseAssessment, sub: AssessmentSub | null) => {
    setFaGradingSubject({ student, assessment, sub });
    setFaGradeInput(sub?.score !== null ? sub.score.toString() : '');
    setFaFeedbackInput(sub?.feedback ?? '');
    setFaGradeOpen(true);
  };

  const saveFaGrade = async () => {
    if (!faGradingSubject) return;
    const maxScore = faGradingSubject.assessment.type === 'Quiz'
      ? (faGradingSubject.assessment.questions?.length || 0)
      : (faGradingSubject.assessment.total_marks || 100);
    const scoreVal = parseInt(faGradeInput);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxScore) {
      return toast({ title: `Score must be 0–${maxScore}`, variant: 'destructive' });
    }
    setSavingFaGrade(true);
    try {
      const { error } = await supabase.from('assessment_submissions').upsert({
        user_id: faGradingSubject.student.id,
        assessment_id: faGradingSubject.assessment.id,
        score: scoreVal,
        feedback: faFeedbackInput || null,
        status: 'graded',
        graded_at: new Date().toISOString(),
      }, { onConflict: 'user_id,assessment_id' });
      if (error) throw error;
      toast({ title: 'Final assessment grade saved ✓' });
      setFaGradeOpen(false);
      reloadGrades();
    } catch (e: any) {
      toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
    } finally { setSavingFaGrade(false); }
  };

  const exportCSV = () => {
    const source = filterCourseId !== 'all' ? filtered : (searchGradeStudent ? [searchGradeStudent] : []);
    const headers = ['Name', 'Email', 'Cohort', 'Program', 'Lessons %', 'Quiz Avg', 'Assignment Avg', 'Attendance %', 'Final Avg', 'Weighted %', 'Grade', 'GPA'];
    const rows = source.map(s => {
      const g = grades[s.id];
      return [s.full_name, s.email, s.cohorts?.name || '—', s.cohorts?.course || '—',
        g?.lessonsPct ?? 0, g?.quizAvg ?? '—', g?.assignAvg ?? '—',
        g?.attendPct ?? '—', g?.finalAvg ?? '—', g?.weighted ?? '—',
        g?.grade ?? '—', (g?.gpa ?? 0).toFixed(2)];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'gradebook.csv';
    a.click();
  };

  const renderStudentCard = (s: Student) => {
    const g = grades[s.id];
    if (!g) return null;
    return (
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 text-xl font-bold flex items-center justify-center shrink-0 shadow-md">
                {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate text-lg">{s.full_name}</h3>
                <p className="text-xs text-gray-500">{s.cohorts?.name || '—'} · {s.cohorts?.course || '—'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className={`px-4 py-2 rounded-xl text-2xl font-black ${g.color}`}>{g.grade}</div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-medium">GPA</p>
                  <p className="text-lg font-bold text-gray-900">{g.gpa.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              {[
                { label: 'Lessons', value: `${g.lessonsPct}%`, icon: BookOpen, bg: 'bg-blue-50', fg: 'text-blue-600' },
                { label: 'Quiz Avg', value: g.quizAvg !== null ? `${g.quizAvg}%` : '—', icon: HelpCircle, bg: 'bg-purple-50', fg: 'text-purple-600' },
                { label: 'Assign Avg', value: g.assignAvg !== null ? `${g.assignAvg}%` : '—', icon: ClipboardList, bg: 'bg-amber-50', fg: 'text-amber-600' },
                { label: 'Attendance', value: g.attendPct !== null ? `${g.attendPct}%` : '—', icon: Calendar, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
                { label: 'Final Exam', value: g.finalAvg !== null ? `${g.finalAvg}%` : '—', icon: Star, bg: 'bg-rose-50', fg: 'text-rose-600' },
                { label: 'Weighted', value: g.weighted !== null ? `${g.weighted}%` : '—', icon: Award, bg: 'bg-indigo-50', fg: 'text-indigo-600' },
              ].map(({ label, value, icon: Icon, bg, fg }) => (
                <div key={label} className={`flex items-center gap-2.5 p-3 rounded-xl ${bg}`}>
                  <Icon className={`w-4 h-4 ${fg}`} />
                  <div>
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setDetailStudent(s); setDetailOpen(true); }}>
                <Eye className="w-3.5 h-3.5" /> Full Details
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 gap-2" onClick={clearSearch}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loadingInit) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      <span className="text-gray-500">Loading...</span>
    </div>
  );

  const isSearchMode = filterCourseId === 'all' && search.length >= 2;

  return (
    <div className="space-y-6 p-6 bg-gray-50/40 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gradebook</h1>
          <p className="text-gray-500 text-sm mt-0.5">Quiz 25% · Assignment 25% · Attendance 10% · Final 40%</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading || filterCourseId === 'all'}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0 && !searchGradeStudent}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold mb-1 block">1. Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">2. Program</Label>
            <Select value={filterProgram} onValueChange={setFilterProgram} disabled={filterCohortName === 'all'}>
              <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {availablePrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">3. Course <span className="text-red-400">*</span></Label>
            <Select value={filterCourseId} onValueChange={setFilterCourseId} disabled={filterProgram === 'all'}>
              <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Select —</SelectItem>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label className="text-xs font-semibold mb-1 block">
              Search <span className="font-normal text-gray-400">(works without filters)</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <Input placeholder="Student name or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              {search.length > 0 && (
                <button onClick={clearSearch} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* SEARCH MODE */}
      {isSearchMode && (
        <>
          {searchGradeStudent && !grades[searchGradeStudent.id] && directLoading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="animate-spin w-5 h-5 text-indigo-500" />
              <span className="text-sm text-gray-500">Loading grades for {searchGradeStudent.full_name}...</span>
            </div>
          )}

          {searchGradeStudent && grades[searchGradeStudent.id] && renderStudentCard(searchGradeStudent)}

          {searchResults.length > 1 && !searchGradeStudent && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  <Search className="w-4 h-4 inline mr-1.5 text-indigo-500" />
                  {searchResults.length} students found
                </p>
                <div className="divide-y divide-gray-100">
                  {searchResults.map(s => {
                    const initials = s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{initials}</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                            <p className="text-xs text-gray-400">{s.email} · {s.cohorts?.name || '—'} · {s.cohorts?.course || '—'}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleSearchClick(s)}>
                          <Eye className="w-3.5 h-3.5" /> View Grades
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {searchResults.length === 0 && !directLoading && (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No students found for &ldquo;{search}&rdquo;</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* FILTER MODE: empty state */}
      {!isSearchMode && filterCourseId === 'all' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Select a Cohort → Program → Course to load class grades</p>
            <p className="text-gray-400 text-sm mt-1">Or use the search box above to look up a student directly</p>
          </CardContent>
        </Card>
      )}

      {!isSearchMode && loading && (
        <div className="flex items-center justify-center py-20 gap-2">
          <Loader2 className="animate-spin w-5 h-5 text-indigo-500" />
          <span className="text-sm text-gray-500">Calculating grades...</span>
        </div>
      )}

      {/* Class summary */}
      {!isSearchMode && !loading && filterCourseId !== 'all' && classAvg && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Students', value: filtered.length, icon: Users, bg: 'bg-indigo-50', fg: 'text-indigo-600', suffix: '' },
            { label: 'Lessons', value: classAvg.completed, icon: BookOpen, bg: 'bg-blue-50', fg: 'text-blue-600', suffix: '%' },
            { label: 'Avg Quiz', value: classAvg.quiz !== null ? classAvg.quiz : '—', icon: HelpCircle, bg: 'bg-purple-50', fg: 'text-purple-600', suffix: classAvg.quiz !== null ? '%' : '' },
            { label: 'Avg Assign', value: classAvg.assign !== null ? classAvg.assign : '—', icon: ClipboardList, bg: 'bg-amber-50', fg: 'text-amber-600', suffix: classAvg.assign !== null ? '%' : '' },
            { label: 'Avg Attend', value: classAvg.attend !== null ? classAvg.attend : '—', icon: Calendar, bg: 'bg-emerald-50', fg: 'text-emerald-600', suffix: classAvg.attend !== null ? '%' : '' },
            { label: 'Class Avg', value: classAvg.weighted !== null ? classAvg.weighted : '—', icon: Award, bg: 'bg-rose-50', fg: 'text-rose-600', suffix: classAvg.weighted !== null ? '%' : '' },
          ].map(({ label, value, icon: Icon, bg, fg, suffix }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${fg}`} />
                </div>
                <p className="text-xl font-bold">{value}{suffix}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grade distribution */}
      {!isSearchMode && !loading && filterCourseId !== 'all' && Object.keys(grades).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Grade Distribution</p>
            <div className="flex gap-2 flex-wrap">
              {['A', 'B', 'C', 'D', 'E', 'F', '—'].map(grade => {
                const count = filtered.filter(s => grades[s.id]?.grade === grade).length;
                const colors: Record<string, string> = {
                  A: 'bg-emerald-500', B: 'bg-blue-500', C: 'bg-amber-500',
                  D: 'bg-orange-500', E: 'bg-red-400', F: 'bg-red-600', '—': 'bg-gray-300'
                };
                return (
                  <div key={grade} className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 ${colors[grade]} rounded-xl flex items-center justify-center text-white font-bold text-sm`}>{grade}</div>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main table */}
      {!isSearchMode && !loading && filterCourseId !== 'all' && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b-2">
                <TableHead className="font-bold">Student</TableHead>
                <TableHead className="text-center font-bold">Lessons</TableHead>
                <TableHead className="text-center font-bold">Quiz (25%)</TableHead>
                <TableHead className="text-center font-bold">Assign (25%)</TableHead>
                <TableHead className="text-center font-bold">Attend (10%)</TableHead>
                <TableHead className="text-center font-bold">Final (40%)</TableHead>
                <TableHead className="text-center font-bold border-l-2">Weighted</TableHead>
                <TableHead className="text-center font-bold">Grade</TableHead>
                <TableHead className="text-center font-bold">GPA</TableHead>
                <TableHead className="text-right font-bold">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-24 text-gray-400">No students found.</TableCell>
                </TableRow>
              ) : filtered.map(s => {
                const g = grades[s.id];
                const initials = s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <TableRow key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{initials}</div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-400">{s.cohorts?.name || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{g ? <MiniBar value={g.lessonsPct} /> : <span className="text-xs text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-center"><ScoreBadge value={g?.quizAvg ?? null} /></TableCell>
                    <TableCell className="text-center"><ScoreBadge value={g?.assignAvg ?? null} /></TableCell>
                    <TableCell className="text-center"><ScoreBadge value={g?.attendPct ?? null} /></TableCell>
                    <TableCell className="text-center"><ScoreBadge value={g?.finalAvg ?? null} /></TableCell>
                    <TableCell className="text-center border-l-2">
                      {g?.weighted !== null
                        ? <span className="text-base font-black text-gray-900">{g.weighted}%</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${g?.color || ''}`}>{g?.grade || '—'}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-bold text-gray-700">{g ? g.gpa.toFixed(2) : '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setDetailStudent(s); setDetailOpen(true); }}>
                        <Eye className="w-4 h-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* DETAIL MODAL */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                {detailStudent?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {detailStudent?.full_name}
            </DialogTitle>
            <DialogDescription>{detailStudent?.cohorts?.name} · {detailStudent?.cohorts?.course}</DialogDescription>
          </DialogHeader>

          {detailStudent && grades[detailStudent.id] && (() => {
            const g = grades[detailStudent.id];
            return (
              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Quizzes', value: g.quizAvg !== null ? `${g.quizAvg}%` : '—', bg: 'bg-purple-50' },
                    { label: 'Assignments', value: g.assignAvg !== null ? `${g.assignAvg}%` : '—', bg: 'bg-amber-50' },
                    { label: 'Attendance', value: g.attendPct !== null ? `${g.attendPct}%` : '—', bg: 'bg-emerald-50' },
                    { label: 'Final Exam', value: g.finalAvg !== null ? `${g.finalAvg}%` : '—', bg: 'bg-rose-50' },
                  ].map(({ label, value, bg }) => (
                    <div key={label} className={`p-3 rounded-xl ${bg}`}>
                      <p className="text-[11px] text-gray-500">{label}</p>
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className={`rounded-xl p-4 flex items-center justify-between ${g.color} border`}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Weighted Grade</p>
                    <p className="text-3xl font-black">{g.weighted !== null ? `${g.weighted}%` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black">{g.grade}</p>
                    <p className="text-xs opacity-70">GPA: {g.gpa.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Course Progress
                  </p>
                  <div className="space-y-2">
                    {g.moduleProgress.map(({ module, done, total }) => (
                      <div key={module.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium">{module.title}</span>
                          <span className="text-gray-500">{done}/{total}</span>
                        </div>
                        <MiniBar value={total > 0 ? Math.round((done / total) * 100) : 0} color={done === total && total > 0 ? '#10b981' : '#6366f1'} />
                      </div>
                    ))}
                  </div>
                </div>

                {g.quizDetails.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-purple-500" /> Quiz Results
                    </p>
                    <div className="space-y-1.5">
                      {g.quizDetails.map(({ lesson, score, completed }) => (
                        <div key={lesson.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {completed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-gray-300" />}
                            <span className="text-sm text-gray-700">{lesson.title}</span>
                          </div>
                          <ScoreBadge value={score} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {g.assignDetails.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-amber-500" /> Assignments
                    </p>
                    <div className="space-y-2">
                      {g.assignDetails.map(({ lesson, sub }) => (
                        <div key={lesson.id} className="p-3 bg-gray-50 rounded-xl border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">{lesson.title}</span>
                            <div className="flex items-center gap-2">
                              {sub ? (
                                <>
                                  <SubStatusBadge status={sub.status} />
                                  {sub.score !== null ? <ScoreBadge value={sub.score} /> : <span className="text-xs text-amber-600 font-medium">Ungraded</span>}
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">Not submitted</span>
                              )}
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => { setDetailOpen(false); setTimeout(() => openGradeModal(detailStudent!, lesson, sub), 150); }}>
                                <Pencil className="w-3 h-3 mr-1" /> Grade
                              </Button>
                            </div>
                          </div>
                          {sub && (
                            <div className="mt-2 space-y-1">
                              {sub.submission_type === 'url' && sub.content && (
                                <a href={sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline">
                                  <Globe className="w-3 h-3" /> {sub.content}
                                </a>
                              )}
                              {sub.submission_type === 'file' && sub.file_url && (
                                <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline">
                                  <FileText className="w-3 h-3" /> View file
                                </a>
                              )}
                              {sub.submission_type === 'text' && sub.content && (
                                <div className="p-2 bg-white rounded-lg border text-xs text-gray-600 whitespace-pre-wrap max-h-24 overflow-y-auto">{sub.content}</div>
                              )}
                              {sub.feedback && (
                                <div className="p-2 bg-white rounded-lg border text-xs text-gray-600">
                                  <span className="font-semibold">Feedback: </span>{sub.feedback}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {g.finalDetails.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-rose-500" /> Final Assessments
                    </p>
                    <div className="space-y-2">
                      {g.finalDetails.map(({ assessment, sub }) => {
                        const isQuiz = assessment.type === 'Quiz';
                        const maxScore = isQuiz ? (assessment.questions?.length || 0) : (assessment.total_marks || 100);
                        const pct = sub && sub.score !== null ? Math.round((sub.score / maxScore) * 100) : null;
                        return (
                          <div key={assessment.id} className="p-3 bg-gray-50 rounded-xl border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700">
                                  {isQuiz ? '❓ Quiz' : assessment.type === 'File' ? '📄 File' : '📝 Exam'}
                                </span>
                                <span className="text-sm font-medium text-gray-800">{assessment.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {sub ? (
                                  <>
                                    <SubStatusBadge status={sub.status} />
                                    {sub.score !== null ? (
                                      <span className="text-sm font-bold" style={{ color: (pct ?? 0) >= 70 ? '#059669' : '#dc2626' }}>
                                        {sub.score}/{maxScore} <span className="text-xs text-gray-400">({pct}%)</span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-amber-600 font-medium">Ungraded</span>
                                    )}
                                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => { setDetailOpen(false); setTimeout(() => openFaGradeModal(detailStudent!, assessment, sub), 150); }}>
                                      <Pencil className="w-3 h-3 mr-1" /> Grade
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400">Not submitted</span>
                                )}
                              </div>
                            </div>
                            {sub && (
                              <div className="mt-2 space-y-1.5">
                                <div className="text-xs text-gray-400">Submitted {new Date(sub.submitted_at).toLocaleDateString()} via {sub.submission_type}</div>
                                {sub.submission_type === 'text' && sub.content && (
                                  <div className="p-2 bg-white rounded-lg border text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">{sub.content}</div>
                                )}
                                {sub.submission_type === 'url' && sub.content && (
                                  <a href={sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline break-all">
                                    <Globe className="w-3 h-3" /> {sub.content}
                                  </a>
                                )}
                                {sub.submission_type === 'file' && sub.file_url && (
                                  <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline">
                                    <FileText className="w-3 h-3" /> View file
                                  </a>
                                )}
                                {sub.submission_type === 'quiz' && sub.quiz_answers && assessment.questions && (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {sub.quiz_answers.map((ans, i) => {
                                      const q = assessment.questions![i];
                                      if (!q) return null;
                                      const correct = ans.selectedOption === q.correct;
                                      return (
                                        <div key={i} className={`p-2 rounded-lg text-xs ${correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                          <span className="font-semibold">Q{i + 1}:</span>{' '}
                                          {ans.selectedOption !== null ? q.a[ans.selectedOption] : 'No answer'}
                                          {!correct && <span className="text-green-600 ml-2">(✓ {q.a[q.correct]})</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {sub.feedback && (
                                  <div className="p-2 bg-white rounded-lg border text-xs text-gray-600">
                                    <span className="font-semibold">Feedback: </span>{sub.feedback}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* GRADE ASSIGNMENT MODAL */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grade Assignment</DialogTitle>
            <DialogDescription>
              <strong>{gradingSubject?.student.full_name}</strong> — {gradingSubject?.lesson.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {gradingSubject?.sub ? (
              <div className="p-3 bg-gray-50 rounded-xl border text-sm">
                <p className="text-xs font-semibold text-gray-500 mb-1">Submission</p>
                {gradingSubject.sub.submission_type === 'file' && gradingSubject.sub.file_url && (
                  <a href={gradingSubject.sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline">
                    <FileText className="w-4 h-3.5" /> View file
                  </a>
                )}
                {gradingSubject.sub.submission_type === 'url' && gradingSubject.sub.content && (
                  <a href={gradingSubject.sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline break-all">
                    {gradingSubject.sub.content}
                  </a>
                )}
                {gradingSubject.sub.submission_type === 'text' && gradingSubject.sub.content && (
                  <p className="text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">{gradingSubject.sub.content}</p>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  Submitted {new Date(gradingSubject.sub.submitted_at).toLocaleDateString()} via {gradingSubject.sub.submission_type}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-1" /> Student hasn&apos;t submitted. You can still assign a score.
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Score (0–100)</Label>
                <Input type="number" min={0} max={100} value={gradeInput} onChange={e => setGradeInput(e.target.value)} placeholder="e.g. 85" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Feedback (optional)</Label>
                <Textarea value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} placeholder="Leave feedback..." rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeOpen(false)}>Cancel</Button>
            <Button onClick={saveGrade} disabled={savingGrade} className="bg-indigo-600 hover:bg-indigo-700">
              {savingGrade ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {savingGrade ? 'Saving...' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GRADE FINAL ASSESSMENT MODAL */}
      <Dialog open={faGradeOpen} onOpenChange={setFaGradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grade Final Assessment</DialogTitle>
            <DialogDescription>
              <strong>{faGradingSubject?.student.full_name}</strong> — {faGradingSubject?.assessment.title}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                {faGradingSubject?.assessment.type === 'Quiz' ? '❓ Quiz' : faGradingSubject?.assessment.type === 'File' ? '📄 File' : '📝 Exam'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {faGradingSubject?.sub ? (
              <div className="p-3 bg-gray-50 rounded-xl border text-sm">
                <p className="text-xs font-semibold text-gray-500 mb-2">Student&apos;s Submission</p>
                {faGradingSubject.sub.submission_type === 'text' && faGradingSubject.sub.content && (
                  <p className="text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">{faGradingSubject.sub.content}</p>
                )}
                {faGradingSubject.sub.submission_type === 'url' && faGradingSubject.sub.content && (
                  <a href={faGradingSubject.sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline break-all">
                    {faGradingSubject.sub.content}
                  </a>
                )}
                {faGradingSubject.sub.submission_type === 'file' && faGradingSubject.sub.file_url && (
                  <a href={faGradingSubject.sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 underline">
                    <FileText className="w-3 h-3" /> View file
                  </a>
                )}
                {faGradingSubject.sub.submission_type === 'quiz' && faGradingSubject.sub.quiz_answers && faGradingSubject.assessment.questions && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {faGradingSubject.sub.quiz_answers.map((ans, i) => {
                      const q = faGradingSubject.assessment.questions![i];
                      if (!q) return null;
                      const correct = ans.selectedOption === q.correct;
                      return (
                        <div key={i} className={`p-2 rounded-lg text-xs ${correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <span className="font-semibold">Q{i + 1}:</span>{' '}
                          {ans.selectedOption !== null ? q.a[ans.selectedOption] : 'No answer'}
                          {!correct && <span className="text-green-600 ml-2">(✓ {q.a[q.correct]})</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  Submitted {new Date(faGradingSubject.sub.submitted_at).toLocaleDateString()} via {faGradingSubject.sub.submission_type}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-1" /> Student hasn&apos;t submitted. You can still assign a score.
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Score (0–{faGradingSubject?.assessment.type === 'Quiz'
                    ? (faGradingSubject.assessment.questions?.length || 0)
                    : (faGradingSubject?.assessment.total_marks || 100)})
                </Label>
                <Input type="number" min={0} value={faGradeInput} onChange={e => setFaGradeInput(e.target.value)} placeholder="Enter score" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Feedback (optional)</Label>
                <Textarea value={faFeedbackInput} onChange={e => setFaFeedbackInput(e.target.value)} placeholder="Leave feedback..." rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaGradeOpen(false)}>Cancel</Button>
            <Button onClick={saveFaGrade} disabled={savingFaGrade} className="bg-indigo-600 hover:bg-indigo-700">
              {savingFaGrade ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {savingFaGrade ? 'Saving...' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}