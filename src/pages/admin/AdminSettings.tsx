import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const AdminSettings = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm">Configure your institute settings</p>
      </div>

      <Card className="p-6 border-border space-y-6">
        <h3 className="font-display font-semibold text-foreground">Institute Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Institute Name</Label><Input defaultValue="Bloomy Technologies" className="mt-1.5" /></div>
          <div><Label>Email</Label><Input defaultValue="info@bloomytech.ng" className="mt-1.5" /></div>
          <div><Label>Phone</Label><Input defaultValue="+234 801 234 5678" className="mt-1.5" /></div>
          <div><Label>Location</Label><Input defaultValue="Lagos, Nigeria" className="mt-1.5" /></div>
        </div>
      </Card>

      <Card className="p-6 border-border space-y-4">
        <h3 className="font-display font-semibold text-foreground">Notifications</h3>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-medium text-foreground">Email Notifications</div><div className="text-xs text-muted-foreground">Send email for new enrollments</div></div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-medium text-foreground">Payment Alerts</div><div className="text-xs text-muted-foreground">Alert on payment received or overdue</div></div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-medium text-foreground">Course Updates</div><div className="text-xs text-muted-foreground">Notify when courses are updated</div></div>
          <Switch />
        </div>
      </Card>

      <Button variant="default" size="lg">Save Changes</Button>
    </div>
  </DashboardLayout>
);

export default AdminSettings;
