import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Pencil, Trash2, Search, Loader2, FileText, Eye, X, Link2, 
  AlertTriangle, CheckCircle2, Clock, Award, Users, Download, Globe 
} from 'lucide-react';

interface Assessment { 
  id: string; title: string; type: 'Exam' | 'File' | 'Quiz'; course_id: string; 
  file_url?: string; questions?: any; courses: { title: string, program: string } | null; 
}
interface Course { id: string; title: string; program: string; }
interface Cohort { id: string; name: string; course: string; }
interface Submission {
  id: string; user_id: string; assessment_id: string; submission_type: string;
  content: string | null; file_url: string | null; score: number | null;
  feedback: string | null; status: string; submitted_at: string; graded_at: string | null;
  student_name: string; cohort_name: string; assessment_title: string; assessment_type: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminFinalAssessment() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submissions State
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [mainTab, setMainTab] = useState('submissions');
  const [sSearchName, setSSearchName] = useState('');
  const [sFilterCohort, setSFilterCohort] = useState('all');
  const [sFilterAssessment, setSFilterAssessment] = useState('all');
  const [sFilterStatus, setSFilterStatus] = useState('all');

  // Grade Dialog State
  const [gradeOpen, setGradeOpen] = useState(false);
  const [activeSub, setActiveSub] = useState<Submission | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  // Original State
  const [searchText, setSearchText] = useState('');
  const [filterCohortName, setFilterCohortName] = useState<string>('all');
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [form, setForm] = useState({ title: '', type: 'Exam' as 'Exam' | 'File' | 'Quiz', course_id: '', file_url: '', questions: [] as any[] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fileMode, setFileMode] = useState<'upload' | 'link'>('upload');
  const [pastedUrl, setPastedUrl] = useState('');

  const [currentQ, setCurrentQ] = useState({ q: '', a: ['', '', '', ''], correct: 0 });
  const { toast } = useToast();

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setSubsLoading(true);
    try {
      // Fixed: Renamed to 'Res' to safely extract .data arrays
      const [courseRes, cohortRes, assessRes, subRes, profRes] = await Promise.all([
        supabase.from('courses').select('id, title, program'),
        supabase.from('cohorts').select('id, name, course'),
        supabase.from('assessments').select('*, courses(title, program)').order('created_at', { ascending: false }),
        supabase.from('assessment_submissions').select('*').order('submitted_at', { ascending: false }),
        supabase.from('profiles').select('*') 
      ]);

      if (courseRes.data) setCourses(courseRes.data);
      if (cohortRes.data) setCohorts(cohortRes.data);
      if (assessRes.data) setAssessments(assessRes.data);

      // Safely match names and cohorts in JavaScript
      const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p]));
      const assessMap = new Map((assessRes.data || []).map((a: any) => [a.id, a]));
      const cohortMap = new Map((cohortRes.data || []).map((c: any) => [c.id, c.name]));

      const enriched = (subRes.data || []).map((sub: any) => {
        const prof = profMap.get(sub.user_id);
        const assess = assessMap.get(sub.assessment_id);
        
        let cohortName = '-';
        if (prof?.cohort_id) {
          cohortName = cohortMap.get(prof.cohort_id) || '-';
        }

        return {
          ...sub,
          student_name: prof?.full_name || prof?.name || 'Unknown Student',
          cohort_name: cohortName,
          assessment_title: assess?.title || 'Deleted Assessment',
          assessment_type: assess?.type || '-',
        };
      });

      setSubmissions(enriched);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { 
      setLoading(false); 
      setSubsLoading(false); 
    }
  };

  const uniqueCohortNames = Array.from(new Set(cohorts.map(c => c.name)));
  const availablePrograms = filterCohortName !== 'all' 
    ? Array.from(new Set(cohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : Array.from(new Set(cohorts.map(c => c.course)));
  const availableCourses = courses.filter(c => { if (filterProgram !== 'all') return c.program === filterProgram; return true; });

  useEffect(() => { setFilterProgram('all'); }, [filterCohortName]);
  useEffect(() => { setFilterCourseId('all'); }, [filterProgram]);

  const filtered = assessments.filter(a => {
    const matchSearch = searchText ? (a.title?.toLowerCase().includes(searchText.toLowerCase())) : true;
    const matchCourse = filterCourseId !== 'all' ? a.course_id === filterCourseId : true;
    const matchProgram = (filterProgram !== 'all' && filterCourseId === 'all') ? (a.courses && a.courses.program === filterProgram) : true;
    return matchSearch && matchCourse && matchProgram;
  });

  const pendingCount = submissions.filter(s => s.status === 'submitted').length;
  const filteredSubs = submissions.filter(s => {
    const m1 = sSearchName ? s.student_name?.toLowerCase().includes(sSearchName.toLowerCase()) : true;
    const m2 = sFilterCohort !== 'all' ? s.cohort_name === sFilterCohort : true;
    const m3 = sFilterAssessment !== 'all' ? s.assessment_id === sFilterAssessment : true;
    const m4 = sFilterStatus !== 'all' ? s.status === sFilterStatus : true;
    return m1 && m2 && m3 && m4;
  });

  const openModal = (item?: Assessment) => {
    if (item) {
      setEditing(item);
      setForm({ title: item.title, type: item.type, course_id: item.course_id, file_url: item.file_url || '', questions: item.questions ? JSON.parse(JSON.stringify(item.questions)) : [] });
      if (item.file_url && !item.file_url.includes('/storage/v1/')) {
        setFileMode('link');
        setPastedUrl(item.file_url);
      } else {
        setFileMode('upload');
        setPastedUrl('');
      }
    } else {
      setEditing(null);
      setForm({ title: '', type: 'Exam', course_id: '', file_url: '', questions: [] });
      setFileMode('upload');
      setPastedUrl('');
    }
    setCurrentQ({ q: '', a: ['', '', '', ''], correct: 0 });
    setModalOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: `${file.name} is ${formatFileSize(file.size)}. Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`, variant: 'destructive' });
      if (e.target) e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = `assessments/${fileName}`;
      const uploadPromise = supabase.storage.from('course-files').upload(filePath, file);
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Upload timed out (30s).')), 30000));
      const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);
      if (uploadError) throw uploadError;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      setForm(prev => ({ ...prev, file_url: `${supabaseUrl}/storage/v1/object/public/course-files/${filePath}` }));
      toast({ title: 'File Uploaded!' });
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handlePasteLink = () => {
    if (!pastedUrl.trim()) return toast({ title: 'Enter a URL', variant: 'destructive' });
    if (!pastedUrl.startsWith('http://') && !pastedUrl.startsWith('https://')) return toast({ title: 'Invalid URL', variant: 'destructive' });
    setForm(prev => ({ ...prev, file_url: pastedUrl.trim() }));
    toast({ title: 'Link saved!' });
  };

  const handleAddQuestion = () => {
    if (!currentQ.q.trim()) return toast({ title: 'Enter a question', variant: 'destructive' });
    if (currentQ.a.filter(x => x.trim()).length < 2) return toast({ title: 'Add at least 2 options', variant: 'destructive' });
    setForm(prev => ({ ...prev, questions: [...prev.questions, { ...currentQ }] }));
    setCurrentQ({ q: '', a: ['', '', '', ''], correct: 0 });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast({ title: 'Title is required', variant: 'destructive' });
    if (!form.course_id) return toast({ title: 'Course is required', variant: 'destructive' });
    if (form.type === 'File' && !form.file_url) return toast({ title: 'Provide a file', variant: 'destructive' });
    if (form.type === 'Quiz' && form.questions.length === 0) return toast({ title: 'Add questions', variant: 'destructive' });

    setSaving(true);
    try {
      const payload = { title: form.title.trim(), type: form.type, course_id: form.course_id, file_url: form.type === 'File' ? form.file_url : null, questions: form.type === 'Quiz' ? form.questions : null };
      if (editing) {
        const { error } = await supabase.from('assessments').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assessments').insert(payload);
        if (error) throw error;
      }
      toast({ title: editing ? 'Updated!' : 'Created!' });
      setModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment?')) return;
    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Deleted' });
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  const openGrade = (sub: Submission) => {
    setActiveSub(sub);
    setGradeScore(sub.score !== null && sub.score !== undefined ? sub.score.toString() : '');
    setGradeFeedback(sub.feedback || '');
    setGradeOpen(true);
  };

  const handleGrade = async () => {
    if (!activeSub) return;
    setGrading(true);
    try {
      const { error } = await supabase.from('assessment_submissions').update({
        score: gradeScore ? parseFloat(gradeScore) : null,
        feedback: gradeFeedback || null,
        status: 'graded',
        graded_at: new Date().toISOString()
      }).eq('id', activeSub.id);
      if (error) throw error;
      toast({ title: 'Grade saved!' });
      setGradeOpen(false);
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setGrading(false); }
  };

  const resetFilters = () => { setSearchText(''); setFilterCohortName('all'); setFilterProgram('all'); setFilterCourseId('all'); };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Final Assessments</h1>
          <p className="text-gray-500 text-sm">Manage Exams, Quizzes, and Files</p>
        </div>
        <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Add Assessment</Button>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="submissions" className="gap-1.5">
            <Users className="w-4 h-4" /> Submissions 
            {pendingCount > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="manage">Manage Assessments</TabsTrigger>
        </TabsList>

        {/* ======================== SUBMISSIONS TAB ======================== */}
        <TabsContent value="submissions" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="relative">
                <Label className="text-xs">Student Name</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"/>
                  <Input placeholder="Search name..." value={sSearchName} onChange={e=>setSSearchName(e.target.value)} className="pl-8"/>
                </div>
              </div>
              <div>
                <Label className="text-xs">Cohort</Label>
                <Select value={sFilterCohort} onValueChange={setSFilterCohort}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cohorts</SelectItem>
                    {uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Assessment</Label>
                <Select value={sFilterAssessment} onValueChange={setSFilterAssessment}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assessments</SelectItem>
                    {assessments.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={sFilterStatus} onValueChange={setSFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="submitted">Pending</SelectItem>
                    <SelectItem value="graded">Graded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="min-w-[200px]">Submission</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin inline mr-2"/>Loading submissions...</TableCell></TableRow>
                ) : filteredSubs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center h-24 text-gray-500">No submissions found.</TableCell></TableRow>
                ) : (
                  filteredSubs.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.student_name}</TableCell>
                      <TableCell><span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{s.cohort_name}</span></TableCell>
                      <TableCell className="max-w-[180px] truncate" title={s.assessment_title}>{s.assessment_title}</TableCell>
                      
                      <TableCell className="max-w-[220px]">
                        {s.submission_type === 'text' && s.content ? (
                          <p className="text-xs text-gray-700 line-clamp-2 bg-gray-50 p-2 rounded border">{s.content}</p>
                        ) : s.submission_type === 'url' && s.content ? (
                          <a href={s.content} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 truncate"><Globe className="w-3 h-3 flex-shrink-0"/>{s.content}</a>
                        ) : s.submission_type === 'file' && s.file_url ? (
                          <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3 flex-shrink-0"/>View File</a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Empty</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(s.submitted_at)}</TableCell>
                      <TableCell>
                        {s.score !== null && s.score !== undefined
                          ? <span className="text-sm font-bold text-emerald-600">{s.score}</span>
                          : <span className="text-xs text-gray-400">-</span>
                        }
                      </TableCell>
                      <TableCell>
                        {s.status === 'graded' 
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" />Graded</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" />Pending</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openGrade(s)} className="h-8 px-2">
                          {s.status === 'graded' ? <><Eye className="w-3.5 h-3.5 mr-1" />View</> : <><Award className="w-3.5 h-3.5 mr-1" />Grade</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ======================== MANAGE ASSESSMENTS TAB ======================== */}
        <TabsContent value="manage" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="relative">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"/>
                  <Input placeholder="Title..." value={searchText} onChange={e=>setSearchText(e.target.value)} className="pl-8"/>
                </div>
              </div>
              <div>
                <Label>Cohort</Label>
                <Select value={filterCohortName} onValueChange={setFilterCohortName}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cohorts</SelectItem>
                    {uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program</Label>
                <Select value={filterProgram} onValueChange={setFilterProgram}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {availablePrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course</Label>
                <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                  <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {availableCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(searchText || filterCohortName !== 'all' || filterProgram !== 'all' || filterCourseId !== 'all') && (
              <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" onClick={resetFilters}><X className="w-4 h-4 mr-1"/> Clear</Button></div>
            )}
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin inline mr-2"/>Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-gray-500">No assessments found.</TableCell></TableRow>
                ) : (
                  filtered.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{a.courses?.title || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${a.type === 'File' ? 'bg-blue-100 text-blue-800' : a.type === 'Quiz' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                          {a.type === 'File' ? '📄 File' : a.type === 'Quiz' ? '❓ Quiz' : '📝 Exam'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {a.type === 'File' && a.file_url ? (
                          <a href={a.file_url} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center gap-1"><Eye className="w-3 h-3"/> View File</a>
                        ) : a.type === 'Quiz' ? (
                          <span className="text-xs text-gray-500">{a.questions?.length || 0} Questions</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Free-form responses</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openModal(a)}><Pencil className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4"/></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Assessment</DialogTitle></DialogHeader>
          
          <Tabs defaultValue="details" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="content" disabled={!form.type || form.type === 'Exam'}>Content</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 py-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(prev => ({...prev, title: e.target.value}))} placeholder="e.g. Final Examination" />
              </div>
              <div>
                <Label>Course *</Label>
                <Select value={form.course_id} onValueChange={v => setForm(prev => ({...prev, course_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select Course"/></SelectTrigger>
                  <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(prev => ({...prev, type: v as 'Exam' | 'File' | 'Quiz'}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Exam">📝 Exam (Text / File / URL)</SelectItem>
                    <SelectItem value="File">📄 File (Upload or Link)</SelectItem>
                    <SelectItem value="Quiz">❓ Quiz (Auto-graded)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1.5">
                  {form.type === 'Exam' && 'Students write text, attach a file, or paste a URL.'}
                  {form.type === 'File' && 'Upload a file or paste a link (Google Drive, Dropbox, etc).'}
                  {form.type === 'Quiz' && 'Add multiple choice questions. Auto-graded on submit.'}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 py-4">
              {form.type === 'File' && (
                <div className="space-y-3">
                  <Label>Assessment File *</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={fileMode === 'upload' ? 'default' : 'outline'} onClick={() => setFileMode('upload')}><FileText className="w-3.5 h-3.5 mr-1" /> Upload File</Button>
                    <Button type="button" size="sm" variant={fileMode === 'link' ? 'default' : 'outline'} onClick={() => setFileMode('link')}><Link2 className="w-3.5 h-3.5 mr-1" /> Paste Link</Button>
                  </div>
                  {fileMode === 'upload' && (
                    <div className="space-y-2">
                      <Input type="file" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx,.png,.jpg,.jpeg" />
                      <p className="text-[11px] text-gray-400">Max file size: {formatFileSize(MAX_FILE_SIZE)}</p>
                      {uploading && (<div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</div>)}
                    </div>
                  )}
                  {fileMode === 'link' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input placeholder="https://drive.google.com/file/d/..." value={pastedUrl} onChange={e => setPastedUrl(e.target.value)} disabled={uploading} />
                        <Button type="button" onClick={handlePasteLink} disabled={uploading} size="sm" className="shrink-0">Save Link</Button>
                      </div>
                      <p className="text-[11px] text-gray-400">Paste a Google Drive, Dropbox, OneDrive, or any public URL</p>
                    </div>
                  )}
                  {form.file_url && !uploading && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-green-700">File ready</span></div>
                      <p className="text-[11px] text-green-600 break-all">{form.file_url}</p>
                      <div className="flex gap-2 mt-2">
                        <a href={form.file_url} target="_blank" className="text-xs font-semibold text-green-700 underline">Open link</a>
                        <button className="text-xs font-semibold text-red-500 underline" onClick={() => { setForm(prev => ({...prev, file_url: ''})); setPastedUrl(''); }}>Remove</button>
                      </div>
                    </div>
                  )}
                  {!form.file_url && !uploading && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700">
                        <p className="font-semibold">Provide a file before saving</p>
                        <p className="mt-0.5">Upload a file under {formatFileSize(MAX_FILE_SIZE)}, or paste a link to Google Drive / Dropbox / OneDrive.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {form.type === 'Quiz' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><Label>Questions</Label><span className="text-xs text-gray-500">{form.questions.length} added</span></div>
                  {form.questions.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {form.questions.map((q, i) => (
                        <div key={i} className="p-3 border rounded-lg bg-gray-50 flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm"><span className="text-gray-400 mr-1">Q{i+1}.</span>{q.q}</p>
                            <div className="flex flex-wrap gap-1 mt-1">{q.a.filter(x => x.trim()).map((opt, oi) => (<span key={oi} className={`text-[11px] px-1.5 py-0.5 rounded ${oi === q.correct ? 'bg-green-100 text-green-700 font-semibold' : 'bg-white text-gray-500 border'}`}>{opt.length > 25 ? opt.slice(0, 25) + '...' : opt}</span>))}</div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setForm(prev => ({...prev, questions: prev.questions.filter((_, idx) => idx !== i)}))}><Trash2 className="w-3 h-3 text-red-500"/></Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border p-4 rounded-lg space-y-3 bg-slate-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add New Question</p>
                    <Input placeholder="Question Text" value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="relative">
                          <Input placeholder={`Option ${i+1}`} value={currentQ.a[i]} onChange={e => { const newA = [...currentQ.a]; newA[i] = e.target.value; setCurrentQ({...currentQ, a: newA}); }} />
                          {currentQ.a[i].trim() && (
                            <button type="button" onClick={() => setCurrentQ({...currentQ, correct: i})} className={`absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${i === currentQ.correct ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400 hover:border-gray-400'}`} title="Mark as correct">{i === currentQ.correct ? '✓' : ''}</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400">Click the circle to mark the correct answer.</p>
                    <Button onClick={handleAddQuestion} size="sm" className="w-full"><Plus className="w-4 h-4 mr-1"/> Add Question</Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin mr-2"/>}
              {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Award className="w-5 h-5" /> {activeSub?.status === 'graded' ? 'View Submission' : 'Grade Submission'}</DialogTitle>
          </DialogHeader>
          {activeSub && (
            <div className="space-y-5 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Student</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{activeSub.student_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Cohort</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{activeSub.cohort_name}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">What they submitted</p>
                <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
                  {activeSub.submission_type === 'text' && activeSub.content && (<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{activeSub.content}</p>)}
                  {activeSub.submission_type === 'url' && activeSub.content && (<a href={activeSub.content} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-2"><Globe className="w-4 h-4" />{activeSub.content}</a>)}
                  {activeSub.submission_type === 'file' && activeSub.file_url && (<a href={activeSub.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-2"><Download className="w-4 h-4" />View submitted file</a>)}
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label>Score</Label>
                    <Input type="number" value={gradeScore} onChange={e => setGradeScore(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label>Feedback</Label>
                  <textarea className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-400" rows={4} placeholder="Write feedback for the student..." value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setGradeOpen(false)}>Close</Button>
            <Button onClick={handleGrade} disabled={grading}>
              {grading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {activeSub?.status === 'graded' ? 'Update Grade' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}