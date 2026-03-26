import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Users, BookOpen, CreditCard, TrendingUp } from 'lucide-react';

const AdminReports = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Reports</h2>
          <p className="text-muted-foreground text-sm">Analytics and insights for your institute</p>
        </div>
        <Button variant="outline"><Download className="w-4 h-4" /> Export Report</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Enrollment Rate', value: '+24%', desc: 'vs last quarter', icon: TrendingUp, color: 'bg-success' },
          { label: 'Completion Rate', value: '87%', desc: 'across all courses', icon: BookOpen, color: 'bg-primary' },
          { label: 'Active Students', value: '892', desc: 'currently learning', icon: Users, color: 'bg-secondary' },
          { label: 'Revenue Growth', value: '+18%', desc: 'month over month', icon: CreditCard, color: 'bg-info' },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
            <div className="font-display font-bold text-2xl text-foreground">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.desc}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Top Performing Courses</h3>
          <div className="space-y-4">
            {[
              { name: 'Full-Stack Web Dev', completion: 92, students: 85 },
              { name: 'Data Science', completion: 88, students: 62 },
              { name: 'UI/UX Design', completion: 85, students: 55 },
              { name: 'Mobile Dev', completion: 78, students: 45 },
            ].map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.completion}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="gradient-accent h-2 rounded-full transition-all" style={{ width: `${c.completion}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Monthly Enrollment Trend</h3>
          <div className="space-y-3">
            {[
              { month: 'January', count: 45 },
              { month: 'February', count: 62 },
              { month: 'March', count: 78 },
            ].map((m) => (
              <div key={m.month} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{m.month} 2026</span>
                <span className="text-sm font-semibold text-foreground">{m.count} new students</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashboardLayout>
);

export default AdminReports;
