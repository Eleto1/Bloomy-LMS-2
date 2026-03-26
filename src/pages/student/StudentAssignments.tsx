import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, CalendarDays, Upload, CheckCircle, Clock } from 'lucide-react';

const assignments = [
  { id: 1, title: 'React Portfolio Project', course: 'Full-Stack Dev', dueDate: '2026-03-28', status: 'pending', grade: null },
  { id: 2, title: 'API Integration Task', course: 'Full-Stack Dev', dueDate: '2026-04-05', status: 'pending', grade: null },
  { id: 3, title: 'Data Visualization Lab', course: 'Database Design', dueDate: '2026-03-20', status: 'submitted', grade: '92%' },
  { id: 4, title: 'SQL Fundamentals Quiz', course: 'Database Design', dueDate: '2026-03-10', status: 'graded', grade: '88%' },
];

const StudentAssignments = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Assignments</h2>
        <p className="text-muted-foreground text-sm">View and submit your assignments</p>
      </div>

      <div className="space-y-4">
        {assignments.map((a) => (
          <Card key={a.id} className="p-5 border-border hover:shadow-brand transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  a.status === 'graded' ? 'bg-success' : a.status === 'submitted' ? 'bg-info' : 'bg-primary'
                }`}>
                  {a.status === 'graded' ? <CheckCircle className="w-5 h-5 text-success-foreground" /> :
                   a.status === 'submitted' ? <Clock className="w-5 h-5 text-info-foreground" /> :
                   <FileText className="w-5 h-5 text-primary-foreground" />}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.course}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <CalendarDays className="w-3 h-3" /> Due: {a.dueDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {a.grade && (
                  <span className="text-lg font-bold text-success font-display">{a.grade}</span>
                )}
                {a.status === 'pending' && (
                  <Button variant="default" size="sm"><Upload className="w-4 h-4" /> Submit</Button>
                )}
                {a.status === 'submitted' && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-info/10 text-info">Submitted</span>
                )}
                {a.status === 'graded' && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">Graded</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default StudentAssignments;
