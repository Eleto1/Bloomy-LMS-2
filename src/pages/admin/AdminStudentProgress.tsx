import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Search, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Simple inline Progress component
const SimpleProgress = ({ value }: { value: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div 
      className="bg-blue-600 h-2.5 rounded-full transition-all" 
      style={{ width: `${value}%` }} 
    />
  </div>
);

interface Student { id: string; full_name: string; email: string; cohort_id?: string; }
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface QuizResult { id: string; score: number; total_questions: number; passed: boolean; created_at: string; }

export default function AdminStudentProgress() {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const [studentsRes, cohortsRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, cohort_id').eq('role', 'student').order('full_name'),
        supabase.from('cohorts').select('id, name, course'),
        supabase.from('courses').select('id, title, program')
      ]);

      if (studentsRes.data) setAllStudents(studentsRes.data);
      if (cohortsRes.data) setCohorts(cohortsRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      setLoading(false);
    };
    fetchInitialData();
  }, []);

  const filteredStudents = allStudents.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchesCohort = selectedCohort === 'all' || s.cohort_id === selectedCohort;
    const matchesCourse = selectedCourse === 'all' || (() => {
      const cohort = cohorts.find(c => c.id === s.cohort_id);
      const course = courses.find(c => c.id === selectedCourse);
      return cohort?.course === course?.program;
    })();
    return matchesSearch && matchesCohort && matchesCourse;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Student Progress & Grades</h2>
            <p className="text-gray-500">Monitor completion rates, attendance, and performance.</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Search Student</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Name or Email..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Filter by Cohort</Label>
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Filter by Program</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.program}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-end">
              <p className="text-sm text-gray-500 pb-2">
                Showing {filteredStudents.length} of {allStudents.length} students
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin mr-2" /> Loading...</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Student Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Cohort</th>
                    <th className="text-left p-3 font-medium">Program</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-6 text-gray-500">No students found.</td></tr>
                  ) : (
                    filteredStudents.map(student => {
                      const cohort = cohorts.find(c => c.id === student.cohort_id);
                      const program = cohort?.course || '—';
                      return (
                        <tr key={student.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-medium">{student.full_name}</td>
                          <td className="p-3 text-sm text-gray-600">{student.email}</td>
                          <td className="p-3 text-sm">{cohort?.name || '—'}</td>
                          <td className="p-3 text-sm">{program}</td>
                          <td className="p-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => setViewingStudent(student)}>
                              <Eye className="w-4 h-4 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!viewingStudent} onOpenChange={() => setViewingStudent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Dashboard: {viewingStudent?.full_name}</DialogTitle>
          </DialogHeader>
          {viewingStudent && (
            <StudentDetailView student={viewingStudent} cohorts={cohorts} courses={courses} />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// --- Sub-component for Detailed View ---
function StudentDetailView({ student, cohorts, courses }: { student: Student, cohorts: Cohort[], courses: Course[] }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    present: 0, absent: 0, late: 0, total: 0, 
    completed: 0, totalLessons: 0, 
    finalScore: 0, finalTotal: 0 
  });
  const [quizzes, setQuizzes] = useState<QuizResult[]>([]);
  const [courseProg, setCourseProg] = useState({ title: '', percent: 0 });

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const cohort = cohorts.find(c => c.id === student.cohort_id);
      const course = courses.find(c => c.program === cohort?.course);

      // 1. Attendance
      const { data: att } = await supabase.from('attendance').select('status').eq('student_id', student.id);
      let present = 0, absent = 0, late = 0;
      (att || []).forEach(a => {
        if (a.status === 'present') present++;
        if (a.status === 'absent') absent++;
        if (a.status === 'late') late++;
      });

      // 2. Progress
      let completed = 0;
      let total = 0;
      if (course) {
        const { data: mods } = await supabase.from('modules').select('id').eq('course_id', course.id);
        if (mods && mods.length > 0) {
          const ids = mods.map(m => m.id);
          const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', ids);
          total = lessons?.length || 0;
          if (total > 0) {
            const ids2 = lessons!.map(l => l.id);
            const { data: prog } = await supabase.from('lesson_progress').select('id').eq('user_id', student.id).in('lesson_id', ids2);
            completed = prog?.length || 0;
          }
        }
      }

      // 3. Quizzes
      const { data: qData } = await supabase.from('quiz_results').select('*').eq('user_id', student.id).order('created_at', { ascending: false }).limit(10);

      // 4. Final Assessment
      const { data: finalAssess } = await supabase
        .from('final_assessments')
        .select('score, total_marks, status')
        .eq('user_id', student.id)
        .eq('status', 'graded')
        .single();

      setStats({ 
        present, absent, late, total: (att || []).length, 
        completed, totalLessons: total, 
        finalScore: finalAssess?.score || 0,
        finalTotal: finalAssess?.total_marks || 0
      });
      
      setCourseProg({ title: course?.title || 'N/A', percent: total > 0 ? Math.round((completed / total) * 100) : 0 });
      setQuizzes(qData || []);
      setLoading(false);
    };
    fetchDetails();
  }, [student, cohorts, courses]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-3 text-center"><p className="text-xs text-gray-500">Present</p><p className="text-lg font-bold text-green-600">{stats.present}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-gray-500">Absent</p><p className="text-lg font-bold text-red-600">{stats.absent}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-gray-500">Late</p><p className="text-lg font-bold text-yellow-600">{stats.late}</p></Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Att. %</p>
          <p className="text-lg font-bold">{stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%</p>
        </Card>
        <Card className="p-3 text-center bg-purple-50 border-purple-200">
          <p className="text-xs text-purple-600">Final Exam</p>
          <p className="text-lg font-bold text-purple-800">
            {stats.finalScore ? `${stats.finalScore}/${stats.finalTotal}` : 'N/A'}
          </p>
        </Card>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Course Progress</h4>
        <div className="flex justify-between text-sm mb-1">
          <span>{courseProg.title}</span>
          <span className="font-medium">{courseProg.percent}%</span>
        </div>
        <SimpleProgress value={courseProg.percent} />
        <p className="text-xs text-gray-500 mt-1">{stats.completed} of {stats.totalLessons} lessons completed</p>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Recent Quizzes</h4>
        {quizzes.length === 0 ? <p className="text-sm text-gray-500">No quiz results.</p> : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-center">Score</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map(q => (
                <tr key={q.id} className="border-t">
                  <td className="p-2">{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-center">{q.score}/{q.total_questions}</td>
                  <td className="p-2 text-center">
                    {q.passed 
                      ? <span className="text-green-600 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> Pass</span>
                      : <span className="text-red-600 flex items-center justify-center gap-1"><XCircle className="w-3 h-3"/> Fail</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}