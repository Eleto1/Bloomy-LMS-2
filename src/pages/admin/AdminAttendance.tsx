import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Download, CheckCircle, XCircle, Loader2, Lock, Pencil, Eye,
  CalendarDays, BookOpen, Users, Clock
} from 'lucide-react';

interface Student { id: string; full_name: string; email: string; cohort_id?: string; }
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface Lesson { id: string; title: string; type: string; module_id: string; }

export default function AdminAttendance() {
  const { toast } = useToast();
  const getFormattedDate = (date: Date) => date.toISOString().split('T')[0];
  const [date, setDate] = useState(getFormattedDate(new Date()));
  
  const [filterCohortName, setFilterCohortName] = useState<string>('');
  const [filterProgramName, setFilterProgramName] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [activeCohortId, setActiveCohortId] = useState<string>('');
  
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [attendance, setAttendance] = useState<{ [key: string]: 'present' | 'absent' | 'late' }>({});
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isLocked, setIsLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsAdmin(false); return; }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      }
    };
    checkRole();
  }, []);

  useEffect(() => {
    const fetchCohorts = async () => {
      setLoadingCohorts(true);
      try {
        const { data, error } = await supabase.from('cohorts').select('id, name, course').order('name');
        if (error) throw error;
        setCohorts(data || []);
      } catch (err: any) {
        console.error(err);
        toast({ title: 'Error fetching cohorts', description: err.message, variant: 'destructive' });
        setCohorts([]);
      } finally {
        setLoadingCohorts(false);
      }
    };
    fetchCohorts();
  }, []);

  const uniqueCohortNames = Array.from(new Set(cohorts.map(c => c.name)));
  const availablePrograms = filterCohortName 
    ? Array.from(new Set(cohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : [];

  useEffect(() => {
    setFilterProgramName('');
    setSelectedCourse('');
    setLessons([]);
    setStudents([]);
    setActiveCohortId('');
    setIsLocked(false);
    setAttendance({});
    setNotes({});
  }, [filterCohortName]);

  useEffect(() => {
    if (!filterProgramName) {
      setCourses([]);
      setSelectedCourse('');
      setActiveCohortId('');
      setIsLocked(false);
      return;
    }

    const fetchCoursesAndCohort = async () => {
      setLoadingCourses(true);
      setSelectedCourse('');
      setLessons([]);
      setStudents([]);
      setIsLocked(false);
      setAttendance({});
      setNotes({});

      try {
        const specificCohort = cohorts.find(c => c.name === filterCohortName && c.course === filterProgramName);
        if (specificCohort) setActiveCohortId(specificCohort.id);
        else setActiveCohortId('');

        const { data: matchedCourses, error } = await supabase
          .from('courses')
          .select('id, title, program')
          .eq('program', filterProgramName);

        if (error) throw error;

        if (matchedCourses) {
          setCourses(matchedCourses);
          if (matchedCourses.length === 1) setSelectedCourse(matchedCourses[0].id);
        } else {
          setCourses([]);
        }
      } catch (err: any) {
        toast({ title: 'Error fetching courses', description: err.message, variant: 'destructive' });
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCoursesAndCohort();
  }, [filterProgramName, cohorts, filterCohortName]);

  useEffect(() => {
    if (!selectedCourse) {
      setLessons([]);
      setSelectedLesson('');
      setIsLocked(false);
      return;
    }

    const fetchLessons = async () => {
      setLoadingLessons(true);
      setSelectedLesson('');
      setIsLocked(false);
      setAttendance({});
      setNotes({});

      try {
        const { data: modules } = await supabase
          .from('modules')
          .select('id')
          .eq('course_id', selectedCourse);
        
        if (modules && modules.length > 0) {
          const moduleIds = modules.map(m => m.id);
          const { data: lessonsData } = await supabase
            .from('lessons')
            .select('id, title, type, module_id')
            .in('module_id', moduleIds)
            .eq('type', 'header')
            .order('order_index');
          
          setLessons(lessonsData || []);
        } else {
          setLessons([]);
        }
      } catch (err: any) {
        toast({ title: 'Error fetching lessons', description: err.message, variant: 'destructive' });
        setLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchLessons();
  }, [selectedCourse]);

  useEffect(() => {
    if (!activeCohortId || !selectedLesson) {
      setStudents([]);
      setIsLocked(false);
      return;
    }

    const fetchStudents = async () => {
      setLoadingStudents(true);
      setIsLocked(false);
      setAttendance({});
      setNotes({});

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, cohort_id')
          .eq('role', 'student')
          .eq('cohort_id', activeCohortId);
        
        if (error) throw error;
        setStudents(data || []);
      } catch (err: any) {
        toast({ title: 'Error fetching students', description: err.message, variant: 'destructive' });
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [activeCohortId, selectedLesson]);

  useEffect(() => {
    if (!selectedLesson || !date || students.length === 0) return;
    const fetchAttendance = async () => {
      const studentIds = students.map(s => s.id);
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status, notes')
        .eq('date', date)
        .eq('lesson_id', selectedLesson)
        .in('student_id', studentIds);

      if (error) {
        console.error("Could not load existing attendance", error);
        return;
      }
      
      if (data && data.length > 0) {
        const attMap: { [key: string]: 'present' | 'absent' | 'late' } = {};
        const notesMap: { [key: string]: string } = {};
        data.forEach((rec: any) => {
          attMap[rec.student_id] = rec.status;
          if (rec.notes) notesMap[rec.student_id] = rec.notes;
        });
        setAttendance(attMap);
        setNotes(notesMap);
        // FORCE LOCK for everyone if data exists. Admin UI will show "Unlock" button.
        setIsLocked(true); 
      } else {
        setAttendance({});
        setNotes({});
        setIsLocked(false);
      }
    };
    fetchAttendance();
  }, [selectedLesson, date, students]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    if (isLocked) return;
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    if (isLocked) return;
    setNotes(prev => ({ ...prev, [studentId]: note }));
  };

  const markAllPresent = () => {
    if (isLocked) return;
    const newAtt: { [key: string]: 'present' | 'absent' | 'late' } = {};
    students.forEach(s => newAtt[s.id] = 'present');
    setAttendance(newAtt);
  };

  const markAllAbsent = () => {
    if (isLocked) return;
    const newAtt: { [key: string]: 'present' | 'absent' | 'late' } = {};
    students.forEach(s => newAtt[s.id] = 'absent');
    setAttendance(newAtt);
  };

  const handleSaveAttendance = async () => {
    if (!selectedLesson || !activeCohortId) {
      toast({ title: 'Error', description: 'Please select Cohort, Program, and Session', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const records = students.map(student => ({
        student_id: student.id,
        cohort_id: activeCohortId,
        date,
        lesson_id: selectedLesson,
        status: attendance[student.id] || 'absent',
        notes: notes[student.id] || null,
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date,lesson_id' });

      if (error) throw error;
      toast({ title: 'Attendance saved!' });
      // FORCE LOCK for everyone once saved. Admins can use the Unlock button.
      setIsLocked(true); 
    } catch (error: any) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const exportAttendance = () => {
    if (students.length === 0) return;
    const cohort = cohorts.find(c => c.id === activeCohortId);
    const lesson = lessons.find(l => l.id === selectedLesson);
    
    const headers = ['Name', 'Email', 'Cohort', 'Program', 'Lesson', 'Date', 'Status', 'Notes'];
    const rows = students.map(s => [
      s.full_name, s.email, cohort?.name || '', 
      courses.find(c => c.id === selectedCourse)?.program || '', 
      lesson?.title || '', date, attendance[s.id] || 'N/A', notes[s.id] || ''
    ]);

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${date}_${lesson?.title || 'export'}.csv`;
    a.click();
  };

  const openStudentRecord = async (student: Student) => {
    setViewingStudent(student);
    setLoadingRecord(true);
    try {
      const { data: attData, error } = await supabase
        .from('attendance')
        .select('date, lesson_id, status, notes')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const records = attData || [];
      
      const lessonIds = [...new Set(records.map(r => r.lesson_id).filter(Boolean))];
      let lessonMap: { [key: string]: string } = {};
      if (lessonIds.length > 0) {
        const { data: lessData } = await supabase
          .from('lessons')
          .select('id, title')
          .in('id', lessonIds);
        (lessData || []).forEach(l => { lessonMap[l.id] = l.title; });
      }

      const enriched = records.map(r => ({
        ...r,
        lesson_title: lessonMap[r.lesson_id] || 'Unknown Session',
      }));

      setStudentRecords(enriched);
    } catch (err: any) {
      toast({ title: 'Error fetching record', description: err.message, variant: 'destructive' });
      setStudentRecords([]);
    } finally {
      setLoadingRecord(false);
    }
  };

  const recordStats = studentRecords.length > 0 ? {
    total: studentRecords.length,
    present: studentRecords.filter(r => r.status === 'present').length,
    absent: studentRecords.filter(r => r.status === 'absent').length,
    late: studentRecords.filter(r => r.status === 'late').length,
    rate: studentRecords.length > 0
      ? Math.round((studentRecords.filter(r => r.status === 'present').length / studentRecords.length) * 100)
      : 0,
  } : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Present</span>;
      case 'absent': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Absent</span>;
      case 'late': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Late</span>;
      default: return <span className="text-xs text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Graded Attendance</h2>
          <p className="text-gray-500">Select Class Session and Mark Attendance</p>
        </div>
        <Button onClick={exportAttendance} variant="outline" disabled={students.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <Label>1. Select Cohort</Label>
            <Select value={filterCohortName} onValueChange={setFilterCohortName} disabled={loadingCohorts}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={loadingCohorts ? "Loading..." : "Choose Cohort"} />
              </SelectTrigger>
              <SelectContent>
                {uniqueCohortNames.length === 0 ? (
                   <SelectItem value="none" disabled>No Cohorts Found</SelectItem>
                ) : (
                  uniqueCohortNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>2. Select Program</Label>
            <Select value={filterProgramName} onValueChange={setFilterProgramName} disabled={!filterCohortName}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose Program" />
              </SelectTrigger>
              <SelectContent>
                {availablePrograms.length === 0 ? (
                   <SelectItem value="none" disabled>No Programs</SelectItem>
                ) : (
                  availablePrograms.map(prog => <SelectItem key={prog} value={prog}>{prog}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>3. Course Content</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={!filterProgramName || loadingCourses || courses.length === 0}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={loadingCourses ? "Loading..." : courses.length === 0 ? "No Courses" : courses.length === 1 ? courses[0].title : "Choose Course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>4. Class Session</Label>
            <Select value={selectedLesson} onValueChange={setSelectedLesson} disabled={!selectedCourse || loadingLessons || lessons.length === 0}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={loadingLessons ? "Loading..." : lessons.length === 0 ? "No Sessions" : "Choose Session"} />
              </SelectTrigger>
              <SelectContent>
                {lessons.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>5. Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5" />
          </div>
        </div>

        {/* Banner — different text per role */}
        {isLocked && students.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
            <div className="flex items-center gap-2 text-amber-800">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isAdmin ? 'Attendance recorded — only admin can edit' : 'Attendance recorded — contact admin to edit'}
              </span>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setIsLocked(false)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Unlock to Edit
              </Button>
            )}
          </div>
        )}

        {students.length > 0 && !isLocked && (
          <div className="flex gap-2 mb-4 border-t pt-4">
            <Button onClick={markAllPresent} variant="outline" size="sm"><CheckCircle className="w-4 h-4 mr-1" />Mark All Present</Button>
            <Button onClick={markAllAbsent} variant="outline" size="sm"><XCircle className="w-4 h-4 mr-1" />Mark All Absent</Button>
          </div>
        )}

        {loadingStudents ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="animate-spin mr-2" /> Loading Students...</div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Student Name</th>
                  <th className="text-center p-3 font-medium">Present</th>
                  <th className="text-center p-3 font-medium">Absent</th>
                  <th className="text-center p-3 font-medium">Late</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                  <th className="text-center p-3 font-medium w-20">Record</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const currentStatus = attendance[student.id];
                  return (
                    <tr key={student.id} className={`border-t ${isLocked ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="p-3">
                        <div className="font-medium">{student.full_name}</div>
                        <div className="text-xs text-gray-500">{student.email}</div>
                      </td>
                      <td className="p-3 text-center">
                        <input type="radio" name={`att-${student.id}`} checked={currentStatus === 'present'} onChange={() => handleAttendanceChange(student.id, 'present')} className="w-4 h-4 accent-green-600" disabled={isLocked} />
                      </td>
                      <td className="p-3 text-center">
                        <input type="radio" name={`att-${student.id}`} checked={currentStatus === 'absent'} onChange={() => handleAttendanceChange(student.id, 'absent')} className="w-4 h-4 accent-red-600" disabled={isLocked} />
                      </td>
                      <td className="p-3 text-center">
                        <input type="radio" name={`att-${student.id}`} checked={currentStatus === 'late'} onChange={() => handleAttendanceChange(student.id, 'late')} className="w-4 h-4 accent-yellow-500" disabled={isLocked} />
                      </td>
                      <td className="p-3">
                        <Input placeholder={isLocked ? "Locked" : "Notes..."} value={notes[student.id] || ''} onChange={e => handleNoteChange(student.id, e.target.value)} className="w-full text-sm h-8" disabled={isLocked} />
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-indigo-600" onClick={() => openStudentRecord(student)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          selectedLesson && <div className="text-center py-10 text-gray-500 border rounded-lg">No students found in this cohort.</div>
        )}

        {students.length > 0 && (
          <div className="mt-6 flex justify-end gap-3">
            {isLocked && isAdmin && (
              <Button variant="outline" onClick={() => setIsLocked(false)}>
                <Pencil className="w-4 h-4 mr-2" /> Edit Attendance
              </Button>
            )}
            <Button onClick={handleSaveAttendance} disabled={saving || isLocked} className="bg-blue-600 text-white px-8">
              {saving ? <><Loader2 className="animate-spin mr-2" /> Saving...</> : isLocked ? 'Already Saved' : 'Save Attendance'}
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={!!viewingStudent} onOpenChange={(open) => { if (!open) { setViewingStudent(null); setStudentRecords([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Record</DialogTitle>
          </DialogHeader>

          {loadingRecord ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" /> Loading record...
            </div>
          ) : (
            <div className="space-y-5 mt-2">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-lg truncate">{viewingStudent?.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{viewingStudent?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {cohorts.find(c => c.id === viewingStudent?.cohort_id)?.name || 'Unknown Cohort'}
                    </Badge>
                  </div>
                </div>
              </div>

              {recordStats && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                    <BookOpen className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-blue-700">{recordStats.total}</p>
                    <p className="text-[10px] font-medium text-blue-500 uppercase">Sessions</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-emerald-700">{recordStats.present}</p>
                    <p className="text-[10px] font-medium text-emerald-500 uppercase">Present</p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                    <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-red-600">{recordStats.absent}</p>
                    <p className="text-[10px] font-medium text-red-500 uppercase">Absent</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-amber-600">{recordStats.late}</p>
                    <p className="text-[10px] font-medium text-amber-500 uppercase">Late</p>
                  </div>
                </div>
              )}

              {recordStats && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-600">Attendance Rate</span>
                    <span className={recordStats.rate >= 75 ? 'text-emerald-600' : recordStats.rate >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {recordStats.rate}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: recordStats.rate + '%',
                        background: recordStats.rate >= 75 ? '#10b981' : recordStats.rate >= 50 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                </div>
              )}

              {studentRecords.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-600">Date</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-600">Session</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-600">Status</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRecords.map((rec, idx) => (
                        <tr key={idx} className="border-t last:border-b-0 hover:bg-gray-50">
                          <td className="p-3 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-700">
                              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-gray-700 truncate max-w-[200px]">{rec.lesson_title}</td>
                          <td className="p-3 text-center">{getStatusBadge(rec.status)}</td>
                          <td className="p-3 text-xs text-gray-500 truncate max-w-[180px]">{rec.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 border rounded-xl">
                  No attendance records found for this student.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}