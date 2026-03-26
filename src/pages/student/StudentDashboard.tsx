import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { BookOpen, CalendarDays, Award, TrendingUp } from 'lucide-react';

const StudentDashboard = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Welcome back! 👋</h2>
        <p className="text-muted-foreground text-sm">Continue your learning journey</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Enrolled Courses', value: '3', icon: BookOpen, color: 'bg-primary' },
          { label: 'Upcoming Classes', value: '2', icon: CalendarDays, color: 'bg-secondary' },
          { label: 'Certificates', value: '1', icon: Award, color: 'gradient-accent' },
          { label: 'Overall Grade', value: 'A-', icon: TrendingUp, color: 'bg-success' },
        ].map((s) => (
          <Card key={s.label} className="p-5 border-border">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="font-display font-bold text-2xl text-foreground">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Current Courses</h3>
          <div className="space-y-4">
            {[
              { name: 'Full-Stack Web Development', progress: 78, instructor: 'Tunde Afolabi' },
              { name: 'React Advanced Patterns', progress: 45, instructor: 'Tunde Afolabi' },
              { name: 'Database Design', progress: 92, instructor: 'Dr. Ngozi Eze' },
            ].map((c) => (
              <div key={c.name} className="p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.progress}%</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">by {c.instructor}</div>
                <div className="w-full bg-background rounded-full h-2">
                  <div className="gradient-accent h-2 rounded-full" style={{ width: `${c.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Upcoming Deadlines</h3>
          <div className="space-y-3">
            {[
              { task: 'React Portfolio Project', due: 'Mar 28', course: 'Full-Stack Dev' },
              { task: 'API Integration Task', due: 'Apr 5', course: 'Full-Stack Dev' },
              { task: 'Mid-term Exam', due: 'Apr 7', course: 'All Courses' },
            ].map((d) => (
              <div key={d.task} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.task}</div>
                  <div className="text-xs text-muted-foreground">{d.course}</div>
                </div>
                <span className="text-xs font-medium text-secondary">{d.due}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashboardLayout>
);

export default StudentDashboard;
