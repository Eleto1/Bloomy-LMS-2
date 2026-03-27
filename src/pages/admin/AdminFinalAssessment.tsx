import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Assessment { id: string; title: string; type: string; course_id: string; courses: { title: string } | null; }
interface Course { id: string; title: string; }

export default function AdminFinalAssessment() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [form, setForm] = useState({ title: '', type: 'Exam', course_id: '' });
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: courseData } = await supabase.from('courses').select('id, title');
    if (courseData) setCourses(courseData);
    const { data: assessData } = await supabase.from('assessments').select('*, courses(title)').order('created_at', { ascending: false });
    if (assessData) setAssessments(assessData);
    setLoading(false);
  };

  const openModal = (item?: Assessment) => {
    if (item) { setEditing(item); setForm({ title: item.title, type: item.type, course_id: item.course_id }); }
    else { setEditing(null); setForm({ title: '', type: 'Exam', course_id: '' }); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.course_id) return toast({ title: 'Required', variant: 'destructive' });
    if (editing) await supabase.from('assessments').update(form).eq('id', editing.id);
    else await supabase.from('assessments').insert(form);
    toast({ title: 'Saved!' });
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Delete?')) return;
    await supabase.from('assessments').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchData();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Final Assessments</h1>
        <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Course</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow> :
             assessments.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.courses?.title}</TableCell>
                <TableCell>{a.type}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openModal(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div>
              <Label>Course</Label>
              <Select value={form.course_id} onValueChange={v => setForm({...form, course_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exam">Exam</SelectItem>
                  <SelectItem value="Project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}