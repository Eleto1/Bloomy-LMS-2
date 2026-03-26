import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Plus, Trash2, Pencil, Upload, AlertCircle, Clock, CheckCircle, CalendarDays } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Student { id: string; full_name: string; email: string; cohort_id?: string; }
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface AssessmentDef { id: string; title: string; type: string; program: string; cohort_id: string; start_date: string; file_url: string; questions: any; }
interface Submission { id: string; status: string; score: number; total_marks: number; submission_url: string; feedback: string; user_id: string; }

interface Question { q: string; a: string[]; correct: number; }

export default function AdminFinalAssessment() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  
  const [assessments, setAssessments] = useState<AssessmentDef[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Updated State for new fields
  const [newAssessment, setNewAssessment] = useState({ 
    title: '', 
    type: 'project', 
    program: '', 
    cohort_id: '', 
    start_date: '', 
    instructions: '', 
    file_url: '' 
  });
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState<Question>({ q: '', a: ['', '', '', ''], correct: 0 });
  
  const [gradingSubmission, setGradingSubmission] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, cohortsRes, coursesRes, assessRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, cohort_id').eq('role', 'student'),
      supabase.from('cohorts').select('id, name, course'),
      supabase.from('courses').select('id, title, program'),
      supabase.from('assessment_definitions').select('*')
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (cohortsRes.data) setCohorts(cohortsRes.data);
    if (coursesRes.data) setCourses(coursesRes.data);
    if (assessRes.data) setAssessments(assessRes.data);

    if (studentsRes.data && studentsRes.data.length > 0) {
      const ids = studentsRes.data.map(s => s.id);
      const { data: subRes } = await supabase.from('final_assessments').select('*').in('user_id', ids);
      const map: Record<string, Submission> = {};
      (subRes || []).forEach(s => map[s.user_id] = s);
      setSubmissions(map);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `assessments/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-files').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('course-files').getPublicUrl(path);
      setNewAssessment(prev => ({ ...prev, file_url: data.publicUrl }));
      toast({ title: 'File Uploaded!' });
    } else {
      toast({ title: 'Upload Failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const addQuestion = () => {
    if (!currentQ.q || currentQ.a.filter(x => x).length < 2) {
      toast({ title: 'Incomplete Question', variant: 'destructive' });
      return;
    }
    setQuizQuestions([...quizQuestions, currentQ]);
    setCurrentQ({ q: '', a: ['', '', '', ''], correct: 0 });
  };

  const openEditModal = (a: AssessmentDef) => {
    setEditingId(a.id);
    setNewAssessment({
      title: a.title,
      type: a.type,
      program: a.program,
      cohort_id: a.cohort_id || '',
      start_date: a.start_date || '',
      instructions: a.instructions || '',
      file_url: a.file_url || ''
    });
    setQuizQuestions(a.questions || []);
    setCreateModalOpen(true);
  };

  const resetModal = () => {
    setEditingId(null);
    setNewAssessment({ title: '', type: 'project', program: '', cohort_id: '', start_date: '', instructions: '', file_url: '' });
    setQuizQuestions([]);
    setCurrentQ({ q: '', a: ['', '', '', ''], correct: 0 });
    setCreateModalOpen(false);
  };

  const handleSave = async () => {
    if (!newAssessment.title || !newAssessment.program) {
      toast({ title: 'Error', description: 'Title and Program are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    
    const payload = {
      ...newAssessment,
      questions: newAssessment.type === 'quiz' ? quizQuestions : null
    };

    let error;
    if (editingId) {
      const res = await supabase.from('assessment_definitions').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('assessment_definitions').insert(payload);
      error = res.error;
    }

    if (!error) {
      toast({ title: editingId ? 'Assessment Updated!' : 'Assessment Created!' });
      resetModal();
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment?')) return;
    const { error } = await supabase.from('assessment_definitions').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Deleted.' });
      fetchData();
    }
  };

  const handleGrade = async (submissionId: string, score: number, feedback: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('final_assessments')
      .update({ score, feedback, status: 'graded' })
      .eq('id', submissionId);
    
    if (!error) {
      toast({ title: 'Saved!' });
      fetchData();
      setGradingSubmission(null);
    } else {
      toast({ title: 'Error saving', variant: 'destructive' });
    }
    setSaving(false);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchesCohort = selectedCohort === 'all' || s.cohort_id === selectedCohort;
    const matchesCourse = selectedCourse === 'all' || (() => {
      const cohort = cohorts.find(c => c.id === s.cohort_id);
      const course = courses.find(c => c.id === selectedCourse);
      return cohort?.course === course?.program;
    })();
    return matchesSearch && matchesCohort && matchesCourse;
  });

  const getStatusBadge = (status: string) => {
    if (status === 'graded') return <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="w-3 h-3" /> Graded</span>;
    if (status === 'submitted') return <span className="flex items-center justify-center gap-1 text-xs font-medium text-blue-600"><Clock className="w-3 h-3" /> Submitted</span>;
    return <span className="flex items-center justify-center gap-1 text-xs font-medium text-gray-400"><AlertCircle className="w-3 h-3" /> Pending</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Final Assessments</h2>
            <p className="text-gray-500">Create quizzes/projects and grade submissions.</p>
          </div>
        </div>

        <Tabs defaultValue="monitor" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="monitor">Monitor Submissions</TabsTrigger>
            <TabsTrigger value="manage">Manage Assessments</TabsTrigger>
          </TabsList>

          {/* MANAGE TAB */}
          <TabsContent value="manage">
            <Card className="p-6">
              <div className="flex justify-between mb-4">
                <h3 className="font-semibold">Active Assessments</h3>
                <Button size="sm" onClick={() => { resetModal(); setCreateModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> Create New
                </Button>
              </div>
              {assessments.length === 0 ? (
                <p className="text-sm text-gray-500">No assessments created yet.</p>
              ) : (
                <div className="space-y-2">
                  {assessments.map(a => {
                    const cohort = cohorts.find(c => c.id === a.cohort_id);
                    return (
                      <div key={a.id} className="p-3 border rounded flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <span className="font-medium">{a.title}</span>
                          <div className="text-xs text-gray-500">
                            {a.program} {cohort ? `(${cohort.name})` : '(All Cohorts)'} 
                            {a.start_date ? ` - Starts: ${new Date(a.start_date).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(a)}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(a.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* MONITOR TAB */}
          <TabsContent value="monitor">
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <Label>Search</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Name or Email" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Cohort</Label>
                  <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cohorts</SelectItem>
                      {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Program</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.program}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? <Loader2 className="animate-spin mx-auto" /> : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Student</th>
                        <th className="text-left p-3 font-medium">Program</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Score</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => {
                        const cohort = cohorts.find(c => c.id === s.cohort_id);
                        const program = cohort?.course || '—';
                        const sub = submissions[s.id];
                        return (
                          <tr key={s.id} className="border-t">
                            <td className="p-3">
                              <div className="font-medium">{s.full_name}</div>
                              <div className="text-xs text-gray-500">{s.email}</div>
                            </td>
                            <td className="p-3">{program}</td>
                            <td className="p-3 text-center">{getStatusBadge(sub?.status || 'pending')}</td>
                            <td className="p-3 text-center font-bold">
                              {sub?.status === 'graded' ? `${sub.score}/${sub.total_marks}` : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {sub && sub.status !== 'pending' && (
                                <Button variant="outline" size="sm" onClick={() => setGradingSubmission(sub)}>Review</Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* CREATE/EDIT MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Assessment' : 'Create Assessment'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input placeholder="e.g., Final Capstone Project" value={newAssessment.title} onChange={e => setNewAssessment({...newAssessment, title: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Program</Label>
                <Select value={newAssessment.program} onValueChange={v => setNewAssessment({...newAssessment, program: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.program}>{c.program}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cohort (Optional)</Label>
                <Select value={newAssessment.cohort_id || 'all'} onValueChange={v => setNewAssessment({...newAssessment, cohort_id: v === 'all' ? '' : v})}>
                  <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cohorts</SelectItem>
                    {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <Label>Type</Label>
                <Select value={newAssessment.type} onValueChange={v => setNewAssessment({...newAssessment, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Project (File Upload)</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={newAssessment.start_date} 
                  onChange={e => setNewAssessment({...newAssessment, start_date: e.target.value})} 
                />
              </div>
            </div>

            <div>
              <Label>Instructions</Label>
              <Textarea rows={3} value={newAssessment.instructions} onChange={e => setNewAssessment({...newAssessment, instructions: e.target.value})} />
            </div>

            {/* FILE UPLOAD */}
            <div>
              <Label>Upload File (PDF/Doc)</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input type="file" onChange={handleFileUpload} disabled={uploading} />
                {uploading && <Loader2 className="animate-spin w-4 h-4" />}
              </div>
              {newAssessment.file_url && (
                <p className="text-xs text-green-600 mt-1">File uploaded.</p>
              )}
            </div>

            {/* QUIZ BUILDER */}
            {newAssessment.type === 'quiz' && (
              <div className="border-t pt-4 mt-4">
                <Label className="font-bold">Quiz Builder</Label>
                <div className="space-y-3 mt-2">
                  <Input placeholder="Question Text" value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Option A" value={currentQ.a[0]} onChange={e => setCurrentQ({...currentQ, a: [e.target.value, currentQ.a[1], currentQ.a[2], currentQ.a[3]]})} />
                    <Input placeholder="Option B" value={currentQ.a[1]} onChange={e => setCurrentQ({...currentQ, a: [currentQ.a[0], e.target.value, currentQ.a[2], currentQ.a[3]]})} />
                    <Input placeholder="Option C" value={currentQ.a[2]} onChange={e => setCurrentQ({...currentQ, a: [currentQ.a[0], currentQ.a[1], e.target.value, currentQ.a[3]]})} />
                    <Input placeholder="Option D" value={currentQ.a[3]} onChange={e => setCurrentQ({...currentQ, a: [currentQ.a[0], currentQ.a[1], currentQ.a[2], e.target.value]})} />
                  </div>
                  <div>
                    <Label className="text-xs">Correct Answer</Label>
                    <Select value={String(currentQ.correct)} onValueChange={v => setCurrentQ({...currentQ, correct: Number(v)})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Option A</SelectItem>
                        <SelectItem value="1">Option B</SelectItem>
                        <SelectItem value="2">Option C</SelectItem>
                        <SelectItem value="3">Option D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={addQuestion}>Add Question</Button>
                </div>

                {quizQuestions.length > 0 && (
                  <div className="mt-4 border rounded p-2 bg-gray-50 space-y-2">
                    {quizQuestions.map((q, i) => (
                      <div key={i} className="text-xs p-2 bg-white border rounded flex justify-between items-center">
                        <span>{i+1}. {q.q}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">Ans: {q.a[q.correct]}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setQuizQuestions(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GRADING MODAL */}
      <Dialog open={!!gradingSubmission} onOpenChange={() => setGradingSubmission(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Submission</DialogTitle></DialogHeader>
          {gradingSubmission && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500">Submitted File</Label>
                <a href={gradingSubmission.submission_url} target="_blank" className="text-blue-600 underline block mt-1">View Submission</a>
              </div>
              <div>
                <Label>Score</Label>
                <Input type="number" id="scoreInput" defaultValue={gradingSubmission.score || 0} />
              </div>
              <div>
                <Label>Feedback</Label>
                <Textarea rows={3} id="feedbackInput" defaultValue={gradingSubmission.feedback || ''} />
              </div>
              <Button className="w-full" onClick={() => {
                const score = Number((document.getElementById('scoreInput') as any).value);
                const feedback = (document.getElementById('feedbackInput') as any).value;
                handleGrade(gradingSubmission.id, score, feedback);
              }}>Save Grade</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}