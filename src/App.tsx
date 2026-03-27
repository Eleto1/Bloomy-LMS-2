import { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, CalendarDays, Video, Clock, Loader2, FileText, HelpCircle, Link as LinkIcon, LayoutDashboard, ChevronDown, ChevronRight, Paperclip, ClipboardList, Users, Copy, ArrowRightCircle, Save } from 'lucide-react';

// Constants
const BLOOMY_PROGRAMS = ['Web Development', 'Data Science', 'Product Design', 'Cybersecurity', 'Digital Marketing'];
const DAYS_OF_WEEK = [{ id: 'Mon', label: 'Mon' }, { id: 'Tue', label: 'Tue' }, { id: 'Wed', label: 'Wed' }, { id: 'Thu', label: 'Thu' }, { id: 'Fri', label: 'Fri' }, { id: 'Sat', label: 'Sat' }, { id: 'Sun', label: 'Sun' }];
const LESSON_TYPES = [
  { value: 'text', label: 'Text Content', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'survey', label: 'Survey', icon: ClipboardList },
  { value: 'header', label: 'Header', icon: LayoutDashboard },
  { value: 'url', label: 'External Link', icon: LinkIcon }
];
const SURVEY_Q_TYPES = [
  { value: 'rating', label: 'Rating (1-5 Stars)' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'text', label: 'Long Text' },
];

