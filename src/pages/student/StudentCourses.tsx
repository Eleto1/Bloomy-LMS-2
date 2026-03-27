import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, FileText, HelpCircle, CheckCircle, Lock, Paperclip, ArrowLeft, Star, LayoutDashboard, Link as LinkIcon, ClipboardList, Check, CalendarDays } from 'lucide-react';

interface Lesson { id: string; title: string; type: string; content: string | null; module_id: string; file_url: string | null; quiz_data?: any; order_index: number; }
interface Module { id: string; title: string; order_index: number; unlock_date?: string; }
interface ProgressMap { [lessonId: string]: boolean }

export default function StudentCourseViewer() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [viewMode, setViewMode] = useState<'list' | 'lesson'>('list');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleName, setActiveModuleName] = useState('');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [surveyInputs, setSurveyInputs] = useState<Record<string, any>>({});

  useEffect(() => { if (user && courseId) loadData(); }, [user, courseId]);

  const loadData = async () => {
    if (!user || !courseId) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('cohort_id').eq('id', user.id).single();
      if (!profile?.cohort_id) throw new Error("No cohort");
      const { data: cohort } = await supabase.from('cohorts').select('course').eq('id', profile.cohort_id).single();
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(courseData);
      if (cohort?.course !== courseData?.program) { setAuthorized(false); setLoading(false); return; }
      setAuthorized(true);

      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order_index');
      if (mods) {
        setModules(mods);
        const { data: less } = await supabase.from('lessons').select('*').in('module_id', mods.map(m => m.id)).order('order_index');
        if (less) setLessons(less);
        const { data: prog } = await supabase.from('lesson_progress').select('lesson_id').eq('user_id', user.id).in('lesson_id', less.map(l => l.id));
        const map: ProgressMap = {}; (prog || []).forEach(p => map[p.lesson_id] = true);
        setProgress(map);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LOGIC ---
  // FIX: Filter out Headers when calculating progress
  const getModuleProgress = (moduleId: string) => {
    const modLessons = lessons.filter(l => l.module_id === moduleId && l.type !== 'header');
    if (modLessons.length === 0) return 100;
    const done = modLessons.filter(l => progress[l.id]).length;
    return Math.round((done / modLessons.length) * 100);
  };

  const isModuleUnlocked = (moduleIndex: number) => {
    const mod = modules[moduleIndex];
    // 1. Check Date
    if (mod.unlock_date && new Date(mod.unlock_date) > new Date()) return false;
    // 2. Check Previous Module Progress
    if (moduleIndex === 0) return true;
    const prevModule = modules[moduleIndex - 1];
    return getModuleProgress(prevModule.id) === 100;
  };

  const isLessonUnlocked = (lesson: Lesson) => {
    const moduleLessons = lessons.filter(l => l.module_id === lesson.module_id && l.type !== 'header');
    const idx = moduleLessons.findIndex(l => l.id === lesson.id);
    if (idx === 0) return true;
    return progress[moduleLessons[idx-1].id];
  };

  const handleMarkComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from('lesson_progress').upsert({ user_id: user.id, lesson_id: lessonId, completed: true });
    setProgress(prev => ({ ...prev, [lessonId]: true }));
    toast({ title: '✅ Completed!' });
  };

  const openLesson = (lesson: Lesson, name: string) => {
    setActiveLesson(lesson); setActiveModuleName(name); setCurrentQIndex(0); setSelectedAnswer(null); setQuizScore(0); setSurveyInputs({}); setViewMode('lesson');
  };

  const handleQuizSubmit = async () => {
    if (!activeLesson || selectedAnswer === null || !user) return;
    const currentQ = activeLesson.quiz_data[currentQIndex];
    const isCorrect = selectedAnswer === currentQ.correct;
    if (isCorrect) { setQuizScore(prev => prev + 1); toast({ title: '✅ Correct!' }); } else toast({ title: '❌ Incorrect', variant: 'destructive' });
    if (currentQIndex < activeLesson.quiz_data.length - 1) { setCurrentQIndex(prev => prev + 1); setSelectedAnswer(null); } 
    else {
      const finalScore = isCorrect ? quizScore + 1 : quizScore;
      const passed = finalScore >= (activeLesson.quiz_data.length / 2);
      await supabase.from('quiz_results').insert({ user_id: user.id, lesson_id: activeLesson.id, score: finalScore, total_questions: activeLesson.quiz_data.length, passed });
      if (passed) { await handleMarkComplete(activeLesson.id); toast({ title: '🎉 Passed!' }); setViewMode('list'); } 
      else { toast({ title: 'Failed', variant: 'destructive' }); setCurrentQIndex(0); setQuizScore(0); setSelectedAnswer(null); }
    }
  };

  const handleSurveySubmit = async () => {
    if (!activeLesson || !user) return;
    const ratingQ = activeLesson.quiz_data.find((q: any) => q.type === 'rating');
    if (ratingQ && !surveyInputs[ratingQ.q]) { toast({ title: 'Rate all stars', variant: 'destructive' }); return; }
    const { error } = await supabase.from('survey_responses').insert({
      lesson_id: activeLesson.id, topic_id: activeLesson.content || null, user_id: user.id,
      rating: ratingQ ? surveyInputs[ratingQ.q] : 0, feedback: surveyInputs['feedback'] || '', answers: surveyInputs
    });
    if (error) { toast({ title: 'Error saving', variant: 'destructive' }); return; }
    toast({ title: 'Thanks!' });
    await handleMarkComplete(activeLesson.id);
    setViewMode('list');
  };

  if (loading) return <DashboardLayout><div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  if (!authorized) return <DashboardLayout><div className="p-10 text-center"><h2 className="text-xl font-bold">Access Denied</h2><Button variant="outline" className="mt-4" onClick={() => window.history.back()}>Go Back</Button></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6">
        {viewMode === 'list' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Link to="/student/courses">My Courses</Link><span>/</span><span className="text-foreground font-medium">{course?.title}</span></div>
            <h1 className="text-2xl font-bold">{course?.title}</h1>
            <div className="space-y-4">
              {modules.map((mod, idx) => {
                const unlocked = isModuleUnlocked(idx);
                const prog = getModuleProgress(mod.id);
                const dateLocked = mod.unlock_date && new Date(mod.unlock_date) > new Date();
                return (
                  <Card key={mod.id} className={`overflow-hidden ${!unlocked ? 'opacity-60' : ''}`}>
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{mod.title}</h3>
                        {dateLocked && <span className="text-xs text-blue-600 flex items-center gap-1 mt-1"><CalendarDays className="w-3 h-3" /> Unlocks: {new Date(mod.unlock_date).toLocaleDateString()}</span>}
                        {!dateLocked && !unlocked && <span className="text-xs text-red-500 flex items-center gap-1 mt-1"><Lock className="w-3 h-3" /> Complete previous module</span>}
                      </div>
                      <div className="text-xs text-gray-500">{prog}%</div>
                    </div>
                    <div className="p-2"><Progress value={prog} className="h-1" /></div>
                    <div className="p-2 space-y-1">
                      {lessons.filter(l => l.module_id === mod.id).map(les => {
                        if (les.type === 'header') return <div key={les.id} className="p-2 border-l-4 border-blue-500 bg-blue-50 rounded mb-1 mt-2 font-bold text-blue-800 text-sm">{les.title}</div>;
                        const open = unlocked && isLessonUnlocked(les);
                        const done = progress[les.id];
                        const Icon = les.type === 'video' ? Play : les.type === 'quiz' ? HelpCircle : les.type === 'survey' ? ClipboardList : les.type === 'url' ? LinkIcon : FileText;
                        return (
                          <div key={les.id} onClick={() => open && openLesson(les, mod.title)} className={`flex items-center justify-between p-3 rounded border cursor-pointer ${done ? 'bg-green-50 border-green-200' : open ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 cursor-not-allowed'}`}>
                            <div className="flex items-center gap-3 flex-1">
                              {done ? <CheckCircle className="w-5 h-5 text-green-600" /> : open ? <Icon className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-gray-400" />}
                              <span className="text-sm">{les.title}</span>
                              {les.file_url && <Paperclip className="w-3 h-3 text-gray-400 ml-auto" />}
                            </div>
                            {done && <Check className="w-4 h-4 text-green-600" />}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'lesson' && activeLesson && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('list')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Card className="p-6 min-h-[60vh]">
              <p className="text-xs text-gray-500 mb-1">{activeModuleName}</p>
              <h2 className="text-xl font-bold mb-4">{activeLesson.title}</h2>
              
              {/* REQUIREMENTS: Only show if NOT header */}
              {activeLesson.file_url && activeLesson.type !== 'header' && (
                <div className="mb-6 p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-2"><Paperclip className="w-4 h-4" /> Requirements</h3>
                  <a href={activeLesson.file_url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Paperclip className="w-4 h-4 mr-2" /> Download File</Button></a>
                </div>
              )}

              {activeLesson.type === 'text' && <div className="prose max-w-none whitespace-pre-wrap">{activeLesson.content}</div>}
              {activeLesson.type === 'video' && <div className="aspect-video bg-black rounded flex items-center justify-center"><iframe src={activeLesson.content} className="w-full h-full rounded" allowFullScreen></iframe></div>}
              {activeLesson.type === 'url' && <div className="text-center py-10"><a href={activeLesson.content} target="_blank"><Button>Open Link</Button></a></div>}
              
              {activeLesson.type === 'quiz' && activeLesson.quiz_data && (
                <div className="space-y-4">
                  <p className="font-semibold">Q{currentQIndex + 1}: {activeLesson.quiz_data[currentQIndex]?.q}</p>
                  <div className="space-y-2">{activeLesson.quiz_data[currentQIndex]?.a.map((ans: string, i: number) => <div key={i} onClick={() => setSelectedAnswer(i)} className={`p-3 border rounded cursor-pointer ${selectedAnswer === i ? 'border-blue-500 bg-blue-50' : ''}`}>{ans}</div>)}</div>
                  <Button onClick={handleQuizSubmit} disabled={selectedAnswer === null}>Submit</Button>
                </div>
              )}

              {activeLesson.type === 'survey' && activeLesson.quiz_data && (
                <div className="space-y-6">
                  {activeLesson.quiz_data.map((q: any, idx: number) => (
                    <div key={idx} className="space-y-2 border-t pt-4">
                      <Label className="font-medium">{idx + 1}. {q.q}</Label>
                      {q.type === 'rating' && <div className="flex gap-1 mt-2">{[1,2,3,4,5].map(star => <button key={star} onClick={() => setSurveyInputs(p => ({...p, [q.q]: star}))} className={`${(surveyInputs[q.q]||0) >= star ? 'text-yellow-400' : 'text-gray-300'}`}><Star className="w-6 h-6 fill-current" /></button>)}</div>}
                      {q.type === 'text' && <Textarea value={surveyInputs[q.q] || ''} onChange={e => setSurveyInputs(p => ({...p, [q.q]: e.target.value}))} />}
                      {q.type === 'multiple_choice' && <div className="grid grid-cols-2 gap-2 mt-2">{q.a.map((opt: string, i: number) => <div key={i} onClick={() => setSurveyInputs(p => ({...p, [q.q]: i}))} className={`p-2 border rounded cursor-pointer text-sm ${surveyInputs[q.q] === i ? 'border-blue-500 bg-blue-50' : ''}`}>{opt}</div>)}</div>}
                    </div>
                  ))}
                  <div className="border-t pt-4"><Label>Comments</Label><Textarea value={surveyInputs['feedback'] || ''} onChange={e => setSurveyInputs(p => ({...p, ['feedback']: e.target.value}))} /></div>
                  <Button onClick={handleSurveySubmit}>Submit Feedback</Button>
                </div>
              )}

              {![ 'quiz', 'survey'].includes(activeLesson.type) && (
                <div className="mt-8 border-t pt-4 flex justify-end">
                  {!progress[activeLesson.id] ? <Button onClick={() => handleMarkComplete(activeLesson.id)}>Mark Complete <Check className="w-4 h-4 ml-2" /></Button> : <div className="flex items-center gap-2 text-green-600 font-medium"><CheckCircle className="w-5 h-5" /> Done</div>}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}