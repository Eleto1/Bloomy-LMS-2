import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Download, Plus, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Payment {
  id: number;
  student: string;
  course: string;
  amount: string;
  date: string;
  status: string;
}

const initialPayments: Payment[] = [
  { id: 1, student: 'Adewale Johnson', course: 'Full-Stack Dev', amount: '₦350,000', date: '2026-03-15', status: 'Paid' },
  { id: 2, student: 'Chioma Okafor', course: 'Data Science', amount: '₦300,000', date: '2026-03-14', status: 'Paid' },
  { id: 3, student: 'Emeka Nwankwo', course: 'Mobile Dev', amount: '₦320,000', date: '2026-03-10', status: 'Pending' },
  { id: 4, student: 'Fatima Abdullahi', course: 'UI/UX Design', amount: '₦250,000', date: '2026-03-08', status: 'Paid' },
  { id: 5, student: 'Oluwaseun Bakare', course: 'Full-Stack Dev', amount: '₦175,000', date: '2026-03-05', status: 'Partial' },
];

const AdminPayments = () => {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ student: '', amount: '', date: '', status: 'Paid', course: '' });
  const { toast } = useToast();

  const filtered = payments.filter(p => p.student.toLowerCase().includes(search.toLowerCase()));

  const exportCSV = () => {
    const rows = [['Student','Course','Amount','Date','Status'], ...payments.map(p => [p.student, p.course, p.amount, p.date, p.status])];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'payments.csv'; a.click();
  };

  const handleSave = () => {
    setPayments([...payments, { id: Date.now(), student: form.student, course: form.course, amount: `₦${Number(form.amount).toLocaleString()}`, date: form.date || new Date().toISOString().split('T')[0], status: form.status }]);
    toast({ title: 'Payment recorded' });
    setModalOpen(false);
    setForm({ student: '', amount: '', date: '', status: 'Paid', course: '' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Payments</h2>
            <p className="text-muted-foreground text-sm">Track tuition and fee payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export</Button>
            <Button variant="default" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> Record Payment</Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center"><CreditCard className="w-5 h-5 text-success-foreground" /></div>
              <div><div className="text-sm text-muted-foreground">Total Revenue</div><div className="font-display font-bold text-xl text-foreground">₦8,500,000</div></div>
            </div>
          </Card>
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-warning flex items-center justify-center"><TrendingUp className="w-5 h-5 text-warning-foreground" /></div>
              <div><div className="text-sm text-muted-foreground">Pending</div><div className="font-display font-bold text-xl text-foreground">₦1,200,000</div></div>
            </div>
          </Card>
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-destructive flex items-center justify-center"><AlertCircle className="w-5 h-5 text-destructive-foreground" /></div>
              <div><div className="text-sm text-muted-foreground">Overdue</div><div className="font-display font-bold text-xl text-foreground">₦450,000</div></div>
            </div>
          </Card>
        </div>

        <Card className="border-border">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search payments..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Course</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-foreground">{p.student}</td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{p.course}</td>
                    <td className="p-4 text-sm font-medium text-foreground">{p.amount}</td>
                    <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">{p.date}</td>
                    <td className="p-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        p.status === 'Paid' ? 'bg-success/10 text-success' :
                        p.status === 'Pending' ? 'bg-warning/10 text-warning' :
                        'bg-info/10 text-info'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Student Name</Label><Input value={form.student} onChange={e => setForm({...form, student: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Course</Label><Input value={form.course} onChange={e => setForm({...form, course: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Amount (₦)</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Payment Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.student || !form.amount}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminPayments;
