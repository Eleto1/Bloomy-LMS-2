import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const StudentProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
    if (error) toast({ title: 'Error saving profile', description: error.message, variant: 'destructive' });
    else toast({ title: 'Profile saved successfully' });
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">My Profile</h2>
          <p className="text-muted-foreground text-sm">Manage your personal information</p>
        </div>

        <Card className="p-6 border-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">{fullName || 'Student'}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">Student</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</Label>
              <Input defaultValue={user?.email || ''} disabled className="mt-1.5" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." className="mt-1.5" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lagos, Nigeria" className="mt-1.5" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border space-y-4">
          <h3 className="font-display font-semibold text-foreground">About Me</h3>
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Tell us about yourself, your interests, and your goals..."
            value={bio}
            onChange={e => setBio(e.target.value)}
          />
        </Card>

        <Button variant="default" size="lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default StudentProfile;
