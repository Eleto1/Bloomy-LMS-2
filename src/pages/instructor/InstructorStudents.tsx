import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Search, Users, CalendarDays, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, Eye, BookOpen, UserCheck, Filter
} from 'lucide-react';

interface Cohort {
  id: string;
  name: string;
  course: string; // Program name (e.g. "Digital Marketing")
}

interface Course {
  id: string;
  program: string;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  course_id: string;     // Course UUID from instructor's courses table
  course: string;        // Program name for display
  cohort_id: string;
  cohort_name: string;
  progress: number;
}

// Helper – fetches all courses assigned to this instructor
async function fetchInstructorCourses(userId: string) {
  const courseMap: Record<string, Course> = {};
  const programNames = new Set<string>();

  // 1. Direct instructor assignment
  const { data: directCourses, error: err1 } = await supabase
    .from('courses')
    .select('id, program')
    .eq('instructor_id', userId);
  directCourses?.forEach(c => {
    courseMap[c.id] = c;
    if (c.program) programNames.add(c.program);
  });

  // 2. Junction table
  const { data: junc, error: err2 } = await supabase
    .from('course_instructors')
    .select('course_id')
    .eq('instructor_id', userId);
  if (junc && junc.length > 0) {
    const ids = junc.map(j => j.course_id);
    const { data: juncDetails } = await supabase
      .from('courses')
      .select('id, program')
      .in('id', ids);
    juncDetails?.forEach(c => {
      courseMap[c.id] = c;
      if (c.program) programNames.add(c.program);
    });
  }

  // 3. Created by user
  const { data: createdCourses } = await supabase
    .from('courses')
    .select('id, program')
    .eq('created_by', userId);
  createdCourses?.forEach(c => {
    courseMap[c.id] = c;
    if (c.program) programNames.add(c.program);
  });

  return {
    courseMap,
    courseIds: Object.keys(courseMap),
    programs: Array.from(programNames),
  };
}

