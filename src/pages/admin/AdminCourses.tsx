import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, CalendarDays, Video, Clock, Loader2, FileText, HelpCircle, Link as LinkIcon, LayoutDashboard, ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { format } from 'date-fns';

// Constants
const BLOOMY_PROGRAMS = [
  'Web Development',
  'Data Science',
  'Product Design',
  'Cybersecurity',
  'Digital Marketing'
];

const LESSON_TYPES = [
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'header', label: 'Header', icon: LayoutDashboard },
  { value: 'url', label: 'Link', icon: LinkIcon }
];

// Interfaces
interface Course { id: string; title: string; description: string; program: string; status: string; }
interface Module { id: string; title: string; course_id: string; order_index: number; }
interface Lesson { id: string; title: string; type: string; content: string; module_id: string; order_index: number; file_url?: string; indent_level?: number; quiz_data?: any; }
interface Schedule { id: string; title: string; scheduled_at: string; duration_minutes: number; meeting_url: string; }

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
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
  
  // Lesson Editor State
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Schedule State
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSchedule, setNewSchedule] = useState({ title: '', scheduled_at: '', duration_minutes: 60, meeting_url: '' });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (data) setCourses(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.program) return toast({ title: 'Error', description: 'Title and Program are required.', variant: 'destructive' });
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('courses').update(form).eq('id', editing.id);
      } else {
        await supabase.from('courses').insert(form);
      }
      toast({ title: 'Success' });
      setModalOpen(false);
      fetchCourses();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('courses').delete().eq('id', deleteTarget.id);
    toast({ title: 'Deleted' });
    setDeleteTarget(null);
    fetchCourses();
  };

  const openBuilder = async (course: Course) => {
    setActiveCourse(course);
    setModules([]);
    setLessons({});
    setSchedules([]);
    setBuilderOpen(true);

    const { data: mods } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
    if (mods) {
      setModules(mods);
      const modIds = mods.map(m => m.id);
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      if (less) {
        const map: Record<string, Lesson[]> = {};
        less.forEach(l => {
          if (!map[l.module_id]) map[l.module_id] = [];
          map[l.module_id].push(l);
        });
        setLessons(map);
      }
    }

    const { data: sched } = await supabase.from('schedules').select('*').eq('course_id', course.id).order('scheduled_at', { ascending: true });
    if (sched) setSchedules(sched);
  };

  const addModule = async () => {
    if (!activeCourse) return;
    const { data } = await supabase.from('modules').insert({ course_id: activeCourse.id, title: 'New Module' }).select().single();
    if (data) setModules([...modules, data]);
  };

  const saveModuleTitle = async (id: string) => {
    await supabase.from('modules').update({ title: moduleTitleInput }).eq('id', id);
    setModules(modules.map(m => m.id === id ? { ...m, title: moduleTitleInput } : m));
    setEditingModuleId(null);
  };

  const deleteModule = async (id: string) => {
    await supabase.from('modules').delete().eq('id', id);
    setModules(modules.filter(m => m.id !== id));
  };

  const addLesson = async (moduleId: string, type: string) => {
    const { data } = await supabase.from('lessons').insert({ module_id: moduleId, title: 'New Lesson', type }).select().single();
    if (data) {
      setLessons(prev => {
        const existing = prev[moduleId] || [];
        return { ...prev, [moduleId]: [...existing, data] };
      });
    }
  };

  const openLessonEditor = (lesson: Lesson, moduleId: string) => {
    setActiveLesson(lesson);
    setActiveModuleId(moduleId);
    setAiPrompt('');
    setLessonEditorOpen(true);
  };

  const saveLesson = async () => {
    if (!activeLesson) return;
    await supabase.from('lessons').update(activeLesson).eq('id', activeLesson.id);
    setLessons(prev => {
      const modLessons = prev[activeLesson.module_id] || [];
      return { ...prev, [activeLesson.module_id]: modLessons.map(l => l.id === activeLesson.id ? activeLesson : l) };
    });
    setLessonEditorOpen(false);
  };

  const deleteLesson = async (id: string, moduleId: string) => {
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(prev => {
      const modLessons = prev[moduleId] || [];
      return { ...prev, [moduleId]: modLessons.filter(l => l.id !== id) };
    });
    setLessonEditorOpen(false);
  };

  const moveLesson = async (moduleId: string, index: number, direction: 'up' | 'down') => {
    const list = lessons[moduleId] || [];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;

    const newList = [...list];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setLessons(prev => ({ ...prev, [moduleId]: newList }));
    newList.forEach((l, i) => supabase.from('lessons').update({ order_index: i }).eq('id', l.id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeLesson) return;
    setUploadingFile(true);
    const path = `lessons/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-files').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('course-files').getPublicUrl(path);
      setActiveLesson({ ...activeLesson, file_url: data.publicUrl });
      toast({ title: 'File uploaded!' });
    } else toast({ title: 'Upload failed', variant: 'destructive' });
    setUploadingFile(false);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const res = await fetch('https://zcxysvrwblwogubakssf.supabase.co/functions/v1/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, type: activeLesson?.type })
      });
      const data = await res.json();
      if (data.content) setActiveLesson(prev => prev ? { ...prev, content: data.content } : null);
      if (data.quiz_data) setActiveLesson(prev => prev ? { ...prev, quiz_data: data.quiz_data } : null);
    } catch (err) {
      toast({ title: 'AI Error', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.title || !newSchedule.scheduled_at || !activeCourse) return;
    const { data, error } = await supabase.from('schedules').insert({
      course_id: activeCourse.id, title: newSchedule.title, scheduled_at: newSchedule.scheduled_at,
      duration_minutes: Number(newSchedule.duration_minutes), meeting_url: newSchedule.meeting_url
    }).select().single();

    if (!error && data) {
      setSchedules([...schedules, data]);
      setNewSchedule({ title: '', scheduled_at: '', duration_minutes: 60, meeting_url: '' });
      toast({ title: 'Session Scheduled' });
    } else toast({ title: 'Error creating schedule', variant: 'destructive' });
  };

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Courses</h2>
            <p className="text-muted-foreground text-sm">Manage your training programs</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ title: '', description: '', program: '', status: 'Draft' }); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Create Course
          </Button>
        </div>

        {loading ? <p>Loading...</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="border-border overflow-hidden">
                <div className="h-24 gradient-hero flex items-center justify-center p-4">
                  <h3 className="font-display font-bold text-lg text-primary-foreground text-center">{course.title}</h3>
                </div>
                <div className="p-5">
                  <div className="text-xs text-secondary font-semibold uppercase mb-2">{course.program || 'General'}</div>
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
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Course' : 'Create Course'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="mt-1.5" /></div>
            <div>
              <Label>Program</Label>
              <Select value={form.program || ''} onValueChange={v => setForm({...form, program: v})}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOMY_PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || 'Draft'} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Builder Modal */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Course Builder: {activeCourse?.title}</DialogTitle></DialogHeader>
          <Tabs defaultValue="modules" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="modules">Modules & Lessons</TabsTrigger>
              <TabsTrigger value="schedule">Class Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="modules">
              <div className="space-y-4 pt-4">
                <Button onClick={addModule} size="sm" className="w-full"><Plus className="w-4 h-4 mr-1" /> Add Module</Button>
                {modules.map((mod, idx) => (
                  <div key={mod.id} className="border border-border rounded-lg">
                    <div className="flex items-center justify-between p-3 bg-muted/50">
                      <div className="flex items-center gap-2 flex-1">
                        {editingModuleId === mod.id ? (
                          <>
                            <Input value={moduleTitleInput} onChange={e => setModuleTitleInput(e.target.value)} className="h-8" />
                            <Button size="sm" onClick={() => saveModuleTitle(mod.id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingModuleId(null)}>X</Button>
                          </>
                        ) : (
                          <span className="font-semibold cursor-pointer" onClick={() => setExpandedModules({ ...expandedModules, [mod.id]: !expandedModules[mod.id] })}>
                            {expandedModules[mod.id] ? <ChevronDown className="w-4 h-4 inline mr-1" /> : <ChevronRight className="w-4 h-4 inline mr-1" />}
                            {idx + 1}. {mod.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditingModuleId(mod.id); setModuleTitleInput(mod.title); }}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteModule(mod.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    {expandedModules[mod.id] && (
                      <div className="p-3 space-y-2 bg-card border-t border-border">
                        <div className="flex flex-wrap gap-2 mb-4">
                          {LESSON_TYPES.map(t => {
                             const Icon = t.icon;
                             return (
                              <Button key={t.value} variant="outline" size="sm" onClick={() => addLesson(mod.id, t.value)}>
                                <Icon className="w-3 h-3 mr-1" /> {t.label}
                              </Button>
                           );
                          })}
                        </div>
                        {(lessons[mod.id] || []).map((les, lIdx) => {
                          const Icon = LESSON_TYPES.find(l => l.value === les.type)?.icon || FileText;
                          const isHeader = les.type === 'header';
                          return (
                            <div key={les.id} className={`flex items-center justify-between p-2 rounded border ${isHeader ? 'bg-blue-50 border-blue-200 font-bold' : 'bg-muted/30 border-border'}`} style={{ marginLeft: `${(les.indent_level || 0) * 24}px` }}>
                              <div className="flex items-center gap-2 flex-1">
                                <Icon className={`w-4 h-4 ${isHeader ? 'text-blue-600' : 'text-muted-foreground'}`} />
                                <span className={`text-sm ${isHeader ? 'text-blue-800 dark:text-blue-200' : ''}`}>{les.title}</span>
                                {les.file_url && <Paperclip className="w-3 h-3 text-green-500" />}
                              </div>
                              <div className="flex gap-1 items-center">
                                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'up')} disabled={lIdx === 0}><ChevronRight className="w-3 h-3 rotate-[-90deg]" /></Button>
                                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => moveLesson(mod.id, lIdx, 'down')} disabled={lIdx === (lessons[mod.id]?.length || 0) - 1}><ChevronRight className="w-3 h-3 rotate-90" /></Button>
                                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openLessonEditor(les, mod.id)}><Pencil className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteLesson(les.id, mod.id)}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          );
                        })}
                        {(lessons[mod.id]?.length === 0) && <p className="text-xs text-center text-muted-foreground py-2">No lessons. Use buttons above to add.</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="schedule">
              <div className="space-y-4 pt-4">
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <h4 className="font-semibold mb-3 flex items-center gap-2"><Video className="w-4 h-4" /> Schedule a Live Session</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label>Title</Label><Input value={newSchedule.title} onChange={e => setNewSchedule({...newSchedule, title: e.target.value})} /></div>
                    <div><Label>Date & Time</Label><Input type="datetime-local" value={newSchedule.scheduled_at} onChange={e => setNewSchedule({...newSchedule, scheduled_at: e.target.value})} /></div>
                    <div><Label>Duration (mins)</Label><Input type="number" value={newSchedule.duration_minutes} onChange={e => setNewSchedule({...newSchedule, duration_minutes: Number(e.target.value)})} /></div>
                    <div><Label>Meeting Link</Label><Input value={newSchedule.meeting_url} onChange={e => setNewSchedule({...newSchedule, meeting_url: e.target.value})} /></div>
                  </div>
                  <Button className="mt-3" onClick={handleAddSchedule}>Add to Schedule</Button>
                </div>
                <div className="space-y-2">
                  {schedules.map(s => (
                    <div key={s.id} className="p-3 border rounded flex justify-between items-center">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-2"><CalendarDays className="w-3 h-3" />{format(new Date(s.scheduled_at), 'PPP p')}</p>
                      </div>
                      <div className="flex gap-2">
                        {s.meeting_url && <a href={s.meeting_url} target="_blank" className="text-xs text-blue-600 underline">Join</a>}
                        <Button variant="ghost" size="sm" className="text-red-600 h-7" onClick={() => handleDeleteSchedule(s.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Lesson Editor Modal */}
      <Dialog open={lessonEditorOpen} onOpenChange={setLessonEditorOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Lesson</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={activeLesson?.title || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, title: e.target.value } : null)} /></div>
            <div>
              <Label>Indent Level</Label>
              <Select value={String(activeLesson?.indent_level || 0)} onValueChange={(v) => setActiveLesson(prev => prev ? { ...prev, indent_level: Number(v) } : null)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Level 0</SelectItem>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border">
              <Label className="text-purple-800 font-semibold">AI Builder</Label>
              <Textarea placeholder="Prompt..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="my-2" />
              <Button onClick={handleAIGenerate} disabled={isGenerating} className="w-full bg-purple-600 hover:bg-purple-700">
                {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Generate'}
              </Button>
            </div>
            {activeLesson?.type === 'text' && <div><Label>Content</Label><Textarea rows={8} value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} /></div>}
            {activeLesson?.type === 'video' && <div><Label>Video URL</Label><Input value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} /></div>}
            {activeLesson?.type === 'quiz' && <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">{JSON.stringify(activeLesson?.quiz_data, null, 2)}</pre>}
            {activeLesson?.type === 'url' && <div><Label>URL</Label><Input value={activeLesson?.content || ''} onChange={e => setActiveLesson(prev => prev ? { ...prev, content: e.target.value } : null)} /></div>}
            <div className="border-t pt-4">
              <Label>Attachment</Label>
              <Input type="file" onChange={handleFileUpload} disabled={uploadingFile} className="mt-1" />
              {activeLesson?.file_url && <a href={activeLesson.file_url} target="_blank" className="text-xs text-blue-600 underline block mt-1">View File</a>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveLesson}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course?</DialogTitle>
            <p className="text-sm text-muted-foreground">This will permanently delete the course and all its modules.</p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}