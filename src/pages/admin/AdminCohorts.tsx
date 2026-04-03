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
import { Plus, Pencil, Trash2, Search, Loader2, Users, Eye, Copy, X } from 'lucide-react';

interface Cohort { 
  id: string; 
  name: string; 
  course: string; 
  start_date: string; 
  student_count?: number; 
  instructor_ids?: string[];
  instructor_id?: string; 
}

interface Student { id: string; full_name: string; email: string; cohort_id: string; }

export default function AdminCohorts() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterCohortName, setFilterCohortName] = useState<string>('all');
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [filterStudentId, setFilterStudentId] = useState<string>('all');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [form, setForm] = useState({ name: '', course: '', start_date: '' });
  const [saving, setSaving] = useState(false);
  const [duplicateFromId, setDuplicateFromId] = useState<string>('new');

  const [isNewProgram, setIsNewProgram] = useState(false);
  const [newProgramInput, setNewProgramInput] = useState('');

  // Instructor assignment states
  const [availableInstructors, setAvailableInstructors] = useState<any[]>([]);
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);

  // Student View Modal
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [activeCohort, setActiveCohort] = useState<Cohort | null>(null);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const { toast } = useToast();

  useEffect(() => { 
    fetchInitialData(); 
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: cohortData, error: cohortError } = await supabase.from('cohorts').select('*').order('created_at', { ascending: false });
      if (cohortError) throw cohortError;

      const { data: studentData, error: studentError } = await supabase.from('profiles').select('id, full_name, email, cohort_id').eq('role', 'student');
      if (studentError) throw studentError;
      
      setAllStudents(studentData || []);

      if (cohortData) {
        const countMap: { [key: string]: number } = {};
        (studentData || []).forEach(p => { if (p.cohort_id) countMap[p.cohort_id] = (countMap[p.cohort_id] || 0) + 1; });
        const finalData = cohortData.map(c => ({ ...c, student_count: countMap[c.id] || 0 }));
        setCohorts(finalData);
      } else {
        setCohorts([]);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error fetching data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const existingPrograms = Array.from(new Set(cohorts.map(c => c.course))).filter(Boolean).sort();
  const uniqueCohortNames = Array.from(new Set(cohorts.map(c => c.name)));

  const availablePrograms = filterCohortName !== 'all' 
    ? Array.from(new Set(cohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : Array.from(new Set(cohorts.map(c => c.course)));

  const availableStudents = (() => {
    let filtered = [...allStudents];
    if (filterCohortName !== 'all') {
      const cohortIdsForName = cohorts.filter(c => c.name === filterCohortName).map(c => c.id);
      filtered = filtered.filter(s => cohortIdsForName.includes(s.cohort_id));
    }
    if (filterProgram !== 'all') {
      const cohortIdsForProg = cohorts.filter(c => c.course === filterProgram).map(c => c.id);
      filtered = filtered.filter(s => cohortIdsForProg.includes(s.cohort_id));
    }
    return filtered;
  })();

  const filteredCohorts = cohorts.filter(c => {
    const matchesSearch = searchText ? 
      (c.name.toLowerCase().includes(searchText.toLowerCase()) || 
       c.course.toLowerCase().includes(searchText.toLowerCase()) ||
       allStudents.some(s => s.cohort_id === c.id && s.full_name.toLowerCase().includes(searchText.toLowerCase()))
      ) : true;

    const matchesCohortName = filterCohortName !== 'all' ? c.name === filterCohortName : true;
    const matchesProgram = filterProgram !== 'all' ? c.course === filterProgram : true;
    const matchesStudent = filterStudentId !== 'all' ? c.id === allStudents.find(s => s.id === filterStudentId)?.cohort_id : true;

    return matchesSearch && matchesCohortName && matchesProgram && matchesStudent;
  });

  useEffect(() => { setFilterProgram('all'); setFilterStudentId('all'); }, [filterCohortName]);
  useEffect(() => { setFilterStudentId('all'); }, [filterProgram]);

  // --- Instructor Fetch Logic ---
  useEffect(() => {
    const fetchInstructors = async () => {
      if (!form.course) {
        setAvailableInstructors([]);
        return;
      }

      setLoadingInstructors(true);
      try {
        const { data: programCourses, error } = await supabase
          .from('courses')
          .select('id, instructor_id, instructor_ids') 
          .eq('program', form.course);

        if (error) throw error;

        let allIds: string[] = [];
        if (programCourses) {
          programCourses.forEach(c => {
            if (c.instructor_id) allIds.push(c.instructor_id);
            if (c.instructor_ids && Array.isArray(c.instructor_ids)) allIds = [...allIds, ...c.instructor_ids];
          });
        }
        let uniqueIds = [...new Set(allIds)];

        if (uniqueIds.length === 0) {
          const { data: fallbackInstructors } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('role', ['instructor', 'facilitator']); 
          setAvailableInstructors(fallbackInstructors || []);
        } else {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', uniqueIds);
          setAvailableInstructors(profiles || []);
        }
      } catch (err) {
        console.error("Could not fetch instructors:", err);
        setAvailableInstructors([]);
      } finally {
        setLoadingInstructors(false);
      }
    };

    fetchInstructors();
  }, [form.course]);

  const openModal = (cohort?: Cohort) => {
    setIsNewProgram(false);
    setNewProgramInput('');
    if (cohort) {
      setEditing(cohort);
      setForm({ name: cohort.name, course: cohort.course, start_date: cohort.start_date || '' });
      setDuplicateFromId('new');
      
      let existingIds = cohort.instructor_ids || [];
      if ((!existingIds || existingIds.length === 0) && cohort.instructor_id) {
        existingIds = [cohort.instructor_id];
      }
      setSelectedInstructorIds(existingIds); 
    } else {
      setEditing(null);
      setForm({ name: '', course: '', start_date: '' });
      setDuplicateFromId('new');
      setSelectedInstructorIds([]);
    }
    setModalOpen(true);
  };

  const handleDuplicateSelect = (cohortId: string) => {
    setDuplicateFromId(cohortId);
    setIsNewProgram(false);
    setNewProgramInput('');
    if (cohortId === 'new') {
      setForm({ name: '', course: '', start_date: '' });
      setSelectedInstructorIds([]);
    } else {
      const source = cohorts.find(c => c.id === cohortId);
      if (source) {
        setForm({ name: source.name, course: source.course, start_date: source.start_date || '' });
        let existingIds = source.instructor_ids || [];
        if ((!existingIds || existingIds.length === 0) && source.instructor_id) {
          existingIds = [source.instructor_id];
        }
        setSelectedInstructorIds(existingIds);
      }
    }
  };

  const handleProgramSelectChange = (value: string) => {
    if (value === '__new__') {
      setIsNewProgram(true);
      setForm(prev => ({ ...prev, course: '' }));
      setNewProgramInput('');
    } else {
      setIsNewProgram(false);
      setNewProgramInput('');
      setForm(prev => ({ ...prev, course: value }));
    }
  };

  const handleNewProgramInput = (value: string) => {
    setNewProgramInput(value);
    setForm(prev => ({ ...prev, course: value }));
  };

  const handleSave = async () => {
    const programToSave = form.course.trim();
    if (!form.name || !programToSave) {
      return toast({ title: 'Cohort Name and Program are required', variant: 'destructive' });
    }

    setSaving(true);
    try {
      // --- ✅ CONFIGURATION ---
      // If you ran the SQL fix (ALTER TABLE cohorts ADD COLUMN instructor_ids TEXT[]), keep this as true.
      // If you are getting the "column not found" error and haven't run SQL, change this to false.
      const USE_ARRAY_COLUMN = true; 

      const instructorPayload: any = {};
      
      if (USE_ARRAY_COLUMN) {
        // Saves as array (Requires 'instructor_ids' column)
        instructorPayload.instructor_ids = selectedInstructorIds.length > 0 ? selectedInstructorIds : null;
      } else {
        // Saves as single ID (Uses standard 'instructor_id' column - only saves the first selected instructor)
        instructorPayload.instructor_id = selectedInstructorIds.length > 0 ? selectedInstructorIds[0] : null;
      }

      if (editing) {
        await supabase.from('cohorts').update({
          name: form.name,
          course: programToSave,
          start_date: form.start_date,
          ...instructorPayload
        }).eq('id', editing.id);

        toast({ title: 'Cohort Updated' });

      } else {
        const { error: cohortError } = await supabase.from('cohorts').insert({
          name: form.name,
          course: programToSave,
          start_date: form.start_date || null,
          ...instructorPayload
        });

        if (cohortError) throw cohortError;

        const { data: existingCourse } = await supabase
          .from('courses')
          .select('id')
          .eq('program', programToSave)
          .maybeSingle();

        if (!existingCourse) {
          const { error: courseError } = await supabase.from('courses').insert({
            title: programToSave,
            program: programToSave,
            description: '',
            status: 'Draft'
          });

          if (courseError) {
            console.error('Course auto-create failed:', courseError);
            toast({
              title: 'Cohort Created',
              description: `Note: Could not auto-create the "${programToSave}" course. You can create it manually on the Courses page.`,
              variant: 'destructive'
            });
          } else {
            toast({
              title: 'Cohort Created!',
              description: `A new "${programToSave}" course was also created automatically on the Courses page.`
            });
          }
        } else {
          toast({ title: 'Cohort Created!' });
        }
      }

      setModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cohort?')) return;
    await supabase.from('cohorts').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchInitialData();
  };

  const openStudentsModal = async (cohort: Cohort) => {
    setActiveCohort(cohort); setStudentsList([]); setStudentsModalOpen(true); setLoadingStudents(true);
    const { data } = await supabase.from('profiles').select('id, full_name, email').eq('cohort_id', cohort.id).eq('role', 'student');
    if (data) setStudentsList(data);
    setLoadingStudents(false);
  };

  const resetFilters = () => {
    setSearchText('');
    setFilterCohortName('all');
    setFilterProgram('all');
    setFilterStudentId('all');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cohorts Management</h1>
          <p className="text-gray-500 text-sm">Filter by Cohort, Program, or Student</p>
        </div>
        <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Add Cohort</Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="relative md:col-span-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <Input placeholder="Name / Program / Student" value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-8" />
            </div>
          </div>

          <div>
            <Label>Filter by Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohortNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Filter by Program</Label>
            <Select value={filterProgram} onValueChange={setFilterProgram} disabled={availablePrograms.length === 0}>
              <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {availablePrograms.map(prog => <SelectItem key={prog} value={prog}>{prog}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Filter by Student</Label>
            <Select value={filterStudentId} onValueChange={setFilterStudentId} disabled={availableStudents.length === 0}>
              <SelectTrigger><SelectValue placeholder="All Students" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {availableStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {(searchText || filterCohortName !== 'all' || filterProgram !== 'all' || filterStudentId !== 'all') && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}><X className="w-4 h-4 mr-1" /> Clear Filters</Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="animate-spin mr-2" /> Loading data...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCohorts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-gray-500">No cohorts found matching filters.</TableCell></TableRow>
                ) : (
                  filteredCohorts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">{c.course}</span></TableCell>
                      <TableCell>{c.start_date ? new Date(c.start_date).toLocaleDateString() : 'Not Set'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 font-medium"><Users className="w-4 h-4 text-gray-400" /><span>{c.student_count || 0}</span></div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openStudentsModal(c)}><Eye className="w-4 h-4 mr-1" /> View</Button>
                          <Button variant="ghost" size="icon" onClick={() => openModal(c)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* --- Create/Edit Modal --- */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">

            {!editing && (
              <div>
                <Label className="text-gray-600">Duplicate from existing?</Label>
                <Select value={duplicateFromId} onValueChange={handleDuplicateSelect}>
                  <SelectTrigger className="mt-1.5 bg-slate-50"><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create New (Blank)</SelectItem>
                    {cohorts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex gap-2"><Copy className="w-3 h-3" /> {c.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">Selecting a cohort copies its name and date.</p>
              </div>
            )}

            <div>
              <Label>Cohort Name *</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="e.g. Batch 9" 
              />
            </div>

            <div>
              <Label>Program *</Label>
              {!isNewProgram ? (
                <Select value={form.course || ''} onValueChange={handleProgramSelectChange}>
                  <SelectTrigger><SelectValue placeholder="Select or create program" /></SelectTrigger>
                  <SelectContent>
                    {existingPrograms.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                    <SelectItem value="__new__" className="text-blue-600 font-medium border-t mt-1 pt-2">
                      + Add New Program...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder="Type new program name e.g. Linux/DevOps & Cloud"
                    value={newProgramInput}
                    onChange={e => handleNewProgramInput(e.target.value)}
                  />
                  <Button 
                    variant="ghost" size="sm" className="text-xs text-gray-500 h-auto p-0"
                    onClick={() => { setIsNewProgram(false); setNewProgramInput(''); setForm(prev => ({ ...prev, course: '' })); }}
                  >
                    ← Back to existing programs
                  </Button>
                </div>
              )}
              {isNewProgram && newProgramInput.trim() && (
                <p className="text-xs text-green-600 mt-1 bg-green-50 px-2 py-1 rounded">
                  ✓ A new <strong>"{newProgramInput.trim()}"</strong> course will be automatically created on the Courses page.
                </p>
              )}
            </div>

            {/* Instructor Assignment Section */}
            <div>
              <Label>Assign Facilitators / Instructors</Label>
              {loadingInstructors ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading facilitators for this program...
                </div>
              ) : form.course ? (
                availableInstructors.length > 0 ? (
                  <div className="mt-2 border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50">
                    {availableInstructors.map(inst => (
                      <label key={inst.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-white p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedInstructorIds.includes(inst.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedInstructorIds([...selectedInstructorIds, inst.id]);
                            } else {
                              setSelectedInstructorIds(selectedInstructorIds.filter(id => id !== inst.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium">{inst.full_name}</span>
                          <span className="text-gray-500 ml-2 text-xs">({inst.email})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-2 bg-amber-50 border border-amber-100 p-2 rounded-md">
                    No facilitators found linked to this program or registered globally.
                  </p>
                )
              ) : (
                <p className="text-sm text-gray-400 mt-2">Select a program first to see available facilitators.</p>
              )}
            </div>

            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Student List Modal --- */}
      <Dialog open={studentsModalOpen} onOpenChange={setStudentsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Students in {activeCohort?.name}</DialogTitle>
            <p className="text-sm text-gray-500">Program: {activeCohort?.course}</p>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {loadingStudents 
              ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> 
              : studentsList.length === 0 
                ? <div className="text-center py-8 text-gray-500">No students enrolled.</div> 
                : (
                  <div className="space-y-2">
                    {studentsList.map(s => (
                      <div key={s.id} className="p-3 border rounded-md flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{s.full_name}</p>
                          <p className="text-xs text-gray-500">{s.email}</p>
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">Active</span>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}