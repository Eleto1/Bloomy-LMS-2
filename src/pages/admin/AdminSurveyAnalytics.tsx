import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight, Star, Users, Search, Loader2 } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  email: string;
  cohort_id: string;
  cohorts: { name: string; course: string } | null;
}

interface SurveyResponse {
  id: string;
  rating: number;
  feedback: string;
  answers: any;
  created_at: string;
  lesson: { title: string } | null;
  topic: { title: string } | null;
}

export default function AdminSurveyResponses() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');

  // Dynamic Filter Options
  const [cohorts, setCohorts] = useState<{id: string, name: string, course: string}[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([]);

  // Computed Data
  const [programSurveys, setProgramSurveys] = useState<Record<string, string[]>>({}); // program -> [lesson_ids]
  const [userResponses, setUserResponses] = useState<Record<string, string[]>>({}); // user_id -> [lesson_ids]

  // Detail Modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<SurveyResponse[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update Programs when Cohort changes
  useEffect(() => {
    if (selectedCohort === 'all') {
      // If "All Cohorts", show all unique programs from all cohorts
      const allProgs = new Set(cohorts.map(c => c.course));
      setAvailablePrograms(Array.from(allProgs));
    } else {
      // Filter programs by selected cohort
      const filtered = cohorts.filter(c => c.id === selectedCohort).map(c => c.course);
      setAvailablePrograms(filtered);
      // Auto-select program if only one exists
      if (filtered.length === 1) setSelectedProgram(filtered[0]);
    }
  }, [selectedCohort, cohorts]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Cohorts
      const { data: cohortData } = await supabase.from('cohorts').select('id, name, course');
      if (cohortData) setCohorts(cohortData);

      // 2. Fetch Students with Cohort info
      const { data: studentData } = await supabase
        .from('profiles')
        .select('id, full_name, email, cohort_id, cohorts(name, course)')
        .eq('role', 'student');
      
      if (studentData) setStudents(studentData);

      // 3. Fetch Survey Lessons structure (to calculate totals)
      // We need: Lessons (survey) -> Module -> Course (Program)
      const { data: modules } = await supabase.from('modules').select('id, course_id');
      const { data: courses } = await supabase.from('courses').select('id, program');
      
      if (modules && courses) {
        const courseProgramMap: Record<string, string> = {};
        courses.forEach(c => courseProgramMap[c.id] = c.program);

        const moduleCourseMap: Record<string, string> = {};
        modules.forEach(m => moduleCourseMap[m.id] = courseProgramMap[m.course_id] || 'General');

        const { data: lessons } = await supabase.from('lessons').select('id, module_id, type').eq('type', 'survey');
        
        if (lessons) {
          const pMap: Record<string, string[]> = {};
          lessons.forEach(l => {
            const prog = moduleCourseMap[l.module_id] || 'General';
            if (!pMap[prog]) pMap[prog] = [];
            pMap[prog].push(l.id);
          });
          setProgramSurveys(pMap);
        }
      }

      // 4. Fetch all responses to calculate progress locally
      const { data: responses } = await supabase.from('survey_responses').select('user_id, lesson_id');
      if (responses) {
        const rMap: Record<string, string[]> = {};
        responses.forEach(r => {
          if (!rMap[r.user_id]) rMap[r.user_id] = [];
          rMap[r.user_id].push(r.lesson_id);
        });
        setUserResponses(rMap);
      }

    } catch (err) {
      console.error(err);
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    
    const { data, error } = await supabase
      .from('survey_responses')
      .select(`
        id, rating, feedback, answers, created_at,
        lesson:lesson_id (title),
        topic:topic_id (title)
      `)
      .eq('user_id', student.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Could not load details', variant: 'destructive' });
    } else {
      setStudentDetails(data || []);
    }
    setLoadingDetails(false);
  };

  // Filter Logic
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
    const matchesCohort = selectedCohort === 'all' || s.cohort_id === selectedCohort;
    const matchesProgram = selectedProgram === 'all' || s.cohorts?.course === selectedProgram;
    return matchesSearch && matchesCohort && matchesProgram;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Survey Analytics</h2>
            <p className="text-gray-500">Filter by cohort and program to track progress.</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-1">
               <Label className="text-xs text-gray-500">Cohort</Label>
               <Select value={selectedCohort} onValueChange={v => { setSelectedCohort(v); setSelectedProgram('all'); }}>
                 <SelectTrigger className="mt-1"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Cohorts</SelectItem>
                   {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                 </SelectContent>
               </Select>
            </div>

            <div className="relative md:col-span-1">
               <Label className="text-xs text-gray-500">Program</Label>
               <Select value={selectedProgram} onValueChange={setSelectedProgram} disabled={selectedCohort === 'all'}>
                 <SelectTrigger className="mt-1"><SelectValue placeholder="Select Program" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Programs</SelectItem>
                   {availablePrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                 </SelectContent>
               </Select>
            </div>

            <div className="relative md:col-span-2">
              <Label className="text-xs text-gray-500">Search Student</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Name or Email..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* Student List */}
        {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div> : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Cohort</th>
                  <th className="text-left p-3">Program</th>
                  <th className="text-center p-3">Surveys Completed</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-8 text-gray-500">No students found for this selection.</td></tr>
                ) : (
                  filteredStudents.map(student => {
                    const prog = student.cohorts?.course || 'General';
                    const totalSurveys = programSurveys[prog]?.length || 0;
                    const completedSet = new Set(userResponses[student.id] || []);
                    
                    // Calculate how many of the program surveys the student completed
                    const completedCount = programSurveys[prog] 
                      ? programSurveys[prog].filter(lessonId => completedSet.has(lessonId)).length 
                      : 0;

                    return (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium">{student.full_name}</div>
                          <div className="text-xs text-gray-500">{student.email}</div>
                        </td>
                        <td className="p-3 text-gray-600">{student.cohorts?.name}</td>
                        <td className="p-3 text-gray-600">{prog}</td>
                        <td className="p-3 text-center">
                          <span className={`font-bold ${completedCount === totalSurveys && totalSurveys > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                            {completedCount} / {totalSurveys}
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 mx-auto max-w-[100px]">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${totalSurveys > 0 ? (completedCount/totalSurveys)*100 : 0}%` }}></div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleViewStudent(student)}>
                            View Responses <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Student Detail Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name}'s Responses</DialogTitle>
            <DialogDescription>
              Program: {selectedStudent?.cohorts?.course} | Cohort: {selectedStudent?.cohorts?.name}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
            <div className="space-y-4 mt-4">
              {studentDetails.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No detailed responses found.</p>
              ) : (
                studentDetails.map(resp => (
                  <Card key={resp.id} className="p-4 border bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold">{resp.lesson?.title || 'Survey'}</h4>
                        <p className="text-xs text-gray-500">Topic: {resp.topic?.title || 'N/A'}</p>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-yellow-500">
                        <Star className="w-4 h-4 fill-current" /> {resp.rating}/5
                      </div>
                    </div>
                    
                    {resp.feedback && (
                      <div className="mt-2 pt-2 border-t">
                        <Label className="text-xs text-gray-500">General Feedback</Label>
                        <p className="text-sm mt-1 p-2 bg-white rounded border">{resp.feedback}</p>
                      </div>
                    )}

                    {resp.answers && Object.keys(resp.answers).length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <Label className="text-xs text-gray-500">Detailed Answers</Label>
                        <div className="mt-1 space-y-2">
                          {Object.entries(resp.answers).map(([q, a]) => (
                            <div key={q} className="text-xs bg-white p-2 rounded border">
                              <div className="font-medium text-gray-800 mb-1">{q}</div>
                              <div className="text-gray-600">{String(a)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}