import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Play, FileText, HelpCircle, CheckCircle, Lock, 
  Paperclip, ArrowRight, ArrowLeft, AlertCircle, Download 
} from 'lucide-react';

interface Lesson { 
  id: string; 
  title: string; 
  type: string; 
  content: string | null; 
  module_id: string; 
  file_url: string | null; 
  quiz_data: any; 
  order_index: number;
}
interface Module { id: string; title: string; order_index: number; }
interface LessonProgress { [lessonId: string]: boolean }

export default function StudentCourseViewer() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress>({});
  
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'lesson'>('list');
  
  // Quiz State
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    const verifyAndFetch = async () => {
      if (!courseId || !user) return;
      setLoading(true);

      // 1. Get Student's Cohort
      const { data: profile } = await supabase
        .from('profiles')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      // 2. Get Cohort's Program Name
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('course')
        .eq('id', profile.cohort_id)
        .single();

      // 3. Get Course Details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      setCourse(courseData);

      // 4. AUTHORIZATION CHECK
      if (cohort?.course !== courseData?.program) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      // 5. Fetch Modules
      const { data: mods } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');
      setModules(mods || []);

      // 6. Fetch Lessons
      if (mods && mods.length > 0) {
        const modIds = mods.map(m => m.id);
        const { data: less } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', modIds)
          .order('order_index');
        setLessons(less || []);

        // 7. Fetch Progress
        const lessIds = (less || []).map(l => l.id);
        const { data: prog } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .in('lesson_id', lessIds);
        
        const map: LessonProgress = {};
        (prog || []).forEach(p => map[p.lesson_id] = true);
        setProgress(map);
      }

      setLoading(false);
    };

    verifyAndFetch();
  }, [courseId, user]);

  // Logic: Is Lesson Unlocked?
  const isUnlocked = (index: number) => {
    if (index === 0) return true; // First lesson always unlocked
    const prevLesson = lessons[index - 1];
    return progress[prevLesson.id]; // Unlocked only if previous is done
  };

  // Handle Mark Complete
  const handleMarkComplete = async (lessonId: string) => {
    if (!user) return;
    
    const { error } = await supabase.from('lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true
    });

    if (!error) {
      setProgress(prev => ({ ...prev, [lessonId]: true }));
      toast({ title: '✅ Lesson Completed!' });
    }
  };

  // Handle Quiz Submission
  const handleQuizSubmit = async () => {
    if (!activeLesson || selectedAnswer === null || !user) return;

    const correctIndex = activeLesson.quiz_data?.[currentQ]?.correct;
    const isCorrect = selectedAnswer === correctIndex;
    
    // Calculate score for this attempt
    let currentAttemptScore = quizScore;
    
    if (isCorrect) {
      currentAttemptScore = quizScore + 1;
      setQuizScore(currentAttemptScore);
      toast({ title: '✅ Correct!', description: 'Great job.' });
    } else {
      toast({ title: '❌ Incorrect', description: 'Moving to next question.', variant: 'destructive' });
    }

    // Next Question or Finish
    if (currentQ < activeLesson.quiz_data.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      // Quiz Finished - Save Result
      const totalQuestions = activeLesson.quiz_data.length;
      const passed = currentAttemptScore >= (totalQuestions / 2); // Pass if > 50%

      await supabase.from('quiz_results').insert({
        user_id: user.id,
        lesson_id: activeLesson.id,
        score: currentAttemptScore,
        total_questions: totalQuestions,
        passed: passed
      });

      if (passed) {
        await handleMarkComplete(activeLesson.id);
        toast({ title: '🎉 Quiz Passed!', description: `Score: ${currentAttemptScore}/${totalQuestions}` });
      } else {
        toast({ title: 'Quiz Failed', description: 'You need to pass to unlock the next lesson.', variant: 'destructive' });
      }
      
      setViewMode('list'); // Go back to list
    }
  };

  const openLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setViewMode('lesson');
  };

  if (loading) return <DashboardLayout><div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;

  if (!authorized) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-gray-500 mt-2">You are not enrolled in this course.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/student/courses')}>
            Back to My Courses
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {viewMode === 'list' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Link to="/student/courses" className="hover:underline">My Courses</Link>
              <span>/</span>
              <span className="text-foreground font-medium">{course?.title}</span>
            </div>

            <h1 className="text-2xl font-bold">{course?.title}</h1>
            <p className="text-gray-500">{course?.description}</p>

            {/* Modules List */}
            <div className="space-y-4">
              {modules.map(mod => (
                <Card key={mod.id} className="p-4 border-border">
                  <h3 className="font-semibold mb-3">{mod.title}</h3>
                  <div className="space-y-1">
                    {lessons.filter(l => l.module_id === mod.id).map((les, idx) => {
                      const globalIndex = lessons.findIndex(l => l.id === les.id);
                      const unlocked = isUnlocked(globalIndex);
                      const isComplete = progress[les.id];

                      return (
                        <div 
                          key={les.id} 
                          onClick={() => unlocked && openLesson(les)}
                          className={`flex items-center justify-between p-3 rounded border transition-all
                            ${isComplete ? 'bg-green-50 border-green-200' : unlocked ? 'bg-white hover:bg-gray-50 border-gray-200 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'}`}
                        >
                          <div className="flex items-center gap-3">
                            {isComplete ? <CheckCircle className="w-5 h-5 text-green-600" /> : unlocked ? <Play className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-gray-400" />}
                            <div>
                              <span className={`font-medium ${!unlocked && 'text-gray-400'}`}>{les.title}</span>
                              {les.type === 'quiz' && <span className="ml-2 text-xs text-purple-600 font-medium">(Quiz)</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {les.file_url && <Paperclip className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* LESSON VIEW */}
        {viewMode === 'lesson' && activeLesson && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('list')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Course
            </Button>

            <Card className="p-6 min-h-[60vh]">
              <h2 className="text-xl font-bold mb-4">{activeLesson.title}</h2>

              {/* Content */}
              {activeLesson.type === 'text' && (
                <div className="prose max-w-none">
                  {activeLesson.content}
                </div>
              )}

              {activeLesson.type === 'video' && (
                <div className="aspect-video bg-black rounded flex items-center justify-center">
                   <iframe 
                     src={activeLesson.content} 
                     className="w-full h-full rounded"
                     allowFullScreen
                   ></iframe>
                </div>
              )}

              {activeLesson.type === 'header' && (
                 <div className="text-center py-10 border rounded bg-blue-50">
                   <h3 className="text-2xl font-bold text-blue-800">{activeLesson.title}</h3>
                   <p className="text-gray-500 mt-2">{activeLesson.content}</p>
                   {/* Headers auto-complete for progress */}
                   {!progress[activeLesson.id] && (
                     <Button className="mt-4" onClick={() => handleMarkComplete(activeLesson.id)}>Continue</Button>
                   )}
                 </div>
              )}

              {activeLesson.type === 'quiz' && activeLesson.quiz_data && (
                <div className="space-y-4">
                  <p className="font-semibold">Question {currentQ + 1} of {activeLesson.quiz_data.length}</p>
                  <p className="text-lg">{activeLesson.quiz_data[currentQ]?.q}</p>
                  
                  <div className="space-y-2">
                    {activeLesson.quiz_data[currentQ]?.a.map((ans: string, i: number) => (
                      <div 
                        key={i}
                        onClick={() => setSelectedAnswer(i)}
                        className={`p-3 border rounded cursor-pointer transition-all
                          ${selectedAnswer === i ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        {ans}
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleQuizSubmit} disabled={selectedAnswer === null}>
                    Submit Answer
                  </Button>
                </div>
              )}

              {/* Files / Requirements */}
              {activeLesson.file_url && (
                <div className="mt-6 border-t pt-4">
                  <Label className="flex items-center gap-2"><Paperclip className="w-4 h-4" /> Requirements / Files</Label>
                  <a href={activeLesson.file_url} target="_blank" className="flex items-center gap-2 text-blue-600 underline mt-2">
                    <Download className="w-4 h-4" /> Download File
                  </a>
                </div>
              )}

              {/* Mark Complete Button (Non-Quiz/Non-Header) */}
              {!['quiz', 'header'].includes(activeLesson.type) && (
                <div className="mt-8 border-t pt-4 flex justify-end">
                  {!progress[activeLesson.id] ? (
                    <Button onClick={() => handleMarkComplete(activeLesson.id)}>
                      Mark as Complete <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle className="w-5 h-5" /> Completed
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}