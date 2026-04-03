import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, Eye, CheckCircle, Clock, FileText, Video,
  HelpCircle, ClipboardList, Globe, RefreshCw, BarChart3, Award,
  ChevronUp, ChevronDown, Download, Users, TrendingUp, Target,
  GraduationCap, Circle, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  email: string;
  cohort_id: string;
  cohorts: { name: string }[] | null;
}

interface Cohort { id: string; name: string; course: string; }
interface Course { id: string; title: string; program: string; }
interface Lesson { id: string; title: string; type: string; module_id: string; moduleTitle?: string; }
interface ProgressRow { lesson_id: string; completed: boolean; score?: number | null; }

const LESSON_ICONS: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4 text-blue-500" />,
  video: <Video className="w-4 h-4 text-purple-500" />,
  quiz: <HelpCircle className="w-4 h-4 text-amber-500" />,
  survey: <ClipboardList className="w-4 h-4 text-emerald-500" />,
  assignment: <ClipboardList className="w-4 h-4 text-rose-500" />,
  url: <Globe className="w-4 h-4 text-cyan-500" />,
};

function getInitials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
}

function initialsBg(name: string): string {
  const palette = [
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function scoreClr(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  if (score > 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function barClr(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct > 0) return 'bg-orange-500';
  return 'bg-muted-foreground/20';
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct === 100)
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 px-2.5 py-0.5 text-[11px]">
        <CheckCircle2 className="w-3 h-3" /> Completed
      </Badge>
    );
  if (pct > 0)
    return (
      <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 text-[11px]">
        <Clock className="w-3 h-3" /> In Progress
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1 px-2.5 py-0.5 text-[11px]">
      <Circle className="w-3 h-3" /> Not Started
    </Badge>
  );
}

const ACCENTS: Record<string, { border: string; bg: string; fg: string }> = {
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400' },
  amber:   { border: 'border-l-amber-500',   bg: 'bg-amber-500/10',   fg: 'text-amber-600 dark:text-amber-400' },
  violet:  { border: 'border-l-violet-500',   bg: 'bg-violet-500/10',   fg: 'text-violet-600 dark:text-violet-400' },
  rose:    { border: 'border-l-rose-500',     bg: 'bg-rose-500/10',     fg: 'text-rose-600 dark:text-rose-400' },
  cyan:    { border: 'border-l-cyan-500',     bg: 'bg-cyan-500/10',     fg: 'text-cyan-600 dark:text-cyan-400' },
};

function KPICard({ icon, label, value, suffix, accent }: {
  icon: React.ReactNode; label: string; value: number | string; suffix?: string; accent: string;
}) {
  const a = ACCENTS[accent] || ACCENTS.emerald;
  return (
    <div className={`rounded-lg border-l-4 ${a.border} bg-card shadow-sm p-4`}>
      <div className={`inline-flex rounded-md p-1.5 mb-2 ${a.bg} ${a.fg}`}>{icon}</div>
      <p className="text-lg font-bold tabular-nums">
        {value}
        {suffix && <span className="text-xs font-semibold text-muted-foreground ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function AdminProgress() {
  const [filterCohortName, setFilterCohortName] = useState<string>('all');
  const [filterProgramName, setFilterProgramName] = useState<string>('all');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { completed: number; total: number; avgScore: number }>>({});

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [studentLessons, setStudentLessons] = useState<Lesson[]>([]);
  const [studentProgress, setStudentProgress] = useState<ProgressRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    const fetchBase = async () => {
      setLoading(true);
      try {
        const [cohortRes, courseRes] = await Promise.all([
          supabase.from('cohorts').select('id, name, course').order('name'),
          supabase.from('courses').select('id, title, program')
        ]);
        setCohorts(cohortRes.data || []);
        setCourses(courseRes.data || []);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchBase();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, full_name, email, cohort_id, cohorts!cohort_id(name)')
          .eq('role', 'student');

        if (filterCohortName !== 'all') {
          const ids = cohorts.filter(c => c.name === filterCohortName).map(c => c.id);
          if (ids.length) query = query.in('cohort_id', ids);
        }

        const { data: studentData } = await query;
        if (!studentData) return;
        setStudents(studentData);

        const studentIds = studentData.map(s => s.id);
        const { data: allProgress } = await supabase
          .from('lesson_progress')
          .select('user_id, completed, score')
          .in('user_id', studentIds);

        const map: Record<string, any> = {};

        for (const student of studentData) {
          const cohort = cohorts.find(c => c.id === student.cohort_id);
          const course = courses.find(c =>
            c.program?.toLowerCase().trim() === cohort?.course?.toLowerCase().trim()
          );
          if (!course) {
            map[student.id] = { completed: 0, total: 0, avgScore: 0 };
            continue;
          }

          const { data: mods } = await supabase.from('modules').select('id').eq('course_id', course.id);
          const modIds = mods?.map(m => m.id) || [];
          const { data: lessons } = await supabase
            .from('lessons')
            .select('id')
            .in('module_id', modIds)
            .neq('type', 'header');

          const total = lessons?.length || 0;
          const prog = (allProgress || []).filter(p => p.user_id === student.id);
          const completed = prog.filter(p => p.completed).length;
          const scored = prog.filter(p => p.score !== null);
          const avgScore = scored.length
            ? Math.round(scored.reduce((sum, p) => sum + (p.score || 0), 0) / scored.length)
            : 0;

          map[student.id] = { completed, total, avgScore };
        }

        setProgressMap(map);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [filterCohortName, cohorts, courses]);

  const filteredStudents = students.filter(s =>
    !searchText ||
    s.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchText.toLowerCase())
  );

  useEffect(() => { setPage(1); }, [filterCohortName, filterProgramName, searchText]);

  const enriched = filteredStudents.map(s => {
    const cohortName = s.cohorts?.[0]?.name || '—';
    const prog = progressMap[s.id] || { completed: 0, total: 0, avgScore: 0 };
    const percent = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
    return { ...s, _cohortName: cohortName, _percent: percent, _prog: prog };
  });

  const sorted = [...enriched].sort((a, b) => {
    let c = 0;
    if (sortField === 'name') c = a.full_name.localeCompare(b.full_name);
    else if (sortField === 'cohort') c = a._cohortName.localeCompare(b._cohortName);
    else if (sortField === 'progress') c = a._percent - b._percent;
    else if (sortField === 'score') c = a._prog.avgScore - b._prog.avgScore;
    else if (sortField === 'status')
      c = (a._percent === 100 ? 0 : a._percent > 0 ? 1 : 2) - (b._percent === 100 ? 0 : b._percent > 0 ? 1 : 2);
    return sortDir === 'asc' ? c : -c;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pageRows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (f: string) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  const kpis = {
    total: filteredStudents.length,
    avgProg: filteredStudents.length
      ? Math.round(enriched.reduce((s, r) => s + r._percent, 0) / filteredStudents.length)
      : 0,
    avgScr: filteredStudents.length
      ? Math.round(enriched.reduce((s, r) => s + r._prog.avgScore, 0) / filteredStudents.length)
      : 0,
    compRate: filteredStudents.length
      ? Math.round(enriched.filter(r => r._percent === 100).length / filteredStudents.length * 100)
      : 0,
    cohorts: new Set(filteredStudents.map(s => s.cohort_id)).size,
  };

  const openDetails = async (student: Student) => {
    setSelectedStudent(student);
    setDetailsOpen(true);
    setLoadingDetails(true);

    try {
      const cohort = cohorts.find(c => c.id === student.cohort_id);
      const course = courses.find(c =>
        c.program?.toLowerCase().trim() === cohort?.course?.toLowerCase().trim()
      );
      if (!course) return;

      const { data: mods } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', course.id)
        .order('order_index');

      const modIds = mods?.map(m => m.id) || [];
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, title, type, module_id')
        .in('module_id', modIds)
        .order('order_index');

      const lessonsWithModule = (lessonData || []).map(l => ({
        ...l,
        moduleTitle: mods?.find(m => m.id === l.module_id)?.title || 'Unknown Module'
      }));

      setStudentLessons(lessonsWithModule);

      const { data: progData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed, score')
        .eq('user_id', student.id);

      setStudentProgress(progData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getLessonStatus = (lessonId: string) => {
    const p = studentProgress.find(pr => pr.lesson_id === lessonId);
    if (!p) return { text: 'Not Started', icon: <Clock className="w-4 h-4 text-muted-foreground" /> };
    if (p.completed) return { text: 'Completed', icon: <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> };
    return { text: 'In Progress', icon: <Clock className="w-4 h-4 text-amber-500" /> };
  };

  const groupedLessons = studentLessons.reduce((acc: any, lesson) => {
    const key = lesson.moduleTitle || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(lesson);
    return acc;
  }, {});

  const _completed = studentLessons.filter(l => studentProgress.find(pr => pr.lesson_id === l.id)?.completed).length;
  const _detailPct = studentLessons.length ? Math.round(_completed / studentLessons.length * 100) : 0;
  const _detailAvg = (() => {
    const scored = studentProgress.filter(p => p.score !== null && p.score !== undefined);
    return scored.length ? Math.round(scored.reduce((s, p) => s + (p.score || 0), 0) / scored.length) : 0;
  })();
  const _moduleStats = Object.entries(groupedLessons).map(([name, lessons]: [string, any]) => ({
    name,
    done: (lessons as Lesson[]).filter(l => studentProgress.find(pr => pr.lesson_id === l.id)?.completed).length,
    total: (lessons as Lesson[]).length,
  }));

  const exportCSV = () => {
    const h = ['Name', 'Email', 'Cohort', 'Progress %', 'Avg Score'];
    const rows = sorted.map(r => [r.full_name, r.email, r._cohortName, r._percent, r._prog.avgScore]);
    const csv = [h.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'progress.csv';
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 sm:p-8 bg-background min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded-md animate-pulse" />
              <div className="h-3.5 w-64 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-14 bg-muted rounded-lg animate-pulse mt-6" />
          <div className="bg-card rounded-lg border overflow-hidden shadow-sm mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/50 border-b last:border-b-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 sm:p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Student Progress
            </h1>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Real-time completion, scores &amp; detailed lesson tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
              {students.length} students · just now
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard icon={<Users className="w-4 h-4" />} label="Total Students" value={kpis.total} accent="emerald" />
          <KPICard icon={<TrendingUp className="w-4 h-4" />} label="Avg Progress" value={kpis.avgProg} suffix="%" accent="amber" />
          <KPICard icon={<Target className="w-4 h-4" />} label="Avg Score" value={kpis.avgScr} suffix="%" accent="violet" />
          <KPICard icon={<Award className="w-4 h-4" />} label="Completion Rate" value={kpis.compRate} suffix="%" accent="rose" />
          <KPICard icon={<GraduationCap className="w-4 h-4" />} label="Active Cohorts" value={kpis.cohorts} accent="cyan" />
        </div>

        <Card className="p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cohort</Label>
              <Select value={filterCohortName} onValueChange={setFilterCohortName}>
                <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="All Cohorts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {Array.from(new Set(cohorts.map(c => c.name))).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Program</Label>
              <Select value={filterProgramName} onValueChange={setFilterProgramName}>
                <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="All Programs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {Array.from(new Set(cohorts.map(c => c.course))).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Course</Label>
              <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="All Courses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Search Student</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Name or email..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border shadow-sm">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {([
                    ['name', 'Student'],
                    ['cohort', 'Cohort'],
                    ['progress', 'Progress'],
                    ['score', 'Score'],
                    ['status', 'Status'],
                  ] as const).map(([field, label]) => (
                    <TableHead
                      key={field}
                      className={`text-[11px] font-semibold text-muted-foreground cursor-pointer select-none hover:bg-muted transition-colors ${field === 'score' || field === 'status' ? 'text-center' : ''}`}
                      onClick={() => toggleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortField === field
                          ? sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3 text-foreground" />
                            : <ChevronDown className="w-3 h-3 text-foreground" />
                          : <ChevronUp className="w-3 h-3 text-muted-foreground/40" />
                        }
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-[11px] font-semibold text-muted-foreground">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded-full bg-muted p-3">
                          <Search className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No students found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((student) => {
                    const cohortName = student.cohorts?.[0]?.name || '—';
                    const prog = progressMap[student.id] || { completed: 0, total: 0, avgScore: 0 };
                    const percent = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;

                    return (
                      <TableRow
                        key={student.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${initialsBg(student.full_name)}`}
                            >
                              {getInitials(student.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal text-[11px]">{cohortName}</Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5 min-w-[130px]">
                            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${barClr(percent)}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium tabular-nums w-9 text-right text-foreground">
                              {percent}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold tabular-nums ${scoreClr(prog.avgScore)}`}>
                            {prog.avgScore > 0 ? `${prog.avgScore}%` : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge pct={percent} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetails(student)}
                            className="hover:bg-accent hover:text-accent-foreground opacity-60 group-hover:opacity-100 transition-opacity text-xs h-8 px-3"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden">
            {pageRows.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="rounded-full bg-muted p-3"><Search className="w-5 h-5 text-muted-foreground" /></div>
                <p className="text-sm font-medium text-foreground mt-2">No students found</p>
              </div>
            ) : pageRows.map((student) => {
              const cohortName = student.cohorts?.[0]?.name || '—';
              const prog = progressMap[student.id] || { completed: 0, total: 0, avgScore: 0 };
              const percent = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;

              return (
                <div key={student.id} className="border-b p-3.5 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${initialsBg(student.full_name)}`}>
                        {getInitials(student.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                      </div>
                    </div>
                    <StatusBadge pct={percent} />
                  </div>
                  <div className="mb-2">
                    <Badge variant="secondary" className="text-[11px]">{cohortName}</Badge>
                  </div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barClr(percent)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium tabular-nums w-9 text-right">{percent}%</span>
                    <span className={`text-[11px] font-medium tabular-nums ${scoreClr(prog.avgScore)}`}>
                      {prog.avgScore > 0 ? `${prog.avgScore}%` : '—'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDetails(student)} className="w-full gap-1.5 text-xs h-8">
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </Button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 px-2 text-xs">
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-7 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-7 px-2 text-xs">
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* DETAIL MODAL */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden gap-0">
            <div className="shrink-0 border-b px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  {selectedStudent && (
                    <div className={`flex w-11 h-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${initialsBg(selectedStudent.full_name)}`}>
                      {getInitials(selectedStudent.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                        {selectedStudent?.full_name}
                      </DialogTitle>
                      <StatusBadge pct={_detailPct} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{selectedStudent?.email}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <Badge variant="secondary" className="text-[11px] h-5">{selectedStudent?.cohorts?.[0]?.name}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedStudent && openDetails(selectedStudent)}
                    className="gap-1.5 shrink-0 text-xs h-8"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>
              </DialogHeader>
            </div>

            {loadingDetails ? (
              <div className="flex-1 flex items-center justify-center py-24">
                <Loader2 className="animate-spin w-5 h-5 text-primary" />
              </div>
            ) : (
              <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                <div className="shrink-0 px-6 pt-4 pb-0">
                  <TabsList className="grid grid-cols-2 w-full h-9">
                    <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
                      <BarChart3 className="w-3.5 h-3.5" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="lessons" className="flex items-center gap-1.5 text-xs">
                      <Award className="w-3.5 h-3.5" /> Lesson Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="flex-1 overflow-auto mt-4 px-6 pb-6">
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    <div className="rounded-lg bg-muted/40 border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Score</p>
                      <p className="text-lg font-bold tabular-nums leading-none">
                        <span className={scoreClr(_detailAvg)}>{_detailAvg > 0 ? _detailAvg : '—'}</span>
                        <span className="text-[11px] font-medium text-muted-foreground ml-0.5">%</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Completed</p>
                      <p className="text-lg font-bold tabular-nums text-foreground leading-none">
                        {_completed}<span className="text-[11px] font-medium text-muted-foreground ml-1">/ {studentLessons.length}</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Highest</p>
                      <p className="text-lg font-bold tabular-nums leading-none">
                        {(() => {
                          const s = studentProgress.filter(p => p.score != null).map(p => p.score!);
                          return s.length ? <span className={scoreClr(Math.max(...s))}>{Math.max(...s)}</span> : <span className="text-muted-foreground">—</span>;
                        })()}<span className="text-[11px] font-medium text-muted-foreground ml-0.5">%</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lowest</p>
                      <p className="text-lg font-bold tabular-nums leading-none">
                        {(() => {
                          const s = studentProgress.filter(p => p.score != null).map(p => p.score!);
                          return s.length ? <span className={scoreClr(Math.min(...s))}>{Math.min(...s)}</span> : <span className="text-muted-foreground">—</span>;
                        })()}<span className="text-[11px] font-medium text-muted-foreground ml-0.5">%</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-12 lg:col-span-4">
                      <div className="rounded-xl border bg-card p-5 text-center">
                        <div className="mx-auto w-28 h-28 relative flex items-center justify-center">
                          <svg className="w-28 h-28 rotate-[-90deg]" viewBox="0 0 42 42">
                            <circle cx="21" cy="21" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
                            <circle
                              cx="21" cy="21" r="15" fill="none"
                              stroke="#10b981"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 15}`}
                              strokeDashoffset={`${2 * Math.PI * 15 * (1 - _detailPct / 100)}`}
                              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                            />
                          </svg>
                          <div className="absolute text-center">
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{_detailPct}%</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2.5">Overall Progress</p>
                      </div>
                    </div>

                    <div className="col-span-12 lg:col-span-8">
                      <div className="rounded-xl border bg-card divide-y">
                        {_moduleStats.map(m => {
                          const pct = m.total > 0 ? Math.round(m.done / m.total * 100) : 0;
                          const isComplete = pct === 100;
                          return (
                            <div key={m.name} className="px-4 py-3 flex items-center gap-3">
                              <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{pct}%</span>}
                              </div>
                              <span className="text-sm text-foreground truncate min-w-0 flex-1">{m.name}</span>
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                <div className={`h-full rounded-full transition-all duration-700 ${barClr(pct)}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] tabular-nums text-muted-foreground w-12 text-right shrink-0">{m.done}/{m.total}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="lessons" className="flex-1 overflow-auto mt-4 px-6 pb-6">
                  {Object.entries(groupedLessons).map(([moduleTitle, lessons]: [string, any]) => {
                    const done = (lessons as Lesson[]).filter(l => studentProgress.find(pr => pr.lesson_id === l.id)?.completed).length;
                    const total = (lessons as Lesson[]).length;
                    const pct = total > 0 ? Math.round(done / total * 100) : 0;
                    const isModuleComplete = done === total;

                    return (
                      <div key={moduleTitle} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2.5 mb-2 px-1">
                          {isModuleComplete
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                          }
                          <span className="text-sm font-semibold text-foreground flex-1 truncate">{moduleTitle}</span>
                          <span className={`text-[11px] tabular-nums font-medium ${isModuleComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {done}/{total} complete
                          </span>
                          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barClr(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="rounded-lg border bg-card divide-y overflow-hidden">
                          {(lessons as Lesson[]).map(lesson => {
                            const status = getLessonStatus(lesson.id);
                            const p = studentProgress.find(pr => pr.lesson_id === lesson.id);
                            const isDone = status.text === 'Completed';

                            return (
                              <div
                                key={lesson.id}
                                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isDone ? 'bg-emerald-500/[0.03]' : ''}`}
                              >
                                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                                  {isDone
                                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    : status.text === 'In Progress'
                                      ? <Clock className="w-4 h-4 text-amber-500" />
                                      : <div className="w-2 h-2 rounded-full bg-muted-foreground/25" />
                                  }
                                </div>
                                <div className="shrink-0">{LESSON_ICONS[lesson.type] || <FileText className="w-4 h-4" />}</div>
                                <span className={`text-sm flex-1 truncate min-w-0 ${isDone ? 'text-foreground/70' : 'text-foreground'}`}>
                                  {lesson.title}
                                </span>
                                {p?.score != null && p?.score !== undefined ? (
                                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${scoreClr(p.score)}`}>{p.score}%</span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}