export default function InstructorStudents() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  const [instructorHasCourse, setInstructorHasCourse] = useState(false);

  const [filterCohort, setFilterCohort] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [search, setSearch] = useState('');

  // Attendance modal state
  const [attendOpen, setAttendOpen] = useState(false);
  const [attendCohortId, setAttendCohortId] = useState('');
  const [attendDate, setAttendDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendStudents, setAttendStudents] = useState<{ id: string; name: string; status: string }[]>([]);
  const [attendLoading, setAttendLoading] = useState(false);
  const [attendSaving, setAttendSaving] = useState(false);
  const [existingLoaded, setExistingLoaded] = useState(false);

  // Student detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailModules, setDetailModules] = useState<{ title: string; done: number; total: number }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      console.log('========================================');
      console.log('[DEBUG] Logged-in user:', user.id, user.email);

      // ── 1. Get instructor's courses & programs ────────────────────
      const { courseMap, courseIds: myCourseIds, programs: myPrograms } =
        await fetchInstructorCourses(user.id);

      console.log('[DEBUG] Step 1 — Course IDs:', myCourseIds);
      console.log('[DEBUG] Step 1 — Programs:', myPrograms);

      if (myCourseIds.length === 0) {
        console.log('[DEBUG] No courses found for this instructor');
        setInstructorHasCourse(false);
        setStudents([]);
        setCohorts([]);
        setLoading(false);
        return;
      }

      setInstructorHasCourse(true);

      // ── 2. Fetch ALL cohorts (we need them for both strategies) ───
      let allCohorts: Cohort[] = [];
      if (myPrograms.length > 0) {
        const { data: cData, error: cErr } = await supabase
          .from('cohorts')
          .select('id, name, course')
          .order('name');
        console.log('[DEBUG] Step 2 — Cohorts query error:', cErr);
        console.log('[DEBUG] Step 2 — All cohorts:', cData);
        allCohorts = cData || [];
      }

      const cohortMap: Record<string, Cohort> = {};
      allCohorts.forEach(c => { cohortMap[c.id] = c; });

      // Build program → course UUID lookup
      const programToCourseId: Record<string, string> = {};
      myCourseIds.forEach(cid => {
        const prog = courseMap[cid]?.program;
        if (prog && !programToCourseId[prog]) {
          programToCourseId[prog] = cid;
        }
      });
      console.log('[DEBUG] Step 2 — Program → Course ID map:', programToCourseId);

      // ── 3. STRATEGY A: Try course_id on profiles (ideal) ─────────
      //    If profiles has a course_id column with data, this is the
      //    most accurate way to link students to specific courses.
      let studentList: { id: string; full_name: string; email: string; cohort_id: string; course_id?: string }[] = [];
      let usedCourseIdStrategy = false;

      try {
        const { data: studsById, error: errById } = await supabase
          .from('profiles')
          .select('id, full_name, email, cohort_id, course_id')
          .eq('role', 'student')
          .in('course_id', myCourseIds);

        console.log('[DEBUG] Step 3A — course_id query error:', errById);
        console.log('[DEBUG] Step 3A — Students by course_id:', studsById?.length);

        if (!errById && studsById && studsById.length > 0) {
          studentList = studsById;
          usedCourseIdStrategy = true;
        }
      } catch (e: any) {
        console.log('[DEBUG] Step 3A — course_id column likely missing, falling back:', e.message);
      }

      // ── 4. STRATEGY B: Fallback — cohort + program-name filter ───
      //    If profiles doesn't have course_id, we use cohort membership
      //    but strictly filter by matching the cohort's program name
      //    against the instructor's programs.
      if (!usedCourseIdStrategy) {
        console.log('[DEBUG] Step 4 — Falling back to cohort-based strategy with program filtering');

        // 4a. Find cohorts whose program name matches one of the instructor's programs
        const matchingCohorts = allCohorts.filter(c =>
          c.course && myPrograms.includes(c.course)
        );
        console.log('[DEBUG] Step 4a — Cohorts matching instructor programs:', matchingCohorts.map(c => ({ id: c.id, name: c.name, course: c.course })));

        const matchingCohortIds = matchingCohorts.map(c => c.id);

        if (matchingCohortIds.length === 0) {
          // 4b. If no cohorts matched by program name, try a softer match:
          //     check if any program name appears in the cohort's course field
          //     (handles partial matches like "Digital Marketing" in "May 2026 - Digital Marketing")
          const softMatchCohorts = allCohorts.filter(c => {
            if (!c.course) return false;
            return myPrograms.some(prog =>
              c.course.toLowerCase().includes(prog.toLowerCase()) ||
              prog.toLowerCase().includes(c.course.toLowerCase())
            );
          });
          console.log('[DEBUG] Step 4b — Soft match cohorts:', softMatchCohorts.map(c => ({ id: c.id, name: c.name, course: c.course })));
          matchingCohortIds.push(...softMatchCohorts.map(c => c.id));
        }

        if (matchingCohortIds.length > 0) {
          const uniqueCohortIds = [...new Set(matchingCohortIds)];
          const { data: studs, error: studError } = await supabase
            .from('profiles')
            .select('id, full_name, email, cohort_id')
            .eq('role', 'student')
            .in('cohort_id', uniqueCohortIds);

          console.log('[DEBUG] Step 4 — Students by cohort error:', studError);
          console.log('[DEBUG] Step 4 — Students by cohort:', studs?.length, studs);

          if (studError) throw studError;

          const rawStudents = studs || [];

          // 4c. CRITICAL FILTER: Only keep students whose cohort's program
          //     actually matches one of the instructor's programs.
          //     This prevents showing Cybersecurity students to a
          //     Digital Marketing instructor even if they share a cohort.
          studentList = rawStudents.filter(s => {
            const cohort = cohortMap[s.cohort_id];
            if (!cohort || !cohort.course) return false;
            return myPrograms.includes(cohort.course) ||
              myPrograms.some(prog =>
                cohort.course.toLowerCase().includes(prog.toLowerCase()) ||
                prog.toLowerCase().includes(cohort.course.toLowerCase())
              );
          });

          console.log('[DEBUG] Step 4c — After program filter:', studentList.length, 'students remain');
        }
      }

      if (studentList.length === 0) {
        console.log('[DEBUG] No students found for this instructor after all strategies');
        setStudents([]);
        setCohorts([]);
        setLoading(false);
        return;
      }

      // ── 5. Set cohorts (only those that actually have our students) ─
      const studentCohortIds = [...new Set(studentList.map(s => s.cohort_id).filter(Boolean))];
      const relevantCohorts = allCohorts.filter(c => studentCohortIds.includes(c.id));
      setCohorts(relevantCohorts);

      // ── 6. Bulk progress data ────────────────────────────────────
      const progressMap: Record<string, number> = {};
      const activeCourseIds = Object.values(programToCourseId);

      if (activeCourseIds.length > 0) {
        const { data: mods } = await supabase
          .from('modules')
          .select('id, title, course_id')
          .in('course_id', activeCourseIds);
        const modList = mods || [];

        const modIds = modList.map(m => m.id);
        let allNonHeaderLessons: { id: string; module_id: string; course_id: string }[] = [];

        if (modIds.length > 0) {
          const { data: lessons } = await supabase
            .from('lessons')
            .select('id, type, module_id')
            .in('module_id', modIds);
          const modCourseMap: Record<string, string> = {};
          modList.forEach(m => { modCourseMap[m.id] = m.course_id; });
          allNonHeaderLessons = (lessons || [])
            .filter(l => l.type !== 'header')
            .map(l => ({ ...l, course_id: modCourseMap[l.module_id] || '' }));
        }

        const studentIds = studentList.map(s => s.id);
        const allLessonIds = allNonHeaderLessons.map(l => l.id);

        if (allLessonIds.length > 0 && studentIds.length > 0) {
          const { data: allProg } = await supabase
            .from('lesson_progress')
            .select('user_id, lesson_id, completed')
            .in('user_id', studentIds)
            .in('lesson_id', allLessonIds);

          const courseLessonCounts: Record<string, number> = {};
          allNonHeaderLessons.forEach(l => {
            courseLessonCounts[l.course_id] = (courseLessonCounts[l.course_id] || 0) + 1;
          });

          studentList.forEach(s => {
            // Determine the course ID for this student
            let courseId = '';
            if (usedCourseIdStrategy && s.course_id) {
              courseId = s.course_id;
            } else {
              const cohort = cohortMap[s.cohort_id];
              const programName = cohort?.course || '';
              courseId = programToCourseId[programName] || '';
            }

            if (!courseId) {
              progressMap[s.id] = 0;
              return;
            }

            const total = courseLessonCounts[courseId] || 0;
            if (total === 0) {
              progressMap[s.id] = 0;
              return;
            }

            const courseModIds = modList.filter(m => m.course_id === courseId).map(m => m.id);
            const courseLessonIds = new Set(
              allNonHeaderLessons
                .filter(l => courseModIds.includes(l.module_id))
                .map(l => l.id)
            );

            const completed = (allProg || []).filter(
              p => p.user_id === s.id && p.completed && courseLessonIds.has(p.lesson_id)
            ).length;

            progressMap[s.id] = Math.round((completed / total) * 100);
          });
        }
      }

      // ── 7. Enrich students ───────────────────────────────────────
      const enriched: Student[] = studentList.map(s => {
        const cohort = cohortMap[s.cohort_id];
        let courseId = '';
        let courseName = '';

        if (usedCourseIdStrategy && s.course_id) {
          courseId = s.course_id;
          courseName = courseMap[courseId]?.program || cohort?.course || 'Unknown';
        } else {
          courseName = cohort?.course || 'Unknown';
          courseId = programToCourseId[courseName] || '';
        }

        return {
          id: s.id,
          full_name: s.full_name || 'Unknown',
          email: s.email || '',
          course_id: courseId,
          course: courseName,
          cohort_id: s.cohort_id || '',
          cohort_name: cohort?.name || '—',
          progress: progressMap[s.id] || 0,
        };
      });

      console.log('[DEBUG] Step 7 — Strategy used:', usedCourseIdStrategy ? 'course_id (ideal)' : 'cohort + program filter (fallback)');
      console.log('[DEBUG] Step 7 — Final enriched students:', enriched.map(s => ({
        name: s.full_name,
        course_id: s.course_id,
        program: s.course,
        cohort: s.cohort_name,
      })));
      console.log('========================================');

      setStudents(enriched);
    } catch (e: any) {
      console.error('[InstructorStudents] loadData error:', e);
      toast({ title: 'Error loading students', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtered list (memoized) ─────────────────────────────────

  const availableCourses = useMemo(() => {
    const courseCounts: Record<string, { name: string; count: number }> = {};
    students.forEach(s => {
      if (!courseCounts[s.course_id]) {
        courseCounts[s.course_id] = { name: s.course, count: 0 };
      }
      courseCounts[s.course_id].count++;
    });
    return Object.entries(courseCounts).map(([id, { name, count }]) => ({ id, name, count }));
  }, [students]);

  const filtered = useMemo(() =>
    students.filter(s => {
      const matchSearch = search
        ? s.full_name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchCohort = filterCohort !== 'all' ? s.cohort_id === filterCohort : true;
      const matchCourse = filterCourse !== 'all' ? s.course_id === filterCourse : true;
      return matchSearch && matchCohort && matchCourse;
    }),
    [students, search, filterCohort, filterCourse]
  );

  // ─── Attendance helpers ───────────────────────────────────────

  const openAttendance = (cohortId?: string) => {
    if (cohortId) setAttendCohortId(cohortId);
    else if (cohorts.length === 1) setAttendCohortId(cohorts[0].id);
    else setAttendCohortId('');
    setAttendDate(new Date().toISOString().split('T')[0]);
    setExistingLoaded(false);
    setAttendOpen(true);
  };

  useEffect(() => {
    if (!attendOpen || !attendCohortId) return;
    const cohortStudents = students.filter(s => s.cohort_id === attendCohortId);
    setAttendStudents(cohortStudents.map(s => ({ id: s.id, name: s.full_name, status: '' })));
    setExistingLoaded(false);
  }, [attendCohortId, attendOpen, students]);

  const loadExistingAttendance = async () => {
    if (!attendCohortId || !attendDate || existingLoaded) return;
    setAttendLoading(true);
    try {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('cohort_id', attendCohortId)
        .eq('date', attendDate);

      const records: Record<string, string> = {};
      (data || []).forEach(r => { records[r.student_id] = r.status; });

      setAttendStudents(prev => prev.map(s => ({
        ...s,
        status: records[s.id] || '',
      })));
      setExistingLoaded(true);
    } catch (e: any) {
      toast({ title: 'Error loading attendance', description: e.message, variant: 'destructive' });
    } finally {
      setAttendLoading(false);
    }
  };

  useEffect(() => {
    if (attendOpen && attendCohortId && attendDate) loadExistingAttendance();
  }, [attendDate, attendCohortId, attendOpen]);

  const setAttendStatus = (studentId: string, status: string) => {
    setAttendStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, status: s.status === status ? '' : status } : s)
    );
  };

  const markAllPresent = () => {
    setAttendStudents(prev => prev.map(s => ({ ...s, status: 'present' })));
  };

  const saveAttendance = async () => {
    const marked = attendStudents.filter(s => s.status);
    if (marked.length === 0) {
      return toast({ title: 'No attendance marked', variant: 'destructive' });
    }
    setAttendSaving(true);
    try {
      const rows = marked.map(s => ({
        student_id: s.id,
        cohort_id: attendCohortId,
        date: attendDate,
        status: s.status,
      }));

      const { error } = await supabase.from('attendance').upsert(rows, {
        onConflict: 'student_id,cohort_id,date',
      });

      if (error) throw error;
      toast({ title: `Attendance saved for ${marked.length} student${marked.length !== 1 ? 's' : ''} ✓` });
      setAttendOpen(false);
    } catch (e: any) {
      toast({ title: 'Error saving attendance', description: e.message, variant: 'destructive' });
    } finally {
      setAttendSaving(false);
    }
  };

  // ─── Student detail ───────────────────────────────────────────

  const openDetail = async (student: Student) => {
    setDetailStudent(student);
    setDetailOpen(true);
    setDetailModules([]);
    setDetailLoading(true);

    try {
      const courseId = student.course_id;
      if (!courseId) {
        setDetailLoading(false);
        return;
      }

      const { data: mods } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseId)
        .order('order_index');

      const modList = mods || [];
      if (modList.length === 0) {
        setDetailLoading(false);
        return;
      }

      const modIds = modList.map(m => m.id);
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, type, module_id')
        .in('module_id', modIds);

      const nonHeader = (lessons || []).filter(l => l.type !== 'header');
      const lIds = nonHeader.map(l => l.id);

      const doneIds = new Set<string>();
      if (lIds.length > 0) {
        const { data: prog } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', student.id)
          .in('lesson_id', lIds)
          .eq('completed', true);
        (prog || []).forEach(p => doneIds.add(p.lesson_id));
      }

      const modStats = modList.map(mod => {
        const modLessons = nonHeader.filter(l => l.module_id === mod.id);
        const done = modLessons.filter(l => doneIds.has(l.id)).length;
        return { title: mod.title, done, total: modLessons.length };
      });

      setDetailModules(modStats);
    } catch (e: any) {
      toast({ title: 'Error loading details', description: e.message, variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-gray-500">Loading students...</span>
      </div>
    );
  }

  if (!instructorHasCourse) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">No Course Assigned</h2>
        <p className="text-sm text-gray-500">
          You have not been assigned to any course yet. Contact your administrator to get set up.
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">No Students Enrolled</h2>
        <p className="text-sm text-gray-500">
          No students are currently enrolled in your assigned courses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Students</h2>
          <p className="text-sm text-muted-foreground">
            {students.length} student{students.length !== 1 ? 's' : ''} enrolled in your course{cohorts.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => openAttendance()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <CalendarDays className="w-4 h-4" /> Take Attendance
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Course filter (primary) */}
            {availableCourses.length > 1 && (
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses ({students.length})</SelectItem>
                  {availableCourses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Cohort filter (secondary) */}
            {cohorts.length > 1 && (
              <Select value={filterCohort} onValueChange={setFilterCohort}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts ({students.length})</SelectItem>
                  {cohorts.map(c => {
                    const count = students.filter(s => s.cohort_id === c.id).length;
                    return <SelectItem key={c.id} value={c.id}>{c.name} ({count})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-100">
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cohort</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Program</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-gray-400"><Users className="w-8 h-8 mx-auto mb-2 text-gray-200" /><p className="text-sm">No students match your search.</p></td></tr>
              ) : filtered.map(s => {
                const initials = s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const progColor = s.progress >= 70 ? '#10b981' : s.progress >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{initials}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{s.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><span className="text-sm text-gray-700">{s.cohort_name}</span></td>
                    <td className="p-4"><Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-600">{s.course}</Badge></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${s.progress}%`, background: progColor }} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8 text-right">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-gray-500 hover:text-indigo-600" onClick={() => openDetail(s)}><Eye className="w-3.5 h-3.5" /> View</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-gray-500 hover:text-emerald-600" onClick={() => openAttendance(s.cohort_id)}><UserCheck className="w-3.5 h-3.5" /> Attend</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ATTENDANCE MODAL */}
      <Dialog open={attendOpen} onOpenChange={setAttendOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-600" /> Take Attendance</DialogTitle>
            <DialogDescription>Mark attendance for your students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cohort <span className="text-red-400">*</span></Label>
              <Select value={attendCohortId} onValueChange={val => { setAttendCohortId(val); setExistingLoaded(false); }}>
                <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={attendDate} onChange={e => { setAttendDate(e.target.value); setExistingLoaded(false); }} />
            </div>
            {attendCohortId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Students ({attendStudents.filter(s => s.status).length}/{attendStudents.length} marked)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 gap-1" onClick={markAllPresent}><CheckCircle2 className="w-3 h-3" /> Mark All Present</Button>
                </div>
                {attendLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /><span className="text-xs text-gray-500">Loading...</span></div>
                ) : attendStudents.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No students in this cohort for your courses.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                    {attendStudents.map(s => {
                      const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div key={s.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${s.status === 'present' ? 'bg-emerald-50 border-emerald-200' : s.status === 'absent' ? 'bg-red-50 border-red-200' : s.status === 'late' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{initials}</div>
                            <span className="text-sm font-medium text-gray-800">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setAttendStatus(s.id, 'present')} className={`p-1.5 rounded-lg transition-all ${s.status === 'present' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50'}`}><CheckCircle2 className="w-4 h-4" /></button>
                            <button onClick={() => setAttendStatus(s.id, 'late')} className={`p-1.5 rounded-lg transition-all ${s.status === 'late' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'}`}><Clock className="w-4 h-4" /></button>
                            <button onClick={() => setAttendStatus(s.id, 'absent')} className={`p-1.5 rounded-lg transition-all ${s.status === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}><XCircle className="w-4 h-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendOpen(false)}>Cancel</Button>
            <Button onClick={saveAttendance} disabled={attendSaving || !attendCohortId || attendStudents.filter(s => s.status).length === 0} className="bg-indigo-600 hover:bg-indigo-700">
              {attendSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {attendSaving ? 'Saving...' : `Save (${attendStudents.filter(s => s.status).length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STUDENT DETAIL MODAL */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">{detailStudent?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
              {detailStudent?.full_name}
            </DialogTitle>
            <DialogDescription>{detailStudent?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-50"><p className="text-[11px] text-gray-400">Cohort</p><p className="text-sm font-semibold text-gray-900">{detailStudent?.cohort_name || '—'}</p></div>
              <div className="p-3 rounded-xl bg-gray-50"><p className="text-[11px] text-gray-400">Program</p><p className="text-sm font-semibold text-gray-900">{detailStudent?.course || '—'}</p></div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">Overall Progress</p>
                <span className="text-sm font-bold" style={{ color: (detailStudent?.progress ?? 0) >= 70 ? '#10b981' : (detailStudent?.progress ?? 0) >= 40 ? '#f59e0b' : '#ef4444' }}>{detailStudent?.progress ?? 0}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${detailStudent?.progress ?? 0}%`, background: (detailStudent?.progress ?? 0) >= 70 ? '#10b981' : (detailStudent?.progress ?? 0) >= 40 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Module Breakdown</p>
              {detailLoading ? (
                <div className="flex items-center justify-center py-6 gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /><span className="text-xs text-gray-400">Loading...</span></div>
              ) : detailModules.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No module data available.</p>
              ) : (
                <div className="space-y-2">
                  {detailModules.map((mod, i) => {
                    const pct = mod.total > 0 ? Math.round((mod.done / mod.total) * 100) : 0;
                    const color = pct === 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b';
                    return (
                      <div key={i} className="p-2.5 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate">{mod.title}</span>
                          <span className="text-gray-400 shrink-0 ml-2">{mod.done}/{mod.total}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
