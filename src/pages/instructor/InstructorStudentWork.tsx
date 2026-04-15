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
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, ArrowLeft,
  Download, ChevronLeft, ChevronRight
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
  course_id?: string;
  assignment_id?: string;
  score: number | null;
  total_marks: number;
  submitted_at: string;
  content: string | null;
  feedback: string | null;
  submission_type: string;
  file_url: string | null;
  file_name?: string | null;
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
  file_name?: string | null;
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

async function fetchInstructorCourseIds(userId: string): Promise<string[]> {
  const ids = new Set<string>();

  // Try courses.instructor_id
  try {
    const { data: d1 } = await supabase.from('courses').select('id').eq('instructor_id', userId);
    d1?.forEach((c: { id: string }) => ids.add(c.id));
  } catch (e) {
    console.warn('[StudentWork] courses.instructor_id query failed:', e);
  }

  // Try course_instructors table
  try {
    const { data: j1 } = await supabase.from('course_instructors').select('course_id').eq('instructor_id', userId);
    j1?.forEach((j: { course_id: string }) => ids.add(j.course_id));
  } catch (e) {
    console.warn('[StudentWork] course_instructors query failed:', e);
  }

  return Array.from(ids);
}

// ────────────────────────────────────────────────────────────────
// Helper: extract filename from URL
// ────────────────────────────────────────────────────────────────

