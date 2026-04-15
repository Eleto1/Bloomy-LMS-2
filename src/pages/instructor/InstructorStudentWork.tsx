import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Search, FileText, ClipboardCheck, AlertTriangle, CheckCircle2,
  Loader2, Eye, MessageSquare, Star, Users, BookOpen, Filter,
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, ArrowLeft
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface QuizResult {
  id: string;
  user_id: string;
  lesson_id: string;
  score: number;
  total_questions: number;
  passed: boolean;
  created_at: string;
  student_name: string;
  student_email: string;
  lesson_title: string;
}

interface AssignmentSubmission {
  id: string;
  user_id: string;
  lesson_id: string;
  assignment_id?: string;
  score: number | null;
  total_marks: number;
  submitted_at: string;
  content: string | null;
  feedback: string | null;
  submission_type: string;
  file_url: string | null;
  status: string;
  graded_at: string | null;
  graded_by: string | null;
  student_name: string;
  student_email: string;
  lesson_title: string;
  assignment_title?: string;
  graded_by_name?: string;
}

interface AssessmentSubmission {
  id: string;
  user_id: string;
  assessment_id: string;
  submission_type: string;
  content: string | null;
  file_url: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submitted_at: string;
  graded_at: string | null;
  quiz_answers: Record<string, any> | null;
  graded_by: string | null;
  student_name: string;
  student_email: string;
  assessment_title: string;
  assessment_type: string;
  total_marks?: number;
  graded_by_name?: string;
}

// ────────────────────────────────────────────────────────────────
// Helper: fetch instructor's course IDs
// ────────────────────────────────────────────────────────────────

