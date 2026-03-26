import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, CalendarDays, Users } from 'lucide-react';

const assignments = [
  { id: 1, title: 'React Portfolio Project', course: 'Full-Stack Dev', dueDate: '2026-03-28', submissions: 18, total: 25, status: 'Active' },
  { id: 2, title: 'API Integration Task', course: 'Full-Stack Dev', dueDate: '2026-04-05', submissions: 5, total: 25, status: 'Active' },
  { id: 3, title: 'Data Visualization Lab', course: 'Data Science', dueDate: '2026-03-20', submissions: 22, total: 22, status: 'Closed' },
  { id: 4, title: 'SQL Query Optimization', course: 'Data Science', dueDate: '2026-04-10', submissions: 0, total: 22, status: 'Draft' },
];

const InstructorAssignments = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Assignments</h2>
          <p className="text-muted-foreground text-sm">Create and manage student assignments</p>
        </div>
        <Button variant="default"><Plus className="w-4 h-4" /> Create Assignment</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {assignments.map((a) => (
          <Card key={a.id} className="p-5 border-border hover:shadow-brand transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.course}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                a.status === 'Active' ? 'bg-success/10 text-success' :
                a.status === 'Closed' ? 'bg-muted text-muted-foreground' :
                'bg-warning/10 text-warning'
              }`}>{a.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Due {a.dueDate}</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {a.submissions}/{a.total}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div className="gradient-accent h-2 rounded-full" style={{ width: `${(a.submissions / a.total) * 100}%` }} />
            </div>
            <Button variant="outline" size="sm" className="w-full">View Submissions</Button>
          </Card>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default InstructorAssignments;
