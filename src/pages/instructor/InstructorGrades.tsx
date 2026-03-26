import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download } from 'lucide-react';

const grades = [
  { id: 1, student: 'Adewale Johnson', assignment1: 85, assignment2: 92, midterm: 78, final: null, total: 85 },
  { id: 2, student: 'Chioma Okafor', assignment1: 90, assignment2: 88, midterm: 85, final: null, total: 88 },
  { id: 3, student: 'Emeka Nwankwo', assignment1: 70, assignment2: 65, midterm: 72, final: null, total: 69 },
  { id: 4, student: 'Fatima Abdullahi', assignment1: 95, assignment2: 98, midterm: 92, final: null, total: 95 },
  { id: 5, student: 'Oluwaseun Bakare', assignment1: 60, assignment2: 55, midterm: 58, final: null, total: 58 },
];

const InstructorGrades = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Gradebook</h2>
          <p className="text-muted-foreground text-sm">Full-Stack Web Development — Cohort 11</p>
        </div>
        <Button variant="outline"><Download className="w-4 h-4" /> Export Grades</Button>
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
                <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign. 1</th>
                <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign. 2</th>
                <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Midterm</th>
                <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final</th>
                <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="p-4 text-sm font-medium text-foreground">{g.student}</td>
                  <td className="p-4 text-sm text-center text-foreground">{g.assignment1}</td>
                  <td className="p-4 text-sm text-center text-foreground">{g.assignment2}</td>
                  <td className="p-4 text-sm text-center text-foreground">{g.midterm}</td>
                  <td className="p-4 text-sm text-center text-muted-foreground">{g.final ?? '—'}</td>
                  <td className="p-4 text-center">
                    <span className={`text-sm font-bold ${g.total >= 80 ? 'text-success' : g.total >= 60 ? 'text-warning' : 'text-destructive'}`}>{g.total}%</span>
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

export default InstructorGrades;
