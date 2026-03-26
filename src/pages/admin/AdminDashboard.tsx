import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, GraduationCap, CreditCard, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function AdminDashboard() {
  const [studentCount, setStudentCount] = useState(0);
  const [instructorCount, setInstructorCount] = useState(0);
  const [recentStudents, setRecentStudents] = useState<{ full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Analytics State
  const [cohortStats, setCohortStats] = useState<any[]>([]);
  const [programStats, setProgramStats] = useState<any[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      // 1. Basic Counts
      const [studentsRes, instructorsRes, recentRes] = await Promise.all([
        supabase.from('profiles').select('id, cohort_id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'instructor'),
        supabase.from('profiles').select('full_name, email').eq('role', 'student').order('created_at', { ascending: false }).limit(5),
      ]);

      if (studentsRes.data) setStudentCount(studentsRes.count ?? 0);
      if (instructorsRes.data) setInstructorCount(instructorsRes.count ?? 0);
      if (recentRes.data) setRecentStudents(recentRes.data);

      // 2. Performance Analytics
      if (studentsRes.data && studentsRes.data.length > 0) {
        const studentIds = studentsRes.data.map(s => s.id);
        const studentCohorts = studentsRes.data; // { id, cohort_id }

        // Fetch all Grade Data
        const [quizRes, assignRes, examRes, attendRes, cohortsRes] = await Promise.all([
          supabase.from('quiz_results').select('user_id, score, total_questions').in('user_id', studentIds),
          supabase.from('assignment_submissions').select('user_id, score, total_marks').in('user_id', studentIds),
          supabase.from('exam_results').select('user_id, score, total_marks').in('user_id', studentIds),
          supabase.from('attendance').select('student_id, status').in('student_id', studentIds),
          supabase.from('cohorts').select('id, name, course')
        ]);

        // Calculate GPA per student
        const studentGrades: Record<string, { totalScore: number; totalPossible: number }> = {};

        const init = (id: string) => {
          if (!studentGrades[id]) studentGrades[id] = { totalScore: 0, totalPossible: 0 };
        };

        // Sum scores (Simplified: 1 point per %)
        (quizRes.data || []).forEach(q => { init(q.user_id); studentGrades[q.user_id].totalScore += q.score; studentGrades[q.user_id].totalPossible += q.total_questions; });
        (assignRes.data || []).forEach(a => { init(a.user_id); studentGrades[a.user_id].totalScore += a.score; studentGrades[a.user_id].totalPossible += a.total_marks; });
        (examRes.data || []).forEach(e => { init(e.user_id); studentGrades[e.user_id].totalScore += e.score; studentGrades[e.user_id].totalPossible += e.total_marks; });
        (attendRes.data || []).forEach(a => { 
          init(a.student_id); 
          studentGrades[a.student_id].totalPossible += 1;
          if (a.status === 'present') studentGrades[a.student_id].totalScore += 1;
          else if (a.status === 'late') studentGrades[a.student_id].totalScore += 0.5;
        });

        // Map Cohorts
        const cohortMap: Record<string, { name: string; course: string }> = {};
        (cohortsRes.data || []).forEach(c => cohortMap[c.id] = { name: c.name, course: c.course });

        // Aggregate by Cohort
        const cohortAgg: Record<string, { name: string; program: string; totalGPA: number; count: number }> = {};

        studentCohorts.forEach(s => {
          if (!s.cohort_id) return;
          const g = studentGrades[s.id];
          if (!g || g.totalPossible === 0) return;

          const percent = (g.totalScore / g.totalPossible) * 100;
          let point = 0;
          if (percent >= 70) point = 5;
          else if (percent >= 60) point = 4;
          else if (percent >= 50) point = 3;
          else if (percent >= 45) point = 2;
          else if (percent >= 40) point = 1;

          if (!cohortAgg[s.cohort_id]) {
            cohortAgg[s.cohort_id] = { 
              name: cohortMap[s.cohort_id]?.name || 'Unknown', 
              program: cohortMap[s.cohort_id]?.course || 'Unknown', 
              totalGPA: 0, 
              count: 0 
            };
          }
          cohortAgg[s.cohort_id].totalGPA += point;
          cohortAgg[s.cohort_id].count++;
        });

        // Prepare Chart Data
        const chartData = Object.keys(cohortAgg).map(id => ({
          name: cohortAgg[id].name,
          program: cohortAgg[id].program,
          gpa: cohortAgg[id].count > 0 ? parseFloat((cohortAgg[id].totalGPA / cohortAgg[id].count).toFixed(2)) : 0,
          students: cohortAgg[id].count
        })).sort((a, b) => b.gpa - a.gpa);

        setCohortStats(chartData);

        // Aggregate by Program
        const programAgg: Record<string, { totalGPA: number; count: number }> = {};
        chartData.forEach(c => {
          if (!programAgg[c.program]) programAgg[c.program] = { totalGPA: 0, count: 0 };
          programAgg[c.program].totalGPA += c.gpa;
          programAgg[c.program].count++;
        });

        const progData = Object.keys(programAgg).map(p => ({
          name: p,
          gpa: programAgg[p].count > 0 ? parseFloat((programAgg[p].totalGPA / programAgg[p].count).toFixed(2)) : 0
        }));

        setProgramStats(progData);
      }

      setLoading(false);
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Students', value: loading ? '...' : studentCount.toLocaleString(), icon: Users, color: 'bg-primary' },
    { label: 'Instructors', value: loading ? '...' : instructorCount.toLocaleString(), icon: GraduationCap, color: 'gradient-accent' },
    { label: 'Active Courses', value: '—', icon: BookOpen, color: 'bg-secondary' },
    { label: 'Revenue (₦)', value: '—', icon: CreditCard, color: 'bg-success' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground text-sm">Welcome back! Here's an overview of your institute.</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-5 border-border hover:shadow-brand transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
              <div className="font-display font-bold text-2xl text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Performance Analytics */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Program Performance (Left) */}
          <Card className="p-6 border-border">
            <h3 className="font-display font-semibold text-foreground mb-4">Average GPA by Program</h3>
            {loading ? <p>Loading...</p> : (
              <div className="space-y-4">
                {programStats.map(p => (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-bold text-blue-600">{p.gpa.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${(p.gpa / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Cohort Performance Chart (Middle/Right) */}
          <Card className="p-6 border-border lg:col-span-2">
            <h3 className="font-display font-semibold text-foreground mb-4">Cohort Performance Comparison</h3>
            {loading ? <p>Loading...</p> : cohortStats.length === 0 ? <p>No data</p> : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortStats.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 5]} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="gpa" fill="#0A2463" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Students */}
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Recent Enrollments</h3>
          <div className="space-y-3">
            {recentStudents.map((s) => (
              <div key={s.email} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-sm text-foreground">{s.full_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.email}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
}