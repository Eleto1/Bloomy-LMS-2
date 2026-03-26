import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, CalendarDays } from 'lucide-react';
import { useState } from 'react';

const students = [
  { id: 1, name: 'Adewale Johnson' },
  { id: 2, name: 'Chioma Okafor' },
  { id: 3, name: 'Emeka Nwankwo' },
  { id: 4, name: 'Fatima Abdullahi' },
  { id: 5, name: 'Oluwaseun Bakare' },
  { id: 6, name: 'Blessing Eze' },
];

const InstructorAttendance = () => {
  const [attendance, setAttendance] = useState<Record<number, 'present' | 'absent' | null>>(
    Object.fromEntries(students.map(s => [s.id, null]))
  );

  const markAll = (status: 'present' | 'absent') => {
    setAttendance(Object.fromEntries(students.map(s => [s.id, status])));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Attendance</h2>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <CalendarDays className="w-4 h-4" /> March 24, 2026 — Full-Stack Web Dev
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll('present')}>Mark All Present</Button>
            <Button variant="default" size="sm">Save Attendance</Button>
          </div>
        </div>

        <Card className="border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                  <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                          {s.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-sm text-foreground">{s.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        attendance[s.id] === 'present' ? 'bg-success/10 text-success' :
                        attendance[s.id] === 'absent' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {attendance[s.id] === 'present' ? 'Present' : attendance[s.id] === 'absent' ? 'Absent' : 'Not marked'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant={attendance[s.id] === 'present' ? 'default' : 'outline'} size="icon" className="w-8 h-8" onClick={() => setAttendance({ ...attendance, [s.id]: 'present' })}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button variant={attendance[s.id] === 'absent' ? 'destructive' : 'outline'} size="icon" className="w-8 h-8" onClick={() => setAttendance({ ...attendance, [s.id]: 'absent' })}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InstructorAttendance;
