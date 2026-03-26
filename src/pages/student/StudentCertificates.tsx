import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Download, ExternalLink } from 'lucide-react';

const certificates = [
  { id: 1, title: 'Introduction to Programming', issueDate: '2025-12-15', credential: 'BT-2025-ITP-0042', status: 'earned' },
  { id: 2, title: 'Full-Stack Web Development', issueDate: null, credential: null, status: 'in-progress', progress: 78 },
  { id: 3, title: 'Database Design & SQL', issueDate: null, credential: null, status: 'in-progress', progress: 92 },
];

const StudentCertificates = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Certificates</h2>
        <p className="text-muted-foreground text-sm">Your earned and upcoming certifications</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((c) => (
          <Card key={c.id} className="border-border overflow-hidden hover:shadow-brand transition-shadow">
            <div className={`h-36 flex items-center justify-center p-4 ${c.status === 'earned' ? 'gradient-accent' : 'bg-muted'}`}>
              <Award className={`w-16 h-16 ${c.status === 'earned' ? 'text-accent-foreground' : 'text-muted-foreground/30'}`} />
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-display font-semibold text-foreground">{c.title}</h3>
              {c.status === 'earned' ? (
                <>
                  <p className="text-xs text-muted-foreground">Issued: {c.issueDate}</p>
                  <p className="text-xs text-muted-foreground">Credential: {c.credential}</p>
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" className="flex-1"><Download className="w-3.5 h-3.5" /> Download</Button>
                    <Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span><span>{(c as any).progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="gradient-accent h-2 rounded-full" style={{ width: `${(c as any).progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Complete the course to earn this certificate</p>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default StudentCertificates;
