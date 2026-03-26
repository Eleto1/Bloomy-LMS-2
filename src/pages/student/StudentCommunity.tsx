import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, ThumbsUp, Users } from 'lucide-react';
import { useState } from 'react';

const discussions = [
  { id: 1, author: 'Chioma Okafor', avatar: 'CO', message: 'Has anyone figured out the Redux middleware challenge? I\'m stuck on the async actions part.', time: '2 hours ago', likes: 5, replies: 3 },
  { id: 2, author: 'Emeka Nwankwo', avatar: 'EN', message: 'Just completed the React Portfolio project! So happy with how it turned out. Happy to help anyone who needs it.', time: '5 hours ago', likes: 12, replies: 7 },
  { id: 3, author: 'Fatima Abdullahi', avatar: 'FA', message: 'Study group for the midterm — who\'s interested? Thinking Saturday 10 AM at the campus library.', time: '1 day ago', likes: 8, replies: 5 },
];

const StudentCommunity = () => {
  const [newPost, setNewPost] = useState('');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Community</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-1"><Users className="w-4 h-4" /> 892 active members</p>
        </div>

        <Card className="p-4 border-border">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">AJ</div>
            <div className="flex-1 flex gap-2">
              <Input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Share something with your community..." className="flex-1" />
              <Button variant="default" size="icon"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {discussions.map((d) => (
            <Card key={d.id} className="p-5 border-border hover:shadow-brand transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">
                  {d.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{d.author}</span>
                    <span className="text-xs text-muted-foreground">{d.time}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-3">{d.message}</p>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-secondary transition-colors">
                      <ThumbsUp className="w-3.5 h-3.5" /> {d.likes}
                    </button>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-secondary transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" /> {d.replies} replies
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentCommunity;
