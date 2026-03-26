import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { supabase, createEphemeralSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Instructor {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  cohort_id?: string | null;
  created_at: string;
}

interface CohortOption {
  id: string;
  name: string;
  course: string | null;
}

const BULK_DEFAULT_PASSWORD = 'password123';
const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone', 'Cohort'] as const;

function cohortLookupMap(cohorts: CohortOption[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of cohorts) {
    m.set(c.name.trim().toLowerCase(), c.id);
  }
  return m;
}

function parseBulkRow(row: Record<string, unknown>): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cohortName: string;
} {
  const norm = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    norm.set(k.trim().toLowerCase(), v == null ? '' : String(v).trim());
  }
  return {
    firstName: norm.get('first name') ?? '',
    lastName: norm.get('last name') ?? '',
    email: norm.get('email') ?? '',
    phone: norm.get('phone') ?? '',
    cohortName: norm.get('cohort') ?? '',
  };
}

function isUserAlreadyExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes('already') && (m.includes('registered') || m.includes('exists'))) ||
    m.includes('user already') ||
    m.includes('email address is already') ||
    m.includes('duplicate key') ||
    m.includes('unique constraint')
  );
}

function downloadInstructorTemplate() {
  const csv = `${TEMPLATE_HEADERS.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bloomy_instructors_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const emptyForm = { full_name: '', email: '', phone: '', password: '', cohort_id: '' };

const AdminInstructors = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instructor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchInstructors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'instructor')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Error fetching instructors', variant: 'destructive' });
    } else if (data) {
      setInstructors(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInstructors();
    const loadCohorts = async () => {
      const { data, error } = await supabase.from('cohorts').select('id, name, course').order('name');
      if (!error && data) setCohorts(data);
    };
    loadCohorts();
  }, []);

  const uniqueCourses = Array.from(new Set(cohorts.map(c => c.course).filter(Boolean)));
  const getSelectedCohort = (id: string | undefined) => cohorts.find(c => c.id === id);

  const filtered = instructors
    .filter(i => {
      const matchesSearch = i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.email?.toLowerCase().includes(search.toLowerCase());
      const matchesCohort = cohortFilter === 'all' || i.cohort_id === cohortFilter;
      const instructorCohort = getSelectedCohort(i.cohort_id);
      const matchesCourse = courseFilter === 'all' || instructorCohort?.course === courseFilter;
      return matchesSearch && matchesCohort && matchesCourse;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return (a.full_name || '').localeCompare(b.full_name || '');
      if (sortBy === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
      if (sortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (i: Instructor) => {
    setEditing(i);
    setForm({
      full_name: i.full_name || '',
      email: i.email || '',
      phone: i.phone || '',
      password: '',
      cohort_id: i.cohort_id || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cohortId = form.cohort_id ? form.cohort_id : null;
      if (editing) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: form.full_name, phone: form.phone || null, cohort_id: cohortId })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Instructor updated' });
      } else {
        const emailNorm = form.email.trim().toLowerCase();
        const password = form.password?.trim() || 'TempPass123!';
        
        const rowClient = createEphemeralSupabaseClient();
        try {
          const { data: signData, error: signErr } = await rowClient.auth.signUp({
            email: emailNorm,
            password,
            options: { data: { full_name: form.full_name, role: 'instructor' } },
          });

          if (signErr) throw signErr;
          const newUser = signData.user ?? signData.session?.user ?? null;
          
          if (newUser) {
            const { error: profErr } = await rowClient.from('profiles').upsert({
              id: newUser.id,
              email: emailNorm,
              full_name: form.full_name,
              phone: form.phone || null,
              role: 'instructor',
              cohort_id: cohortId,
            });
            if (profErr) throw profErr;
            toast({ title: 'Instructor added' });
          }
        } finally {
          await rowClient.auth.signOut();
        }
      }
      setModalOpen(false);
      fetchInstructors();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Instructor deleted' }); fetchInstructors(); }
    setDeleteTarget(null);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Cohort', 'Course', 'Created At'];
    const rows = instructors.map(i => {
      const cohort = getSelectedCohort(i.cohort_id);
      return [i.full_name, i.email, i.phone || '', cohort?.name || '—', cohort?.course || '—', i.created_at];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'instructors.csv'; a.click();
  };

  const handleBulkCsvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBulkUploading(true);
    let success = 0;
    let failed = 0;

    try {
      const { data: cohortRows } = await supabase.from('cohorts').select('id, name');
      const cohortMap = cohortLookupMap((cohortRows ?? []) as CohortOption[]);

      const parsed = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
          complete: resolve,
          error: (err) => reject(err),
        });
      });

      const rows = parsed.data.filter((row) => Object.values(row).some((v) => v != null && String(v).trim() !== ''));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const { firstName, lastName, email, phone, cohortName } = parseBulkRow(row);
        const full_name = `${firstName} ${lastName}`.trim();
        const emailNorm = email.trim().toLowerCase();

        if (!emailNorm || !full_name) {
          failed++;
          continue;
        }

        const cohortId = cohortName ? cohortMap.get(cohortName.trim().toLowerCase()) ?? null : null;

        const rowClient = createEphemeralSupabaseClient();
        try {
          const { data: signData, error: signErr } = await rowClient.auth.signUp({
            email: emailNorm,
            password: BULK_DEFAULT_PASSWORD,
            options: { data: { full_name, role: 'instructor' } },
          });

          if (signErr) {
            if (isUserAlreadyExistsError(signErr.message)) failed++;
            else failed++;
            continue;
          }

          const newUser = signData.user ?? signData.session?.user ?? null;
          if (newUser) {
            const { error: profErr } = await rowClient.from('profiles').upsert({
              id: newUser.id,
              email: emailNorm,
              full_name,
              phone: phone || null,
              role: 'instructor',
              cohort_id: cohortId,
            });
            if (profErr) throw profErr;
            success++;
          }
        } finally {
          await rowClient.auth.signOut();
        }
      }

      toast({ title: 'Bulk Upload Finished', description: `${success} added, ${failed} failed.` });
      fetchInstructors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk upload failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Instructors</h2>
            <p className="text-muted-foreground text-sm">Manage your teaching staff ({instructors.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>Export CSV</Button>
            <Button variant="outline" size="sm" onClick={downloadInstructorTemplate}>
              <Download className="w-4 h-4 mr-1" /> Download Template
            </Button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleBulkCsvSelected}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={bulkUploading}
              onClick={() => bulkFileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" /> {bulkUploading ? 'Processing...' : 'Bulk Upload'}
            </Button>
            <Button variant="default" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Instructor</Button>
          </div>
        </div>

        <Card className="border-border">
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search instructors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <Select value={cohortFilter} onValueChange={setCohortFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Cohort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {uniqueCourses.map(course => <SelectItem key={course} value={course || ''}>{course}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Newest First</SelectItem>
                  <SelectItem value="created_asc">Oldest First</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Cohort</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Course</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Joined</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No instructors found.</td></tr>
                ) : filtered.map((i) => {
                  const instructorCohort = getSelectedCohort(i.cohort_id);
                  return (
                    <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
                            {(i.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">{i.full_name}</span>
                            <span className="text-xs text-muted-foreground md:hidden">{i.email}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 md:hidden">
                              {instructorCohort?.name || 'No Cohort'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{i.email}</td>
                      <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">{i.phone || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">
                        {instructorCohort?.name || '—'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden xl:table-cell">
                        {instructorCohort?.course || '—'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{new Date(i.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(i)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(i)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Instructor' : 'Add Instructor'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="mt-1.5" /></div>
            {!editing && (
              <>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1.5" /></div>
                <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className="mt-1.5" /></div>
              </>
            )}
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+234..." className="mt-1.5" /></div>
            
            <div>
              <Label>Cohort</Label>
              {cohorts.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1.5">
                  No cohorts. <Link to="/admin/cohorts" className="text-secondary font-medium hover:underline">Create one</Link>
                </p>
              ) : (
                <Select value={form.cohort_id || undefined} onValueChange={(v) => setForm({ ...form, cohort_id: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                  <SelectContent>
                    {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Instructor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Instructor</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete {deleteTarget?.full_name}?</AlertDialogDescription>
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

export default AdminInstructors;