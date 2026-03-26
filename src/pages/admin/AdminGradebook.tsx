import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Download, RefreshCw } from 'lucide-react';

interface Student { id: string; full_name: string; email: string; cohort_id?: string; }
interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }

// Grading Logic (5.0 Scale)
const calculateGrade = (percent: number) => {
  if (percent >= 70) return { grade: 'A', point: 5.0, color: 'bg-green-100 text-green-800' };
  if (percent >= 60) return { grade: 'B', point: 4.0, color: 'bg-blue-100 text-blue-800' };
  if (percent >= 50) return { grade: 'C', point: 3.0, color: 'bg-yellow-100 text-yellow-800' };
  if (percent >= 45) return { grade: 'D', point: 2.0, color: 'bg-orange-100 text-orange-800' };
  if (percent >= 40) return { grade: 'E', point: 1.0, color: 'bg-red-100 text-red-800' };
  return { grade: 'F', point: 0.0, color: 'bg-red-200 text-red-900' };
};

export default function AdminGradebook() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  
  const [loading, setLoading] = useState(true);
  const [gradeData, setGradeData] = useState<Record<string, any>>({});
  
  const { toast } = useToast();

  // --- Main Data Fetching Function ---
  const loadGradebookData = async () => {
    setLoading(true);
    
    // 1. Fetch Basic Info
    const [studentsRes, cohortsRes, coursesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, cohort_id').eq('role', 'student'),
      supabase.from('cohorts').select('id, name, course'),
      supabase.from('courses').select('id, title, program')
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (cohortsRes.data) setCohorts(cohortsRes.data);
    if (coursesRes.data) setCourses(coursesRes.data);

    const studentIds = (studentsRes.data || []).map(s => s.id);

    if (studentIds.length === 0) {
      setLoading(false);
      return;
    }

    // 2. Fetch All Scores in Parallel (Removed Exam, Added Final Assessment)
    const [quizRes, assignRes, attendRes, finalRes] = await Promise.all([
      supabase.from('quiz_results').select('user_id, score, total_questions').in('user_id', studentIds),
      supabase.from('assignment_submissions').select('user_id, score, total_marks').in('user_id', studentIds),
      supabase.from('attendance').select('student_id, status').in('student_id', studentIds),
      supabase.from('final_assessments').select('user_id, score, total_marks, status').in('user_id', studentIds)
    ]);

    // 3. Process Data
    const stats: Record<string, any> = {};

    // Helper to init student stats
    const init = (id: string) => {
      if (!stats[id]) {
        stats[id] = {
          quiz: { score: 0, total: 0 },
          assign: { score: 0, total: 0 },
          attend: { present: 0, total: 0 },
          final: { score: 0, total: 0 }
        };
      }
    };

    // Process Quizzes
    (quizRes.data || []).forEach(q => {
      init(q.user_id);
      stats[q.user_id].quiz.score += q.score;
      stats[q.user_id].quiz.total += q.total_questions;
    });

    // Process Assignments
    (assignRes.data || []).forEach(a => {
      init(a.user_id);
      stats[a.user_id].assign.score += a.score;
      stats[a.user_id].assign.total += a.total_marks;
    });

    // Process Attendance
    (attendRes.data || []).forEach(a => {
      init(a.student_id);
      stats[a.student_id].attend.total++;
      if (a.status === 'present') {
        stats[a.student_id].attend.present++;
      }
    });

    // Process Final Assessments
    (finalRes.data || []).forEach(f => {
      init(f.user_id);
      if(f.status === 'graded') {
        stats[f.user_id].final.score += f.score;
        stats[f.user_id].final.total += f.total_marks;
      }
    });

    // 4. Calculate Final Grades
    const finalGrades: Record<string, any> = {};
    
    Object.keys(stats).forEach(userId => {
      const s = stats[userId];
      
      const quizAvg = s.quiz.total > 0 ? Math.round((s.quiz.score / s.quiz.total) * 100) : 0;
      const assignAvg = s.assign.total > 0 ? Math.round((s.assign.score / s.assign.total) * 100) : 0;
      const attendAvg = s.attend.total > 0 ? Math.round((s.attend.present / s.attend.total) * 100) : 0;
      const finalAvg = s.final.total > 0 ? Math.round((s.final.score / s.final.total) * 100) : 0;

      // Weighted Average: Quiz 20%, Assignment 20%, Final 50%, Attendance 10%
      let totalWeight = 0;
      let weightedSum = 0;

      if (s.quiz.total > 0) { weightedSum += quizAvg * 0.2; totalWeight += 0.2; }
      if (s.assign.total > 0) { weightedSum += assignAvg * 0.2; totalWeight += 0.2; }
      if (s.final.total > 0) { weightedSum += finalAvg * 0.5; totalWeight += 0.5; }
      if (s.attend.total > 0) { weightedSum += attendAvg * 0.1; totalWeight += 0.1; }

      const finalPercent = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      const g = calculateGrade(finalPercent);

      finalGrades[userId] = {
        quizAvg,
        assignAvg,
        finalAvg,
        attendAvg,
        finalPercent,
        ...g
      };
    });

    setGradeData(finalGrades);
    setLoading(false);
    toast({ title: 'Gradebook Updated!' });
  };

  // Load on mount
  useEffect(() => {
    loadGradebookData();
  }, []);

  // --- Filtering Logic ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchesCohort = selectedCohort === 'all' || s.cohort_id === selectedCohort;
    const matchesCourse = selectedCourse === 'all' || (() => {
      const cohort = cohorts.find(c => c.id === s.cohort_id);
      const course = courses.find(c => c.id === selectedCourse);
      return cohort?.course === course?.program;
    })();
    return matchesSearch && matchesCohort && matchesCourse;
  });

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Program', 'Quiz', 'Assign', 'Final Assess', 'Attend', 'Score', 'Grade', 'GPA'];
    const rows = filteredStudents.map(s => {
      const cohort = cohorts.find(c => c.id === s.cohort_id);
      const gd = gradeData[s.id] || {};
      return [
        s.full_name, s.email, cohort?.course || 'N/A',
        gd.quizAvg || 0, gd.assignAvg || 0, gd.finalAvg || 0, gd.attendAvg || 0,
        gd.finalPercent || 0, gd.grade || 'N/A', (gd.point || 0).toFixed(2)
      ];
    });
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'detailed_gradebook.csv';
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Detailed Gradebook</h2>
            <p className="text-gray-500">Weights: Quiz 20%, Assignment 20%, Final Assessment 50%, Attendance 10%.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadGradebookData} 
              disabled={loading}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
              Refresh Data
            </Button>
            <Button onClick={exportCSV} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
          </div>
        </div>

        <Card className="p-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Name or Email" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cohort</Label>
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Program</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.program}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end pb-2">
              <p className="text-sm text-gray-500">{filteredStudents.length} students</p>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Student</th>
                    <th className="text-center p-3 font-medium">Quiz (20%)</th>
                    <th className="text-center p-3 font-medium">Assign (20%)</th>
                    <th className="text-center p-3 font-medium">Final Assess (50%)</th>
                    <th className="text-center p-3 font-medium">Attend (10%)</th>
                    <th className="text-center p-3 font-medium border-l border-gray-200">Final Score</th>
                    <th className="text-center p-3 font-medium">Grade</th>
                    <th className="text-center p-3 font-medium">GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={8} className="text-center p-4 text-gray-500">No students found.</td></tr>
                  ) : (
                    filteredStudents.map(s => {
                      const gd = gradeData[s.id] || {};
                      return (
                        <tr key={s.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium">{s.full_name}</div>
                            <div className="text-xs text-gray-500">{s.email}</div>
                          </td>
                          <td className="p-3 text-center">{gd.quizAvg || 0}%</td>
                          <td className="p-3 text-center">{gd.assignAvg || 0}%</td>
                          <td className="p-3 text-center">{gd.finalAvg || 0}%</td>
                          <td className="p-3 text-center">{gd.attendAvg || 0}%</td>
                          <td className="p-3 text-center font-bold border-l border-gray-200">{gd.finalPercent || 0}%</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${gd.color || 'bg-gray-100'}`}>
                              {gd.grade || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">{(gd.point || 0).toFixed(2)}</td>
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
    </DashboardLayout>
  );
}