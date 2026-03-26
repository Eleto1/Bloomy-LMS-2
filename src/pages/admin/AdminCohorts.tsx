import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

// Your exact list of courses
const BLOOMY_PROGRAMS = [
  'Cybersecurity',
  'Web Development',
  'Data Analytics',
  'Product Design',
  'Product Management',
  'Digital Marketing',
  'Linux, DevOps, Cloud'
];

interface CohortRow {
  id: string;
  name: string;
  course: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  max_students: number | null;
}

const emptyForm = { name: '', course: '', startDate: '', endDate: '', maxStudents: '' };

const AdminCohorts = () => {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [existingCohortNames, setExistingCohortNames] = useState<string[]>([]);
  const [studentCountByCohort, setStudentCountByCohort] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CohortRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CohortRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadCohorts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('cohorts').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({
        title: 'Could not load cohorts',
        description: error.message,
        variant: 'destructive',
      });
      setCohorts([]);
    } else {
      setCohorts(data ?? []);
      
      // Extract unique names for the dropdown suggestion
      const names = Array.from(new Set((data ?? []).map(c => c.name).filter(Boolean)));
      setExistingCohortNames(names);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('cohort_id')
        .eq('role', 'student');
      const counts: Record<string, number> = {};
      for (const p of profiles ?? []) {
        const cid = p.cohort_id as string | null;
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
      }
      setStudentCountByCohort(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCohorts();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: CohortRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      course: c.course ?? '',
      startDate: c.start_date ?? '',
      endDate: c.end_date ?? '',
      maxStudents: c.max_students != null ? String(c.max_students) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        course: form.course.trim() || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        max_students: form.maxStudents ? parseInt(form.maxStudents, 10) : null,
      };

      if (editing) {
        const { error } = await supabase.from('cohorts').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Cohort updated' });
      } else {
        const { error } = await supabase.from('cohorts').insert({
          ...payload,
          status: 'Upcoming',
        });
        if (error) throw error;
        toast({ title: 'Cohort created' });
      }
      setModalOpen(false);
      await loadCohorts();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('cohorts').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cohort deleted' });
      await loadCohorts();
    }
    setDeleteTarget(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Cohorts</h2>
            <p className="text-muted-foreground text-sm">
              Create cohorts and assign them to specific programs.{' '}
              <Link to="/admin/students" className="text-secondary font-medium hover:underline">
                Go to Students
              </Link>
            </p>
          </div>
          <Button variant="default" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Create Cohort
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading cohorts…</p>
        ) : cohorts.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <p className="text-muted-foreground text-sm mb-4">No cohorts in the database yet.</p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" /> Create your first cohort
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohorts.map((c) => (
              <Card key={c.id} className="p-5 border-border hover:shadow-brand transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">{c.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      c.status === 'Active'
                        ? 'bg-success/10 text-success'
                        : c.status === 'Upcoming'
                          ? 'bg-info/10 text-info'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.status ?? '—'}
                  </span>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">{c.course ?? '—'}</p>
                <p className="text-xs text-muted-foreground mb-3">Program</p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {studentCountByCohort[c.id] ?? 0} students
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {c.start_date ?? '—'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Cohort' : 'Create Cohort'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editing ? 'Update cohort details.' : 'Add a new cohort to the database.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
          <div>
              <Label>Use Existing Name (Optional)</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) setForm({ ...form, name: v });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select to populate name..." />
                </SelectTrigger>
                <SelectContent>
                  {existingCohortNames.length === 0 ? (
                    <SelectItem value="_none" disabled>No existing names</SelectItem>
                  ) : (
                    existingCohortNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cohort Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
                placeholder="Type new name or edit selected"
              />
            </div>
            
            <div>
              <Label>Program / Course</Label>
              <Select
                value={form.course}
                onValueChange={(v) => setForm({ ...form, course: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOMY_PROGRAMS.map((prog) => (
                    <SelectItem key={prog} value={prog}>
                      {prog}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Max Students</Label>
              <Input
                type="number"
                min={0}
                value={form.maxStudents}
                onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create Cohort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Students linked to it may need their cohort updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminCohorts;