import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const students = [
  { id: 1, name: 'Adewale Johnson', course: 'Full-Stack Dev', progress: 78, grade: 'A' },
  { id: 2, name: 'Chioma Okafor', course: 'Full-Stack Dev', progress: 85, grade: 'A' },
  { id: 3, name: 'Emeka Nwankwo', course: 'Full-Stack Dev', progress: 62, grade: 'B' },
  { id: 4, name: 'Fatima Abdullahi', course: 'React Advanced', progress: 91, grade: 'A+' },
  { id: 5, name: 'Oluwaseun Bakare', course: 'React Advanced', progress: 45, grade: 'C' },
];

const InstructorStudents = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">My Students</h2>
        <p className="text-muted-foreground text-sm">Track student progress across your courses</p>
      </div>

      <Card className="border-border">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search students..." className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-sm text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{s.course}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div className="gradient-accent h-2 rounded-full" style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.progress}%</span>
                    </div>
                  </td>
                  <td className="p-4"><span className="text-sm font-semibold text-foreground">{s.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </DashboardLayout>
);

export default InstructorStudents;
