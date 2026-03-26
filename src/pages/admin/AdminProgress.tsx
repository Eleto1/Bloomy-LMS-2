import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminProgress() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Student Progress</h1>
        <Card>
          <CardHeader><CardTitle>Progress Tracking</CardTitle></CardHeader>
          <CardContent>
            <p className="text-gray-500">Detailed student progress tracking will appear here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}