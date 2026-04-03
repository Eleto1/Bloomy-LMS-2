import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, FileText, Video, Link as LinkIcon, LayoutDashboard,
  ChevronDown, ChevronRight, Paperclip, ClipboardList,
  CalendarDays, Eye, Globe, Star, HelpCircle, BookOpen, X,
  AlertCircle, Users, Layers, Pencil, Save,
  CheckCircle2, Clock, Award, Send, GraduationCap
} from 'lucide-react';

const LESSON_TYPES: Record<string, { label: string; icon: React.ReactNode }> = {
  text:       { label: 'Text Content',  icon: <FileText className="w-4 h-4 text-blue-500" /> },
  video:      { label: 'Video',         icon: <Video className="w-4 h-4 text-purple-500" /> },
  assignment: { label: 'Assignment',    icon: <ClipboardList className="w-4 h-4 text-rose-500" /> },
  quiz:       { label: 'Quiz',          icon: <HelpCircle className="w-4 h-4 text-amber-500" /> },
  survey:     { label: 'Survey',        icon: <ClipboardList className="w-4 h-4 text-emerald-500" /> },
  header:     { label: 'Section Header', icon: <LayoutDashboard className="w-4 h-4 text-indigo-500" /> },
  url:        { label: 'External Link', icon: <Globe className="w-4 h-4 text-cyan-500" /> },
};

interface Course { 
  id: string; 
  title: string; 
  description: string; 
  program: string; 
  status: string; 
  created_at?: string;
  instructor_id?: string;
}
interface Module   { id: string; title: string; course_id: string; order_index: number; unlock_date?: string; }
interface Lesson   { id: string; title: string; type: string; content: string; module_id: string; order_index: number; file_url?: string; file_downloadable?: boolean; indent_level?: number; quiz_data?: any; assignment_config?: any; }
interface Schedule { id: string; title: string; scheduled_at: string; days: string[]; time: string; is_recurring: boolean; meeting_url: string; }
interface Cohort   { id: string; name: string; course: string; }
interface AssignLesson {
  lesson: Lesson;
  module: Module;
  submissions: AssignSub[];
}
interface AssignSub {
  id?: string;
  lesson_id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  score: number | null;
  status: string;
  submitted_at: string;
  feedback: string | null;
  submission_type: string;
  content: string | null;
  file_url: string | null;
}

async function fetchInstructorCohorts(userId: string): Promise<Cohort[]> {
  const { data: d1 } = await supabase.from('cohorts').select('id, name, course').eq('instructor_id', userId).order('name');
  if (d1 && d1.length > 0) return d1;
  
  const { data: d2 } = await supabase.from('cohorts').select('id, name, course').eq('teacher_id', userId).order('name');
  if (d2 && d2.length > 0) return d2;
  
  const { data: courses1 } = await supabase.from('courses').select('id, program').eq('instructor_id', userId);
  if (courses1 && courses1.length > 0) {
    const progs = [...new Set(courses1.map(c => c.program).filter(Boolean))];
    if (progs.length > 0) {
      const { data: c1 } = await supabase.from('cohorts').select('id, name, course').in('course', progs).order('name');
      if (c1 && c1.length > 0) return c1;
    }
  }
  
  try {
    const { data: courses2 } = await supabase.from('courses').select('id, program').eq('created_by', userId);
    if (courses2 && courses2.length > 0) {
      const progs = [...new Set(courses2.map(c => c.program).filter(Boolean))];
      if (progs.length > 0) {
        const { data: c2 } = await supabase.from('cohorts').select('id, name, course').in('course', progs).order('name');
        if (c2 && c2.length > 0) return c2;
      }
    }
  } catch { /* column may not exist */ }
  
  const { data: junc } = await supabase.from('cohort_instructors').select('cohort_id').eq('instructor_id', userId);
  if (junc && junc.length > 0) {
    const ids = junc.map(r => r.cohort_id);
    const { data: c3 } = await supabase.from('cohorts').select('id, name, course').in('id', ids).order('name');
    if (c3 && c3.length > 0) return c3;
  }
  return [];
}

