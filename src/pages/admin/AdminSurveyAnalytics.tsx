import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, Eye, CheckCircle2, Clock, Download, Star,
  ChevronRight, ChevronLeft, Users, BarChart3, ClipboardList, AlertCircle,
  TrendingUp, Award, Circle, MessageSquare,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES  (your exact interfaces — untouched)
// ─────────────────────────────────────────────────────────────────────────────
interface Cohort    { id: string; name: string; course: string; }
interface Course    { id: string; title: string; program: string; }
interface Lesson    { id: string; title: string; type: string; module_id: string; content: string; quiz_data?: any[]; }
interface Student   { id: string; full_name: string; email: string; cohort_id: string; }
interface SurveyResponse {
  id: string; user_id: string; lesson_id: string;
  answers: any[]; rating: number | null; created_at: string;
}

interface Topic {
  headerId: string;
  headerTitle: string;
  surveys: Lesson[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
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

function ratingClr(rating: number | null): string {
  if (rating === null || rating === undefined) return 'text-muted-foreground';
  if (rating >= 4) return 'text-emerald-600 dark:text-emerald-400';
  if (rating >= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function completionClr(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct > 0) return 'bg-orange-500';
  return 'bg-muted-foreground/20';
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Star display
// ─────────────────────────────────────────────────────────────────────────────
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25 fill-muted-foreground/25'}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Answer display in detail modal
// ─────────────────────────────────────────────────────────────────────────────
function AnswerDisplay({ answer }: { answer: any }) {
  if (!answer) return <span className="text-muted-foreground italic text-xs">No answer</span>;

  if (answer.type === 'rating') return (
    <div className="flex items-center gap-2">
      <StarRating value={Number(answer.answer)} />
      <span className="text-sm font-medium text-foreground">
        {answer.answer}/5 {answer.label ? `— ${answer.label}` : ''}
      </span>
    </div>
  );

  if (answer.type === 'multiple_choice') return (
    <span className="text-sm text-foreground">
      {answer.optionText || `Option ${answer.answer}`}
    </span>
  );

  return <span className="text-sm text-foreground whitespace-pre-wrap">{String(answer.answer)}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT  (data logic completely untouched)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminSurveyAnalytics() {
  // ── Your exact filter state ───────────────────────────────────────────────
  const [filterCohortName,   setFilterCohortName]   = useState('all');
  const [filterProgram,      setFilterProgram]       = useState('all');
  const [filterCourseId,     setFilterCourseId]      = useState('all');
  const [filterTopicId,      setFilterTopicId]       = useState('all');
  const [searchText,         setSearchText]          = useState('');

  // ── Your exact data state ────────────────────────────────────────────────
  const [cohorts,   setCohorts]   = useState<Cohort[]>([]);
  const [courses,   setCourses]   = useState<Course[]>([]);
  const [allLessons,setAllLessons]= useState<Lesson[]>([]);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [topics,    setTopics]    = useState<Topic[]>([]);

  // ── Your exact UI state ──────────────────────────────────────────────────
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingData,    setLoadingData]    = useState(false);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailStudent,  setDetailStudent]  = useState<Student | null>(null);
  const [detailTopic,    setDetailTopic]    = useState<Topic | null>(null);

  const { toast } = useToast();

  // ── Your exact load cohorts useEffect ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingFilters(true);
      const { data } = await supabase.from('cohorts').select('id, name, course').order('name');
      setCohorts(data || []);
      setLoadingFilters(false);
    };
    load();
  }, []);

  // ── Your exact derived filter options ─────────────────────────────────────
  const uniqueCohortNames = Array.from(new Set(cohorts.map(c => c.name)));
  const availablePrograms = filterCohortName !== 'all'
    ? Array.from(new Set(cohorts.filter(c => c.name === filterCohortName).map(c => c.course)))
    : Array.from(new Set(cohorts.map(c => c.course)));