function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    return decodeURIComponent(last) || 'Download File';
  } catch {
    return 'Download File';
  }
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

      // ── If no course IDs found, try loading ALL submissions ──
      // (Instructor might be linked differently, or user might be admin)
      const useAllData = courseIds.length === 0;
      if (useAllData) {
        console.log('[StudentWork] No course IDs found — loading ALL submissions (admin fallback)');
      }

      // ── FETCH RAW SUBMISSIONS ──
      // FIX: For assignments and quizzes, only filter by course_id if we have courseIds
      // For assessments, always fetch all (some may not have course_id set)
      const [quizRes, assignRes, assessRes] = await Promise.all([
        supabase
          .from('quiz_results')
          .select('id, user_id, lesson_id, course_id, score, total_questions, passed, created_at'),
        supabase
          .from('assignment_submissions')
          .select('id, user_id, lesson_id, course_id, assignment_id, score, total_marks, submitted_at, content, feedback, submission_type, file_url, file_name, status, graded_at, graded_by'),
        supabase
          .from('assessment_submissions')
          .select('id, user_id, assessment_id, lesson_id, course_id, submission_type, content, file_url, file_name, score, feedback, status, submitted_at, graded_at, quiz_answers, graded_by'),
      ]);

      // ── DIAGNOSTIC LOGGING ──
      console.log('[StudentWork] quiz_results raw:', quizRes.data?.length || 0, 'rows',
        quizRes.error ? 'ERROR: ' + quizRes.error.message : '');
      console.log('[StudentWork] assignment_submissions raw:', assignRes.data?.length || 0, 'rows',
        assignRes.error ? 'ERROR: ' + assignRes.error.message : '');
      console.log('[StudentWork] assessment_submissions raw:', assessRes.data?.length || 0, 'rows',
        assessRes.error ? 'ERROR: ' + assessRes.error.message : '');

      // Log raw data for debugging
      if (assignRes.data?.length) {
        console.log('[StudentWork] Sample assignment:', JSON.stringify(assignRes.data[0], null, 2));
      }

      // ── Server-side course_id filter (if we have courseIds) ──
      let filteredQuizData = quizRes.data || [];
      let filteredAssignData = assignRes.data || [];
      let filteredAssessData = assessRes.data || [];

      if (!useAllData && courseIds.length > 0) {
        filteredQuizData = filteredQuizData.filter((r: any) =>
          !r.course_id || courseIds.includes(r.course_id)
        );
        filteredAssignData = filteredAssignData.filter((r: any) =>
          !r.course_id || courseIds.includes(r.course_id)
        );
        filteredAssessData = filteredAssessData.filter((r: any) =>
          !r.course_id || courseIds.includes(r.course_id)
        );
      }

      console.log('[StudentWork] After course filter — quiz:', filteredQuizData.length,
        'assign:', filteredAssignData.length, 'assess:', filteredAssessData.length);

      // ── Collect all user IDs for name lookups ──
      const allUserIds = new Set<string>();
      filteredQuizData.forEach((r: any) => r.user_id && allUserIds.add(r.user_id));
      filteredAssignData.forEach((r: any) => { r.user_id && allUserIds.add(r.user_id); r.graded_by && allUserIds.add(r.graded_by); });
      filteredAssessData.forEach((r: any) => { r.user_id && allUserIds.add(r.user_id); r.graded_by && allUserIds.add(r.graded_by); });

      // ── Batch fetch profiles ──
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
      console.log('[StudentWork] Profile names loaded:', Object.keys(nameMap).length);

      // ── Fetch modules and lessons for title lookups ──
      const { data: mods } = await supabase
        .from('modules')
        .select('id, course_id');
      const moduleIds = new Set((mods || []).map((m: any) => m.id));
      const moduleIdToCourseId: Record<string, string> = {};
      mods?.forEach((m: any) => { moduleIdToCourseId[m.id] = m.course_id; });

      const lessonTitleMap: Record<string, string> = {};
      const lessonToCourseMap: Record<string, string> = {};
      if (moduleIds.size > 0) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, title, module_id');
        lessons?.forEach((l: any) => {
          lessonTitleMap[l.id] = l.title || 'Untitled Lesson';
          lessonToCourseMap[l.id] = moduleIdToCourseId[l.module_id] || '';
        });
      }

      // ── Fetch enrolled student IDs — try BOTH user_id AND student_id ──
      let enrolledStudentIds = new Set<string>();

      if (!useAllData && courseIds.length > 0) {
        // Try user_id column first (wrap in try/catch since table may not exist)
        try {
          const { data: enrolled1, error: e1Err } = await supabase
            .from('enrollments')
            .select('user_id')
            .in('course_id', courseIds);
          if (!e1Err && enrolled1) {
            enrolled1.forEach((e: any) => { if (e.user_id) enrolledStudentIds.add(e.user_id); });
          } else if (e1Err) {
            console.warn('[StudentWork] enrollments.user_id query error:', e1Err.message);
          }
        } catch (e) { /* table may not exist */ }

        // Also try student_id column
        try {
          const { data: enrolled2, error: e2Err } = await supabase
            .from('enrollments')
            .select('student_id')
            .in('course_id', courseIds);
          if (!e2Err && enrolled2) {
            enrolled2.forEach((e: any) => { if (e.student_id) enrolledStudentIds.add(e.student_id); });
          } else if (e2Err) {
            console.warn('[StudentWork] enrollments.student_id query error:', e2Err.message);
          }
        } catch (e) { /* table may not exist */ }

        console.log('[StudentWork] Enrolled student IDs:', enrolledStudentIds.size);

        // If no enrolled students found, disable the enrollment filter
        if (enrolledStudentIds.size === 0) {
          console.warn('[StudentWork] No enrollments found — showing all submissions.');
        }
      }

      // ── Quiz Results ──
      const quizzes: QuizResult[] = filteredQuizData
        .filter((r: any) => {
          // Only filter by enrollment if we actually found enrolled students
          if (enrolledStudentIds.size > 0) return enrolledStudentIds.has(r.user_id);
          return true; // Bypass enrollment filter if no enrollments found
        })
        .map((r: any) => ({
          ...r,
          student_name: nameMap[r.user_id]?.name || 'Unknown',
          student_email: nameMap[r.user_id]?.email || '',
          lesson_title: lessonTitleMap[r.lesson_id] || 'Unknown Lesson',
        }));

      // ── Assignment Submissions ──
      const assignIds = [...new Set(filteredAssignData.map((r: any) => r.assignment_id).filter(Boolean))] as string[];
      const assignmentTitleMap: Record<string, string> = {};
      const assignmentMarksMap: Record<string, number> = {};
      if (assignIds.length > 0) {
        const { data: assigns } = await supabase
          .from('assignments')
          .select('id, title, total_marks')
          .in('id', assignIds);
        assigns?.forEach((a: any) => {
          assignmentTitleMap[a.id] = a.title;
          if (a.total_marks) assignmentMarksMap[a.id] = a.total_marks;
        });
      }

      const assignments: AssignmentSubmission[] = filteredAssignData
        .filter((r: any) => {
          // Only filter by enrollment if we actually found enrolled students
          if (enrolledStudentIds.size > 0) return enrolledStudentIds.has(r.user_id);
          return true; // Bypass enrollment filter if no enrollments found
        })
        .map((r: any) => ({
          ...r,
          total_marks: r.total_marks || (r.assignment_id ? assignmentMarksMap[r.assignment_id] : 100) || 100,
          student_name: nameMap[r.user_id]?.name || 'Unknown',
          student_email: nameMap[r.user_id]?.email || '',
          lesson_title: lessonTitleMap[r.lesson_id] || 'Unknown Lesson',
          assignment_title: r.assignment_id ? assignmentTitleMap[r.assignment_id] : undefined,
          graded_by_name: r.graded_by ? nameMap[r.graded_by]?.name : undefined,
        }));

      // ── Assessment Submissions ──
      const assessIds = [...new Set(filteredAssessData.map((r: any) => r.assessment_id).filter(Boolean))] as string[];
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

      const assessments: AssessmentSubmission[] = filteredAssessData
        .filter((r: any) => {
          // Only filter by enrollment if we actually found enrolled students
          if (enrolledStudentIds.size > 0 && !enrolledStudentIds.has(r.user_id)) return false;
          // If we have courseIds, verify the assessment belongs to our course
          const assess = assessMap[r.assessment_id];
          if (assess && !useAllData && courseIds.length > 0 && assess.course_id && !courseIds.includes(assess.course_id)) {
            return false;
          }
          return true;
        })
        .map((r: any) => {
          const assess = assessMap[r.assessment_id];
          return {
            ...r,
            student_name: nameMap[r.user_id]?.name || 'Unknown',
            student_email: nameMap[r.user_id]?.email || '',
            assessment_title: assess?.title || 'Unknown Assessment',
            assessment_type: assess?.type || 'Exam',
            total_marks: assess?.total_marks || r.total_marks || 100,
            graded_by_name: r.graded_by ? nameMap[r.graded_by]?.name : undefined,
          };
        });

      setQuizResults(quizzes);
      setAssignmentSubs(assignments);
      setAssessmentSubs(assessments);

      console.log(`[StudentWork] FINAL: ${quizzes.length} quizzes, ${assignments.length} assignments, ${assessments.length} assessments`);
      console.log(`[StudentWork] courseIds: ${courseIds.length}, enrolledStudents: ${enrolledStudentIds.size}, useAllData: ${useAllData}`);
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

  // ── Navigate: Previous / Next submission ─────────────────────

  const navigateSubmission = useCallback((direction: -1 | 1) => {
    if (!detailData) return;

    let items: any[] = [];
    if (detailType === 'assignment') items = assignmentSubs;
    else if (detailType === 'assessment') items = assessmentSubs;
    else return;

    const currentIndex = items.findIndex((item: any) => item.id === detailData.id);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= items.length) return;

    const nextItem = items[newIndex];
    openDetail(detailType, nextItem);
  }, [detailData, detailType, assignmentSubs, assessmentSubs]);

  const hasPrev = useMemo(() => {
    if (!detailData || detailType === 'quiz') return false;
    const items = detailType === 'assignment' ? assignmentSubs : assessmentSubs;
    const idx = items.findIndex((i: any) => i.id === detailData.id);
    return idx > 0;
  }, [detailData, detailType, assignmentSubs, assessmentSubs]);

  const hasNext = useMemo(() => {
    if (!detailData || detailType === 'quiz') return false;
    const items = detailType === 'assignment' ? assignmentSubs : assessmentSubs;
    const idx = items.findIndex((i: any) => i.id === detailData.id);
    return idx >= 0 && idx < items.length - 1;
  }, [detailData, detailType, assignmentSubs, assessmentSubs]);

  // ── Helper: normalize plural tab name to singular type ──
  const toSingular = (t: string): 'assignment' | 'assessment' | 'quiz' => {
    if (t === 'assignments' || t === 'assignment') return 'assignment';
    if (t === 'assessments' || t === 'assessment') return 'assessment';
    return 'quiz';
  };

  // ── Open Detail / Grade ─────────────────────────────────────

  const openDetail = (type: string, item: any) => {
    // Normalize type to singular: 'assignments' → 'assignment', etc.
    const normalizedType = toSingular(type);

    // Reset ALL grading state first to prevent stale data from previous item
    setGradeScore('');
    setGradeFeedback('');
    setGradeTotalMarks(100);
    setConflictWarning(null);
    setDetailLoading(false);
    setGradeSaving(false);

    setDetailType(normalizedType);
    setDetailData(item);
    setDetailOpen(true);

    if (normalizedType === 'assignment') {
      setGradeScore(item.score !== null ? String(item.score) : '');
      setGradeFeedback(item.feedback || '');
      setGradeTotalMarks(item.total_marks || 100);
    } else if (normalizedType === 'assessment') {
      setGradeScore(item.score !== null ? String(item.score) : '');
      setGradeFeedback(item.feedback || '');
      setGradeTotalMarks(item.total_marks || 100);
    }

    console.log('[StudentWork] Opened detail:', normalizedType, 'id:', item.id,
      'score:', item.score, 'status:', item.status, 'feedback:', item.feedback);

    if (normalizedType !== 'quiz') {
      currentSubmissionIdRef.current = item.id;
      startPolling(normalizedType, item.id);
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
            .select('graded_by, graded_at, score, feedback, status, total_marks')
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
          setConflictWarning(`This submission was also graded by ${graderName} at ${time} (Score: ${data.score}/${data.total_marks || '\u2014'})`);
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

  // ── Download File ────────────────────────────────────────────

  const downloadFile = (url: string, fileName?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || extractFileName(url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Save Grade ───────────────────────────────────────────────

  const saveGrade = async () => {
    if (!detailData || !user) return;

    const score = gradeScore ? parseFloat(gradeScore) : null;
    const singularType = toSingular(detailType);

    if (score !== null && (isNaN(score) || score < 0 || score > gradeTotalMarks)) {
      toast({ title: 'Invalid score', description: `Score must be between 0 and ${gradeTotalMarks}`, variant: 'destructive' });
      return;
    }

    setGradeSaving(true);

    try {
      const tableName = singularType === 'assignment' ? 'assignment_submissions' : 'assessment_submissions';

      console.log('[StudentWork] Saving grade — singularType:', singularType, 'tableName:', tableName, 'id:', detailData.id);

      // Build update object — only include columns that exist on the target table
      const updatePayload: Record<string, any> = {
        score,
        feedback: gradeFeedback || null,
        graded_at: new Date().toISOString(),
        graded_by: user.id,
        status: score !== null ? 'graded' : 'submitted',
      };

      // total_marks only exists on assignment_submissions
      if (singularType === 'assignment') {
        updatePayload.total_marks = gradeTotalMarks;
      }

      const { error } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', detailData.id);

      if (error) {
        // Fallback: if total_marks error, retry without it
        if (error.message?.includes('total_marks')) {
          console.warn('[StudentWork] total_marks not supported, retrying without it');
          const { error: retryError } = await supabase
            .from(tableName)
            .update({
              score,
              feedback: gradeFeedback || null,
              graded_at: new Date().toISOString(),
              graded_by: user.id,
              status: score !== null ? 'graded' : 'submitted',
            })
            .eq('id', detailData.id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      // ── VERIFY the save actually worked by reading the row back ──
      const { data: verifyRow, error: verifyError } = await supabase
        .from(tableName)
        .select('id, score, status, graded_at, graded_by, feedback')
        .eq('id', detailData.id)
        .maybeSingle(); // maybeSingle returns null instead of error if no row

      if (verifyError) {
        console.error('[StudentWork] Verification query failed:', verifyError.message);
      } else if (verifyRow) {
        console.log('[StudentWork] VERIFIED DB row:', JSON.stringify(verifyRow, null, 2));
        if (verifyRow.status !== 'graded' && score !== null) {
          console.error('[StudentWork] CRITICAL: Status not updated in DB! Expected graded, got:', verifyRow.status);
        }
      } else {
        console.warn('[StudentWork] Verification: no row found (may be RLS issue)');
      }

      toast({
        title: 'Grade saved successfully',
        description: score !== null ? `Score: ${score}/${gradeTotalMarks}` : 'Feedback saved',
      });

      // Close the grading modal so user sees the updated list
      closeDetail();

      // Re-fetch all data from DB to ensure the list shows the correct status
      await loadAllData();
    } catch (e: any) {
      console.error('[StudentWork] Grade save error:', e.message, e);
      toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
      // Still close modal and reload so user sees current state
      closeDetail();
      await loadAllData();
    } finally {
      setGradeSaving(false);
    }
  };

  // ── Format helpers ───────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const getScoreColor = (score: number | null, total: number) => {
    if (score === null || !total) return '#9ca3af';
    const pct = (score / total) * 100;
    return pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  };

  const getGradeLabel = (score: number | null, total: number) => {
    if (score === null || !total) return null;
    const pct = score / total;
    if (pct >= 0.7) return { label: 'Good', className: 'bg-emerald-100 text-emerald-700' };
    if (pct >= 0.4) return { label: 'Fair', className: 'bg-amber-100 text-amber-700' };
    return { label: 'Poor', className: 'bg-red-100 text-red-700' };
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
                  const gradeInfo = activeTab !== 'quizzes' ? getGradeLabel(score, total) : null;

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
                        {item.file_url && (
                          <p className="text-[10px] text-indigo-500 mt-0.5 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Has attachment
                          </p>
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
                            {gradeInfo && (
                              <Badge className={`text-[10px] ${gradeInfo.className}`}>{gradeInfo.label}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{'\u2014'}</span>
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
                          {item.file_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1 text-gray-500 hover:text-green-600"
                              onClick={(e) => { e.stopPropagation(); downloadFile(item.file_url, item.file_name); }}
                              title="Download attachment"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          )}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" key={detailData?.id || 'none'}>
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
              {detailType === 'quiz' && `Quiz \u2014 ${detailData?.lesson_title}`}
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
                      : '\u2014'}
                </p>
              </div>
            </div>

            {/* File Download */}
            {detailData?.file_url && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm text-indigo-700 font-medium">
                      {detailData.file_name || extractFileName(detailData.file_url)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                    onClick={() => downloadFile(detailData.file_url, detailData.file_name)}
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              </div>
            )}

            {/* Content / Answers */}
            {detailData?.content && detailType !== 'quiz' && (
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400 mb-1">Student Response</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{detailData.content}</p>
              </div>
            )}

            {/* Quiz Answers */}
            {detailType === 'quiz' && (
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400 mb-2">Quiz Summary</p>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold" style={{ color: getScoreColor(detailData?.score, detailData?.total_questions) }}>
                    {detailData?.score}/{detailData?.total_questions}
                  </span>
                  <Badge className={`${detailData?.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {detailData?.passed ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Assessment Quiz Answers */}
            {detailType === 'assessment' && detailData?.quiz_answers && Object.keys(detailData.quiz_answers).length > 0 && (
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[11px] text-gray-400 mb-2">Assessment Answers</p>
                <div className="space-y-2">
                  {Object.entries(detailData.quiz_answers).map(([qNum, answer]: [string, any]) => (
                    <div key={qNum} className="flex gap-2 text-sm">
                      <span className="font-medium text-gray-500 shrink-0">Q{qNum}:</span>
                      <span className="text-gray-800">
                        {typeof answer === 'object' ? JSON.stringify(answer) : String(answer)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Feedback */}
            {detailData?.feedback && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <p className="text-[11px] text-green-600 mb-1">Previous Feedback</p>
                <p className="text-sm text-green-800">{detailData.feedback}</p>
              </div>
            )}

            {/* Graded By Info */}
            {detailData?.graded_by && detailData?.graded_by !== user?.id && detailData?.graded_by_name && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs text-gray-500">
                <span>Previously graded by <strong>{detailData.graded_by_name}</strong></span>
                {detailData.graded_at && <span>on {formatDate(detailData.graded_at)}</span>}
              </div>
            )}

            {/* Grading Form (only for assignments and assessments) */}
            {detailType !== 'quiz' && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Grade this submission
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Score</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={gradeTotalMarks}
                        placeholder="Enter score"
                        value={gradeScore}
                        onChange={e => setGradeScore(e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500">/</span>
                      <Input
                        type="number"
                        min={1}
                        value={gradeTotalMarks}
                        onChange={e => setGradeTotalMarks(parseInt(e.target.value) || 100)}
                        className="w-20"
                        title="Total marks"
                      />
                    </div>
                    {gradeScore && !isNaN(parseFloat(gradeScore)) && (
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((parseFloat(gradeScore) / gradeTotalMarks) * 100, 100)}%`,
                            background: getScoreColor(parseFloat(gradeScore), gradeTotalMarks),
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Quick Actions</Label>
                    <div className="flex flex-wrap gap-2">
                      {[0, 25, 50, 75, 100].map(pct => {
                        const val = Math.round((pct / 100) * gradeTotalMarks);
                        return (
                          <Button key={pct} variant="outline" size="sm" className="text-xs h-8"
                            onClick={() => setGradeScore(String(val))}>
                            {pct}%
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Feedback</Label>
                  <Textarea
                    placeholder="Provide feedback to the student..."
                    value={gradeFeedback}
                    onChange={e => setGradeFeedback(e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {hasPrev && (
                      <Button variant="ghost" size="sm" className="text-xs gap-1"
                        onClick={() => navigateSubmission(-1)}>
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </Button>
                    )}
                    {hasNext && (
                      <Button variant="ghost" size="sm" className="text-xs gap-1"
                        onClick={() => navigateSubmission(1)}>
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={saveGrade}
                    disabled={gradeSaving}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {gradeSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {gradeSaving ? 'Saving...' : 'Save Grade'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