export default function InstructorCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorCohorts, setInstructorCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [filterCohortName, setFilterCohortName] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'Draft' });
  const [saving, setSaving] = useState(false);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courseCohorts, setCourseCohorts] = useState<Cohort[]>([]);
  const [builderLoading, setBuilderLoading] = useState(false);

  const [lessonViewerOpen, setLessonViewerOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  // ── Submissions state ──
  const [assignLessons, setAssignLessons] = useState<AssignLesson[]>([]);
  const [expandedAssign, setExpandedAssign] = useState<string | null>(null);
  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  const [gradingSub, setGradingSub] = useState<AssignSub | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradingSaving, setGradingSaving] = useState(false);

  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const cohortList = await fetchInstructorCohorts(user.id);
      setInstructorCohorts(cohortList);
      
      if (cohortList.length === 0) { setLoading(false); return; }
      
      const programs = [...new Set(cohortList.map(c => c.course).filter(Boolean))];
      if (programs.length === 0) { setLoading(false); return; }

      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .in('program', programs)
        .order('created_at', { ascending: false });
        
      setCourses(courseData || []);
    } catch (e: any) {
      toast({ title: 'Error loading courses', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openBuilder = async (course: Course) => {
    setBuilderLoading(true);
    setActiveCourse(course);
    setModules([]);
    setLessons({});
    setSchedules([]);
    setCourseCohorts([]);
    setExpandedModules({});
    setAssignLessons([]);
    setExpandedAssign(null);
    setBuilderOpen(true);
    try {
      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
      const moduleIds = (mods || []).map(m => m.id);

      const [lessRes, schedRes, chtsRes] = await Promise.all([
        moduleIds.length > 0 
          ? supabase.from('lessons').select('*').in('module_id', moduleIds).order('order_index') 
          : { data: [] },
        supabase.from('schedules').select('*').eq('course_id', course.id),
        supabase.from('cohorts').select('*').eq('course', course.program),
      ]);

      if (mods) setModules(mods);
      
      const less = lessRes.data;
      if (less) {
        const map: Record<string, Lesson[]> = {};
        less.forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); });
        setLessons(map);

        // ── Fetch assignment submissions ──
        const assignTypeLessons = less.filter(l => l.type === 'assignment');
        if (assignTypeLessons.length > 0) {
          const assignLessonIds = assignTypeLessons.map(l => l.id);
          const moduleMap: Record<string, Module> = {};
          (mods || []).forEach(m => { moduleMap[m.id] = m; });

          // Fetch all submissions for these assignment lessons
          const { data: subs } = await supabase
            .from('assignment_submissions')
            .select('*')
            .in('lesson_id', assignLessonIds)
            .order('submitted_at', { ascending: false });

          // Get unique student IDs to fetch their names
          const studentIds = [...new Set((subs || []).map(s => s.user_id))];
          let studentMap: Record<string, { full_name: string; email: string }> = {};
          if (studentIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', studentIds);
            (profiles || []).forEach(p => {
              studentMap[p.id] = { full_name: p.full_name || 'Unknown', email: p.email || '' };
            });
          }

          // Build assignment lessons with submissions
          const assignItems: AssignLesson[] = assignTypeLessons.map(lesson => {
            const lessonSubs = (subs || [])
              .filter(s => s.lesson_id === lesson.id)
              .map(s => ({
                ...s,
                student_name: studentMap[s.user_id]?.full_name || 'Unknown',
                student_email: studentMap[s.user_id]?.email || '',
              }));
            return {
              lesson,
              module: moduleMap[lesson.module_id] || { id: '', title: 'Unknown', course_id: '', order_index: 0 },
              submissions: lessonSubs,
            };
          });

          setAssignLessons(assignItems);
        }
      }
      if (schedRes.data) setSchedules(schedRes.data);
      if (chtsRes.data) setCourseCohorts(chtsRes.data);

      const exp: Record<string, boolean> = {};
      (mods || []).forEach(m => { exp[m.id] = true; });
      setExpandedModules(exp);
    } catch (e: any) {
      toast({ title: 'Error opening builder', description: e.message, variant: 'destructive' });
    } finally {
      setBuilderLoading(false);
    }
  };

  const openLessonViewer = (lesson: Lesson, moduleId: string) => {
    setActiveLesson(lesson);
    setActiveModuleId(moduleId);
    setLessonViewerOpen(true);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setEditForm({ title: course.title, description: course.description || '', status: course.status });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingCourse || !editForm.title) return toast({ title: 'Title is required', variant: 'destructive' });
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({ title: editForm.title, description: editForm.description || null, status: editForm.status })
        .eq('id', editingCourse.id);
      if (error) throw error;
      toast({ title: 'Course updated ✓' });
      setEditModalOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error updating course', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Grade submission ──
  const openGradingDialog = (sub: AssignSub) => {
    setGradingSub(sub);
    setGradeScore(sub.score !== null ? String(sub.score) : '');
    setGradeFeedback(sub.feedback || '');
    setGradingDialogOpen(true);
  };

  const handleSaveGrade = async () => {
    if (!gradingSub) return;
    const scoreNum = parseInt(gradeScore, 10);
    if (gradeScore === '' || isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      toast({ title: 'Invalid score', description: 'Enter a number between 0 and 100', variant: 'destructive' });
      return;
    }
    setGradingSaving(true);
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: scoreNum,
          feedback: gradeFeedback.trim() || null,
          status: 'graded',
        })
        .eq('lesson_id', gradingSub.lesson_id)
        .eq('user_id', gradingSub.user_id);

      if (error) throw error;

      // Update local state
      setAssignLessons(prev => prev.map(al => ({
        ...al,
        submissions: al.submissions.map(s =>
          s.lesson_id === gradingSub.lesson_id && s.user_id === gradingSub.user_id
            ? { ...s, score: scoreNum, feedback: gradeFeedback.trim() || null, status: 'graded' }
            : s
        ),
      })));

      toast({ title: `Graded ${scoreNum}% ✓`, description: `${gradingSub.student_name}'s assignment has been graded.` });
      setGradingDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
    } finally {
      setGradingSaving(false);
    }
  };

  const uniqueCohortNames = Array.from(new Set(instructorCohorts.map(c => c.name)));
  const displayedPrograms = filterCohortName !== 'all'
    ? Array.from(new Set(instructorCohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : Array.from(new Set(instructorCohorts.map(c => c.course)));
    
  const getCohortNames = (program: string) =>
    instructorCohorts.filter(c => c.course === program).map(c => c.name).join(', ') || 'No Cohort';

  const filtered = courses.filter(c => {
    const matchSearch = searchText
      ? (c.title?.toLowerCase().includes(searchText.toLowerCase()) || c.program?.toLowerCase().includes(searchText.toLowerCase()))
      : true;
    const matchCohort = filterCohortName !== 'all'
      ? instructorCohorts.some(ch => ch.name === filterCohortName && ch.course === c.program)
      : true;
    const matchProgram = filterProgram !== 'all' ? c.program === filterProgram : true;
    return matchSearch && matchCohort && matchProgram;
  });

  useEffect(() => { setFilterProgram('all'); }, [filterCohortName]);
  
  const groupedSchedules = schedules.reduce((acc, s) => {
    const k = s.time || '00:00';
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const totalLessons = Object.values(lessons).flat().filter(l => l.type !== 'header').length;
  const completedByType = (type: string) => Object.values(lessons).flat().filter(l => l.type === type).length;

  // Submission stats
  const totalSubmissions = assignLessons.reduce((a, al) => a + al.submissions.length, 0);
  const gradedSubmissions = assignLessons.reduce((a, al) => a + al.submissions.filter(s => s.status === 'graded').length, 0);
  const pendingSubmissions = totalSubmissions - gradedSubmissions;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-gray-500">Loading courses...</span>
      </div>
    );
  }

  if (instructorCohorts.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
          <BookOpen className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Courses Available</h2>
        <p className="text-gray-500 mb-6">You haven&apos;t been assigned to any cohorts yet. Contact your administrator to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="font-bold text-2xl text-foreground">My Courses</h2>
        <p className="text-muted-foreground text-sm">View and edit courses for your assigned cohorts</p>
      </div>

      <Card className="p-4 border-0 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Title or program..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Filter by Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Filter by Program</Label>
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {displayedPrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {(searchText || filterCohortName !== 'all' || filterProgram !== 'all') && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setSearchText(''); setFilterCohortName('all'); setFilterProgram('all'); }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(course => (
          <Card key={course.id} className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-24 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center p-4">
              <h3 className="font-bold text-lg text-white text-center leading-tight">{course.title}</h3>
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-1 mb-3">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{course.program || 'General'}</span>
                <span className="text-xs text-gray-500 truncate"><strong>Cohorts:</strong> {getCohortNames(course.program)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${course.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {course.status}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openBuilder(course)}>
                    <Eye className="w-3.5 h-3.5" /> Content
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-gray-600 hover:text-indigo-600" onClick={() => openEditModal(course)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p>No courses found.</p>
          </div>
        )}
      </div>

      {/* ── EDIT MODAL ── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-indigo-500" /> Edit Course
            </DialogTitle>
            <DialogDescription>
              Update the course details below. Content modules and lessons are unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-medium">Course Title *</Label>
              <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="e.g. Digital Marketing Essentials" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Course description..." rows={4} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs font-medium">Status</Label>
              <div className="flex flex-col gap-2 mt-1.5">
                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                  </SelectContent>
                </Select>
                <div className="p-3 bg-gray-50 border rounded-xl">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                    Only the title, description, and status can be edited here. To modify modules and lessons, use the Content view.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COURSE BUILDER ── */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              {activeCourse?.title}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold">{activeCourse?.program}</span>
                <span className="text-muted-foreground">Course management — view content, schedules, submissions & cohorts</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {builderLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-sm text-gray-500">Loading course content...</span>
            </div>
          ) : (
            <Tabs defaultValue="modules" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="modules" className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger value="submissions" className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" /> Submissions
                  {pendingSubmissions > 0 && (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">{pendingSubmissions}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Schedule
                </TabsTrigger>
                <TabsTrigger value="cohorts" className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Cohorts
                </TabsTrigger>
              </TabsList>

              {/* ── CONTENT TAB ── */}
              <TabsContent value="modules">
                <div className="pt-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                      <p className="text-2xl font-bold text-indigo-700">{modules.length}</p>
                      <p className="text-[11px] text-indigo-500 font-medium">Modules</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                      <p className="text-2xl font-bold text-purple-700">{totalLessons}</p>
                      <p className="text-[11px] text-purple-500 font-medium">Lessons</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                      <p className="text-2xl font-bold text-rose-700">{completedByType('assignment')}</p>
                      <p className="text-[11px] text-rose-500 font-medium">Assignments</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-2xl font-bold text-amber-700">{totalSubmissions}</p>
                      <p className="text-[11px] text-amber-500 font-medium">Submissions</p>
                    </div>
                  </div>

                  {modules.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Layers className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No modules created yet.</p>
                    </div>
                  ) : modules.map((mod, idx) => {
                    const isExp = expandedModules[mod.id];
                    const modLessons = lessons[mod.id] || [];
                    const done = modLessons.filter(l => l.type !== 'header').length;
                    return (
                      <div key={mod.id} className="border rounded-xl overflow-hidden shadow-sm">
                        <div
                          className="flex items-center justify-between p-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => setExpandedModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {isExp ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                            <span className="font-semibold text-sm">{idx + 1}. {mod.title}</span>
                            {mod.unlock_date && (
                              <span className="text-xs text-blue-500 font-normal">(unlocks {new Date(mod.unlock_date).toLocaleDateString()})</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 font-medium">{done} items</span>
                        </div>
                        {isExp && (
                          <div className="p-3 space-y-1.5">
                            {modLessons.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">No lessons in this module.</p>
                            ) : modLessons.map(les => {
                              const Icon = LESSON_TYPES[les.type]?.icon || <FileText className="w-4 h-4 text-gray-400" />;
                              return (
                                <div
                                  key={les.id}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer hover:bg-indigo-50/40 transition-colors ${les.type === 'header' ? 'bg-indigo-50 font-bold border-indigo-100' : 'bg-white'}`}
                                  style={{ marginLeft: `${(les.indent_level || 0) * 20}px` }}
                                  onClick={() => openLessonViewer(les, mod.id)}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {Icon}
                                    <span className="truncate">{les.title}</span>
                                    {les.file_url && <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {les.type === 'quiz' && les.quiz_data && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{les.quiz_data.length}Q</span>
                                    )}
                                    {les.type === 'survey' && les.quiz_data && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{les.quiz_data.length}Q</span>
                                    )}
                                    {les.type === 'assignment' && les.assignment_config?.instructions && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">has brief</span>
                                    )}
                                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ════════════════════════════════════════════════════════
                  SUBMISSIONS TAB — View & Grade Assignments
                  ════════════════════════════════════════════════════════ */}
              <TabsContent value="submissions">
                <div className="pt-4 space-y-4">

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                      <p className="text-2xl font-bold text-indigo-700">{totalSubmissions}</p>
                      <p className="text-[11px] text-indigo-500 font-medium">Total Submissions</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{gradedSubmissions}</p>
                      <p className="text-[11px] text-emerald-500 font-medium">Graded</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                      <p className="text-2xl font-bold text-rose-700">{pendingSubmissions}</p>
                      <p className="text-[11px] text-rose-500 font-medium">Pending Review</p>
                    </div>
                  </div>

                  {assignLessons.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No assignments in this course.</p>
                    </div>
                  ) : (
                    assignLessons.map(al => {
                      const isExp = expandedAssign === al.lesson.id;
                      const graded = al.submissions.filter(s => s.status === 'graded').length;
                      const pending = al.submissions.length - graded;
                      const moduleTitle = al.module.title;

                      return (
                        <div key={al.lesson.id} className="border rounded-xl overflow-hidden shadow-sm">
                          {/* Assignment header */}
                          <button
                            className="w-full flex items-center justify-between p-3.5 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors text-left"
                            onClick={() => setExpandedAssign(isExp ? null : al.lesson.id)}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {isExp ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                              <ClipboardList className="w-4 h-4 text-rose-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-gray-800 truncate">{al.lesson.title}</p>
                                <p className="text-[11px] text-gray-400">{moduleTitle} &bull; Module {al.module.order_index + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {al.submissions.length > 0 && (
                                <>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                    {al.submissions.length} sub{al.submissions.length !== 1 ? 's' : ''}
                                  </span>
                                  {graded > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                      {graded} graded
                                    </span>
                                  )}
                                  {pending > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                      {pending} pending
                                    </span>
                                  )}
                                </>
                              )}
                              {al.submissions.length === 0 && (
                                <span className="text-[10px] text-gray-400 font-medium">No submissions yet</span>
                              )}
                            </div>
                          </button>

                          {/* Submissions list */}
                          {isExp && (
                            <div className="divide-y">
                              {al.submissions.length === 0 ? (
                                <div className="p-6 text-center text-gray-400">
                                  <Inbox className="w-6 h-6 mx-auto mb-1.5 text-gray-200" />
                                  <p className="text-sm">No students have submitted this assignment yet.</p>
                                </div>
                              ) : (
                                al.submissions.map((sub, i) => {
                                  const isGraded = sub.status === 'graded';
                                  return (
                                    <div key={i} className="p-3.5 hover:bg-gray-50/50 transition-colors">
                                      <div className="flex items-start justify-between gap-3">
                                        {/* Student info */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                            isGraded
                                              ? (sub.score !== null && sub.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')
                                              : 'bg-gray-100 text-gray-500'
                                          }`}>
                                            {sub.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <p className="text-sm font-semibold text-gray-800 truncate">{sub.student_name}</p>
                                              {isGraded && sub.score !== null && (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                  sub.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                                }`}>{sub.score}%</span>
                                              )}
                                              {!isGraded && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Pending</span>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-gray-400">{sub.student_email}</p>

                                            {/* Submission content preview */}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                              {sub.submission_type && (
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-600 capitalize">
                                                  {sub.submission_type === 'text' ? 'Text' : sub.submission_type === 'url' ? 'Link' : sub.submission_type === 'file' ? 'File' : sub.submission_type}
                                                </span>
                                              )}
                                              <span className="text-[10px] text-gray-400">
                                                Submitted {new Date(sub.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            </div>

                                            {/* Text submission preview */}
                                            {sub.content && (
                                              <div className="mt-2 p-2 bg-gray-50 rounded-lg border text-xs text-gray-600 max-h-16 overflow-y-auto whitespace-pre-wrap">
                                                {sub.content.length > 200 ? sub.content.slice(0, 200) + '...' : sub.content}
                                              </div>
                                            )}

                                            {/* File submission */}
                                            {sub.file_url && (
                                              <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                                                <Paperclip className="w-3 h-3" /> View submitted file
                                              </a>
                                            )}

                                            {/* URL submission */}
                                            {sub.submission_type === 'url' && sub.content && (
                                              <a href={sub.content} target="_blank" rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                                                <Globe className="w-3 h-3" /> {sub.content}
                                              </a>
                                            )}

                                            {/* Previous feedback */}
                                            {isGraded && sub.feedback && (
                                              <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                                <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">Your Feedback</p>
                                                <p className="text-xs text-emerald-700">{sub.feedback}</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Grade button */}
                                        <Button
                                          size="sm"
                                          variant={isGraded ? 'outline' : 'default'}
                                          className={`shrink-0 gap-1.5 ${!isGraded ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                                          onClick={() => openGradingDialog(sub)}
                                        >
                                          {isGraded ? (
                                            <><Pencil className="w-3 h-3" /> Update</>
                                          ) : (
                                            <><Award className="w-3 h-3" /> Grade</>
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* ── SCHEDULE TAB ── */}
              <TabsContent value="schedule">
                <div className="pt-4 space-y-3">
                  {Object.keys(groupedSchedules).length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No schedules configured.</p>
                    </div>
                  ) : (
                    Object.entries(groupedSchedules).map(([time, items]) => (
                      <Card key={time} className="border-0 shadow-sm p-4">
                        <div className="font-bold text-sm mb-2 flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-indigo-500" />{time}
                        </div>
                        {items.map(s => (
                          <div key={s.id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-b-0">
                            <span className="text-gray-600">{s.days?.join(', ')}</span>
                            <div className="flex items-center gap-2">
                              {s.meeting_url && (
                                <a href={s.meeting_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Join</a>
                              )}
                              <span className="text-xs text-gray-400">{s.is_recurring ? 'Recurring' : 'Once'}</span>
                            </div>
                          </div>
                        ))}
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* ── COHORTS TAB ── */}
              <TabsContent value="cohorts">
                <div className="pt-4 space-y-2">
                  {courseCohorts.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No cohorts linked to this program.</p>
                    </div>
                  ) : (
                    courseCohorts.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 border rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                            {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{c.name}</span>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">{c.course}</span>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── GRADING DIALOG ── */}
      <Dialog open={gradingDialogOpen} onOpenChange={setGradingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" /> Grade Assignment
            </DialogTitle>
            <DialogDescription>
              {gradingSub && (
                <span>Enter a score and optional feedback for <strong>{gradingSub.student_name}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {gradingSub && (
            <div className="space-y-4 py-3">
              {/* Student info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
                  {gradingSub.student_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{gradingSub.student_name}</p>
                  <p className="text-xs text-gray-400">{gradingSub.student_email}</p>
                </div>
              </div>

              {/* Submission content preview */}
              {gradingSub.content && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Submitted Content</p>
                  <div className="p-3 bg-white border rounded-xl text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {gradingSub.content}
                  </div>
                </div>
              )}

              {gradingSub.file_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Submitted File</p>
                  <a href={gradingSub.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-sm hover:bg-indigo-100 transition-colors">
                    <Paperclip className="w-4 h-4" /> View submitted file
                  </a>
                </div>
              )}

              {/* Score input */}
              <div>
                <Label className="text-xs font-medium">
                  Score <span className="text-gray-400 font-normal">(0 – 100)</span>
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Enter score e.g. 85"
                    value={gradeScore}
                    onChange={e => setGradeScore(e.target.value)}
                    className="pr-12 text-lg font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
                </div>
                {gradeScore !== '' && (parseInt(gradeScore) < 0 || parseInt(gradeScore) > 100) && (
                  <p className="text-xs text-red-500 mt-1">Score must be between 0 and 100</p>
                )}
              </div>

              {/* Quick grade buttons */}
              <div className="flex gap-1.5">
                {[
                  { label: 'A (70+)', value: 75 },
                  { label: 'B (60+)', value: 65 },
                  { label: 'C (50+)', value: 55 },
                  { label: 'D (45+)', value: 47 },
                  { label: 'F (<40)', value: 30 },
                ].map(q => (
                  <button
                    key={q.label}
                    onClick={() => setGradeScore(String(q.value))}
                    className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg border transition-colors ${
                      gradeScore === String(q.value)
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Feedback */}
              <div>
                <Label className="text-xs font-medium">Feedback <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Write feedback for the student..."
                  value={gradeFeedback}
                  onChange={e => setGradeFeedback(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGradingDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveGrade}
              disabled={gradingSaving || gradeScore === ''}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {gradingSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {gradingSaving ? 'Saving...' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── LESSON VIEWER MODAL ── */}
      <Dialog open={lessonViewerOpen} onOpenChange={setLessonViewerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeLesson && <>{LESSON_TYPES[activeLesson.type]?.icon || <FileText className="w-5 h-5 text-gray-400" />}</>}
              <span className="capitalize">{activeLesson?.type} Lesson</span>
            </DialogTitle>
            <DialogDescription>
              {activeModuleId && modules.find(m => m.id === activeModuleId)?.title}
            </DialogDescription>
          </DialogHeader>

          {activeLesson && (
            <div className="space-y-5 py-3">
              <div className="p-3 bg-gray-50 rounded-xl border">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title</p>
                <p className="text-base font-semibold text-gray-900">{activeLesson.title}</p>
              </div>

              {activeLesson.type === 'text' && activeLesson.content && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Content</p>
                  <div className="p-4 bg-white border rounded-xl text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">{activeLesson.content}</div>
                </div>
              )}

              {activeLesson.type === 'video' && (activeLesson.content || activeLesson.file_url) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Video</p>
                  <video src={activeLesson.file_url || activeLesson.content} controls className="w-full rounded-xl bg-black" />
                </div>
              )}

              {activeLesson.type === 'url' && activeLesson.content && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">External Link</p>
                  <a href={activeLesson.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 hover:bg-blue-100 transition-colors">
                    <Globe className="w-4 h-4" />{activeLesson.content}
                  </a>
                </div>
              )}

              {activeLesson.type === 'assignment' && activeLesson.assignment_config && (
                <div className="space-y-3">
                  {activeLesson.assignment_config.instructions && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instructions</p>
                      <div className="p-4 bg-white border rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{activeLesson.assignment_config.instructions}</div>
                    </div>
                  )}
                  {activeLesson.assignment_config.resource_url && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resource Link</p>
                      <a href={activeLesson.assignment_config.resource_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                        <Globe className="w-4 h-4" />{activeLesson.assignment_config.resource_url}
                      </a>
                    </div>
                  )}
                  {activeLesson.file_url && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attached File</p>
                      <a href={activeLesson.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-50 border rounded-xl text-gray-700 text-sm">
                        <Paperclip className="w-4 h-4 text-gray-400" />View attached file
                      </a>
                    </div>
                  )}
                  {activeLesson.assignment_config.due_note && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span><strong>Deadline:</strong> {activeLesson.assignment_config.due_note}</span>
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 border rounded-xl">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Submission Methods</p>
                    <div className="flex gap-1.5">
                      {activeLesson.assignment_config.allow_text && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Text</span>}
                      {activeLesson.assignment_config.allow_url && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Link</span>}
                      {activeLesson.assignment_config.allow_file && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">File</span>}
                    </div>
                  </div>
                </div>
              )}

              {activeLesson.type === 'quiz' && activeLesson.quiz_data && activeLesson.quiz_data.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Questions ({activeLesson.quiz_data.length})</p>
                  <div className="space-y-2">
                    {activeLesson.quiz_data.map((q: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 border rounded-xl">
                        <p className="font-semibold text-sm text-gray-900">{i + 1}. {q.q}</p>
                        {q.type === 'multiple_choice' && q.a?.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {q.a.map((opt: string, oi: number) => (
                              <span key={oi} className={`text-xs px-2.5 py-1.5 rounded-lg ${oi === q.correct ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
                                {String.fromCharCode(65 + oi)}. {opt || '(empty)'} {oi === q.correct && '✓'}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.type === 'rating' && <div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-5 h-5 text-amber-400 fill-amber-400" />)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeLesson.type === 'survey' && activeLesson.quiz_data && activeLesson.quiz_data.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Survey Questions ({activeLesson.quiz_data.length})</p>
                  <div className="space-y-2">
                    {activeLesson.quiz_data.map((q: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 border rounded-xl">
                        <p className="font-semibold text-sm text-gray-900">{i + 1}. {q.q}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${q.type === 'rating' ? 'bg-amber-100 text-amber-700' : q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{q.type}</span>
                        {q.type === 'rating' && <div className="flex gap-1 mt-1">{[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>}
                        {q.type === 'multiple_choice' && q.a?.filter(Boolean).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">{q.a.filter(Boolean).map((opt: string, oi: number) => <span key={oi} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{opt}</span>)}</div>
                        )}
                        {q.type === 'text' && q.a?.[0] && (
                          <p className="mt-1.5 text-sm text-gray-600 bg-white border rounded-lg p-2">{q.a[0]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeLesson.file_url && activeLesson.type !== 'assignment' && activeLesson.type !== 'video' && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attached File</p>
                  <a href={activeLesson.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-50 border rounded-xl text-gray-700 text-sm hover:bg-gray-100 transition-colors">
                    <Paperclip className="w-4 h-4 text-gray-400" />View attached file
                  </a>
                </div>
              )}

              {!activeLesson.content && !activeLesson.file_url && activeLesson.type !== 'header' && activeLesson.type !== 'survey' && activeLesson.type !== 'assignment' && (
                <div className="flex items-center justify-center gap-2 p-6 bg-gray-50 border border-dashed rounded-xl text-gray-400">
                  <AlertCircle className="w-5 h-5" /><span className="text-sm">No content added yet.</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline Inbox icon component (no external dependency)
function Inbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}