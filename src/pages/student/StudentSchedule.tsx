import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Video, CalendarDays, ExternalLink, Clock } from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';

interface Schedule { 
  id: string; 
  title: string; 
  scheduled_at: string; 
  duration_minutes: number; 
  meeting_url: string; 
  courses: { title: string } 
}

export default function StudentSchedule() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [past, setPast] = useState<Schedule[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user) return;

      // 1. Get Student's Cohort
      const { data: profile } = await supabase
        .from('profiles')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      // 2. Get Cohort's Program
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('course')
        .eq('id', profile.cohort_id)
        .single();

      if (!cohort?.course) {
        setLoading(false);
        return;
      }

      // 3. Get Courses for that Program
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id')
        .eq('program', cohort.course);

      if (!coursesData || coursesData.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = coursesData.map(c => c.id);

      // 4. Fetch Schedules for these courses
      const now = new Date().toISOString();
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*, courses(title)')
        .in('course_id', courseIds)
        .order('scheduled_at', { ascending: true });

      if (schedules) {
        const up = schedules.filter(s => isAfter(new Date(s.scheduled_at), new Date()));
        const down = schedules.filter(s => isBefore(new Date(s.scheduled_at), new Date()));
        setUpcoming(up);
        setPast(down);
      }

      setLoading(false);
    };

    fetchSchedule();
  }, [user]);

  if (loading) return <DashboardLayout><div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold">My Schedule</h2>
          <p className="text-gray-500">Your upcoming classes and sessions.</p>
        </div>

        {/* Upcoming */}
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" /> Upcoming Sessions
          </h3>
          {upcoming.length === 0 ? (
            <Card className="p-6 text-center text-gray-500">No upcoming sessions scheduled.</Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map(s => (
                <Card key={s.id} className="p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">{s.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Course: {s.courses?.title}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-4 h-4" /> {format(new Date(s.scheduled_at), 'PPP')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {format(new Date(s.scheduled_at), 'p')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {s.duration_minutes} mins
                        </span>
                      </div>
                    </div>
                    {s.meeting_url && (
                      <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Video className="w-4 h-4 mr-2" /> Join Class
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-400">Past Sessions</h3>
          <div className="space-y-2">
            {past.map(s => (
              <Card key={s.id} className="p-3 bg-gray-50 opacity-75">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{s.title} <span className="text-gray-400 text-xs">({s.courses?.title})</span></p>
                    <p className="text-xs text-gray-400">{format(new Date(s.scheduled_at), 'PPP p')}</p>
                  </div>
                  {s.meeting_url && (
                    <a href={s.meeting_url} target="_blank" className="text-xs text-gray-500 underline">Recording?</a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}