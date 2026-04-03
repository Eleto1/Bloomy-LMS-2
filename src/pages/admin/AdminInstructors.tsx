import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, UserPlus, AlertCircle, Pencil, BookOpen, Users, Filter, XCircle } from 'lucide-react';

interface Instructor {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface Cohort {
  id: string;
  name: string;
  course?: string; // Added course to interface for grouping logic
}

interface Course {
  id: string;
  title: string;
}

type ModalMode = 'add' | 'edit' | null;

export default function AdminInstructors() {
  const [list, setList] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dropdown lists
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  // Filters
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterCohort, setFilterCohort] = useState<string>('all');

  // Bulk assignment map
  const [instCourseMap, setInstCourseMap] = useState<Record<string, string[]>>({});
  const [instCohortMap, setInstCohortMap] = useState<Record<string, string[]>>({});

  // Form state
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '' });
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchInstructors(),
      fetchCohorts(),
      fetchCourses(),
      fetchAllAssignments(),
    ]);
    setLoading(false);
  };

  const fetchInstructors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'instructor')
      .order('created_at', { ascending: false });

    if (!error && data) setList(data);
  };

  const fetchCohorts = async () => {
    // Fetch course name as well to display if needed
    const { data } = await supabase.from('cohorts').select('id, name, course').order('name');
    setCohorts(data || []);
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('id, title').order('title');
    setCourses(data || []);
  };

  const fetchAllAssignments = async () => {
    const [cRes, coRes] = await Promise.all([
      supabase.from('course_instructors').select('instructor_id, course_id'),
      supabase.from('cohort_instructors').select('instructor_id, cohort_id'),
    ]);

    const cMap: Record<string, string[]> = {};
    (cRes.data || []).forEach(r => {
      if (!cMap[r.instructor_id]) cMap[r.instructor_id] = [];
      cMap[r.instructor_id].push(r.course_id);
    });

    const coMap: Record<string, string[]> = {};
    (coRes.data || []).forEach(r => {
      if (!coMap[r.instructor_id]) coMap[r.instructor_id] = [];
      coMap[r.instructor_id].push(r.cohort_id);
    });

    setInstCourseMap(cMap);
    setInstCohortMap(coMap);
  };

  const fetchInstructorAssignments = async (instructorId: string) => {
    const [cohortRes, courseRes] = await Promise.all([
      supabase.from('cohort_instructors').select('cohort_id').eq('instructor_id', instructorId),
      supabase.from('course_instructors').select('course_id').eq('instructor_id', instructorId),
    ]);
    setSelectedCohorts((cohortRes.data || []).map(r => r.cohort_id));
    setSelectedCourses((courseRes.data || []).map(r => r.course_id));
  };

  const resetForm = () => {
    setFormData({ full_name: '', email: '', password: '' });
    setSelectedCohorts([]);
    setSelectedCourses([]);
    setError('');
    setSuccess('');
  };

  const openAddModal = () => { resetForm(); setModalMode('add'); setEditingId(null); };

  const openEditModal = async (instructor: Instructor) => {
    resetForm();
    setFormData({ full_name: instructor.full_name, email: instructor.email, password: '' });
    setEditingId(instructor.id);
    setModalMode('edit');
    await fetchInstructorAssignments(instructor.id);
  };

  const closeModal = () => { setModalMode(null); setEditingId(null); resetForm(); };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const toggleCourse = (id: string) => setSelectedCourses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  
  // Toggle logic for grouped cohorts
  const toggleCohortGroup = (name: string, ids: string[]) => {
    const allSelected = ids.every(id => selectedCohorts.includes(id));
    
    if (allSelected) {
      // Remove all IDs for this group
      setSelectedCohorts(prev => prev.filter(id => !ids.includes(id)));
    } else {
      // Add all IDs for this group
      setSelectedCohorts(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const syncAssignments = async (instructorId: string) => {
    // Sync Cohorts
    const { data: existingCohorts } = await supabase.from('cohort_instructors').select('cohort_id').eq('instructor_id', instructorId);
    const existingCohortIds = (existingCohorts || []).map(r => r.cohort_id);
    const toRemoveCohorts = existingCohortIds.filter(id => !selectedCohorts.includes(id));
    const toAddCohorts = selectedCohorts.filter(id => !existingCohortIds.includes(id));
    if (toRemoveCohorts.length > 0) await supabase.from('cohort_instructors').delete().eq('instructor_id', instructorId).in('cohort_id', toRemoveCohorts);
    if (toAddCohorts.length > 0) await supabase.from('cohort_instructors').insert(toAddCohorts.map(cohort_id => ({ instructor_id: instructorId, cohort_id })));

    // Sync Courses
    const { data: existingCourses } = await supabase.from('course_instructors').select('course_id').eq('instructor_id', instructorId);
    const existingCourseIds = (existingCourses || []).map(r => r.course_id);
    const toRemoveCourses = existingCourseIds.filter(id => !selectedCourses.includes(id));
    const toAddCourses = selectedCourses.filter(id => !existingCourseIds.includes(id));
    if (toRemoveCourses.length > 0) await supabase.from('course_instructors').delete().eq('instructor_id', instructorId).in('course_id', toRemoveCourses);
    if (toAddCourses.length > 0) await supabase.from('course_instructors').insert(toAddCourses.map(course_id => ({ instructor_id: instructorId, course_id })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setIsSaving(true);
    try {
      if (modalMode === 'add') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email, password: formData.password,
          options: { data: { full_name: formData.full_name } },
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user');

        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id, full_name: formData.full_name, email: formData.email, role: 'instructor',
        });
        if (profileError) throw profileError;
        await syncAssignments(authData.user.id);
        setSuccess('Instructor added successfully!');
      }

      if (modalMode === 'edit' && editingId) {
        const { error: updateError } = await supabase.from('profiles').update({ full_name: formData.full_name, email: formData.email }).eq('id', editingId);
        if (updateError) throw updateError;
        if (formData.password.trim()) {
          const { error: pwError } = await supabase.auth.updateUser({ password: formData.password });
          if (pwError) throw pwError;
        }
        await syncAssignments(editingId);
        setSuccess('Instructor updated successfully!');
      }

      closeModal();
      await fetchInstructors();
      await fetchAllAssignments();
    } catch (err: any) {
      console.error(err);
      setError(err.message?.includes('Database error creating new user') ? 'Database error while creating user. Check Postgres logs.' : (err.message || 'An error occurred.'));
    } finally {
      setIsSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterCourse('all');
    setFilterCohort('all');
    setSearch('');
  };

  const isFiltering = filterCourse !== 'all' || filterCohort !== 'all' || search !== '';

  const filtered = list.filter(i => {
    const matchesSearch = i.full_name?.toLowerCase().includes(search.toLowerCase()) || i.email?.toLowerCase().includes(search.toLowerCase());
    const matchesCourse = filterCourse === 'all' || (instCourseMap[i.id] || []).includes(filterCourse);
    const matchesCohort = filterCohort === 'all' || (instCohortMap[i.id] || []).includes(filterCohort);
    return matchesSearch && matchesCourse && matchesCohort;
  });

  const getNamesForIds = (ids: string[] | undefined, masterList: (Course | Cohort)[]) => {
    if (!ids) return [];
    return ids.map(id => {
      const found = masterList.find(m => m.id === id);
      return found && 'title' in found ? found.title : found && 'name' in found ? found.name : 'Unknown';
    }).filter(Boolean);
  };

  // ✅ LOGIC: Group cohorts by name
  const groupedCohorts = useMemo(() => {
    const map = new Map<string, { name: string; ids: string[] }>();
    cohorts.forEach(c => {
      if (map.has(c.name)) {
        map.get(c.name)!.ids.push(c.id);
      } else {
        map.set(c.name, { name: c.name, ids: [c.id] });
      }
    });
    return Array.from(map.values());
  }, [cohorts]);

  const AssignmentCheckboxes = ({ type }: { type: 'courses' | 'cohorts' }) => {
    const items = type === 'courses' ? courses : groupedCohorts;
    const selected = type === 'courses' ? selectedCourses : selectedCohorts;
    const label = type === 'courses' ? 'Assign to Courses' : 'Assign to Cohorts';
    const Icon = type === 'courses' ? BookOpen : Users;

    // ✅ FIX: Calculate selected count based on Groups, not IDs
    const selectedCount = useMemo(() => {
      if (type === 'courses') return selected.length;
      // For cohorts, count how many groups are fully selected
      return (items as { name: string; ids: string[] }[]).filter(group => 
        group.ids.every(id => selected.includes(id))
      ).length;
    }, [selected, items, type]);

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Icon className="w-4 h-4" /> {label}
          {selectedCount > 0 && (
            <span className="text-xs text-indigo-600 font-medium">({selectedCount} selected)</span>
          )}
        </Label>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No {type} available.</p>
        ) : (
          <div className="border rounded-lg max-h-40 overflow-y-auto p-1 space-y-0.5 bg-gray-50">
            {items.map((item, idx) => {
              const displayName = 'title' in item ? item.title : item.name;
              const itemIds = 'id' in item ? [item.id] : item.ids; 
              
              // Check if ALL IDs for this item are selected
              const isChecked = itemIds.every(id => selected.includes(id));
              
              return (
                <label 
                  key={idx} 
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm ${isChecked ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={() => {
                      if (type === 'courses') {
                        toggleCourse(itemIds[0]);
                      } else {
                        toggleCohortGroup(displayName, itemIds);
                      }
                    }} 
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                  />
                  {displayName}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const selectStyles = "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Instructors / Facilitators</h1>

        {/* ADD MODAL */}
        <Dialog open={modalMode === 'add'} onOpenChange={(open) => { if (!open) closeModal(); else openAddModal(); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" />Add New Facilitator</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Instructor/Facilitator</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="add_name">Full Name</Label><Input id="add_name" name="full_name" value={formData.full_name} onChange={handleInputChange} required placeholder="John Doe" /></div>
                <div className="space-y-2"><Label htmlFor="add_email">Email Address</Label><Input id="add_email" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="john@example.com" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="add_pw">Password</Label><Input id="add_pw" name="password" type="password" value={formData.password} onChange={handleInputChange} required placeholder="••••••••" minLength={6} /></div>
              <AssignmentCheckboxes type="courses" />
              <AssignmentCheckboxes type="cohorts" />
              {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded">{success}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Instructor'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT MODAL */}
        <Dialog open={modalMode === 'edit'} onOpenChange={(open) => { if (!open) closeModal(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Instructor/Facilitator</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="edit_name">Full Name</Label><Input id="edit_name" name="full_name" value={formData.full_name} onChange={handleInputChange} required placeholder="John Doe" /></div>
                <div className="space-y-2"><Label htmlFor="edit_email">Email Address</Label><Input id="edit_email" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="john@example.com" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="edit_pw">New Password <span className="text-xs text-gray-400 font-normal ml-2">(leave blank to keep current)</span></Label><Input id="edit_pw" name="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="••••••••" minLength={6} /></div>
              <AssignmentCheckboxes type="courses" />
              <AssignmentCheckboxes type="cohorts" />
              {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded">{success}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        {/* FILTERS BAR */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full" />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-400 hidden md:block" />
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={selectStyles + " md:w-[220px]"}>
              <option value="all">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>

            <select value={filterCohort} onChange={e => setFilterCohort(e.target.value)} className={selectStyles + " md:w-[220px]"}>
              <option value="all">All Cohorts</option>
              {/* Filter dropdown also uses unique names */}
              {Array.from(new Set(cohorts.map(c => c.name))).map(name => (
                <option key={name} value={cohorts.find(co => co.name === name)?.id}>{name}</option>
              ))}
            </select>

            {isFiltering && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 hover:text-red-500 h-9 px-2">
                <XCircle className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* RESULTS COUNT */}
        {isFiltering && (
          <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            Showing {filtered.length} of {list.length} instructors
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Cohorts</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-20 text-gray-500">
                  {isFiltering ? "No instructors match the selected filters." : "No instructors found."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(i => (
                <InstructorRow
                  key={i.id}
                  instructor={i}
                  courseNames={getNamesForIds(instCourseMap[i.id], courses)}
                  cohortNames={[...new Set(getNamesForIds(instCohortMap[i.id], cohorts))]}
                  onEdit={openEditModal}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function InstructorRow({ instructor, courseNames, cohortNames, onEdit }: { 
  instructor: Instructor; 
  courseNames: string[]; 
  cohortNames: string[];
  onEdit: (i: Instructor) => void 
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{instructor.full_name}</TableCell>
      <TableCell className="text-gray-500">{instructor.email}</TableCell>
      <TableCell>
        {courseNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {courseNames.slice(0, 2).map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs font-normal bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                {name.length > 20 ? name.slice(0, 20) + '…' : name}
              </Badge>
            ))}
            {courseNames.length > 2 && (
              <Badge variant="secondary" className="text-xs font-normal bg-gray-100 text-gray-500">+{courseNames.length - 2}</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">None</span>
        )}
      </TableCell>
      <TableCell>
        {cohortNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {cohortNames.slice(0, 2).map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs font-normal bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                {name.length > 20 ? name.slice(0, 20) + '…' : name}
              </Badge>
            ))}
            {cohortNames.length > 2 && (
              <Badge variant="secondary" className="text-xs font-normal bg-gray-100 text-gray-500">+{cohortNames.length - 2}</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">None</span>
        )}
      </TableCell>
      <TableCell className="text-gray-500 text-sm">{new Date(instructor.created_at).toLocaleDateString()}</TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600" onClick={() => onEdit(instructor)}>
          <Pencil className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}