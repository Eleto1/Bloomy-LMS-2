import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Megaphone } from 'lucide-react';
import { useState } from 'react';

const existingAnnouncements = [
  { id: 1, title: 'Mid-term Exam Schedule', content: 'Mid-term exams will be held from April 7-11. Please prepare accordingly.', date: '2026-03-20', course: 'All Courses' },
  { id: 2, title: 'Guest Speaker — Friday', content: 'We have a special guest speaker from Google this Friday at 2 PM.', date: '2026-03-18', course: 'Full-Stack Dev' },
  { id: 3, title: 'Assignment Deadline Extended', content: 'The React Portfolio project deadline has been extended to March 28.', date: '2026-03-15', course: 'Full-Stack Dev' },
];

const InstructorAnnouncements = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground">Announcements</h2>
            <p className="text-muted-foreground text-sm">Post updates for your students</p>
          </div>
          <Button variant="default" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        </div>

        {showForm && (
          <Card className="p-6 border-border border-secondary/30 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Create Announcement</h3>
            <div><Label>Title</Label><Input placeholder="Announcement title..." className="mt-1.5" /></div>
            <div><Label>Message</Label><Textarea placeholder="Write your announcement..." className="mt-1.5" rows={4} /></div>
            <div className="flex gap-2">
              <Button variant="default">Post Announcement</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {existingAnnouncements.map((a) => (
            <Card key={a.id} className="p-5 border-border hover:shadow-brand transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-semibold text-foreground">{a.title}</h3>
                    <span className="text-xs text-muted-foreground">{a.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{a.content}</p>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">{a.course}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InstructorAnnouncements;
