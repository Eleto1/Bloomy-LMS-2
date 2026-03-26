import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Users, BookOpen, GraduationCap } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, courses: 0, instructors: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: students } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: courses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    const { count: instructors } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'instructor');
    setStats({ students: students || 0, courses: courses || 0, instructors: instructors || 0 });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.students}</div></CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.courses}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instructors</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.instructors}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}