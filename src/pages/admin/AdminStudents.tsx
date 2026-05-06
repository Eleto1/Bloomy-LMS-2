import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, Plus, Pencil, Trash2, CalendarDays, Upload, Download, X } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  admission_date?: string;
  created_at: string;
  cohort_id: string;
  cohorts: { name: string; course: string } | { name: string; course: string }[] | null;
}

interface Cohort { id: string; name: string; course: string; }

function getCohort(student: Student): { name: string; course: string } | null {
  if (!student.cohorts) return null;
  if (Array.isArray(student.cohorts)) return student.cohorts[0] ?? null;
  return student.cohorts;
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// REPLACE THIS with your actual Supabase project ref
// e.g. if your URL is https://abc123.supabase.co then use "abc123"
// ═══════════════════════════════════════════════════════════════════
const SUPABASE_PROJECT_REF = 'zcxysvrwblwogubakssf';
const CREATE_STUDENT_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/create-student`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [filterCohortName, setFilterCohortName] = useState<string>('all');
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [filterStudentId, setFilterStudentId] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', admission_date: '',
    cohort_name: '', course: '', password: ''
  });
  const [saving, setSaving] = useState(false);

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { toast } = useToast();

  // ─── Derived data (memoized) ───────────────────────────────────

  const uniqueCohortNames = useMemo(
    () => Array.from(new Set(cohorts.map(c => c.name))),
    [cohorts]
  );

  const availablePrograms = useMemo(() => {
    const source = filterCohortName !== 'all'
      ? cohorts.filter(c => c.name === filterCohortName)
      : cohorts;
    return Array.from(new Set(source.map(c => c.course)));
  }, [cohorts, filterCohortName]);

  const availableStudents = useMemo(
    () => students.filter(s => {
      const cohort = getCohort(s);
      const matchCohort = filterCohortName !== 'all' ? cohort?.name === filterCohortName : true;
      const matchProgram = filterProgram !== 'all' ? cohort?.course === filterProgram : true;
      return matchCohort && matchProgram;
    }),
    [students, filterCohortName, filterProgram]
  );

  const filtered = useMemo(
    () => students.filter(s => {
      const cohort = getCohort(s);
      const matchSearch = searchText
        ? (s.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
           s.email?.toLowerCase().includes(searchText.toLowerCase()))
        : true;
      const matchCohort = filterCohortName !== 'all' ? cohort?.name === filterCohortName : true;
      const matchProgram = filterProgram !== 'all' ? cohort?.course === filterProgram : true;
      const matchStudent = filterStudentId !== 'all' ? s.id === filterStudentId : true;
      return matchSearch && matchCohort && matchProgram && matchStudent;
    }),
    [students, searchText, filterCohortName, filterProgram, filterStudentId]
  );

  // ─── Data fetching ─────────────────────────────────────────────

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cohortData, error: cohortError } = await supabase
        .from('cohorts')
        .select('id, name, course')
        .order('name');

      if (cohortError) throw cohortError;
      if (cohortData) setCohorts(cohortData as Cohort[]);

      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, admission_date, created_at, cohort_id, cohorts!cohort_id(name, course)')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (studentError) throw studentError;
      if (studentData) setStudents(studentData as Student[]);

    } catch (err: any) {
      console.error('Fetch students error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
  useEffect(() => { setFilterProgram('all'); setFilterStudentId('all'); }, [filterCohortName]);
  useEffect(() => { setFilterStudentId('all'); }, [filterProgram]);

  // ─── Modal helpers ──────────────────────────────────────────────

  const openModal = (student?: Student) => {
    if (student) {
      const sc = getCohort(student);
      setEditing(student);
      setForm({
        full_name: student.full_name,
        email: student.email,
        phone: student.phone || '',
        admission_date: student.admission_date || '',
        cohort_name: sc?.name || '',
        course: sc?.course || '',
        password: ''
      });
    } else {
      setEditing(null);
      setForm({
        full_name: '', email: '', phone: '', admission_date: '',
        cohort_name: '', course: '', password: ''
      });
    }
    setModalOpen(true);
  };

  const handleCohortNameChange = (name: string) =>
    setForm(prev => ({ ...prev, cohort_name: name, course: '' }));

  // ─── CRUD operations ───────────────────────────────────────────

  const handleSave = async () => {
    if (!form.full_name || !form.email) {
      return toast({ title: 'Name & Email required', variant: 'destructive' });
    }

    setSaving(true);
    try {
      let cohortIdToSave: string | null = null;

      if (form.cohort_name && form.course) {
        const found = cohorts.find(c =>
          c.name.toLowerCase() === form.cohort_name.toLowerCase() &&
          c.course.toLowerCase() === form.course.toLowerCase()
        );
        if (found) cohortIdToSave = found.id;
      }

      if (!cohortIdToSave && form.cohort_name) {
        const found = cohorts.find(c =>
          c.name.toLowerCase() === form.cohort_name.toLowerCase()
        );
        if (found) cohortIdToSave = found.id;
      }

      if (editing) {
        // ── Update existing student ──
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            phone: form.phone || null,
            admission_date: form.admission_date || null,
            cohort_id: cohortIdToSave
          })
          .eq('id', editing.id);

        if (error) throw error;
        toast({ title: 'Student Updated' });

      } else {
        // ── Create new student via Edge Function ──
        if (!form.password) {
          return toast({ title: 'Password required', variant: 'destructive' });
        }

        const res = await fetch(CREATE_STUDENT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || null,
            admission_date: form.admission_date || null,
            cohort_id: cohortIdToSave,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Failed to create student');
        }

        toast({ title: 'Student Created!', description: 'A welcome email has been sent.' });
      }

      setModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Student Deleted' });
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Bulk upload ───────────────────────────────────────────────

  const downloadTemplate = () => {
    const header = 'full_name,email,phone,admission_date,cohort_name,program';
    const example = 'John Doe,john@example.com,08012345678,2024-01-01,Cohort 1,Web Development';
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'student_template.csv';
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setBulkCsvText(evt.target?.result as string);
    reader.readAsText(file);
  };

  const processBulkUpload = async () => {
    if (!bulkCsvText) return;
    setBulkProcessing(true);
    try {
      const lines = bulkCsvText.trim().split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

      const required = ['full_name', 'email', 'cohort_name', 'program'];
      if (!required.every(r => headers.includes(r))) {
        throw new Error('Missing required columns: ' + required.join(', '));
      }

      const idx = {
        n: headers.indexOf('full_name'),
        e: headers.indexOf('email'),
        p: headers.indexOf('phone'),
        d: headers.indexOf('admission_date'),
        cn: headers.indexOf('cohort_name'),
        pr: headers.indexOf('program')
      };

      let ok = 0, fail = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',').map(x => x.trim().replace(/"/g, ''));
        if (cols.length < 4) { fail++; continue; }

        const name = cols[idx.n];
        const email = cols[idx.e];
        const phone = cols[idx.p] || '';
        const date = cols[idx.d] || '';
        const cname = cols[idx.cn];
        const prog = cols[idx.pr];

        const coh = cohorts.find(
          x => x.name.toLowerCase().trim() === cname.toLowerCase().trim() &&
               x.course.toLowerCase().trim() === prog.toLowerCase().trim()
        );
        if (!coh) { fail++; continue; }

        const autoPassword = generatePassword(12);

        const res = await fetch(CREATE_STUDENT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email,
            password: autoPassword,
            full_name: name,
            phone: phone || null,
            admission_date: date || null,
            cohort_id: coh.id,
          }),
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
          console.error('Bulk create failed for', email, ':', result.error);
          fail++;
        } else {
          ok++;
        }
      }

      toast({
        title: 'Bulk Upload Complete',
        description: `${ok} added, ${fail} failed. Welcome emails sent to new students.`
      });
      setBulkModalOpen(false);
      setBulkCsvText('');
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBulkProcessing(false);
    }
  };

  // ─── Filters ───────────────────────────────────────────────────

  const resetFilters = () => {
    setSearchText('');
    setFilterCohortName('all');
    setFilterProgram('all');
    setFilterStudentId('all');
  };

  const hasActiveFilters = searchText || filterCohortName !== 'all' || filterProgram !== 'all' || filterStudentId !== 'all';

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-gray-500 text-sm">
            {students.length} total &middot; {filtered.length} shown
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="relative md:col-span-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Name or Email"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <Label>Filter by Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohortNames.map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Filter by Program</Label>
            <Select
              value={filterProgram}
              onValueChange={setFilterProgram}
              disabled={filterCohortName === 'all'}
            >
              <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {availablePrograms.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Filter by Student</Label>
            <Select value={filterStudentId} onValueChange={setFilterStudentId}>
              <SelectTrigger><SelectValue placeholder="All Students" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {availableStudents.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Student</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-gray-500">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(s => {
                    const cohort = getCohort(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.full_name}</div>
                          <div className="text-xs text-gray-500">{s.email}</div>
                        </TableCell>
                        <TableCell>{s.phone || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <CalendarDays className="w-3 h-3" />
                            {s.admission_date
                              ? new Date(s.admission_date).toLocaleDateString()
                              : new Date(s.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{cohort?.name || '-'}</TableCell>
                        <TableCell>
                          {cohort?.course ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {cohort.course}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openModal(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => handleDelete(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add / Edit Student Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Student' : 'Add Student'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 md:col-span-1">
              <Label>1. Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <Label>2. Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={!!editing}
                placeholder="student@example.com"
              />
            </div>
            <div>
              <Label>3. Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="08012345678"
              />
            </div>
            <div>
              <Label>4. Admission Date</Label>
              <Input
                type="date"
                value={form.admission_date}
                onChange={e => setForm({ ...form, admission_date: e.target.value })}
              />
            </div>
            <div>
              <Label>5. Cohort *</Label>
              <Select value={form.cohort_name} onValueChange={handleCohortNameChange}>
                <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                <SelectContent>
                  {uniqueCohortNames.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>6. Program *</Label>
              <Select
                value={form.course}
                onValueChange={v => setForm({ ...form, course: v })}
                disabled={!form.cohort_name}
              >
                <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  {cohorts.filter(c => c.name === form.cohort_name).map(c => (
                    <SelectItem key={c.id} value={c.course}>{c.course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div className="col-span-2">
                <Label>Password *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter or generate a password"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, password: generatePassword(12) })}
                  >
                    Generate
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Update' : 'Create'} Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Required CSV columns:{' '}
              <code className="bg-gray-100 px-1 rounded">full_name</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">email</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">cohort_name</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">program</code>
            </p>
            <p className="text-sm text-gray-500">
              Optional columns:{' '}
              <code className="bg-gray-100 px-1 rounded">phone</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">admission_date</code>
            </p>
            <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded">
              A random password will be generated for each student and sent via welcome email.
            </p>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" /> Download Template
              </Button>
              <Input type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            {bulkCsvText && (
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                File loaded and ready for upload.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkModalOpen(false)}>Cancel</Button>
            <Button onClick={processBulkUpload} disabled={bulkProcessing || !bulkCsvText}>
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}