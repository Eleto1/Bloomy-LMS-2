import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { Users, BookOpen, GraduationCap, Star, Layers, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  // State for basic stats
  const [stats, setStats] = useState({ 
    students: 0, 
    courses: 0, 
    instructors: 0, 
    cohorts: 0 
  });
  
  // The specific state you requested
  const [trainingAvg, setTrainingAvg] = useState(0);
  
  // State for advanced charts
  const [programStats, setProgramStats] = useState<{name: string, rating: number}[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Basic Counts
      const { count: students } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: courses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
      const { count: instructors } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'instructor');
      const { count: cohorts } = await supabase.from('cohorts').select('*', { count: 'exact', head: true });

      setStats({ 
        students: students || 0, 
        courses: courses || 0, 
        instructors: instructors || 0, 
        cohorts: cohorts || 0
      });

      // 2. The Specific Logic You Requested
      const { data } = await supabase.from('survey_responses').select('rating');
      if (data && data.length > 0) {
        const sum = data.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        setTrainingAvg(Math.round((sum / data.length) * 10) / 10); // e.g. 4.5
      }

      // 3. Advanced Program Stats (For the charts)
      const { data: progData } = await supabase
        .from('survey_responses')
        .select('rating, lesson:lesson_id ( module:module_id ( course:course_id ( program ) ) )');

      if (progData) {
        const programMap: Record<string, {total: number, count: number}> = {};
        
        progData.forEach((item: any) => {
          const programName = item?.lesson?.module?.course?.program || 'General';
          if (!programMap[programName]) programMap[programName] = { total: 0, count: 0 };
          programMap[programName].total += item.rating || 0;
          programMap[programName].count += 1;
        });

        const progArray = Object.entries(programMap).map(([name, data]) => ({
          name,
          rating: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0
        }));
        
        setProgramStats(progArray);
      }

    } catch (error) {
      console.error("Error fetching dashboard stats", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center">Loading Dashboard...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Top Row: Counts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.students}</div></CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instructors</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.instructors}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.courses}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cohorts</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.cohorts}</div></CardContent>
        </Card>

        {/* The Card using the specific logic */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {trainingAvg} <span className="text-yellow-500 text-lg">★</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Program Ratings Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Program Performance
            </CardTitle>
            <CardDescription>Average satisfaction rating per program.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {programStats.length === 0 ? (
              <p className="text-gray-500 text-sm">No survey data available yet.</p>
            ) : (
              programStats.map((prog) => (
                <div key={prog.name} className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{prog.name}</span>
                    <span className="flex items-center gap-1">{prog.rating} <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /></span>
                  </div>
                  <Progress value={prog.rating * 20} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}