  // ── Your exact reset cascades ─────────────────────────────────────────────
  useEffect(() => { setFilterProgram('all'); }, [filterCohortName]);
  useEffect(() => { setFilterCourseId('all'); }, [filterProgram]);
  useEffect(() => { setFilterTopicId('all'); }, [filterCourseId]);

  // ── Your exact load courses useEffect ─────────────────────────────────────
  useEffect(() => {
    if (filterProgram === 'all') { setCourses([]); return; }
    supabase.from('courses').select('id, title, program').eq('program', filterProgram)
      .then(({ data }) => setCourses(data || []));
  }, [filterProgram]);

  // ── Your exact main data load useEffect ───────────────────────────────────
  useEffect(() => {
    if (filterCourseId === 'all' || filterCohortName === 'all') {
      setAllLessons([]); setStudents([]); setResponses([]); setTopics([]);
      return;
    }

    const load = async () => {
      setLoadingData(true);
      try {
        const cohortIds = cohorts.filter(c => c.name === filterCohortName).map(c => c.id);
        const { data: studs } = await supabase
          .from('profiles').select('id, full_name, email, cohort_id')
          .eq('role', 'student').in('cohort_id', cohortIds);
        setStudents(studs || []);

        const { data: mods } = await supabase.from('modules').select('id').eq('course_id', filterCourseId);
        if (!mods?.length) { setLoadingData(false); return; }

        const { data: lessData } = await supabase
          .from('lessons').select('id, title, type, module_id, content, quiz_data')
          .in('module_id', mods.map(m => m.id))
          .in('type', ['header', 'survey'])
          .order('order_index');

        const less = lessData || [];
        setAllLessons(less);

        const headers = less.filter(l => l.type === 'header');
        const surveys  = less.filter(l => l.type === 'survey');

        const topicMap: Record<string, Topic> = {};
        headers.forEach(h => {
          topicMap[h.id] = { headerId: h.id, headerTitle: h.title, surveys: [] };
        });

        surveys.forEach(s => {
          if (s.content && topicMap[s.content]) {
            topicMap[s.content].surveys.push(s);
          } else {
            if (!topicMap['__general__']) {
              topicMap['__general__'] = { headerId: '__general__', headerTitle: 'General', surveys: [] };
            }
            topicMap['__general__'].surveys.push(s);
          }
        });

        const topicList = Object.values(topicMap).filter(t => t.surveys.length > 0);
        setTopics(topicList);

        const surveyLessonIds = surveys.map(l => l.id);
        const studentIds      = (studs || []).map(s => s.id);

        if (surveyLessonIds.length > 0 && studentIds.length > 0) {
          const { data: respData } = await supabase
            .from('survey_responses').select('*')
            .in('user_id', studentIds)
            .in('lesson_id', surveyLessonIds);
          setResponses(respData || []);
        } else {
          setResponses([]);
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      } finally { setLoadingData(false); }
    };

    load();
  }, [filterCourseId, filterCohortName, cohorts]);

  // ── Your exact derived analytics ──────────────────────────────────────────
  const getTopicStats = (topic: Topic) => {
    const surveyIds = topic.surveys.map(s => s.id);
    const relevantResps = responses.filter(r => surveyIds.includes(r.lesson_id));
    const submittedStudentIds = new Set(relevantResps.map(r => r.user_id));
    const totalStudents = students.length;
    const submitted     = submittedStudentIds.size;

    const ratings = relevantResps.map(r => r.rating).filter((r): r is number => r !== null && r !== undefined);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return { submitted, totalStudents, completionPct: totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0, avgRating, totalResponses: relevantResps.length };
  };

  const getStudentTopicStatus = (student: Student, topic: Topic) => {
    const surveyIds = topic.surveys.map(s => s.id);
    const studentResps = responses.filter(r => r.user_id === student.id && surveyIds.includes(r.lesson_id));
    if (studentResps.length === 0) return { submitted: false, rating: null, latestResp: null };
    const latest = studentResps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const ratings = studentResps.map(r => r.rating).filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
    return { submitted: true, rating: avgRating, latestResp: latest, allResps: studentResps };
  };

  const activeTopic = filterTopicId === 'all' ? null : topics.find(t => t.headerId === filterTopicId) ?? null;

  const filteredStudents = students.filter(s =>
    searchText ? s.full_name.toLowerCase().includes(searchText.toLowerCase()) || s.email.toLowerCase().includes(searchText.toLowerCase()) : true
  );

  const overallStats = (() => {
    const surveyIds = allLessons.filter(l => l.type === 'survey').map(l => l.id);
    const relevantResps = responses.filter(r => surveyIds.includes(r.lesson_id));
    const ratings = relevantResps.map(r => r.rating).filter((r): r is number => r !== null);
    const submittedStudentIds = new Set(relevantResps.map(r => r.user_id));
    return {
      totalTopics:     topics.length,
      totalResponses:  relevantResps.length,
      studentsWhoFilled: submittedStudentIds.size,
      avgRating: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    };
  })();

  // ── Your exact exportCSV ──────────────────────────────────────────────────
  const exportCSV = () => {
    const rows: string[][] = [['Student', 'Email', 'Topic', 'Submitted', 'Rating', 'Date']];
    topics.forEach(topic => {
      students.forEach(s => {
        const status = getStudentTopicStatus(s, topic);
        rows.push([
          s.full_name, s.email, topic.headerTitle,
          status.submitted ? 'Yes' : 'No',
          status.rating !== null ? String(status.rating) : '—',
          status.latestResp ? new Date(status.latestResp.created_at).toLocaleDateString() : '—',
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'bloomy_survey_analytics.csv';
    a.click();
  };

  // ── Your exact openDetail ────────────────────────────────────────────────
  const openDetail = (student: Student, topic: Topic) => {
    setDetailStudent(student);
    setDetailTopic(topic);
    setDetailOpen(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER  — visual layer only
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 p-6 sm:p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Survey Analytics
            </h1>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Track student feedback by topic and cohort
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={students.length === 0} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <Card className="p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                1 · Cohort
              </Label>
              <Select value={filterCohortName} onValueChange={setFilterCohortName} disabled={loadingFilters}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Cohort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {uniqueCohortNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                2 · Program
              </Label>
              <Select value={filterProgram} onValueChange={setFilterProgram} disabled={filterCohortName === 'all'}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {availablePrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                3 · Course
              </Label>
              <Select value={filterCourseId} onValueChange={setFilterCourseId} disabled={filterProgram === 'all'}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                4 · Topic
              </Label>
              <Select value={filterTopicId} onValueChange={setFilterTopicId} disabled={filterCourseId === 'all' || topics.length === 0}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Topics" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics (Summary)</SelectItem>
                  {topics.map(t => <SelectItem key={t.headerId} value={t.headerId}>{t.headerTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Name or email..." className="pl-9 h-9 text-sm" value={searchText}
                  onChange={e => setSearchText(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Prompt to select filters ─────────────────────────────────── */}
        {filterCourseId === 'all' && !loadingData && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
                <ClipboardList className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Select a Cohort → Program → Course to view analytics</p>
              <p className="text-xs text-muted-foreground mt-1">Then optionally filter by a specific topic</p>
            </CardContent>
          </Card>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loadingData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="bg-muted rounded-lg h-48 animate-pulse" />
          </div>
        )}

        {/* ── Stats row ───────────────────────────────────────────────── */}
        {!loadingData && filterCourseId !== 'all' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Survey Topics',    value: overallStats.totalTopics,      icon: BarChart3,    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', border: 'border-l-indigo-500' },
              { label: 'Total Students',   value: students.length,               icon: Users,        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',     border: 'border-l-blue-500' },
              { label: 'Filled Surveys',   value: overallStats.studentsWhoFilled,icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500' },
              { label: 'Avg Rating',       value: overallStats.avgRating !== null ? `${overallStats.avgRating}/5` : '—', icon: Star, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', border: 'border-l-amber-500' },
            ].map(({ label, value, icon: Icon, color, border }) => (
              <div key={label} className={`rounded-lg border-l-4 ${border} bg-card shadow-sm p-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
                    <p className="text-lg font-bold tabular-nums mt-1">{value}</p>
                  </div>
                  <div className={`rounded-md p-1.5 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ALL TOPICS: summary cards
            ═══════════════════════════════════════════════════════════════ */}
        {!loadingData && filterCourseId !== 'all' && filterTopicId === 'all' && topics.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-foreground">Topics Overview</h2>
              <span className="text-[11px] text-muted-foreground">{topics.length} topic{topics.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {topics.map((topic) => {
                const stats = getTopicStats(topic);
                return (
                  <Card key={topic.headerId} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{topic.headerTitle}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{topic.surveys.length} survey{topic.surveys.length !== 1 ? 's' : ''} · {stats.totalResponses} responses</p>
                          </div>
                        </div>
                        {stats.avgRating !== null && (
                          <div className="text-right flex-shrink-0 ml-3">
                            <div className={`text-lg font-bold tabular-nums ${ratingClr(stats.avgRating)}`}>{stats.avgRating}</div>
                            <StarRating value={stats.avgRating} />
                          </div>
                        )}
                      </div>

                      {/* Completion bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="font-medium tabular-nums text-foreground">{stats.submitted}/{stats.totalStudents} students</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${completionClr(stats.completionPct)}`}
                            style={{ width: `${stats.completionPct}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-[11px] font-medium ${stats.completionPct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {stats.completionPct}%
                          </span>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-indigo-600 dark:text-indigo-400"
                            onClick={() => setFilterTopicId(topic.headerId)}>
                            View detail <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {topics.length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No survey topics found</p>
                  <p className="text-xs text-muted-foreground mt-1">Add surveys in the Course Builder and link them to Header topics.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SPECIFIC TOPIC: student table
            ═══════════════════════════════════════════════════════════════ */}
        {!loadingData && filterCourseId !== 'all' && activeTopic && (
          <div className="space-y-4">
            {/* Topic header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <button onClick={() => setFilterTopicId('all')}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mb-1">
                  <ChevronLeft className="w-3 h-3" /> All Topics
                </button>
                <h2 className="text-base font-semibold text-foreground">{activeTopic.headerTitle}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {activeTopic.surveys.length} survey{activeTopic.surveys.length !== 1 ? 's' : ''} · {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                </p>
              </div>
              {(() => {
                const stats = getTopicStats(activeTopic);
                return stats.avgRating !== null ? (
                  <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rating</p>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{stats.avgRating}/5</p>
                    </div>
                    <StarRating value={stats.avgRating} />
                  </div>
                ) : null;
              })()}
            </div>

            {/* Survey questions preview */}
            {activeTopic.surveys[0]?.quiz_data && activeTopic.surveys[0].quiz_data.length > 0 && (
              <Card className="shadow-sm bg-indigo-500/5 dark:bg-indigo-500/10">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Survey Questions</p>
                  <div className="space-y-1.5">
                    {activeTopic.surveys[0].quiz_data.map((q: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-[10px] font-bold text-indigo-500 w-4">{i + 1}.</span>
                        <span className="text-xs">{q.q}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto flex-shrink-0 ${
                          q.type === 'rating' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : q.type === 'multiple_choice' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                        }`}>{q.type === 'multiple_choice' ? 'Choice' : q.type}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Student table */}
            <Card className="shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Student</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Rating</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Submitted</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-14">
                        <div className="flex flex-col items-center gap-2">
                          <div className="rounded-full bg-muted p-3">
                            <Search className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground">No students found</p>
                          <p className="text-xs text-muted-foreground">Try adjusting your search</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.map(s => {
                    const status = getStudentTopicStatus(s, activeTopic);
                    return (
                      <TableRow key={s.id} className={`${!status.submitted ? 'opacity-50' : ''} hover:bg-muted/30 transition-colors group`}>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${initialsBg(s.full_name)}`}>
                              {getInitials(s.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {status.submitted ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 px-2 py-0.5 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Submitted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1 px-2 py-0.5 text-[11px]">
                              <Clock className="w-3 h-3" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {status.rating !== null ? (
                            <div className="flex items-center gap-1.5">
                              <StarRating value={status.rating} />
                              <span className={`text-[11px] font-semibold tabular-nums ${ratingClr(status.rating)}`}>{status.rating}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {status.latestResp ? new Date(status.latestResp.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(s, activeTopic)}
                            disabled={!status.submitted} className="text-xs h-7 px-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Rating distribution */}
            {(() => {
              const surveyIds = activeTopic.surveys.map(s => s.id);
              const topicResps = responses.filter(r => surveyIds.includes(r.lesson_id) && r.rating !== null);
              if (topicResps.length === 0) return null;

              const dist = [5, 4, 3, 2, 1].map(r => ({
                stars: r,
                count: topicResps.filter(resp => Math.round(resp.rating!) === r).length,
              }));
              const max = Math.max(...dist.map(d => d.count), 1);

              return (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-foreground">
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Rating Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 px-4 pb-4">
                    {dist.map(({ stars, count }) => (
                      <div key={stars} className="flex items-center gap-3">
                        <div className="flex gap-0.5 w-16 flex-shrink-0 justify-end">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} className={`w-2.5 h-2.5 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20 fill-muted-foreground/20'}`} />
                          ))}
                        </div>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all duration-700"
                            style={{ width: `${Math.round((count / max) * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground w-6 text-right tabular-nums">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ── No topics message ──────────────────────────────────────── */}
        {!loadingData && filterCourseId !== 'all' && topics.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No survey topics found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add "Survey" type lessons to modules in the Course Builder, and link them to Header topics.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            DETAIL MODAL
            ═══════════════════════════════════════════════════════════════ */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0">
            {/* Header */}
            <div className="shrink-0 border-b px-5 py-4">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {detailStudent && (
                    <div className={`flex w-10 h-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${initialsBg(detailStudent.full_name)}`}>
                      {getInitials(detailStudent.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-semibold text-foreground">
                      {detailStudent?.full_name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Survey responses for <span className="font-medium text-foreground">{detailTopic?.headerTitle}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
              {detailStudent && detailTopic && (() => {
                const status = getStudentTopicStatus(detailStudent, detailTopic);
                if (!status.submitted || !status.allResps?.length) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <div className="rounded-full bg-muted p-3">
                        <ClipboardList className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No responses submitted yet.</p>
                    </div>
                  );
                }

                return status.allResps.map((resp, ri) => {
                  const surveyLesson = detailTopic.surveys.find(s => s.id === resp.lesson_id);
                  return (
                    <div key={resp.id} className="rounded-lg border bg-card overflow-hidden">
                      {/* Survey header */}
                      <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">{surveyLesson?.title || 'Survey'}</p>
                        <div className="flex items-center gap-2">
                          {resp.rating !== null && (
                            <div className="flex items-center gap-1">
                              <StarRating value={resp.rating} />
                              <span className={`text-[11px] font-bold tabular-nums ${ratingClr(resp.rating)}`}>{resp.rating}/5</span>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(resp.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Answers */}
                      <div className="p-4 space-y-3">
                        {(resp.answers || []).map((ans: any, ai: number) => (
                          <div key={ai} className="space-y-1">
                            <p className="text-[11px] font-semibold text-muted-foreground">{ans.question}</p>
                            <div className="pl-1">
                              <AnswerDisplay answer={ans} />
                            </div>
                          </div>
                        ))}
                        {(!resp.answers || resp.answers.length === 0) && (
                          <p className="text-xs text-muted-foreground italic">No answer details stored for this response.</p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