async function fetchInstructorCourseIds(userId: string) {
  const ids = new Set<string>();

  const { data: d1 } = await supabase.from('courses').select('id').eq('instructor_id', userId);
  d1?.forEach((c: { id: string }) => ids.add(c.id));

  const { data: j1 } = await supabase.from('course_instructors').select('course_id').eq('instructor_id', userId);
  j1?.forEach((j: { course_id: string }) => ids.add(j.course_id));

  return Array.from(ids);
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export default function InstructorStudentWork() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'assessments' | 'quizzes'>('assignments');

  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [assignmentSubs, setAssignmentSubs] = useState<AssignmentSubmission[]>([]);
  const [assessmentSubs, setAssessmentSubs] = useState<AssessmentSubmission[]>([]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'assignment' | 'assessment' | 'quiz'>('assignment');
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeTotalMarks, setGradeTotalMarks] = useState(100);

  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSubmissionIdRef = useRef<string | null>(null);

  // ── Load Data ─────────────────────────────────────────────────

  useEffect(() => {
    if (user) loadAllData();
    return () => stopPolling();
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const courseIds = await fetchInstructorCourseIds(user.id);
      console.log('[StudentWork] Instructor course IDs:', courseIds);

      if (courseIds.length === 0) {
        setLoading(false);
        return;
      }

      const [quizRes, assignRes, assessRes] = await Promise.all([
        supabase
          .from('quiz_results')
          .select('id, user_id, lesson_id, score, total_questions, passed, created_at')
          .in('user_id', courseIds),
        supabase
          .from('assignment_submissions')
          .select('id, user_id, lesson_id, assignment_id, score, total_marks, submitted_at, content, feedback, submission_type, file_url, status, graded_at, graded_by')
          .order('submitted_at', { ascending: false }),
        supabase
          .from('assessment_submissions')
          .select('id, user_id, assessment_id, submission_type, content, file_url, score, feedback, status, submitted_at, graded_at, quiz_answers, graded_by')
          .order('submitted_at', { ascending: false }),
      ]);

      const allUserIds = new Set<string>();
      quizRes.data?.forEach((r: any) => r.user_id && allUserIds.add(r.user_id));
      assignRes.data?.forEach((r: any) => r.user_id && allUserIds.add(r.user_id));
      assignRes.data?.forEach((r: any) => r.graded_by && allUserIds.add(r.graded_by));
      assessRes.data?.forEach((r: any) => r.user_id && allUserIds.add(r.user_id));
      assessRes.data?.forEach((r: any) => r.graded_by && allUserIds.add(r.graded_by));

      const nameMap: Record<string, { name: string; email: string }> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', Array.from(allUserIds));
        profiles?.forEach((p: any) => {
          nameMap[p.id] = { name: p.full_name || 'Unknown', email: p.email || '' };
        });
      }

      const { data: mods } = await supabase
        .from('modules')
        .select('id, course_id')
        .in('course_id', courseIds);
      const moduleIds = new Set((mods || []).map((m: any) => m.id));

      let lessonIds = new Set<string>();
      if (moduleIds.size > 0) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, title, module_id')
          .in('module_id', Array.from(moduleIds));
        lessons?.forEach((l: any) => lessonIds.add(l.id));

        const lessonTitleMap: Record<string, string> = {};
        lessons?.forEach((l: any) => { lessonTitleMap[l.id] = l.title || 'Untitled Lesson'; });

        const { data: enrolled } = await supabase
          .from('enrollments')
          .select('student_id')
          .in('course_id', courseIds);
        const enrolledStudentIds = new Set((enrolled || []).map((e: any) => e.student_id));

        const quizzes: QuizResult[] = (quizRes.data || [])
          .filter((r: any) => enrolledStudentIds.has(r.user_id))
          .map((r: any) => ({
            ...r,
            student_name: nameMap[r.user_id]?.name || 'Unknown',
            student_email: nameMap[r.user_id]?.email || '',
            lesson_title: lessonTitleMap[r.lesson_id] || 'Unknown Lesson',
          }));

        const assignIds = [...new Set((assignRes.data || []).map((r: any) => r.assignment_id).filter(Boolean))] as string[];
        const assignmentTitleMap: Record<string, string> = {};
        if (assignIds.length > 0) {
          const { data: assigns } = await supabase
            .from('assignments')
            .select('id, title')
            .in('id', assignIds);
          assigns?.forEach((a: any) => { assignmentTitleMap[a.id] = a.title; });
        }

        const assignments: AssignmentSubmission[] = (assignRes.data || [])
          .filter((r: any) => enrolledStudentIds.has(r.user_id) && lessonIds.has(r.lesson_id))
          .map((r: any) => ({
            ...r,
            student_name: nameMap[r.user_id]?.name || 'Unknown',
            student_email: nameMap[r.user_id]?.email || '',
            lesson_title: lessonTitleMap[r.lesson_id] || 'Unknown Lesson',
            assignment_title: r.assignment_id ? assignmentTitleMap[r.assignment_id] : undefined,
            graded_by_name: r.graded_by ? nameMap[r.graded_by]?.name : undefined,
          }));

        const assessIds = [...new Set((assessRes.data || []).map((r: any) => r.assessment_id).filter(Boolean))] as string[];
        const assessMap: Record<string, any> = {};
        if (assessIds.length > 0) {
          const { data: assess } = await supabase
            .from('assessments')
            .select('id, title, type, total_marks, course_id')
            .in('id', assessIds);
          assess?.forEach((a: any) => {
            assessMap[a.id] = a;
          });
        }

        const assessments: AssessmentSubmission[] = (assessRes.data || [])
          .filter((r: any) => {
            const assess = assessMap[r.assessment_id];
            return enrolledStudentIds.has(r.user_id) && assess && courseIds.includes(assess.course_id);
          })
          .map((r: any) => {
            const assess = assessMap[r.assessment_id];
            return {
              ...r,
              student_name: nameMap[r.user_id]?.name || 'Unknown',
              student_email: nameMap[r.user_id]?.email || '',
              assessment_title: assess?.title || 'Unknown Assessment',
              assessment_type: assess?.type || 'Exam',
              total_marks: assess?.total_marks || 100,
              graded_by_name: r.graded_by ? nameMap[r.graded_by]?.name : undefined,
            };
          });

        setQuizResults(quizzes);
        setAssignmentSubs(assignments);
        setAssessmentSubs(assessments);
      }
    } catch (e: any) {
      console.error('[StudentWork] Load error:', e);
      toast({ title: 'Error loading student work', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Filtering & Sorting ──────────────────────────────────────

  const getFilteredItems = useCallback(() => {
    let items: any[] = [];

    if (activeTab === 'quizzes') items = quizResults;
    else if (activeTab === 'assignments') items = assignmentSubs;
    else items = assessmentSubs;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i: any) =>
        i.student_name?.toLowerCase().includes(q) ||
        i.student_email?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      if (activeTab === 'assignments') {
        items = items.filter((i: AssignmentSubmission) => i.status === filterStatus);
      } else if (activeTab === 'assessments') {
        items = items.filter((i: AssessmentSubmission) => i.status === filterStatus);
      } else {
        if (filterStatus === 'passed') items = items.filter((i: QuizResult) => i.passed);
        else if (filterStatus === 'failed') items = items.filter((i: QuizResult) => !i.passed);
      }
    }

    items = [...items].sort((a: any, b: any) => {
      const dateA = new Date(a.submitted_at || a.created_at || 0).getTime();
      const dateB = new Date(b.submitted_at || b.created_at || 0).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return items;
  }, [activeTab, quizResults, assignmentSubs, assessmentSubs, search, filterStatus, sortOrder]);

  const filteredItems = getFilteredItems();

  const counts = useMemo(() => ({
    assignments: assignmentSubs.length,
    assessments: assessmentSubs.length,
    quizzes: quizResults.length,
  }), [assignmentSubs, assessmentSubs, quizResults]);

  const pendingCount = useMemo(() => {
    if (activeTab === 'assignments') return assignmentSubs.filter(s => s.status === 'submitted' && !s.graded_at).length;
    if (activeTab === 'assessments') return assessmentSubs.filter(s => s.status === 'submitted' && !s.graded_at).length;
    return 0;
  }, [activeTab, assignmentSubs, assessmentSubs]);

  // ── Open Detail / Grade ─────────────────────────────────────

  const openDetail = (type: 'assignment' | 'assessment' | 'quiz', item: any) => {
    setDetailType(type);
    setDetailData(item);
    setDetailOpen(true);
    setConflictWarning(null);
    setDetailLoading(false);

    if (type === 'assignment') {
      setGradeScore(item.score !== null ? String(item.score) : '');
      setGradeFeedback(item.feedback || '');
      setGradeTotalMarks(item.total_marks || 100);
    } else if (type === 'assessment') {
      setGradeScore(item.score !== null ? String(item.score) : '');
      setGradeFeedback(item.feedback || '');
      setGradeTotalMarks(item.total_marks || 100);
    }

    if (type !== 'quiz') {
      currentSubmissionIdRef.current = item.id;
      startPolling(type, item.id);
    }
  };

  // ── Conflict Detection (Polling) ────────────────────────────

  const startPolling = (type: string, submissionId: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        let data: any;
        if (type === 'assignment') {
          const { data: d } = await supabase
            .from('assignment_submissions')
            .select('graded_by, graded_at, score, feedback, status')
            .eq('id', submissionId)
            .single();
          data = d;
        } else {
          const { data: d } = await supabase
            .from('assessment_submissions')
            .select('graded_by, graded_at, score, feedback, status')
            .eq('id', submissionId)
            .single();
          data = d;
        }

        if (data && data.graded_by && data.graded_by !== user?.id && data.graded_at) {
          const { data: grader } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.graded_by)
            .single();
          const graderName = (grader as any)?.full_name || 'Another instructor';
          const time = new Date(data.graded_at).toLocaleString();
          setConflictWarning(`This submission was also graded by ${graderName} at ${time} (Score: ${data.score}/${data.total_marks || '—'})`);
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    currentSubmissionIdRef.current = null;
  };

  const closeDetail = () => {
    stopPolling();
    setDetailOpen(false);
    setDetailData(null);
    setConflictWarning(null);
  };

  // ── Save Grade ───────────────────────────────────────────────

  const saveGrade = async () => {
    if (!detailData || !user) return;

    const score = gradeScore ? parseFloat(gradeScore) : null;

    if (score !== null && (isNaN(score) || score < 0 || score > gradeTotalMarks)) {
      toast({ title: 'Invalid score', description: `Score must be between 0 and ${gradeTotalMarks}`, variant: 'destructive' });
      return;
    }

    setGradeSaving(true);

    try {
      const tableName = detailType === 'assignment' ? 'assignment_submissions' : 'assessment_submissions';

      const { error } = await supabase
        .from(tableName)
        .update({
          score,
          feedback: gradeFeedback || null,
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          status: score !== null ? 'graded' : 'submitted',
        })
        .eq('id', detailData.id);

      if (error) throw error;

      toast({
        title: 'Grade saved successfully',
        description: score !== null ? `Score: ${score}/${gradeTotalMarks}` : 'Feedback saved',
      });

      if (detailType === 'assignment') {
        setAssignmentSubs(prev => prev.map(s =>
          s.id === detailData.id
            ? { ...s, score, feedback: gradeFeedback || null, graded_at: new Date().toISOString(), graded_by: user.id, status: score !== null ? 'graded' : 'submitted', graded_by_name: user.user_metadata?.full_name || 'You' }
            : s
        ));
      } else {
        setAssessmentSubs(prev => prev.map(s =>
          s.id === detailData.id
            ? { ...s, score, feedback: gradeFeedback || null, graded_at: new Date().toISOString(), graded_by: user.id, status: score !== null ? 'graded' : 'submitted', graded_by_name: user.user_metadata?.full_name || 'You' }
            : s
        ));
      }

      setDetailData(prev => prev ? {
        ...prev,
        score,
        feedback: gradeFeedback || null,
        graded_at: new Date().toISOString(),
        graded_by: user.id,
        status: score !== null ? 'graded' : 'submitted',
      } : prev);

      stopPolling();
      if (detailType !== 'quiz') {
        startPolling(detailType, detailData.id);
      }
    } catch (e: any) {
      toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
    } finally {
      setGradeSaving(false);
    }
  };

  // ── Format helpers ───────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const getScoreColor = (score: number | null, total: number) => {
    if (score === null) return '#9ca3af';
    const pct = (score / total) * 100;
    return pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-gray-500">Loading student work...</span>
      </div>
    );
  }

  const tabs: { key: 'assignments' | 'assessments' | 'quizzes'; label: string; icon: any }[] = [
    { key: 'assignments', label: 'Assignments', icon: FileText },
    { key: 'assessments', label: 'Assessments', icon: ClipboardCheck },
    { key: 'quizzes', label: 'Quiz Results', icon: Star },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Student Work</h2>
          <p className="text-sm text-muted-foreground">
            Review submissions, grade assignments, and track student performance
          </p>
        </div>
        <Button onClick={loadAllData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const count = counts[tab.key];
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setFilterStatus('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="hidden sm:inline">{count}</span>
              {isActive && pendingCount > 0 && tab.key !== 'quizzes' && (
                <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">{pendingCount} pending</Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {activeTab === 'quizzes' ? (
                  <>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="submitted">Pending</SelectItem>
                    <SelectItem value="graded">Graded</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={v => setSortOrder(v as 'newest' | 'oldest')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-200" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No Submissions Found</h3>
            <p className="text-sm text-gray-400">
              {search ? 'No results match your search.' : 'No student submissions yet for this category.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {activeTab === 'assignments' ? 'Lesson' : activeTab === 'assessments' ? 'Assessment' : 'Lesson'}
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item: any) => {
                  const initials = getInitials(item.student_name || 'U');
                  const score = item.score;
                  const total = activeTab === 'quizzes' ? item.total_questions : (item.total_marks || 100);

                  return (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{item.student_name}</p>
                            <p className="text-xs text-gray-400 truncate">{item.student_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-700 truncate max-w-[200px]">
                          {activeTab === 'assignments'
                            ? (item.assignment_title || item.lesson_title)
                            : activeTab === 'assessments'
                            ? item.assessment_title
                            : item.lesson_title}
                        </p>
                        {activeTab === 'assessments' && (
                          <Badge variant="outline" className="text-[10px] mt-1">{item.assessment_type}</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-gray-500">
                          {formatDate(item.submitted_at || item.created_at)}
                        </span>
                      </td>
                      <td className="p-4">
                        {activeTab === 'quizzes' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: getScoreColor(item.score, item.total_questions) }}>
                              {item.score}/{item.total_questions}
                            </span>
                            <Badge className={`text-[10px] ${item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {item.passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </div>
                        ) : score !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min((score / total) * 100, 100)}%`, background: getScoreColor(score, total) }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: getScoreColor(score, total) }}>{score}/{total}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {activeTab === 'quizzes' ? (
                          <Badge className="bg-gray-100 text-gray-600 text-xs">{item.passed ? 'Completed' : 'Failed'}</Badge>
                        ) : (
                          <Badge className={`text-xs ${
                            item.status === 'graded'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.status === 'graded' ? 'Graded' : 'Pending'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1 text-gray-500 hover:text-indigo-600"
                            onClick={() => openDetail(activeTab, item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {activeTab === 'quizzes' ? 'View' : item.status === 'graded' ? 'Review' : 'Grade'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── DETAIL / GRADING MODAL ────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                {detailData ? getInitials(detailData.student_name) : ''}
              </div>
              <div>
                <span>{detailData?.student_name}</span>
                <p className="text-sm font-normal text-gray-400">{detailData?.student_email}</p>
              </div>
            </DialogTitle>
            <DialogDescription>
              {detailType === 'assignment' && (detailData?.assignment_title || detailData?.lesson_title)}
              {detailType === 'assessment' && `${detailData?.assessment_title} (${detailData?.assessment_type})`}
              {detailType === 'quiz' && `Quiz — ${detailData?.lesson_title}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Conflict Warning */}
            {conflictWarning && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Grading Conflict Detected</p>
                  <p className="text-xs text-amber-700 mt-0.5">{conflictWarning}</p>
                </div>
              </div>
            )}

            {/* Submission Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400">Submitted</p>
                <p className="text-xs font-semibold text-gray-900">{formatDate(detailData?.submitted_at || detailData?.created_at)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400">Type</p>
                <p className="text-xs font-semibold text-gray-900 capitalize">{detailData?.submission_type || detailType}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400">Status</p>
                <Badge className={`text-xs mt-1 ${detailData?.status === 'graded' || detailType === 'quiz' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {detailType === 'quiz' ? (detailData?.passed ? 'Passed' : 'Failed') : (detailData?.status === 'graded' ? 'Graded' : 'Pending')}
                </Badge>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400">Score</p>
                <p className="text-xs font-bold" style={{ color: getScoreColor(
                  detailData?.score ?? null,
                  detailType === 'quiz' ? (detailData?.total_questions || 1) : (detailData?.total_marks || 100)
                )}}>
                  {detailType === 'quiz'
                    ? `${detailData?.score}/${detailData?.total_questions}`
                    : (detailData?.score !== null && detailData?.score !== undefined)
                      ? `${detailData?.score}/${detailData?.total_marks || 100}`
                      : '—'}
                </p>
              </div>
            </div>

            {/* Previous Grader Info */}
            {detailData?.graded_by_name && detailData?.graded_by !== user?.id && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700">
                  Previously graded by <strong>{detailData.graded_by_name}</strong> on {formatDate(detailData.graded_at)}
                </span>
              </div>
            )}

            {/* Student's Submission Content */}
            {detailData?.content && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Student Submission
                </p>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{detailData.content}</p>
                </div>
              </div>
            )}

            {/* File Attachment */}
            {detailData?.file_url && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Attached File
                </p>
                <a
                  href={detailData.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">View Attachment</p>
                    <p className="text-xs text-gray-400">Click to open in new tab</p>
                  </div>
                </a>
              </div>
            )}

            {/* Quiz Answers */}
            {detailType === 'assessment' && detailData?.quiz_answers && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5" /> Quiz Answers
                </p>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                  {Object.entries(detailData.quiz_answers).map(([qNum, answer]: [string, any], i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">Q{parseInt(qNum) + 1}</Badge>
                      <span className="text-sm text-gray-700">{typeof answer === 'string' ? answer : JSON.stringify(answer)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Feedback */}
            {detailData?.feedback && detailType !== 'quiz' && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Previous Feedback
                </p>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailData.feedback}</p>
                </div>
              </div>
            )}

            {/* ─── Grading Interface (hidden for quizzes) ──── */}
            {detailType !== 'quiz' && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Grade This Submission
                </p>
                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Score</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max={gradeTotalMarks}
                          placeholder="0"
                          className="w-24"
                          value={gradeScore}
                          onChange={e => setGradeScore(e.target.value)}
                        />
                        <span className="text-sm text-gray-400">/ {gradeTotalMarks}</span>
                      </div>
                    </div>
                    <div className="pb-1">
                      {gradeScore && !isNaN(parseFloat(gradeScore)) && (
                        <Badge className={`text-xs ${parseFloat(gradeScore) / gradeTotalMarks >= 0.7 ? 'bg-emerald-100 text-emerald-700' : parseFloat(gradeScore) / gradeTotalMarks >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {parseFloat(gradeScore) / gradeTotalMarks >= 0.7 ? 'Good' : parseFloat(gradeScore) / gradeTotalMarks >= 0.4 ? 'Fair' : 'Poor'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Feedback</Label>
                    <Textarea
                      placeholder="Write feedback for the student..."
                      className="mt-1 min-h-[80px]"
                      value={gradeFeedback}
                      onChange={e => setGradeFeedback(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={closeDetail}
                      disabled={gradeSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveGrade}
                      disabled={gradeSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    >
                      {gradeSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Save Grade
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {detailType !== 'quiz' && (
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={closeDetail}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}