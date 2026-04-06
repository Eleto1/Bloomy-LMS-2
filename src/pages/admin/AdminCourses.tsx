import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from './RichTextEditor';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Pencil, Trash2, CalendarDays, Video, Loader2, FileText, HelpCircle,
  Link as LinkIcon, LayoutDashboard, ChevronDown, ChevronRight, Paperclip,
  ClipboardList, Copy, Save, Search, X, ArrowUp, ArrowDown, Star, Upload,
  Globe, AlignLeft, FileUp, AlertCircle, CheckCircle2, User, Users, Lock,
  GripVertical
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SMART PASTE UTILITY — converts rich HTML from clipboard to clean plain text
// ─────────────────────────────────────────────────────────────────────────────
function handleSmartPaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  setValue: (val: string) => void
) {
  const clipboard = e.clipboardData;
  const html = clipboard.getData('text/html');
  const text = clipboard.getData('text/plain');
  if (html) {
    e.preventDefault();
    setValue(htmlToPlainText(html));
    return;
  }
  if (text) {
    e.preventDefault();
    setValue(text);
  }
}

function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li, tr, hr, blockquote, pre').forEach(el => {
    if (el.tagName === 'BR') el.replaceWith(document.createTextNode('\n'));
    else if (el.tagName === 'HR') el.replaceWith(document.createTextNode('\n────────────────\n'));
    else el.prepend(document.createTextNode('\n'));
  });
  tmp.querySelectorAll('li').forEach(li => {
    const prefix = li.closest('ol') ? `${Array.from(li.parentElement!.children).indexOf(li) + 1}. ` : '• ';
    li.prepend(document.createTextNode(prefix));
  });
  let plain = tmp.textContent || tmp.innerText || '';
  plain = plain.replace(/\n{3,}/g, '\n\n');
  plain = plain.split('\n').map(line => line.trim()).join('\n');
  return plain.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = [
  { id: 'Mon', label: 'Mon' }, { id: 'Tue', label: 'Tue' }, { id: 'Wed', label: 'Wed' },
  { id: 'Thu', label: 'Thu' }, { id: 'Fri', label: 'Fri' }, { id: 'Sat', label: 'Sat' }, { id: 'Sun', label: 'Sun' }
];

const LESSON_TYPES = [
  { value: 'text',       label: 'Text Content',  icon: FileText     },
  { value: 'video',      label: 'Video',         icon: Video        },
  { value: 'assignment', label: 'Assignment',    icon: ClipboardList},
  { value: 'quiz',       label: 'Quiz',          icon: HelpCircle   },
  { value: 'survey',     label: 'Survey',        icon: ClipboardList},
  { value: 'header',     label: 'Section Header',icon: LayoutDashboard},
  { value: 'url',        label: 'External Link', icon: LinkIcon     },
];

const SURVEY_Q_TYPES = [
  { value: 'rating',          label: '⭐ Rating (1-5 Stars)' },
  { value: 'multiple_choice', label: '✓ Multiple Choice'    },
  { value: 'text',            label: '✏ Long Text Answer'   },
];

