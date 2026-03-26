import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Users, BookOpen, ClipboardList, FileText } from 'lucide-react';

const InstructorDashboard = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Instructor Dashboard</h2>
        <p className="text-muted-foreground text-sm">Manage your courses and students</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Students', value: '124', icon: Users, color: 'bg-primary' },
          { label: 'Active Courses', value: '4', icon: BookOpen, color: 'bg-secondary' },
          { label: 'Attendance Today', value: '89%', icon: ClipboardList, color: 'bg-success' },
          { label: 'Pending Grading', value: '12', icon: FileText, color: 'bg-warning' },
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
          <h3 className="font-display font-semibold text-foreground mb-4">Today's Classes</h3>
          <div className="space-y-3">
            {[
              { time: '9:00 AM', course: 'Full-Stack Web Dev — Module 8', room: 'Room A1' },
              { time: '11:30 AM', course: 'React Advanced Patterns', room: 'Room B2' },
              { time: '2:00 PM', course: 'Database Design Workshop', room: 'Lab 3' },
            ].map((cls) => (
              <div key={cls.time} className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                <div className="text-sm font-semibold text-secondary min-w-[70px]">{cls.time}</div>
                <div>
                  <div className="text-sm font-medium text-foreground">{cls.course}</div>
                  <div className="text-xs text-muted-foreground">{cls.room}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Recent Submissions</h3>
          <div className="space-y-3">
            {[
              { student: 'Adewale Johnson', assignment: 'React Portfolio Project', time: '2 hours ago' },
              { student: 'Chioma Okafor', assignment: 'Data Visualization Lab', time: '4 hours ago' },
              { student: 'Fatima Abdullahi', assignment: 'API Integration Task', time: '6 hours ago' },
            ].map((sub) => (
              <div key={sub.student} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium text-foreground">{sub.student}</div>
                  <div className="text-xs text-muted-foreground">{sub.assignment}</div>
                </div>
                <span className="text-xs text-muted-foreground">{sub.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashboardLayout>
);

export default InstructorDashboard;
