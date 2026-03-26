import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Student { id: string; full_name: string; email: string; cohort_id?: string; }
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface Lesson { id: string; title: string; type: string; module_id: string; }

export default function AdminAttendance() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Selections
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  
  // Data
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Attendance State
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  // Loading States
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { toast } = useToast();

  // 1. Fetch Cohorts
  useEffect(() => {
    const fetchCohorts = async () => {
      setLoadingCohorts(true);
      const { data } = await supabase.from('cohorts').select('id, name, course').order('name');
      if (data) setCohorts(data);
      setLoadingCohorts(false);
    };
    fetchCohorts();
  }, []);

  // 2. Fetch Programs (Courses) for Selected Cohort
  useEffect(() => {
    if (!selectedCohort) {
      setCourses([]);
      setSelectedCourse('');
      return;
    }

    const fetchCourses = async () => {
      setLoadingCourses(true);
      setSelectedCourse('');
      setLessons([]);
      setStudents([]);
      
      const cohort = cohorts.find(c => c.id === selectedCohort);
      
      // A. If cohort has a specific program name assigned
      if (cohort?.course) {
        // Try to find that specific program in the courses table
        const { data: matched } = await supabase
          .from('courses')
          .select('id, title, program')
          .eq('program', cohort.course);
        
        if (matched && matched.length > 0) {
          setCourses(matched);
        } else {
          // B. Fallback: If specific match fails, show ALL available programs
          // This handles cases where names might differ slightly
          const { data: allCourses } = await supabase
            .from('courses')
            .select('id, title, program');
          
          if (allCourses && allCourses.length > 0) {
            setCourses(allCourses);
          } else {
            setCourses([]); // No courses in DB
          }
        }
      } else {
        // C. Fallback: If cohort has no program assigned, show ALL programs
        const { data: allCourses } = await supabase
          .from('courses')
          .select('id, title, program');
        
        if (allCourses && allCourses.length > 0) {
          setCourses(allCourses);
        } else {
          setCourses([]);
        }
      }
      setLoadingCourses(false);
    };
    fetchCourses();
  }, [selectedCohort, cohorts]);

  // 3. Fetch Text Headers (Lessons)
  useEffect(() => {
    if (!selectedCourse) {
      setLessons([]);
      setSelectedLesson('');
      return;
    }

    const fetchLessons = async () => {
      setLoadingLessons(true);
      setSelectedLesson('');
      setStudents([]);
      
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
        
        if (lessonsData && lessonsData.length > 0) {
          setLessons(lessonsData as Lesson[]);
        } else {
          setLessons([]);
        }
      } else {
        setLessons([]);
      }
      setLoadingLessons(false);
    };
    fetchLessons();
  }, [selectedCourse]);

  // 4. Fetch Students
  useEffect(() => {
    if (!selectedCohort || !selectedLesson) {
      setStudents([]);
      return;
    }

    const fetchStudents = async () => {
      setLoadingStudents(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, cohort_id')
        .eq('role', 'student')
        .eq('cohort_id', selectedCohort);
      
      if (data) setStudents(data);
      setLoadingStudents(false);
    };
    fetchStudents();
  }, [selectedCohort, selectedLesson]);

  // Load existing attendance
  useEffect(() => {
    if (!selectedLesson || !date || students.length === 0) return;
    const fetchAttendance = async () => {
      const studentIds = students.map(s => s.id);
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, notes')
        .eq('date', date)
        .eq('lesson_id', selectedLesson)
        .in('student_id', studentIds);

      if (data) {
        const attMap: Record<string, 'present' | 'absent' | 'late'> = {};
        const notesMap: Record<string, string> = {};
        data.forEach((rec: any) => {
          attMap[rec.student_id] = rec.status;
          if (rec.notes) notesMap[rec.student_id] = rec.notes;
        });
        setAttendance(attMap);
        setNotes(notesMap);
      }
    };
    fetchAttendance();
  }, [selectedLesson, date, students]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setNotes(prev => ({ ...prev, [studentId]: note }));
  };

  const markAllPresent = () => {
    const newAtt: Record<string, 'present' | 'absent' | 'late'> = {};
    students.forEach(s => newAtt[s.id] = 'present');
    setAttendance(newAtt);
  };

  const markAllAbsent = () => {
    const newAtt: Record<string, 'present' | 'absent' | 'late'> = {};
    students.forEach(s => newAtt[s.id] = 'absent');
    setAttendance(newAtt);
  };

  const handleSaveAttendance = async () => {
    if (!selectedLesson || !selectedCohort) {
      toast({ title: 'Error', description: 'Please select Cohort, Program, and Class Session', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const records = students.map(student => ({
        student_id: student.id,
        cohort_id: selectedCohort,
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
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const exportAttendance = () => {
    if (students.length === 0) return;
    const cohort = cohorts.find(c => c.id === selectedCohort);
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

  return (
    <DashboardLayout>
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
          {/* Selection Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* 1. Cohort */}
            <div>
              <Label>1. Select Cohort</Label>
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={loadingCohorts ? "Loading..." : "Choose Cohort"} />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Program */}
            <div>
              <Label>2. Select Program</Label>
              <Select 
                value={selectedCourse} 
                onValueChange={setSelectedCourse} 
                disabled={!selectedCohort || loadingCourses || courses.length === 0}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={
                    loadingCourses ? "Loading..." : 
                    courses.length === 0 ? "No Programs Found" : "Choose Program"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.program}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Class Session */}
            <div>
              <Label>3. Class Session (Day/Topic)</Label>
              <Select 
                value={selectedLesson} 
                onValueChange={setSelectedLesson} 
                disabled={!selectedCourse || loadingLessons || lessons.length === 0}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={
                    loadingLessons ? "Loading..." : 
                    lessons.length === 0 ? "No Topics Found" : "Choose Session"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Date */}
            <div>
              <Label>4. Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {/* Action Buttons */}
          {students.length > 0 && (
            <div className="flex gap-2 mb-4 border-t pt-4">
              <Button onClick={markAllPresent} variant="outline" size="sm"><CheckCircle className="w-4 h-4 mr-1" />Mark All Present</Button>
              <Button onClick={markAllAbsent} variant="outline" size="sm"><XCircle className="w-4 h-4 mr-1" />Mark All Absent</Button>
            </div>
          )}

          {/* Student List */}
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
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{student.full_name}</div>
                        <div className="text-xs text-gray-500">{student.email}</div>
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="radio" 
                          name={`att-${student.id}`} 
                          checked={attendance[student.id] === 'present'} 
                          onChange={() => handleAttendanceChange(student.id, 'present')} 
                          className="w-4 h-4 accent-green-600"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="radio" 
                          name={`att-${student.id}`} 
                          checked={attendance[student.id] === 'absent'} 
                          onChange={() => handleAttendanceChange(student.id, 'absent')} 
                          className="w-4 h-4 accent-red-600"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="radio" 
                          name={`att-${student.id}`} 
                          checked={attendance[student.id] === 'late'} 
                          onChange={() => handleAttendanceChange(student.id, 'late')} 
                          className="w-4 h-4 accent-yellow-500"
                        />
                      </td>
                      <td className="p-3">
                        <Input 
                          placeholder="Notes..." 
                          value={notes[student.id] || ''} 
                          onChange={e => handleNoteChange(student.id, e.target.value)} 
                          className="w-full text-sm h-8" 
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            selectedLesson && <div className="text-center py-10 text-gray-500 border rounded-lg">No students found in this cohort.</div>
          )}

          {/* Save Button */}
          {students.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveAttendance} disabled={saving} className="bg-blue-600 text-white px-8">
                {saving ? <><Loader2 className="animate-spin mr-2" /> Saving...</> : 'Save Attendance'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}