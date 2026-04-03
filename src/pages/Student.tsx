import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, PlayCircle, FileText, HelpCircle, ClipboardList, Download, 
  ChevronRight, ChevronDown, CheckCircle, Circle, Loader2, ArrowLeft, Star, Link as LinkIcon, AlertCircle
} from 'lucide-react';

// --- Interfaces ---
interface Profile { id: string; full_name: string; email: string; cohort_id: string; }
interface Course { id: string; title: string; description: string; program: string; }
interface Module { id: string; title: string; order_index: number; }
interface Lesson { 
  id: string; 
  title: string; 
  type: string; 
  content: string; 
  file_url?: string;
  quiz_data?: any;
  module_id: string;
  order_index: number;
}
interface UserProgress { lesson_id: string; completed: boolean; score?: number; }

export default function StudentDashboard() {
  // --- State ---
  const [user, setUser] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- View State ---
  const [activeView, setActiveView] = useState<'dashboard' | 'course'>('dashboard');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  
  // --- Course Data ---
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  
  // --- Misc State ---
  const [myProgramName, setMyProgramName] = useState<string>('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [surveyRating, setSurveyRating] = useState(0);
  const [surveyFeedback, setSurveyFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  // 1. Initial Load: Get User & Assigned Courses
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // A. Get User
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, cohort_id, cohorts(name, course)')
          .eq('id', authUser.id)
          .single();
        
        if (!profile) throw new Error("Profile not found");
        setUser(profile);

        // B. Get User's Program Name (from Cohort)
        const programName = profile.cohorts && profile.cohorts.length > 0 ? profile.cohorts[0].course : null;
        setMyProgramName(programName || 'Unknown Program');

        // C. Fetch Courses matching that Program (Case Insensitive)
        if (programName) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('*')
            .ilike('program', programName); // ilike is case-insensitive
          
          setCourses(courseData || []);
        } else {
          setCourses([]);
        }
      } catch (e) {
        console.error(e);
        toast({ title: 'Error loading dashboard', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // 2. Open Course: Fetch Modules, Lessons, Progress
  const openCourse = async (course: Course) => {
    setActiveCourse(course);
    setActiveLesson(null);
    setActiveView('course');
    setLoading(true);

    try {
      const { data: modData } = await supabase.from('modules').select('*').eq('course_id', course.id).order('order_index');
      if (!modData) throw new Error("No modules");
      setModules(modData);

      const modIds = modData.map(m => m.id);
      const { data: lessData } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      setLessons(lessData || []);

      if (lessData && user) {
        const lessonIds = lessData.map(l => l.id);
        const { data: progData } = await supabase.from('progress').select('lesson_id, completed, score').eq('student_id', user.id).in('lesson_id', lessonIds);
        const map: Record<string, UserProgress> = {};
        (progData || []).forEach(p => map[p.lesson_id] = p);
        setProgress(map);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 3. Open Lesson
  const openLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setQuizAnswers({});
    setSurveyRating(0);
    setSurveyFeedback('');
  };

  // 4. Mark Complete
  const markComplete = async () => {
    if (!activeLesson || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('progress').upsert({ student_id: user.id, lesson_id: activeLesson.id, completed: true }, { onConflict: 'student_id,lesson_id' });
    if (!error) {
      setProgress(prev => ({ ...prev, [activeLesson.id]: { lesson_id: activeLesson.id, completed: true } }));
      toast({ title: 'Marked as Complete!' });
      setActiveLesson(null);
    } else toast({ title: 'Error saving progress', variant: 'destructive' });
    setSubmitting(false);
  };

  // 5. Submit Quiz
  const submitQuiz = async () => {
    if (!activeLesson || !user) return;
    setSubmitting(true);
    let score = 0;
    const questions = activeLesson.quiz_data || [];
    questions.forEach((q: any) => { if (quizAnswers[q.q] === q.a[q.correct]) score++; });
    const finalScore = Math.round((score / questions.length) * 100);

    await supabase.from('quiz_results').insert({ user_id: user.id, lesson_id: activeLesson.id, score: score, total_questions: questions.length });
    await supabase.from('progress').upsert({ student_id: user.id, lesson_id: activeLesson.id, completed: true, score: finalScore }, { onConflict: 'student_id,lesson_id' });

    toast({ title: `Quiz Submitted! Score: ${finalScore}%` });
    setProgress(prev => ({ ...prev, [activeLesson.id]: { lesson_id: activeLesson.id, completed: true, score: finalScore } }));
    setSubmitting(false);
    setActiveLesson(null);
  };

  // 6. Submit Survey
  const submitSurvey = async () => {
    if (!activeLesson || !user || surveyRating === 0) { toast({ title: 'Please provide a rating', variant: 'destructive' }); return; }
    setSubmitting(true);
    await supabase.from('survey_responses').insert({ user_id: user.id, lesson_id: activeLesson.id, rating: surveyRating, feedback: surveyFeedback, answers: {} });
    await supabase.from('progress').upsert({ student_id: user.id, lesson_id: activeLesson.id, completed: true }, { onConflict: 'student_id,lesson_id' });
    toast({ title: 'Feedback Submitted! Thank you.' });
    setProgress(prev => ({ ...prev, [activeLesson.id]: { lesson_id: activeLesson.id, completed: true } }));
    setSubmitting(false);
    setActiveLesson(null);
  };

  const getLessonIcon = (type: string) => {
    switch(type) {
      case 'video': return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-500" />;
      case 'survey': return <ClipboardList className="w-4 h-4 text-green-500" />;
      case 'file': return <Download className="w-4 h-4 text-red-500" />;
      case 'url': return <LinkIcon className="w-4 h-4 text-gray-500" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };
  const isCompleted = (lessonId: string) => progress[lessonId]?.completed;

  if (loading && !user) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2"/> Loading...</div>;

  // --- Dashboard View ---
  if (activeView === 'dashboard') {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="text-gray-500">Program: {myProgramName}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500 border rounded-lg border-dashed">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500"/>
              <p className="font-medium">No courses assigned yet.</p>
              <p className="text-xs mt-1 text-gray-400">(Looking for program: <strong>{myProgramName}</strong>)</p>
            </div>
          ) : (
            courses.map(course => (
              <Card key={course.id} className="overflow-hidden hover:shadow-lg transition cursor-pointer" onClick={() => openCourse(course)}>
                <div className="h-24 gradient-hero flex items-center justify-center p-4">
                  <h3 className="font-bold text-lg text-primary-foreground text-center">{course.title}</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 line-clamp-2">{course.description || 'No description'}</p>
                  <Button className="w-full mt-4" variant="outline">Enter Course</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- Course View ---
  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setActiveView('dashboard')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Button>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{activeCourse?.title}</h1>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{activeCourse?.program}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {modules.map(mod => (
            <div key={mod.id} className="border rounded-lg bg-white shadow-sm">
              <div className="p-3 bg-gray-50 font-semibold text-sm">{mod.title}</div>
              <div className="p-2 space-y-1">
                {lessons.filter(l => l.module_id === mod.id).map(les => (
                  <div key={les.id} onClick={() => openLesson(les)} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${activeLesson?.id === les.id ? 'bg-blue-50 border border-blue-200' : ''}`}>
                    {isCompleted(les.id) ? <CheckCircle className="w-4 h-4 text-green-500"/> : <Circle className="w-4 h-4 text-gray-300"/>}
                    {getLessonIcon(les.type)}
                    <span className="text-sm truncate">{les.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-2">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin"/></div> : 
          !activeLesson ? (
            <div className="h-64 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400">Select a lesson to start</div>
          ) : (
            <Card className="p-6 min-h-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{activeLesson.title}</h2>
                {isCompleted(activeLesson.id) && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Completed</span>}
              </div>

              <div className="space-y-4">
                {activeLesson.type === 'text' && ( <div className="prose max-w-none"><p>{activeLesson.content}</p></div> )}
                
                {activeLesson.type === 'video' && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    {activeLesson.content?.includes('youtube.com') ? <iframe src={activeLesson.content.replace("watch?v=", "embed/")} className="w-full h-full" allowFullScreen/> : <video src={activeLesson.content} controls className="w-full h-full" />}
                  </div>
                )}

                {activeLesson.type === 'url' && ( <div className="text-center p-10 bg-gray-50 rounded-lg border"><a href={activeLesson.content} target="_blank" className="text-blue-600 underline text-lg">Open Resource</a></div> )}

                {activeLesson.type === 'file' && (
                  <div className="text-center p-10 bg-gray-50 rounded-lg border">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-2"/>
                    <p className="font-medium">{activeLesson.title}</p>
                    <a href={activeLesson.file_url} target="_blank" download className="mt-2 inline-block"><Button><Download className="w-4 h-4 mr-2"/> Download File</Button></a>
                  </div>
                )}

                {activeLesson.type === 'quiz' && activeLesson.quiz_data && (
                  <div className="space-y-4">
                    {activeLesson.quiz_data.map((q: any, i: number) => (
                      <div key={i} className="p-4 border rounded-lg bg-gray-50">
                        <p className="font-medium mb-2">{i + 1}. {q.q}</p>
                        <div className="space-y-1">
                          {q.a.map((ans: string, j: number) => (
                            <label key={j} className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-white ${quizAnswers[q.q] === ans ? 'bg-blue-50 border-blue-400' : 'bg-white'}`}>
                              <input type="radio" name={q.q} value={ans} checked={quizAnswers[q.q] === ans} onChange={() => setQuizAnswers(prev => ({ ...prev, [q.q]: ans }))} className="w-4 h-4"/>
                              {ans}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button onClick={submitQuiz} disabled={submitting} className="w-full">{submitting ? <Loader2 className="animate-spin mr-2"/> : null} Submit Quiz</Button>
                  </div>
                )}

                {activeLesson.type === 'survey' && (
                  <div className="space-y-4">
                    <div>
                      <Label>Your Rating</Label>
                      <div className="flex gap-1 mt-1">
                        {[1,2,3,4,5].map(star => <Star key={star} onClick={() => setSurveyRating(star)} className={`w-8 h-8 cursor-pointer ${surveyRating >= star ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}/>)}
                      </div>
                    </div>
                    <div>
                      <Label>Feedback (Optional)</Label>
                      <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={surveyFeedback} onChange={e => setSurveyFeedback(e.target.value)}/>
                    </div>
                    <Button onClick={submitSurvey} disabled={submitting || surveyRating === 0} className="w-full">Submit Feedback</Button>
                  </div>
                )}
              </div>

              {['text', 'video', 'file', 'url'].includes(activeLesson.type) && !isCompleted(activeLesson.id) && (
                <div className="mt-6 pt-4 border-t">
                  <Button onClick={markComplete} disabled={submitting}><CheckCircle className="w-4 h-4 mr-2"/> Mark as Complete</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}