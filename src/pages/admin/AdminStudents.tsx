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

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  cohort_id?: string | null;
  created_at: string;
}

// Updated to include course
interface CohortOption {
  id: string;
  name: string;
  course: string | null;
}

const BULK_DEFAULT_PASSWORD = 'password123';

const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone', 'Course', 'Cohort'] as const;

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

function downloadStudentTemplate() {
  const csv = `${TEMPLATE_HEADERS.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bloomy_students_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  cohort_id: '',
};

const AdminStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchStudents:', error.message, error);
      toast({
        title: 'Could not load students',
        description: error.message.includes('permission') || error.message.includes('policy')
          ? 'Row-level security is probably blocking admin reads.'
          : error.message,
        variant: 'destructive',
      });
    } else if (data) {
      setStudents(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
    const loadCohorts = async () => {
      // UPDATED: Fetching 'course' as well
      const { data, error } = await supabase.from('cohorts').select('id, name, course').order('name');
      if (!error && data) setCohorts(data);
    };
    loadCohorts();
  }, []);

  // Helper to find cohort details
  const getSelectedCohort = (id: string | undefined) => cohorts.find(c => c.id === id);

  
    // Get unique list of courses from cohorts for the filter dropdown
    const uniqueCourses = Array.from(new Set(cohorts.map(c => c.course).filter(Boolean)));
    const filtered = students
    .filter(s => {
      const matchesSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase());
      
      const matchesCohort = cohortFilter === 'all' || s.cohort_id === cohortFilter;

      const studentCohort = getSelectedCohort(s.cohort_id);
      const matchesCourse = courseFilter === 'all' || studentCohort?.course === courseFilter;

      return matchesSearch && matchesCohort && matchesCourse;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return (a.full_name || '').localeCompare(b.full_name || '');
      if (sortBy === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
      if (sortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      // Default: created_desc (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
  const openAddModal = () => {
    setEditingStudent(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setForm({
      full_name: s.full_name || '',
      email: s.email || '',
      phone: s.phone || '',
      password: '',
      cohort_id: s.cohort_id || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingStudent && cohorts.length > 0 && !form.cohort_id) {
      toast({ title: 'Select a cohort', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cohortId = form.cohort_id ? form.cohort_id : null;
      if (editingStudent) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            phone: form.phone || null,
            cohort_id: cohortId,
          })
          .eq('id', editingStudent.id);
        if (error) throw error;
        toast({ title: 'Student updated successfully' });
      } else {
        const emailNorm = form.email.trim().toLowerCase();
        const password = form.password?.trim() || 'TempPass123!';
        if (password.length < 6) {
          toast({
            title: 'Password too short',
            description: 'Use at least 6 characters or leave blank for a temporary password.',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }

        const rowClient = createEphemeralSupabaseClient();
        try {
          const { data: signData, error: signErr } = await rowClient.auth.signUp({
            email: emailNorm,
            password,
            options: { data: { full_name: form.full_name, role: 'student' } },
          });

          if (signErr && isUserAlreadyExistsError(signErr.message)) {
            const { data: existing, error: findErr } = await supabase
              .from('profiles')
              .select('id, role')
              .ilike('email', emailNorm)
              .maybeSingle();
            if (findErr) throw findErr;

            if (existing?.id) {
              if (existing.role !== 'student') {
                throw new Error('This email is already used by a non-student account.');
              }
              const { error: updErr } = await supabase
                .from('profiles')
                .update({
                  full_name: form.full_name,
                  phone: form.phone || null,
                  cohort_id: cohortId,
                })
                .eq('id', existing.id);
              if (updErr) throw updErr;
              toast({
                title: 'Login already existed',
                description: 'That email is already registered. Student profile was updated.',
              });
            } else {
              throw new Error(
                'This email is already in Supabase Auth but has no profile row. Fix in Supabase Dashboard.'
              );
            }
          } else if (signErr) {
            throw signErr;
          } else {
            const newUser = signData.user ?? signData.session?.user ?? null;
            if (!newUser?.id) {
              throw new Error(
                'No user returned from sign up. Try disabling "Confirm email" in Supabase.'
              );
            }

            const profilePayload = {
              id: newUser.id,
              email: emailNorm,
              full_name: form.full_name,
              phone: form.phone || null,
              role: 'student' as const,
              cohort_id: cohortId,
            };

            let profileError = null as { message: string } | null;
            const { error: upErr } = await rowClient
              .from('profiles')
              .upsert(profilePayload, { onConflict: 'id' });
            if (upErr) {
              const { data: updated, error: updErr } = await rowClient
                .from('profiles')
                .update({
                  email: emailNorm,
                  full_name: form.full_name,
                  phone: form.phone || null,
                  role: 'student',
                  cohort_id: cohortId,
                })
                .eq('id', newUser.id)
                .select('id');
              if (updErr) {
                profileError = updErr;
              } else if (!updated?.length) {
                const { error: insErr } = await rowClient.from('profiles').insert(profilePayload);
                profileError = insErr;
              }
            }
            if (profileError) throw profileError;
            toast({ title: 'Student added successfully' });
          }
        } finally {
          await rowClient.auth.signOut();
        }
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Error deleting student', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student deleted' });
      fetchStudents();
    }
    setDeleteTarget(null);
  };

  const exportCSV = () => {
    // Updated Export to include Cohort and Course
    const headers = ['Name', 'Email', 'Phone', 'Cohort', 'Course', 'Created At'];
    const rows = students.map(s => {
      const cohort = getSelectedCohort(s.cohort_id);
      return [
        s.full_name, 
        s.email, 
        s.phone || '', 
        cohort?.name || '—', 
        cohort?.course || '—', 
        s.created_at
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkCsvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBulkUploading(true);
    let success = 0;
    let failed = 0;

    try {
      const { data: cohortRows, error: cohortErr } = await supabase
        .from('cohorts')
        .select('id, name, course') // Fetching course too for consistency
        .order('name');
      if (cohortErr) throw cohortErr;
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

      if (parsed.errors.length > 0) {
        console.warn('CSV parse warnings:', parsed.errors);
      }

      const rows = parsed.data.filter((row) =>
        Object.values(row).some((v) => v != null && String(v).trim() !== '')
      );

      let firstErrorDetail: string | null = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const { firstName, lastName, email, phone, cohortName } = parseBulkRow(row);
        const full_name = `${firstName} ${lastName}`.trim();
        const emailNorm = email.trim().toLowerCase();

        if (!emailNorm || !full_name) {
          failed += 1;
          console.warn(`Bulk upload row ${i + 2}: skipped — missing email or name`);
          continue;
        }

        let cohortId: string | null = null;
        if (cohortName.trim()) {
          cohortId = cohortMap.get(cohortName.trim().toLowerCase()) ?? null;
          if (!cohortId) {
            console.warn(
              `Bulk upload row ${i + 2} (${emailNorm}): cohort "${cohortName}" not in database — continuing without cohort`
            );
          }
        }

        const rowClient = createEphemeralSupabaseClient();
        try {
          const { data: signUpData, error: signUpError } = await rowClient.auth.signUp({
            email: emailNorm,
            password: BULK_DEFAULT_PASSWORD,
            options: {
              data: { full_name, role: 'student' },
            },
          });

          if (signUpError) {
            if (isUserAlreadyExistsError(signUpError.message)) {
              failed += 1;
              console.warn(`Bulk upload row ${i + 2} (${emailNorm}): user already exists — skipped`);
            } else {
              failed += 1;
              const msg = signUpError.message;
              console.warn(`Bulk upload row ${i + 2} (${emailNorm}):`, msg);
              if (!firstErrorDetail) firstErrorDetail = `Auth: ${msg}`;
            }
            continue;
          }

          const newUser = signUpData.user ?? signUpData.session?.user ?? null;
          if (!newUser?.id) {
            failed += 1;
            const hint =
              'No user returned — in Supabase turn off "Confirm email" for Auth.';
            console.warn(`Bulk upload row ${i + 2} (${emailNorm}): ${hint}`);
            if (!firstErrorDetail) firstErrorDetail = hint;
            continue;
          }

          const profilePayload = {
            id: newUser.id,
            email: emailNorm,
            full_name,
            phone: phone || null,
            role: 'student' as const,
            cohort_id: cohortId,
          };

          let profileError = null as { message: string } | null;
          const { error: upErr } = await rowClient.from('profiles').upsert(profilePayload, {
            onConflict: 'id',
          });
          if (upErr) {
            const { data: updated, error: updErr } = await rowClient
              .from('profiles')
              .update({
                email: emailNorm,
                full_name,
                phone: phone || null,
                role: 'student',
                cohort_id: cohortId,
              })
              .eq('id', newUser.id)
              .select('id');
            if (updErr) {
              profileError = updErr;
            } else if (!updated?.length) {
              const { error: insErr } = await rowClient.from('profiles').insert(profilePayload);
              profileError = insErr;
            }
          }

          if (profileError) {
            failed += 1;
            console.warn(`Bulk upload row ${i + 2} (${emailNorm}) profile:`, profileError.message);
            if (!firstErrorDetail) firstErrorDetail = `Profile: ${profileError.message}`;
            continue;
          }

          success += 1;
        } finally {
          await rowClient.auth.signOut();
        }
      }

      toast({
        title: 'Bulk upload finished',
        description:
          firstErrorDetail && success === 0 && failed > 0
            ? `${failed} failed. ${firstErrorDetail}`
            : `Successfully uploaded ${success} students. ${failed} failed.${
                firstErrorDetail && failed > 0 ? ` (${firstErrorDetail})` : ''
              }`,
      });
      await fetchStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk upload failed';
      toast({ title: 'Bulk upload error', description: message, variant: 'destructive' });
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Students</h2>
            <p className="text-muted-foreground text-sm">Manage all enrolled students ({students.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>Export CSV</Button>
            <Button variant="outline" size="sm" onClick={downloadStudentTemplate}>
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
              <Upload className="w-4 h-4 mr-1" /> {bulkUploading ? 'Processing…' : 'Bulk Upload (CSV)'}
            </Button>
            <Button variant="default" onClick={openAddModal}><Plus className="w-4 h-4 mr-1" /> Add Student</Button>
          </div>
        </div>

        <Card className="border-border">
        <div className="p-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search students..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              {/* Cohort Filter */}
              <Select value={cohortFilter} onValueChange={setCohortFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Cohort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Course Filter */}
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {uniqueCourses.map(course => <SelectItem key={course} value={course || ''}>{course}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Sort Options */}
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
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No students found.</td></tr>
                ) : filtered.map((s) => {
                  const studentCohort = getSelectedCohort(s.cohort_id);
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                            {(s.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">{s.full_name}</span>
                            <span className="text-xs text-muted-foreground md:hidden">{s.email}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 md:hidden">
                              {studentCohort?.name || 'No Cohort'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{s.email}</td>
                      <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">{s.phone || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">
                        {studentCohort?.name || '—'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden xl:table-cell">
                        {studentCohort?.course || '—'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(s)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(s)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
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

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingStudent ? "Update this student's details." : 'Create a new student account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" required />
            </div>
            {!editingStudent && (
              <>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1.5" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234..." className="mt-1.5" />
            </div>
            <div>
              <Label>Cohort</Label>
              {cohorts.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1.5">
                  No cohorts yet.{' '}
                  <Link to="/admin/cohorts" className="text-secondary font-medium hover:underline">
                    Create one under Cohorts
                  </Link>
                </p>
              ) : (
                <>
                  <Select
                    value={form.cohort_id || undefined}
                    onValueChange={(v) => setForm({ ...form, cohort_id: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Auto-display Course based on selected Cohort */}
                  {form.cohort_id && (
                    <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded border border-border">
                      <span className="font-medium text-foreground">Course:</span> {getSelectedCohort(form.cohort_id)?.course || 'Not set for this cohort'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.full_name ||
                (!editingStudent && (!form.email?.trim() || (cohorts.length > 0 && !form.cohort_id)))
              }>
              {saving ? 'Saving...' : editingStudent ? 'Update' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.full_name}? This action cannot be undone.
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

export default AdminStudents;