// Interfaces
interface Course { id: string; title: string; description: string; program: string; status: string; }
interface Module { id: string; title: string; course_id: string; order_index: number; unlock_date?: string; }
interface Lesson { id: string; title: string; type: string; content: string; module_id: string; order_index: number; file_url?: string; indent_level?: number; quiz_data?: any; }
interface Schedule { id: string; title: string; scheduled_at: string; days: string[]; time: string; is_recurring: boolean; meeting_url: string; }
interface Cohort { id: string; name: string; course: string; }
interface Question { q: string; type: string; a: string[]; correct: number; }

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState({ title: '', description: '', program: '', status: 'Draft' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Builder State
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleTitleInput, setModuleTitleInput] = useState('');
  const [moduleDateInput, setModuleDateInput] = useState<string>('');
  
  // Lesson Editor State
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Question Builder State
  const [currentQuestion, setCurrentQuestion] = useState<Question>({ q: '', type: 'text', a: ['', '', '', ''], correct: 0 });
  const [courseTopics, setCourseTopics] = useState<{ id: string; title: string }[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSchedule, setNewSchedule] = useState({ days: [] as string[], time: '09:00', meeting_url: '' });
  const [courseCohorts, setCourseCohorts] = useState<Cohort[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: courseData } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (courseData) setCourses(courseData);
    const { data: cohortData } = await supabase.from('cohorts').select('*');
    if (cohortData) setAllCohorts(cohortData);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.program) return toast({ title: 'Error', description: 'Title and Program are required.', variant: 'destructive' });
    setSaving(true);
    try {
      if (editing) await supabase.from('courses').update(form).eq('id', editing.id);
      else await supabase.from('courses').insert(form);
      toast({ title: 'Success' });
      setModalOpen(false);
      fetchInitialData();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('courses').delete().eq('id', deleteTarget.id);
    toast({ title: 'Deleted' });
    setDeleteTarget(null);
    fetchInitialData();
  };

  const openBuilder = async (course: Course) => {
    setActiveCourse(course);
    setModules([]); setLessons({}); setSchedules([]); setCourseCohorts([]); setBuilderOpen(true);
    const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
    if (mods) {
      setModules(mods);
      const modIds = mods.map(m => m.id);
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      if (less) { const map: Record<string, Lesson[]> = {}; less.forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); }); setLessons(map); }
    }
    const { data: sched } = await supabase.from('schedules').select('*').eq('course_id', course.id);
    if (sched) setSchedules(sched);
    const { data: cohorts } = await supabase.from('cohorts').select('*').eq('course', course.program);
    if (cohorts) setCourseCohorts(cohorts);
  };

  // --- Module Actions ---
  const addModule = async () => {
    if (!activeCourse) return;
    const { data } = await supabase.from('modules').insert({ course_id: activeCourse.id, title: 'New Module' }).select().single();
    if (data) setModules([...modules, data]);
  };

  const saveModuleTitle = async (id: string) => {
    await supabase.from('modules').update({ title: moduleTitleInput, unlock_date: moduleDateInput || null }).eq('id', id);
    setModules(modules.map(m => m.id === id ? { ...m, title: moduleTitleInput, unlock_date: moduleDateInput || null } : m));
    setEditingModuleId(null);
  };

  const deleteModule = async (id: string) => { await supabase.from('modules').delete().eq('id', id); setModules(modules.filter(m => m.id !== id)); };

  const duplicateModule = async (mod: Module) => {
    if(!activeCourse) return; setSaving(true);
    const { data: newMod } = await supabase.from('modules').insert({ course_id: activeCourse.id, title: `${mod.title} (Copy)` }).select().single();
    if (newMod) {
      const lessonsToCopy = lessons[mod.id] || [];
      if (lessonsToCopy.length > 0) await supabase.from('lessons').insert(lessonsToCopy.map(l => ({ module_id: newMod.id, title: l.title, type: l.type, content: l.content, file_url: l.file_url, quiz_data: l.quiz_data, order_index: l.order_index })));
      toast({ title: 'Module Duplicated!' });
      openBuilder(activeCourse);
    }
    setSaving(false);
  };

  const toggleModuleExpand = (id: string) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));

  // --- Lesson Actions ---
  const addLesson = async (moduleId: string, type: string) => {
    const { data } = await supabase.from('lessons').insert({ module_id: moduleId, title: 'New Lesson', type }).select().single();
    if (data) setLessons(prev => { const existing = prev[moduleId] || []; return { ...prev, [moduleId]: [...existing, data] }; });
  };

  const openLessonEditor = (lesson: Lesson, moduleId: string) => {
    setActiveLesson(lesson); setActiveModuleId(moduleId); setAiPrompt(''); setCurrentQuestion({ q: '', type: 'text', a: ['', '', '', ''], correct: 0 });
    const allLessons = Object.values(lessons).flat();
    setCourseTopics(allLessons.filter(l => l.type === 'header').map(l => ({ id: l.id, title: l.title })));
    setLessonEditorOpen(true);
  };

  const saveLesson = async () => {
    if (!activeLesson) return;
    await supabase.from('lessons').update(activeLesson).eq('id', activeLesson.id);
    if (activeCourse) {
        const { data: less } = await supabase.from('lessons').select('*').in('module_id', modules.map(m => m.id)).order('order_index');
        if (less) { const map: Record<string, Lesson[]> = {}; less.forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); }); setLessons(map); }
    }
    setLessonEditorOpen(false);
  };

  const deleteLesson = async (id: string, moduleId: string) => {
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(prev => { const modLessons = prev[moduleId] || []; return { ...prev, [moduleId]: modLessons.filter(l => l.id !== id) }; });
    setLessonEditorOpen(false);
  };

  const duplicateLesson = async (lesson: Lesson) => {
    setSaving(true);
    const { id, ...copyData } = lesson;
    const { data } = await supabase.from('lessons').insert({ ...copyData, title: `${lesson.title} (Copy)` }).select().single();
    if (data) { setLessons(prev => { const existing = prev[lesson.module_id] || []; return { ...prev, [lesson.module_id]: [...existing, data] }; }); toast({ title: 'Duplicated!' }); }
    setSaving(false);
  };

  const moveLesson = async (moduleId: string, index: number, direction: 'up' | 'down') => {
    const list = lessons[moduleId] || [];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    const newList = [...list]; [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setLessons(prev => ({ ...prev, [moduleId]: newList }));
    newList.forEach((l, i) => supabase.from('lessons').update({ order_index: i }).eq('id', l.id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !activeLesson) return;
    setUploadingFile(true);
    const path = `lessons/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-files').upload(path, file);
    if (!error) { const { data } = supabase.storage.from('course-files').getPublicUrl(path); setActiveLesson({ ...activeLesson, file_url: data.publicUrl }); toast({ title: 'Uploaded!' }); }
    else toast({ title: 'Upload failed', variant: 'destructive' });
    setUploadingFile(false);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return; setIsGenerating(true);
    try {
      const res = await fetch('https://zcxysvrwblwogubakssf.supabase.co/functions/v1/generate-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt, type: activeLesson?.type }) });
      const data = await res.json();
      if (data.content) setActiveLesson(prev => prev ? { ...prev, content: data.content } : null);
      if (data.quiz_data) setActiveLesson(prev => prev ? { ...prev, quiz_data: data.quiz_data } : null);
    } catch { toast({ title: 'AI Error', variant: 'destructive' }); } finally { setIsGenerating(false); }
  };

  const handleQuestionFieldChange = (field: string, value: string, index?: number) => {
    setCurrentQuestion(prev => {
      if (field === 'q') return { ...prev, q: value };
      if (field === 'type') return { ...prev, type: value, a: value === 'multiple_choice' ? ['', '', '', ''] : [] };
      if (field === 'a' && index !== undefined) { const newOptions = [...prev.a]; newOptions[index] = value; return { ...prev, a: newOptions }; }
      if (field === 'correct') return { ...prev, correct: Number(value) };
      return prev;
    });
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.q) { toast({ title: 'Enter question text', variant: 'destructive' }); return; }
    if (currentQuestion.type === 'multiple_choice' && currentQuestion.a.filter(x => x).length < 2) { toast({ title: 'Need 2 options', variant: 'destructive' }); return; }
    setActiveLesson(prev => { if(!prev) return null; return { ...prev, quiz_data: [...(prev.quiz_data || []), currentQuestion] }; });
    setCurrentQuestion({ q: '', type: 'text', a: ['', '', '', ''], correct: 0 });
    toast({ title: 'Added!' });
  };

  const handleRemoveQuestion = (index: number) => setActiveLesson(prev => prev ? { ...prev, quiz_data: prev.quiz_data?.filter((_: any, i: number) => i !== index) } : null);

  // Schedule Logic
  const handleDayToggle = (dayId: string) => setNewSchedule(prev => ({ ...prev, days: prev.days.includes(dayId) ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId] }));
  const handleAddSchedule = async () => {
    if (newSchedule.days.length === 0 || !newSchedule.time || !activeCourse) { toast({ title: 'Missing fields', variant: 'destructive' }); return; }
    const { data, error } = await supabase.from('schedules').insert(newSchedule.days.map(day => ({ course_id: activeCourse.id, title: 'Class', days: [day], time: newSchedule.time, is_recurring: true, meeting_url: newSchedule.meeting_url, scheduled_at: new Date().toISOString() }))).select();
    if (!error && data) { setSchedules([...schedules, ...data]); setNewSchedule({ days: [], time: '09:00', meeting_url: '' }); toast({ title: 'Created!' }); }
  };
  const handleDeleteSchedule = async (id: string) => { await supabase.from('schedules').delete().eq('id', id); setSchedules(schedules.filter(s => s.id !== id)); };

  const groupedSchedules = schedules.reduce((acc, curr) => { const key = curr.time || '00:00'; if (!acc[key]) acc[key] = []; acc[key].push(curr); return acc; }, {} as Record<string, Schedule[]>);
  const getCohortNames = (program: string) => allCohorts.filter(c => c.course === program).map(c => c.name).join(', ') || 'No Cohort';

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex justify-between items-center">
        <div><h2 className="font-display font-bold text-2xl">Courses</h2><p className="text-muted-foreground text-sm">Manage training programs</p></div>
        <Button onClick={() => { setEditing(null); setForm({ title: '', description: '', program: '', status: 'Draft' }); setModalOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Create Course</Button>
      </div>
      {loading ? <p>Loading...</p> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="border-border overflow-hidden">
              <div className="h-24 gradient-hero flex items-center justify-center p-4"><h3 className="font-display font-bold text-lg text-primary-foreground text-center">{course.title}</h3></div>
              <div className="p-5">
                <div className="flex flex-col gap-1 mb-2">
                  <span className="text-xs text-secondary font-semibold uppercase">{course.program || 'General'}</span>
                  <span className="text-xs text-gray-500 truncate"><strong>Cohort:</strong> {getCohortNames(course.program)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${course.status === 'Active' ? 'bg-success/10 text-success' : 'bg-muted'}`}>{course.status}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openBuilder(course)}>Build</Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditing(course); setForm(course); setModalOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleteTarget(course)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Course</DialogTitle><DialogDescription>Fill details below.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div><Label>Program</Label><Select value={form.program || ''} onValueChange={v => setForm({...form, program: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{BLOOMY_PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={form.status || 'Draft'} onValueChange={v => setForm({...form, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Active">Active</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Course Builder: {activeCourse?.title}</DialogTitle><DialogDescription>Manage content, schedule, and cohorts.</DialogDescription></DialogHeader>
          <Tabs defaultValue="modules" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="modules">Content</TabsTrigger><TabsTrigger value="schedule">Schedule</TabsTrigger><TabsTrigger value="cohorts">Cohorts</TabsTrigger></TabsList>

            <TabsContent value="modules">
              <div className="space-y-4 pt-4">
                <Button onClick={addModule} size="sm" className="w-full"><Plus className="w-4 h-4 mr-1" /> Add Module</Button>
                {modules.map((mod, idx) => {
                  const isExpanded = expandedModules[mod.id];
                  return (
                    <div key={mod.id} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3 bg-muted/50">
                        <div className="flex items-center gap-2 flex-1">
                          {editingModuleId === mod.id ? (
                            <div className="flex gap-2 flex-1">
                              <Input value={moduleTitleInput} onChange={e => setModuleTitleInput(e.target.value)} className="h-8" />
                              <Input type="datetime-local" value={moduleDateInput} onChange={e => setModuleDateInput(e.target.value)} className="h-8" title="Unlock Date (Optional)" />
                              <Button size="sm" onClick={() => saveModuleTitle(mod.id)}><Save className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingModuleId(null)}>X</Button>
                            </div>
                          ) : (
                            <div className="font-semibold cursor-pointer flex items-center gap-1" onClick={() => toggleModuleExpand(mod.id)}>
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {idx + 1}. {mod.title}
                              {mod.unlock_date && <span className="text-xs text-blue-500 ml-2">(Unlocks: {new Date(mod.unlock_date).toLocaleDateString()})</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button title="Edit" variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditingModuleId(mod.id); setModuleTitleInput(mod.title); setModuleDateInput(mod.unlock_date || ''); }}><Pencil className="w-3 h-3" /></Button>
                          <Button title="Duplicate" variant="ghost" size="icon" className="w-7 h-7" onClick={() => duplicateModule(mod)}><Copy className="w-3 h-3" /></Button>
                          <Button title="Delete" variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteModule(mod.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-3 space-y-2 bg-card border-t">
                          <div className="flex flex-wrap gap-2 mb-4">{LESSON_TYPES.map(t => <Button key={t.value} variant="outline" size="sm" onClick={() => addLesson(mod.id, t.value)}><t.icon className="w-3 h-3 mr-1" />{t.label}</Button>)}</div>
                          {(lessons[mod.id] || []).map((les, lIdx) => {
                             const Icon = LESSON_TYPES.find(l => l.value === les.type)?.icon || FileText;
                             return (
                              <div key={les.id} className={`flex items-center justify-between p-2 rounded border ${les.type === 'header' ? 'bg-blue-50 font-bold' : 'bg-muted/30'}`} style={{ marginLeft: `${(les.indent_level || 0) * 24}px` }}>
                                <div className="flex items-center gap-2 flex-1"><Icon className="w-4 h-4" /><span className="text-sm">{les.title}</span>{les.file_url && <Paperclip className="w-3 h-3 text-gray-400" />}</div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => duplicateLesson(les)}><Copy className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'up')} disabled={lIdx === 0}><ChevronRight className="w-3 h-3 rotate-[-90deg]" /></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'down')} disabled={lIdx === (lessons[mod.id]?.length || 0) - 1}><ChevronRight className="w-3 h-3 rotate-90" /></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openLessonEditor(les, mod.id)}><Pencil className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteLesson(les.id, mod.id)}><Trash2 className="w-3 h-3" /></Button>
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
                 <Card className="p-4"><h4 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Schedule Classes</h4>
                   <div className="flex flex-wrap gap-4 mt-2">{DAYS_OF_WEEK.map(day => <label key={day.id} className="flex items-center gap-2"><input type="checkbox" checked={newSchedule.days.includes(day.id)} onChange={() => handleDayToggle(day.id)} /><span>{day.label}</span></label>)}</div>
                   <div className="grid grid-cols-2 gap-3 mt-3">
                     <Input type="time" value={newSchedule.time} onChange={e => setNewSchedule({...newSchedule, time: e.target.value})} />
                     <Input placeholder="Meeting URL" value={newSchedule.meeting_url} onChange={e => setNewSchedule({...newSchedule, meeting_url: e.target.value})} />
                   </div>
                   <Button className="mt-3" onClick={handleAddSchedule}>Add</Button>
                 </Card>
                 {Object.entries(groupedSchedules).map(([time, items]) => (
                   <Card key={time} className="p-2"><div className="font-bold text-sm mb-1">{time}</div>{items.map(s => <div key={s.id} className="flex justify-between text-xs p-1"><span>{s.days?.join(',')}</span><span className="flex gap-2">{s.meeting_url && <a href={s.meeting_url} target="_blank" className="text-blue-600 underline">Join</a>}<button onClick={() => handleDeleteSchedule(s.id)} className="text-red-500">X</button></span></div>)}</Card>
                 ))}
               </div>
            </TabsContent>

            <TabsContent value="cohorts">
              <div className="pt-4 space-y-2">{courseCohorts.length === 0 ? <p className="text-center text-gray-500 p-4">No cohorts enrolled.</p> : courseCohorts.map(c => <div key={c.id} className="p-2 border rounded flex justify-between"><span>{c.name}</span><span className="text-xs bg-blue-100 px-2 py-1 rounded">{c.course}</span></div>)}</div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={lessonEditorOpen} onOpenChange={setLessonEditorOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Lesson</DialogTitle><DialogDescription>Modify lesson details.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={activeLesson?.title || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, title: e.target.value } : null)} /></div>
            <div><Label>Move to Module</Label><Select value={activeLesson?.module_id || ''} onValueChange={v => setActiveLesson(prev => prev ? { ...prev, module_id: v } : null)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Indent Level</Label><Select value={String(activeLesson?.indent_level || 0)} onValueChange={v => setActiveLesson(prev => prev ? { ...prev, indent_level: Number(v) } : null)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent></Select></div>
            
            <div className="bg-purple-50 p-3 rounded border"><Label>AI Generator</Label><Textarea placeholder="Prompt..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} /><Button onClick={handleAIGenerate} disabled={isGenerating} className="mt-2 w-full bg-purple-600">{isGenerating ? '...Loading' : 'Generate'}</Button></div>

            {activeLesson?.type === 'text' && <Textarea rows={6} value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} />}
            {activeLesson?.type === 'video' && <Input value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} />}
            {activeLesson?.type === 'url' && <Input value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} />}
            
            {activeLesson?.type === 'quiz' && (
              <div className="space-y-2">
                {activeLesson?.quiz_data?.map((q: any, i: number) => <div key={i} className="p-2 border rounded text-xs"><b>{q.q}</b> <div className="float-right cursor-pointer text-red-500" onClick={() => handleRemoveQuestion(i)}>X</div></div>)}
                <div className="p-2 border rounded bg-gray-50">
                  <Input placeholder="Question" value={currentQuestion.q} onChange={e => handleQuestionFieldChange('q', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input placeholder="Opt A" value={currentQuestion.a[0]} onChange={e => handleQuestionFieldChange('a', e.target.value, 0)} />
                    <Input placeholder="Opt B" value={currentQuestion.a[1]} onChange={e => handleQuestionFieldChange('a', e.target.value, 1)} />
                    <Input placeholder="Opt C" value={currentQuestion.a[2]} onChange={e => handleQuestionFieldChange('a', e.target.value, 2)} />
                    <Input placeholder="Opt D" value={currentQuestion.a[3]} onChange={e => handleQuestionFieldChange('a', e.target.value, 3)} />
                  </div>
                  <Select value={String(currentQuestion.correct)} onValueChange={v => handleQuestionFieldChange('correct', v)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">A</SelectItem><SelectItem value="1">B</SelectItem><SelectItem value="2">C</SelectItem><SelectItem value="3">D</SelectItem></SelectContent></Select>
                  <Button size="sm" className="mt-2 w-full" onClick={handleAddQuestion}>Add Question</Button>
                </div>
              </div>
            )}

            {activeLesson?.type === 'survey' && (
               <div className="space-y-2">
                 <Label>Link to Topic (Header)</Label>
                 <Select value={activeLesson?.content || ''} onValueChange={v => setActiveLesson(prev => prev ? { ...prev, content: v } : null)}><SelectTrigger><SelectValue placeholder="Select Topic" /></SelectTrigger><SelectContent>{courseTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select>
                 {activeLesson?.quiz_data?.map((q: any, i: number) => <div key={i} className="p-2 border rounded text-xs"><b>{q.q}</b> <div className="float-right cursor-pointer text-red-500" onClick={() => handleRemoveQuestion(i)}>X</div></div>)}
                 <div className="p-2 border rounded bg-gray-50">
                   <Select value={currentQuestion.type} onValueChange={v => handleQuestionFieldChange('type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SURVEY_Q_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                   <Input placeholder="Question Text" value={currentQuestion.q} onChange={e => handleQuestionFieldChange('q', e.target.value)} className="mt-2" />
                   {currentQuestion.type === 'multiple_choice' && <div className="grid grid-cols-2 gap-2 mt-2">{[0,1,2,3].map(i => <Input key={i} placeholder={`Opt ${i+1}`} value={currentQuestion.a[i]} onChange={e => handleQuestionFieldChange('a', e.target.value, i)} />)}</div>}
                   <Button size="sm" className="mt-2 w-full" onClick={handleAddQuestion}>Add Question</Button>
                 </div>
               </div>
            )}

            <div className="border-t pt-2">
              <Label>Requirements / File</Label>
              <Input type="file" onChange={handleFileUpload} disabled={uploadingFile} />
              {activeLesson?.file_url && <a href={activeLesson.file_url} target="_blank" className="text-xs text-blue-600 underline">View Current File</a>}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLessonEditorOpen(false)}>Cancel</Button><Button onClick={saveLesson}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Delete Course?</DialogTitle><DialogDescription>This cannot be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}