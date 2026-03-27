import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  cohorts: { name: string } | null;
}

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at, cohorts(name)')
        .eq('role', 'student');
      
      if (error) throw error;
      if (data) setStudents(data as Student[]);
    } catch (err: any) {
      toast({ title: 'Error fetching students', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students</h1>
        <Link to="/register">
          <Button><UserPlus className="w-4 h-4 mr-2" /> Add Student</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-gray-400" />
          <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    <Loader2 className="animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-gray-500 font-medium">No students found.</p>
                      <p className="text-xs text-gray-400">Click "Add Student" to register a new user.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || 'No Name'}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>{s.cohorts?.name || 'Unassigned'}</TableCell>
                    <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}