const QUIZ_Q_TYPES = [
  { value: 'multiple_choice', label: '✓ Multiple Choice'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Course   { id: string; title: string; description: string; program: string; status: string; instructor_id?: string; }
interface Module   { id: string; title: string; course_id: string; order_index: number; unlock_date?: string; sequential_lessons?: boolean; }
interface Lesson   { id: string; title: string; type: string; content: string; module_id: string; order_index: number; file_url?: string; file_downloadable?: boolean; indent_level?: number; quiz_data?: any; assignment_config?: AssignmentConfig; }
interface Schedule { id: string; title: string; scheduled_at: string; days: string[]; time: string; is_recurring: boolean; meeting_url: string; }
interface Cohort   { id: string; name: string; course: string; }
interface Question { q: string; type: string; a: string[]; correct: number; }

interface AssignmentConfig {
  instructions: string;
  instruction_type: 'text' | 'url' | 'file';
  resource_url?: string;
  allow_text: boolean;
  allow_url: boolean;
  allow_file: boolean;
  due_note?: string;
}

const DEFAULT_ASSIGNMENT_CONFIG: AssignmentConfig = {
  instructions: '',
  instruction_type: 'text',
  resource_url: '',
  allow_text: true,
  allow_url: true,
  allow_file: true,
  due_note: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminCourses() {
  const [courses,           setCourses]           = useState<Course[]>([]);
  const [allCohorts,        setAllCohorts]        = useState<Cohort[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [modalOpen,         setModalOpen]         = useState(false);
  const [builderOpen,       setBuilderOpen]       = useState(false);
  const [editing,           setEditing]           = useState<Course | null>(null);
  // Added selectedCohortId to track selection in UI
  const [form,              setForm]              = useState({ title: '', description: '', program: '', status: 'Draft', instructor_id: 'unassigned', selectedCohortId: '' });
  const [saving,            setSaving]            = useState(false);
  const { toast } = useToast();

  const [instructors, setInstructors] = useState<any[]>([]);
  const [courseFacilitators, setCourseFacilitators] = useState<Record<string, string[]>>({});

  const [searchText,       setSearchText]       = useState('');
  const [filterCohortName, setFilterCohortName] = useState('all');
  const [filterProgram,    setFilterProgram]    = useState('all');

  const [activeCourse,    setActiveCourse]    = useState<Course | null>(null);
  const [modules,         setModules]         = useState<Module[]>([]);
  const [lessons,         setLessons]         = useState<Record<string, Lesson[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleTitleInput,setModuleTitleInput]= useState('');
  const [moduleDateInput, setModuleDateInput] = useState('');
  const [moduleSeqInput,  setModuleSeqInput]  = useState(false);

  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [activeLesson,     setActiveLesson]     = useState<Lesson | null>(null);
  const [activeModuleId,   setActiveModuleId]   = useState<string | null>(null);
  const [aiPrompt,         setAiPrompt]         = useState('');
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [uploadingFile,    setUploadingFile]     = useState(false);

  const [assignConfig,     setAssignConfig]     = useState<AssignmentConfig>(DEFAULT_ASSIGNMENT_CONFIG);
  const [uploadingAssignFile, setUploadingAssignFile] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState<Question>({ q: '', type: 'multiple_choice', a: ['','','',''], correct: 0 });
  const [courseTopics,    setCourseTopics]    = useState<{ id: string; title: string }[]>([]);

  const [schedules,    setSchedules]    = useState<Schedule[]>([]);
  const [newSchedule,  setNewSchedule]  = useState({ days: [] as string[], time: '09:00', meeting_url: '' });
  const [courseCohorts,setCourseCohorts]= useState<Cohort[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  // ── Drag-and-drop state ──────────────────────────────────────────────
  const [draggedModuleIdx, setDraggedModuleIdx] = useState<number | null>(null);
  const [draggedLessonKey, setDraggedLessonKey] = useState<string | null>(null); // format: "moduleId:lessonIdx"
  const [dropTargetModuleIdx, setDropTargetModuleIdx] = useState<number | null>(null);
  const [dropTargetLessonKey, setDropTargetLessonKey] = useState<string | null>(null);

  useEffect(() => { fetchInitialData(); }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [{ data: courseData }, { data: cohortData }, { data: ciData }, { data: instructorData }] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('cohorts').select('*'),
        supabase.from('course_instructors').select('course_id, instructor_id'),
        supabase.from('profiles').select('id, full_name').eq('role', 'instructor')
      ]);
      
      if (courseData) setCourses(courseData);
      if (cohortData) setAllCohorts(cohortData);
      if (instructorData) setInstructors(instructorData || []);

      const allInstructorIds = new Set([
        ...(ciData || []).map(r => r.instructor_id),
        ...(courseData || []).map(c => c.instructor_id).filter(Boolean) as string[]
      ]);
      
      const { data: profData } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(allInstructorIds));
      const nameMap: Record<string, string> = {};
      (profData || []).forEach(p => { if (p.full_name) nameMap[p.id] = p.full_name; });
      
      const fMap: Record<string, string[]> = {};
      
      ciData?.forEach(r => {
        if (!fMap[r.course_id]) fMap[r.course_id] = [];
        const name = nameMap[r.instructor_id];
        if (name && !fMap[r.course_id].includes(name)) fMap[r.course_id].push(name);
      });

      courseData?.forEach(c => {
        if (c.instructor_id) {
          if (!fMap[c.id]) fMap[c.id] = [];
          const name = nameMap[c.instructor_id];
          if (name && !fMap[c.id].includes(name)) fMap[c.id].push(name);
        }
      });
      
      setCourseFacilitators(fMap);

      const uniqueProgs = Array.from(new Set([
        ...(courseData || []).map(c => c.program),
        ...(cohortData  || []).map(c => c.course),
      ].filter(Boolean)));
      setAvailablePrograms(uniqueProgs);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COURSE CRUD
  // ─────────────────────────────────────────────────────────────────────────
  const openModal = (course?: Course) => {
    if (course) { 
      setEditing(course); 
      setForm({ 
        title: course.title, 
        description: course.description, 
        program: course.program, 
        status: course.status,
        instructor_id: course.instructor_id || 'unassigned',
        selectedCohortId: '' 
      }); 
    }
    else { 
      setEditing(null); 
      setForm({ 
        title: '', 
        description: '', 
        program: availablePrograms[0] || '', 
        status: 'Draft', 
        instructor_id: 'unassigned',
        selectedCohortId: ''
      }); 
    }
    setModalOpen(true);
  };

  const handleCohortChange = (cohortId: string) => {
    const selectedCohort = allCohorts.find(c => c.id === cohortId);
    if (selectedCohort) {
      setForm(prev => ({ ...prev, program: selectedCohort.course, selectedCohortId: cohortId }));
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.program) return toast({ title: 'Title and Program are required', variant: 'destructive' });
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        program: form.program,
        status: form.status,
        instructor_id: form.instructor_id === 'unassigned' ? null : form.instructor_id
      };
      
      if (editing) await supabase.from('courses').update(payload).eq('id', editing.id);
      else await supabase.from('courses').insert(payload);
      toast({ title: 'Course saved ✓' });
      setModalOpen(false);
      fetchInitialData();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('courses').delete().eq('id', deleteTarget.id);
    toast({ title: 'Deleted' }); setDeleteTarget(null); fetchInitialData();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COURSE BUILDER
  // ─────────────────────────────────────────────────────────────────────────
  const openBuilder = async (course: Course) => {
    setActiveCourse(course); setModules([]); setLessons({}); setSchedules([]); setCourseCohorts([]); setBuilderOpen(true);
    const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
    if (mods) {
      setModules(mods);
      const modIds = mods.map(m => m.id);
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      if (less) {
        const map: Record<string, Lesson[]> = {};
        less.forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); });
        setLessons(map);
      }
    }
    const [{ data: sched }, { data: cohorts }] = await Promise.all([
      supabase.from('schedules').select('*').eq('course_id', course.id),
      supabase.from('cohorts').select('*').eq('course', course.program),
    ]);
    if (sched)   setSchedules(sched);
    if (cohorts) setCourseCohorts(cohorts);
  };

  // ── Module actions ────────────────────────────────────────────────────────
  const addModule = async () => {
    if (!activeCourse) return;
    const { data } = await supabase.from('modules').insert({ course_id: activeCourse.id, title: 'New Module', order_index: modules.length, sequential_lessons: false }).select().single();
    if (data) setModules([...modules, data]);
  };

  const saveModuleTitle = async (id: string) => {
    await supabase.from('modules').update({ title: moduleTitleInput, unlock_date: moduleDateInput || null, sequential_lessons: moduleSeqInput }).eq('id', id);
    setModules(modules.map(m => m.id === id ? { ...m, title: moduleTitleInput, unlock_date: moduleDateInput || null, sequential_lessons: moduleSeqInput } : m));
    setEditingModuleId(null);
  };

  const deleteModule = async (id: string) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    await supabase.from('modules').delete().eq('id', id);
    setModules(modules.filter(m => m.id !== id));
    toast({ title: 'Module deleted' });
  };

  const duplicateModule = async (mod: Module) => {
    if (!activeCourse) return; setSaving(true);
    const { data: newMod } = await supabase.from('modules').insert({ course_id: activeCourse.id, title: `${mod.title} (Copy)`, order_index: modules.length, sequential_lessons: mod.sequential_lessons || false }).select().single();
    if (newMod) {
      const toCopy = lessons[mod.id] || [];
      if (toCopy.length > 0) await supabase.from('lessons').insert(toCopy.map(l => ({ module_id: newMod.id, title: l.title, type: l.type, content: l.content, file_url: l.file_url, file_downloadable: l.file_downloadable, quiz_data: l.quiz_data, assignment_config: l.assignment_config, order_index: l.order_index })));
      toast({ title: 'Module duplicated!' }); openBuilder(activeCourse);
    }
    setSaving(false);
  };

  const moveModule = async (index: number, dir: 'up' | 'down') => {
    const ni = dir === 'up' ? index - 1 : index + 1;
    if (ni < 0 || ni >= modules.length) return;
    const nm = [...modules]; [nm[index], nm[ni]] = [nm[ni], nm[index]];
    setModules(nm);
    nm.forEach((m, i) => supabase.from('modules').update({ order_index: i }).eq('id', m.id));
  };

  // ── Drag-and-drop handlers for modules ───────────────────────────────
  const handleModuleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedModuleIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `module:${idx}`);
    // Make the dragged element semi-transparent
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleModuleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedModuleIdx !== null && draggedModuleIdx !== idx) {
      setDropTargetModuleIdx(idx);
    }
  };

  const handleModuleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedModuleIdx(null);
    setDropTargetModuleIdx(null);
  };

  const handleModuleDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const srcIdx = draggedModuleIdx;
    if (srcIdx === null || srcIdx === targetIdx) {
      setDraggedModuleIdx(null);
      setDropTargetModuleIdx(null);
      return;
    }
    const nm = [...modules];
    const [moved] = nm.splice(srcIdx, 1);
    nm.splice(targetIdx, 0, moved);
    setModules(nm);
    setDraggedModuleIdx(null);
    setDropTargetModuleIdx(null);
    // Persist new order
    await Promise.all(nm.map((m, i) => supabase.from('modules').update({ order_index: i }).eq('id', m.id)));
    toast({ title: 'Module order updated ✓' });
  };

  // ✅ NEW: Toggle sequential lessons on a module (saves immediately)
  const toggleSequentialLessons = async (moduleId: string, checked: boolean) => {
    // Optimistic update
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, sequential_lessons: checked } : m));
    try {
      const { error } = await supabase.from('modules').update({ sequential_lessons: checked }).eq('id', moduleId);
      if (error) throw error;
      toast({ 
        title: checked ? 'Sequential lessons enabled ✓' : 'Sequential lessons disabled',
        description: checked ? 'Students must complete lessons in order' : 'Students can access all lessons freely'
      });
    } catch (e: any) {
      // Revert on error
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, sequential_lessons: !checked } : m));
      toast({ title: 'Error updating module', description: e.message, variant: 'destructive' });
    }
  };

  // ── Lesson actions ────────────────────────────────────────────────────────
  const addLesson = async (moduleId: string, type: string) => {
    const { data } = await supabase.from('lessons').insert({ module_id: moduleId, title: type === 'header' ? 'Section Title' : 'New Lesson', type, order_index: (lessons[moduleId] || []).length, file_downloadable: true }).select().single();
    if (data) setLessons(prev => ({ ...prev, [moduleId]: [...(prev[moduleId] || []), data] }));
  };

  const openLessonEditor = (lesson: Lesson, moduleId: string) => {
    setActiveLesson(lesson); setActiveModuleId(moduleId); setAiPrompt('');
    setCurrentQuestion({ q: '', type: 'multiple_choice', a: ['','','',''], correct: 0 });
    const all = Object.values(lessons).flat();
    setCourseTopics(all.filter(l => l.type === 'header').map(l => ({ id: l.id, title: l.title })));
    setAssignConfig(lesson.assignment_config || { ...DEFAULT_ASSIGNMENT_CONFIG });
    setLessonEditorOpen(true);
  };

  const saveLesson = async () => {
    if (!activeLesson) return;
    const lessonToSave = activeLesson.type === 'assignment'
      ? { ...activeLesson, assignment_config: assignConfig }
      : activeLesson;
    await supabase.from('lessons').update(lessonToSave).eq('id', activeLesson.id);
    if (activeCourse) {
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modules.map(m => m.id)).order('order_index');
      if (less) { const map: Record<string, Lesson[]> = {}; less.forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); }); setLessons(map); }
    }
    setLessonEditorOpen(false);
    toast({ title: 'Lesson saved ✓' });
  };

  const deleteLesson = async (id: string, moduleId: string) => {
    if (!confirm('Delete this lesson?')) return;
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(prev => ({ ...prev, [moduleId]: (prev[moduleId] || []).filter(l => l.id !== id) }));
    setLessonEditorOpen(false);
    toast({ title: 'Lesson deleted' });
  };

  const duplicateLesson = async (lesson: Lesson) => {
    setSaving(true);
    const { id, ...copy } = lesson;
    const { data } = await supabase.from('lessons').insert({ ...copy, title: `${lesson.title} (Copy)` }).select().single();
    if (data) { setLessons(prev => ({ ...prev, [lesson.module_id]: [...(prev[lesson.module_id] || []), data] })); toast({ title: 'Duplicated!' }); }
    setSaving(false);
  };

  const moveLesson = (moduleId: string, index: number, dir: 'up' | 'down') => {
    const list = lessons[moduleId] || [];
    const ni = dir === 'up' ? index - 1 : index + 1;
    if (ni < 0 || ni >= list.length) return;
    const nl = [...list]; [nl[index], nl[ni]] = [nl[ni], nl[index]];
    setLessons(prev => ({ ...prev, [moduleId]: nl }));
    nl.forEach((l, i) => supabase.from('lessons').update({ order_index: i }).eq('id', l.id));
  };

  // ── Drag-and-drop handlers for lessons ───────────────────────────────
  const handleLessonDragStart = (e: React.DragEvent, moduleId: string, idx: number) => {
    setDraggedLessonKey(`${moduleId}:${idx}`);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `lesson:${moduleId}:${idx}`);
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleLessonDragOver = (e: React.DragEvent, moduleId: string, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetKey = `${moduleId}:${idx}`;
    if (draggedLessonKey && draggedLessonKey !== targetKey) {
      // Only allow drop within the same module
      const [srcModuleId] = draggedLessonKey.split(':');
      if (srcModuleId === moduleId) {
        setDropTargetLessonKey(targetKey);
      }
    }
  };

  const handleLessonDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedLessonKey(null);
    setDropTargetLessonKey(null);
  };

  const handleLessonDrop = async (e: React.DragEvent, moduleId: string, targetIdx: number) => {
    e.preventDefault();
    if (!draggedLessonKey) return;
    const [srcModuleId, srcIdxStr] = draggedLessonKey.split(':');
    const srcIdx = parseInt(srcIdxStr, 10);
    if (srcModuleId !== moduleId || srcIdx === targetIdx) {
      setDraggedLessonKey(null);
      setDropTargetLessonKey(null);
      return;
    }
    const list = lessons[moduleId] || [];
    const nl = [...list];
    const [moved] = nl.splice(srcIdx, 1);
    nl.splice(targetIdx, 0, moved);
    setLessons(prev => ({ ...prev, [moduleId]: nl }));
    setDraggedLessonKey(null);
    setDropTargetLessonKey(null);
    // Persist new order
    await Promise.all(nl.map((l, i) => supabase.from('lessons').update({ order_index: i }).eq('id', l.id)));
    toast({ title: 'Lesson order updated ✓' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !activeLesson) return;
    setUploadingFile(true);
    const path = `lessons/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-files').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('course-files').getPublicUrl(path);
      setActiveLesson(prev => prev ? { ...prev, file_url: data.publicUrl } : null);
      toast({ title: 'File uploaded ✓' });
    } else toast({ title: 'Upload failed', variant: 'destructive' });
    setUploadingFile(false);
  };

  const handleAssignmentResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !activeLesson) return;
    setUploadingAssignFile(true);
    const path = `assignments/resources/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-files').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('course-files').getPublicUrl(path);
      setActiveLesson(prev => prev ? { ...prev, file_url: data.publicUrl } : null);
      toast({ title: 'Resource uploaded ✓' });
    } else toast({ title: 'Upload failed', variant: 'destructive' });
    setUploadingAssignFile(false);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return; setIsGenerating(true);
    try {
      const res = await fetch('https://zcxysvrwblwogubakssf.supabase.co/functions/v1/generate-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, type: activeLesson?.type }),
      });
      const data = await res.json();
      if (data.content)   setActiveLesson(prev => prev ? { ...prev, content: data.content } : null);
      if (data.quiz_data) setActiveLesson(prev => prev ? { ...prev, quiz_data: data.quiz_data } : null);
    } catch { toast({ title: 'AI Error', variant: 'destructive' }); }
    finally { setIsGenerating(false); }
  };

  const handleQuestionFieldChange = (field: string, value: string, index?: number) => {
    setCurrentQuestion(prev => {
      if (field === 'q') return { ...prev, q: value };
      if (field === 'type') return { ...prev, type: value, a: value === 'multiple_choice' ? ['','','',''] : [] };
      if (field === 'a' && index !== undefined) { const a = [...prev.a]; a[index] = value; return { ...prev, a }; }
      if (field === 'correct') return { ...prev, correct: Number(value) };
      return prev;
    });
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.q) return toast({ title: 'Enter question text', variant: 'destructive' });
    if (currentQuestion.type === 'multiple_choice' && currentQuestion.a.filter(x => x).length < 2) return toast({ title: 'Need at least 2 options', variant: 'destructive' });
    setActiveLesson(prev => prev ? { ...prev, quiz_data: [...(prev.quiz_data || []), currentQuestion] } : null);
    setCurrentQuestion({ q: '', type: 'multiple_choice', a: ['','','',''], correct: 0 });
    toast({ title: 'Question added ✓' });
  };

  const handleRemoveQuestion = (i: number) => setActiveLesson(prev => prev ? { ...prev, quiz_data: prev.quiz_data?.filter((_: any, idx: number) => idx !== i) } : null);

  const handleDayToggle = (dayId: string) => setNewSchedule(prev => ({ ...prev, days: prev.days.includes(dayId) ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId] }));

  const handleAddSchedule = async () => {
    if (!newSchedule.days.length || !newSchedule.time || !activeCourse) return toast({ title: 'Select days and time', variant: 'destructive' });
    const { data, error } = await supabase.from('schedules').insert(newSchedule.days.map(day => ({ course_id: activeCourse.id, title: 'Class', days: [day], time: newSchedule.time, is_recurring: true, meeting_url: newSchedule.meeting_url, scheduled_at: new Date().toISOString() }))).select();
    if (!error && data) { setSchedules([...schedules, ...data]); setNewSchedule({ days: [], time: '09:00', meeting_url: '' }); toast({ title: 'Schedule added ✓' }); }
  };

  const handleDeleteSchedule = async (id: string) => { await supabase.from('schedules').delete().eq('id', id); setSchedules(schedules.filter(s => s.id !== id)); };

  const uniqueCohortNames = Array.from(new Set(allCohorts.map(c => c.name)));
  const displayedPrograms = filterCohortName !== 'all' ? Array.from(new Set(allCohorts.filter(c => c.name === filterCohortName).map(c => c.course))) : availablePrograms;
  const getCohortNames    = (program: string) => allCohorts.filter(c => c.course === program).map(c => c.name).join(', ') || 'No Cohort';
  const getFacilitatorNames = (courseId: string) => {
    const names = courseFacilitators[courseId];
    if (!names || names.length === 0) return 'No Facilitator';
    return names.join(', ');
  };

  const filtered = courses.filter(c => {
    const matchSearch  = searchText ? (c.title?.toLowerCase().includes(searchText.toLowerCase()) || c.program?.toLowerCase().includes(searchText.toLowerCase())) : true;
    const matchCohort  = filterCohortName !== 'all' ? allCohorts.some(ch => ch.name === filterCohortName && ch.course === c.program) : true;
    const matchProgram = filterProgram !== 'all' ? c.program === filterProgram : true;
    return matchSearch && matchCohort && matchProgram;
  });

  useEffect(() => { setFilterProgram('all'); }, [filterCohortName]);
  const groupedSchedules = schedules.reduce((acc, s) => { const k = s.time || '00:00'; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {} as Record<string, Schedule[]>);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div><h2 className="font-bold text-2xl">Courses</h2><p className="text-muted-foreground text-sm">Manage training programs</p></div>
        <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-1" /> Create Course</Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Search</Label>
            <div className="relative"><Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"/><Input placeholder="Title or Program" value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-8"/></div>
          </div>
          <div>
            <Label>Filter by Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName}>
              <SelectTrigger><SelectValue placeholder="All Cohorts"/></SelectTrigger>
              <SelectContent><SelectItem value="all">All Cohorts</SelectItem>{uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter by Program</Label>
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger><SelectValue placeholder="All Programs"/></SelectTrigger>
              <SelectContent><SelectItem value="all">All Programs</SelectItem>{displayedPrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {(searchText || filterCohortName !== 'all' || filterProgram !== 'all') && (
          <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={() => { setSearchText(''); setFilterCohortName('all'); setFilterProgram('all'); }}><X className="w-4 h-4 mr-1"/>Clear</Button></div>
        )}
      </Card>

      {loading ? <p className="text-center py-10 text-gray-400">Loading courses...</p> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(course => (
            <Card key={course.id} className="border overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-24 gradient-hero flex items-center justify-center p-4">
                <h3 className="font-bold text-lg text-primary-foreground text-center leading-tight">{course.title}</h3>
              </div>
              <div className="p-5">
                <div className="flex flex-col gap-1 mb-3">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{course.program || 'General'}</span>
                  <span className="text-xs text-gray-500 truncate"><strong>Cohorts:</strong> {getCohortNames(course.program)}</span>
                  <span className="text-xs text-gray-500 truncate"><strong>Facilitators:</strong> {getFacilitatorNames(course.id)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${course.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{course.status}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openBuilder(course)}>Build</Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openModal(course)}><Pencil className="w-3.5 h-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleteTarget(course)}><Trash2 className="w-3.5 h-3.5"/></Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">No courses found.</div>}
        </div>
      )}

      {/* ── Create/Edit Course Modal ──────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Course</DialogTitle><DialogDescription>Configure course details, assignment, and linkage.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Digital Marketing Essentials"/></div>
            <div><Label>Description</Label><RichTextEditor content={form.description||''} onChange={v => setForm(prev => ({...prev, description: v}))} placeholder="Course description..." minHeight="120px" className="mt-1"/></div>
            
            {/* ✅ COHORT SELECTOR (NEW) */}
            <div>
              <Label className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Select Cohort</Label>
              <Select value={form.selectedCohortId} onValueChange={handleCohortChange}>
                <SelectTrigger><SelectValue placeholder="Choose a cohort to auto-fill program" /></SelectTrigger>
                <SelectContent>
                  {allCohorts.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500 text-center">No cohorts found. Create one first.</div>
                  ) : (
                    availablePrograms.map(prog => (
                      <SelectGroup key={prog}>
                        <SelectLabel className="font-semibold text-indigo-600">{prog}</SelectLabel>
                        {allCohorts.filter(c => c.course === prog).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* PROGRAM (Auto-filled by Cohort, but editable) */}
            <div>
              <Label>Program (Inferred from Cohort)</Label>
              <Input value={form.program} disabled className="bg-gray-50 text-gray-600 cursor-not-allowed" />
              <p className="text-[10px] text-gray-400 mt-1">This field is automatically set by your cohort selection.</p>
            </div>

            {/* INSTRUCTOR SELECTOR */}
            <div>
              <Label>Assign Instructor</Label>
              <Select value={form.instructor_id} onValueChange={v => setForm({...form, instructor_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select Instructor (Optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      <div className="flex items-center gap-2"><User className="w-3 h-3 text-gray-500" />{i.full_name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status || 'Draft'} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Active">Active</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Course'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Course Builder — {activeCourse?.title}</DialogTitle><DialogDescription>Build modules, lessons, schedule and cohort links.</DialogDescription></DialogHeader>
          <Tabs defaultValue="modules" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="modules">Content</TabsTrigger><TabsTrigger value="schedule">Schedule</TabsTrigger><TabsTrigger value="cohorts">Cohorts</TabsTrigger></TabsList>

            <TabsContent value="modules">
              <div className="space-y-3 pt-4">
                <Button onClick={addModule} size="sm" className="w-full"><Plus className="w-4 h-4 mr-1"/>Add Module</Button>
                {modules.map((mod, idx) => {
                  const isExp = expandedModules[mod.id];
                  const isSequential = mod.sequential_lessons === true;
                  const isModuleDragOver = dropTargetModuleIdx === idx;
                  const isModuleDragging = draggedModuleIdx === idx;
                  return (
                    <div key={mod.id}
                      draggable={editingModuleId !== mod.id}
                      onDragStart={(e) => handleModuleDragStart(e, idx)}
                      onDragOver={(e) => handleModuleDragOver(e, idx)}
                      onDrop={(e) => handleModuleDrop(e, idx)}
                      onDragEnd={handleModuleDragEnd}
                      onDragLeave={() => setDropTargetModuleIdx(null)}
                      className={`border rounded-xl overflow-hidden shadow-sm transition-all ${isSequential ? 'ring-1 ring-indigo-200' : ''} ${isModuleDragging ? 'opacity-40' : ''} ${isModuleDragOver ? 'ring-2 ring-indigo-400 border-indigo-300' : 'hover:shadow-md'}`}
                    >
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2 flex-1">
                          {/* Drag handle */}
                          <GripVertical className={`w-4 h-4 flex-shrink-0 cursor-grab active:cursor-grabbing ${isModuleDragging ? 'text-indigo-500' : 'text-gray-300 hover:text-gray-500'}`} />
                          {editingModuleId === mod.id ? (
                            <div className="flex gap-2 flex-1 items-center flex-wrap">
                              <Input value={moduleTitleInput} onChange={e => setModuleTitleInput(e.target.value)} className="h-8" placeholder="Module title"/>
                              <Input type="datetime-local" value={moduleDateInput} onChange={e => setModuleDateInput(e.target.value)} className="h-8" title="Unlock date (optional)"/>
                              <Button size="sm" onClick={() => saveModuleTitle(mod.id)}><Save className="w-4 h-4"/></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingModuleId(null)}>✕</Button>
                            </div>
                          ) : (
                            <button className="font-semibold flex items-center gap-1.5 hover:text-indigo-600 transition-colors text-left" onClick={() => setExpandedModules(prev => ({...prev,[mod.id]:!prev[mod.id]}))}>
                              {isExp ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                              <span>{idx+1}. {mod.title}</span>
                              {mod.unlock_date && <span className="text-xs text-blue-500 font-normal">({new Date(mod.unlock_date).toLocaleDateString()})</span>}
                              {isSequential && <Lock className="w-3.5 h-3.5 text-indigo-500" />}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* ✅ SEQUENTIAL LESSONS TOGGLE */}
                          <div className="flex items-center gap-1.5 mr-1 px-2 py-1 rounded-lg bg-white border">
                            <Lock className={`w-3 h-3 ${isSequential ? 'text-indigo-500' : 'text-gray-300'}`} />
                            <Switch
                              checked={isSequential}
                              onCheckedChange={(checked) => toggleSequentialLessons(mod.id, checked)}
                              className="scale-75 origin-right"
                              title={isSequential ? 'Lessons must be completed in order' : 'All lessons are freely accessible'}
                            />
                          </div>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveModule(idx,'up')} disabled={idx===0}><ArrowUp className="w-3 h-3"/></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveModule(idx,'down')} disabled={idx===modules.length-1}><ArrowDown className="w-3 h-3"/></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {setEditingModuleId(mod.id);setModuleTitleInput(mod.title);setModuleDateInput(mod.unlock_date||'');setModuleSeqInput(mod.sequential_lessons||false);}} title="Edit module"><Pencil className="w-3 h-3"/></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => duplicateModule(mod)} title="Duplicate module"><Copy className="w-3 h-3"/></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => deleteModule(mod.id)} title="Delete module"><Trash2 className="w-3 h-3"/></Button>
                        </div>
                      </div>
                      {isExp && (
                        <div className="p-3 space-y-2">
                          {/* ✅ Sequential banner when enabled */}
                          {isSequential && (
                            <div className="flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700">
                              <Lock className="w-4 h-4 flex-shrink-0" />
                              <span className="font-medium">Sequential mode ON</span>
                              <span className="text-indigo-500">— Students must complete each lesson in order to unlock the next one.</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {LESSON_TYPES.map(t => (
                              <Button key={t.value} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLesson(mod.id, t.value)}>
                                <t.icon className="w-3 h-3 mr-1"/>{t.label}
                              </Button>
                            ))}
                          </div>
                          {(lessons[mod.id] || []).map((les, lIdx) => {
                            const Icon = LESSON_TYPES.find(l => l.value === les.type)?.icon || FileText;
                            // Check if this lesson would be locked in sequential mode
                            const isLockedBySeq = isSequential && lIdx > 0;
                            const lessonKey = `${mod.id}:${lIdx}`;
                            const isLessonDragOver = dropTargetLessonKey === lessonKey;
                            const isLessonDragging = draggedLessonKey === lessonKey;
                            return (
                              <div key={les.id}
                                draggable
                                onDragStart={(e) => handleLessonDragStart(e, mod.id, lIdx)}
                                onDragOver={(e) => handleLessonDragOver(e, mod.id, lIdx)}
                                onDrop={(e) => handleLessonDrop(e, mod.id, lIdx)}
                                onDragEnd={handleLessonDragEnd}
                                onDragLeave={() => setDropTargetLessonKey(null)}
                                className={`flex items-center justify-between p-2 rounded-lg border text-sm transition-all cursor-grab active:cursor-grabbing ${les.type==='header'?'bg-indigo-50 font-bold border-indigo-200':'bg-white'} ${isLessonDragging ? 'opacity-40 scale-[0.98]' : ''} ${isLessonDragOver ? 'ring-2 ring-indigo-400 border-indigo-300 bg-indigo-50/50' : 'hover:border-gray-300'}`}
                                style={{ marginLeft: `${(les.indent_level || 0) * 20}px` }}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 cursor-grab active:cursor-grabbing ${isLessonDragging ? 'text-indigo-500' : 'text-gray-300 hover:text-gray-500'}`} />
                                  <Icon className={`w-4 h-4 flex-shrink-0 ${les.type==='quiz'?'text-amber-500':les.type==='survey'?'text-purple-500':les.type==='assignment'?'text-blue-500':'text-gray-500'}`}/>
                                  <span className="truncate">{les.title}</span>
                                  {isLockedBySeq && <Lock className="w-3 h-3 text-indigo-400 flex-shrink-0" title="Will be locked until previous lesson is completed" />}
                                  {les.file_url && (
                                    <span className="flex items-center gap-0.5 flex-shrink-0">
                                      <Paperclip className="w-3 h-3 text-gray-400"/>
                                      {les.file_downloadable === false && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-medium">hidden</span>}
                                    </span>
                                  )}
                                  {les.type === 'assignment' && les.assignment_config?.instructions && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">has brief</span>}
                                </div>
                                <div className="flex items-center flex-shrink-0" onDragStart={e => e.preventDefault()}>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'up')} disabled={lIdx===0}><ArrowUp className="w-3 h-3"/></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'down')} disabled={lIdx===(lessons[mod.id]?.length||0)-1}><ArrowDown className="w-3 h-3"/></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => duplicateLesson(les)}><Copy className="w-3 h-3"/></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openLessonEditor(les, mod.id)}><Pencil className="w-3 h-3"/></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => deleteLesson(les.id, mod.id)}><Trash2 className="w-3 h-3"/></Button>
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

            <TabsContent value="schedule">
              <div className="space-y-4 pt-4">
                <Card className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4"/>Add Class Time</h4>
                  <div className="flex flex-wrap gap-3 mb-3">{DAYS_OF_WEEK.map(d => (<label key={d.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ${newSchedule.days.includes(d.id)?'bg-indigo-50 border-indigo-400 text-indigo-700':'border-gray-200 hover:border-indigo-200'}`}><input type="checkbox" className="sr-only" checked={newSchedule.days.includes(d.id)} onChange={() => handleDayToggle(d.id)}/>{d.label}</label>))}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="time" value={newSchedule.time} onChange={e => setNewSchedule({...newSchedule, time: e.target.value})}/>
                    <Input placeholder="Meeting URL (Zoom/Meet)" value={newSchedule.meeting_url} onChange={e => setNewSchedule({...newSchedule, meeting_url: e.target.value})}/>
                  </div>
                  <Button className="mt-3" onClick={handleAddSchedule}>Add Class</Button>
                </Card>
                {Object.entries(groupedSchedules).map(([time, items]) => (
                  <Card key={time} className="p-3">
                    <div className="font-bold text-sm mb-2">{time}</div>
                    {items.map(s => (<div key={s.id} className="flex justify-between items-center text-sm py-1"><span className="text-gray-600">{s.days?.join(', ')}</span><div className="flex gap-2">{s.meeting_url && <a href={s.meeting_url} target="_blank" className="text-blue-600 underline text-xs">Join</a>}<button onClick={() => handleDeleteSchedule(s.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button></div></div>))}
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="cohorts">
              <div className="pt-4 space-y-2">
                {courseCohorts.length === 0
                  ? <p className="text-center text-gray-400 py-8">No cohorts linked to this program yet.</p>
                  : courseCohorts.map(c => (<div key={c.id} className="flex justify-between items-center p-3 border rounded-lg"><span className="font-medium">{c.name}</span><span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{c.course}</span></div>))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── LESSON EDITOR MODAL ───────────────────────────────────── */}
      <Dialog open={lessonEditorOpen} onOpenChange={setLessonEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeLesson && React.createElement(LESSON_TYPES.find(t => t.value === activeLesson.type)?.icon || FileText, { className: 'w-5 h-5 text-indigo-500' })}
              Edit {activeLesson?.type === 'assignment' ? 'Assignment' : 'Lesson'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Lesson Title</Label><Input value={activeLesson?.title||''} onChange={e => setActiveLesson(prev => prev?{...prev,title:e.target.value}:null)}/></div>
              <div>
                <Label>Module</Label>
                <Select value={activeLesson?.module_id||''} onValueChange={v => setActiveLesson(prev => prev?{...prev,module_id:v}:null)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Indent Level</Label>
                <Select value={String(activeLesson?.indent_level||0)} onValueChange={v => setActiveLesson(prev => prev?{...prev,indent_level:Number(v)}:null)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="0">None</SelectItem><SelectItem value="1">Level 1</SelectItem><SelectItem value="2">Level 2</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {activeLesson?.type !== 'assignment' && (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <Label className="text-purple-700">✨ AI Content Generator</Label>
                <Textarea placeholder="Describe what you want to generate..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="mt-1.5" rows={2} onPaste={e => handleSmartPaste(e, setAiPrompt)}/>
                <Button onClick={handleAIGenerate} disabled={isGenerating} className="mt-2 bg-purple-600 hover:bg-purple-700 w-full">
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Generating...</> : 'Generate Content'}
                </Button>
              </div>
            )}

            {activeLesson?.type === 'text' && (
              <div className="space-y-3">
                <div><Label>Content</Label><RichTextEditor content={activeLesson.content||''} onChange={v => setActiveLesson(prev => prev?{...prev,content:v}:null)} placeholder="Write or paste your lesson content here..." minHeight="300px" className="mt-1"/></div>
                <div className="border-t pt-3 space-y-3">
                  <Label className="text-sm text-gray-500">Attach File (PDF, DOC, etc.)</Label>
                  <Input type="file" className="mt-1" onChange={handleFileUpload} disabled={uploadingFile}/>
                  {activeLesson.file_url && <a href={activeLesson.file_url} target="_blank" className="text-xs text-blue-600 underline mt-1 block">View current file</a>}
                  {activeLesson.file_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-gray-400"/>
                        <Label className="text-sm font-medium cursor-pointer">Allow students to download this file</Label>
                      </div>
                      <Switch checked={activeLesson.file_downloadable !== false} onCheckedChange={checked => setActiveLesson(prev => prev ? { ...prev, file_downloadable: checked } : null)} />
                    </div>
                  )}
                  {activeLesson.file_url && activeLesson.file_downloadable === false && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0"/>File is attached but <strong>hidden from students</strong>. They won't see a download button.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeLesson?.type === 'video' && (
              <div className="space-y-3">
                <div><Label>Video URL (YouTube / Vimeo / direct MP4)</Label><Input value={activeLesson.content||''} onChange={e => setActiveLesson(prev => prev?{...prev,content:e.target.value}:null)} placeholder="https://youtube.com/watch?v=..."/></div>
                <div className="border-t pt-3 space-y-3">
                  <Label className="text-sm text-gray-500">Or Upload a Video File</Label>
                  <Input type="file" accept="video/*" className="mt-1" onChange={handleFileUpload} disabled={uploadingFile}/>
                  {activeLesson.file_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-gray-400"/>
                        <Label className="text-sm font-medium cursor-pointer">Allow students to download this file</Label>
                      </div>
                      <Switch checked={activeLesson.file_downloadable !== false} onCheckedChange={checked => setActiveLesson(prev => prev ? { ...prev, file_downloadable: checked } : null)} />
                    </div>
                  )}
                  {activeLesson.file_url && activeLesson.file_downloadable === false && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0"/>Video file is uploaded but <strong>hidden from students</strong>.
                    </div>
                  )}
                </div>
                {(activeLesson.file_url || activeLesson.content) && <video src={activeLesson.file_url || activeLesson.content} controls className="w-full mt-2 rounded-lg bg-black"/>}
              </div>
            )}

            {activeLesson?.type === 'url' && (
              <div><Label>External URL</Label><Input value={activeLesson.content||''} onChange={e => setActiveLesson(prev => prev?{...prev,content:e.target.value}:null)} placeholder="https://..."/></div>
            )}

            {activeLesson?.type === 'header' && (
              <div><Label>Section Description (optional)</Label><RichTextEditor content={activeLesson.content||''} onChange={v => setActiveLesson(prev => prev?{...prev,content:v}:null)} placeholder="Brief description of this section..." minHeight="120px" className="mt-1"/></div>
            )}

            {activeLesson?.type === 'assignment' && (
              <div className="space-y-5">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2"><ClipboardList className="w-4 h-4"/> Assignment Setup</p>
                  <p className="text-xs text-blue-600">Define what students need to do and how they should submit their work.</p>
                </div>
                <div className="space-y-3 border rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-black">1</span>Assignment Instructions</p>
                  <p className="text-xs text-gray-500">How will you give students their assignment brief?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'text' as const, label: 'Write Instructions', icon: AlignLeft },
                      { type: 'url'  as const, label: 'Link to Brief',       icon: Globe    },
                      { type: 'file' as const, label: 'Upload Brief File',   icon: FileUp   },
                    ].map(({ type, label, icon: Icon }) => (
                      <button key={type} onClick={() => setAssignConfig(prev => ({...prev, instruction_type: type}))} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${assignConfig.instruction_type===type ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 hover:border-indigo-200 text-gray-600'}`}>
                        <Icon className="w-4 h-4"/>{label}
                      </button>
                    ))}
                  </div>
                  {assignConfig.instruction_type === 'text' && <RichTextEditor content={assignConfig.instructions} onChange={v => setAssignConfig(prev => ({...prev, instructions: v}))} placeholder="Write or paste the assignment instructions here..." minHeight="210px" className="mt-2"/>}
                  {assignConfig.instruction_type === 'url' && (
                    <div className="mt-2">
                      <div className="relative"><Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><Input type="url" placeholder="https://docs.google.com/... or any brief URL" className="pl-10" value={assignConfig.resource_url || ''} onChange={e => setAssignConfig(prev => ({...prev, resource_url: e.target.value}))}/></div>
                      <RichTextEditor content={assignConfig.instructions} onChange={v => setAssignConfig(prev => ({...prev, instructions: v}))} placeholder="Additional text instructions (optional)..." minHeight="105px" className="mt-2"/>
                    </div>
                  )}
                  {assignConfig.instruction_type === 'file' && (
                    <div className="mt-2 space-y-2">
                      <label className={`flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${activeLesson.file_url ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                        <input type="file" className="hidden" onChange={handleAssignmentResourceUpload} disabled={uploadingAssignFile}/>
                        {uploadingAssignFile ? <><Loader2 className="w-5 h-5 text-indigo-500 animate-spin"/><p className="text-sm text-indigo-600">Uploading...</p></> : activeLesson.file_url ? <><CheckCircle2 className="w-5 h-5 text-emerald-500"/><p className="text-sm font-medium text-emerald-700">File uploaded</p><a href={activeLesson.file_url} target="_blank" className="text-xs text-indigo-600 underline">View file</a></> : <><Upload className="w-6 h-6 text-gray-300"/><p className="text-sm font-medium text-gray-500">Upload assignment brief (PDF, DOC, etc.)</p></>}
                      </label>
                      <RichTextEditor content={assignConfig.instructions} onChange={v => setAssignConfig(prev => ({...prev, instructions: v}))} placeholder="Additional text instructions (optional)..." minHeight="105px"/>
                    </div>
                  )}
                  {activeLesson.file_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl">
                      <div className="flex items-center gap-2"><Paperclip className="w-4 h-4 text-gray-400"/><Label className="text-sm font-medium cursor-pointer">Allow students to download the brief file</Label></div>
                      <Switch checked={activeLesson.file_downloadable !== false} onCheckedChange={checked => setActiveLesson(prev => prev ? { ...prev, file_downloadable: checked } : null)} />
                    </div>
                  )}
                  {activeLesson.file_url && activeLesson.file_downloadable === false && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs"><AlertCircle className="w-4 h-4 flex-shrink-0"/>Brief file is uploaded but <strong>hidden from students</strong>.</div>
                  )}
                  <div><Label className="text-xs text-gray-500">Deadline / Due Date Note (optional)</Label><Input placeholder="e.g. Submit before the next class session" value={assignConfig.due_note || ''} onChange={e => setAssignConfig(prev => ({...prev, due_note: e.target.value}))} className="mt-1"/></div>
                </div>
                <div className="space-y-3 border rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-black">2</span>Allowed Submission Methods</p>
                  <p className="text-xs text-gray-500">Students can submit their work using any of the methods you enable below.</p>
                  <div className="space-y-2">
                    {[
                      { key: 'allow_text' as keyof AssignmentConfig, icon: AlignLeft, label: 'Written Text',  desc: 'Student types their answer directly' },
                      { key: 'allow_url'  as keyof AssignmentConfig, icon: Globe,     label: 'URL / Link',    desc: 'Google Drive, GitHub, Notion, etc.'  },
                      { key: 'allow_file' as keyof AssignmentConfig, icon: FileUp,    label: 'File Upload',   desc: 'PDF, Word, image, zip, etc.'         },
                    ].map(({ key, icon: Icon, label, desc }) => (
                      <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${assignConfig[key] ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                        <input type="checkbox" className="sr-only" checked={!!assignConfig[key]} onChange={e => setAssignConfig(prev => ({...prev, [key]: e.target.checked}))}/>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${assignConfig[key] ? 'bg-emerald-100' : 'bg-gray-100'}`}><Icon className={`w-4 h-4 ${assignConfig[key] ? 'text-emerald-600' : 'text-gray-400'}`}/></div>
                        <div className="flex-1"><p className={`text-sm font-medium ${assignConfig[key] ? 'text-emerald-800' : 'text-gray-700'}`}>{label}</p><p className="text-xs text-gray-400">{desc}</p></div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${assignConfig[key] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{assignConfig[key] && <CheckCircle2 className="w-3 h-3 text-white"/>}</div>
                      </label>
                    ))}
                  </div>
                  {!assignConfig.allow_text && !assignConfig.allow_url && !assignConfig.allow_file && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>Enable at least one submission method.</div>
                  )}
                </div>
                {(assignConfig.instructions || assignConfig.resource_url || activeLesson.file_url) && (
                  <div className="border rounded-xl p-4 bg-gray-50">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Student Preview</p>
                    <div className="bg-white border rounded-lg p-3 text-sm text-gray-600 space-y-2">
                      {assignConfig.instructions && <p className="whitespace-pre-wrap text-sm">{assignConfig.instructions.slice(0, 150)}{assignConfig.instructions.length > 150 ? '…' : ''}</p>}
                      {assignConfig.resource_url && <a href={assignConfig.resource_url} target="_blank" className="flex items-center gap-1.5 text-indigo-600 underline text-xs"><Globe className="w-3.5 h-3.5"/>{assignConfig.resource_url}</a>}
                      {activeLesson.file_url && activeLesson.file_downloadable !== false && <a href={activeLesson.file_url} target="_blank" className="flex items-center gap-1.5 text-indigo-600 underline text-xs"><FileText className="w-3.5 h-3.5"/>Download Assignment File</a>}
                      {activeLesson.file_url && activeLesson.file_downloadable === false && <p className="text-xs text-gray-400 italic">Assignment brief file (not downloadable)</p>}
                      {assignConfig.due_note && <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">⏰ {assignConfig.due_note}</p>}
                      <div className="flex gap-1.5 pt-1 border-t">
                        <span className="text-xs text-gray-400">Submit via:</span>
                        {assignConfig.allow_text && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Text</span>}
                        {assignConfig.allow_url  && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Link</span>}
                        {assignConfig.allow_file && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">File</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeLesson?.type === 'quiz' && (
              <div className="space-y-3">
                <Label>Questions</Label>
                {(activeLesson.quiz_data || []).map((q: any, i: number) => (
                  <div key={i} className="p-3 border rounded-xl bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{i+1}. {q.q}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 mt-1 inline-block">{q.type}</span>
                      </div>
                      <button onClick={() => handleRemoveQuestion(i)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                    </div>
                    {q.type === 'multiple_choice' && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {q.a?.map((opt: string, oi: number) => (
                          <span key={oi} className={`text-xs px-2 py-1 rounded-lg ${oi===q.correct?'bg-emerald-100 text-emerald-700 font-semibold':'bg-gray-100 text-gray-500'}`}>{String.fromCharCode(65+oi)}. {opt||'(empty)'} {oi===q.correct&&'✓'}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2"><Label className="flex-shrink-0">Type</Label><Select value={currentQuestion.type} onValueChange={v => handleQuestionFieldChange('type', v)}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent>{QUIZ_Q_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                  <Input placeholder="Question text" value={currentQuestion.q} onChange={e => handleQuestionFieldChange('q', e.target.value)}/>
                  {currentQuestion.type === 'multiple_choice' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">{['A','B','C','D'].map((l, i) => <Input key={i} placeholder={`Option ${l}`} value={currentQuestion.a[i]} onChange={e => handleQuestionFieldChange('a', e.target.value, i)}/>)}</div>
                      <Select value={String(currentQuestion.correct)} onValueChange={v => handleQuestionFieldChange('correct', v)}><SelectTrigger><SelectValue placeholder="Correct answer"/></SelectTrigger><SelectContent>{['A','B','C','D'].map((l, i) => <SelectItem key={i} value={String(i)}>✓ Option {l}</SelectItem>)}</SelectContent></Select>
                    </>
                  )}
                  <Button size="sm" className="w-full" onClick={handleAddQuestion}><Plus className="w-4 h-4 mr-1"/>Add Question</Button>
                </div>
              </div>
            )}

            {activeLesson?.type === 'survey' && (
              <div className="space-y-3">
                <div>
                  <Label>Link to Topic Header (for grouping in analytics)</Label>
                  <Select value={activeLesson.content||''} onValueChange={v => setActiveLesson(prev => prev?{...prev,content:v}:null)}><SelectTrigger><SelectValue placeholder="Select header topic (optional)"/></SelectTrigger><SelectContent>{courseTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select>
                </div>
                <Label>Survey Questions</Label>
                {(activeLesson.quiz_data || []).map((q: any, i: number) => (
                  <div key={i} className="p-3 border rounded-xl bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div><p className="text-sm font-semibold">{i+1}. {q.q}</p><span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${q.type==='rating'?'bg-amber-100 text-amber-700':q.type==='multiple_choice'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>{q.type}</span></div>
                      <button onClick={() => handleRemoveQuestion(i)} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                    {q.type === 'rating' && <div className="flex gap-1 mt-1">{[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400"/>)}</div>}
                    {q.type === 'multiple_choice' && q.a?.filter(Boolean).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{q.a.filter(Boolean).map((opt: string, oi: number) => <span key={oi} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{opt}</span>)}</div>}
                  </div>
                ))}
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                  <Select value={currentQuestion.type} onValueChange={v => handleQuestionFieldChange('type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{SURVEY_Q_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                  <Input placeholder="Question text" value={currentQuestion.q} onChange={e => handleQuestionFieldChange('q', e.target.value)}/>
                  {currentQuestion.type === 'rating' && <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-center gap-3"><div className="flex gap-1">{[1,2,3,4,5].map(s => <Star key={s} className="w-5 h-5 text-amber-400 fill-amber-400"/>)}</div><p className="text-xs text-amber-700 font-medium">Students will rate 1–5 stars. The average rating is tracked in analytics.</p></div>}
                  {currentQuestion.type === 'multiple_choice' && <div className="grid grid-cols-2 gap-2">{[0,1,2,3].map(i => <Input key={i} placeholder={`Option ${i+1}`} value={currentQuestion.a[i]} onChange={e => handleQuestionFieldChange('a', e.target.value, i)}/>)}</div>}
                  <Button size="sm" className="w-full" onClick={handleAddQuestion}><Plus className="w-4 h-4 mr-1"/>Add Question</Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonEditorOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => activeLesson && activeModuleId && deleteLesson(activeLesson.id, activeModuleId)}>Delete</Button>
            <Button onClick={saveLesson} className="bg-indigo-600 hover:bg-indigo-700">Save Lesson</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Course?</DialogTitle><DialogDescription>This will permanently delete the course and all its modules and lessons.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete Course</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
