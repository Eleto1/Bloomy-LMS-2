import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Lock, Menu, X,
  FileText, Video, HelpCircle, Link as LinkIcon, LayoutDashboard,
  ClipboardList, Paperclip, Download, ExternalLink, Star,
  ChevronDown, Loader2, BookOpen, PlayCircle, AlertCircle,
  Clock, Trophy, ArrowRight, RefreshCw, Info, Upload,
  Send, FileUp, Globe, AlignLeft, Eye, XCircle
} from 'lucide-react';

interface AssignmentConfig {
  instructions: string;
  instruction_type: 'text' | 'url' | 'file';
  resource_url?: string;
  allow_text: boolean;
  allow_url: boolean;
  allow_file: boolean;
  due_note?: string;
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  content: string;
  module_id: string;
  order_index: number;
  file_url?: string;
  file_downloadable?: boolean;
  indent_level?: number;
  quiz_data?: QuizQuestion[];
  assignment_config?: AssignmentConfig;
}

interface Module {
  id: string;
  title: string;
  order_index: number;
  unlock_date?: string;
}

interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  score?: number;
  completed_at?: string;
  time_spent?: number;
}

interface AssignmentSubmission {
  lesson_id: string;
  status: string;
  submission_type: string;
  content: string | null;
  file_url: string | null;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  total_marks?: number | null;
}

interface QuizQuestion {
  q: string;
  type: 'text' | 'multiple_choice' | 'rating';
  a: string[];
  correct: number;
}

const LESSON_ICONS: Record<string, React.ElementType> = {
  text: FileText,
  video: Video,
  quiz: HelpCircle,
  url: LinkIcon,
  header: LayoutDashboard,
  survey: ClipboardList,
  assignment: ClipboardList
};

function getYouTubeId(url: string) {
  return url.match(/(?:youtube.com\/(?:watch?v=|embed\/)|youtu.be\/)([^&\n?#]+)/)?.[1] ?? null;
}

function formatTime(s: number) {
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

function getFileType(url: string): 'pdf' | 'image' | 'video' | 'audio' | 'other' {
  if (!url) return 'other';
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico)$/i.test(lower)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac)$/i.test(lower)) return 'audio';
  return 'other';
}

function getFileName(url: string): string {
  if (!url) return 'File';
  try {
    const parts = url.split('/');
    const last = parts[parts.length - 1].split('?')[0].split('#')[0];
    return decodeURIComponent(last) || 'File';
  } catch {
    return 'File';
  }
}

function getPdfSrc(url: string, canDownload: boolean): string {
  if (canDownload) return url;
  const base = url.split('#')[0];
  return base + '#toolbar=0&navpanes=0&scrollbar=0&statusbar=0';
}

function FileViewerModal({ url, open, onClose, canDownload }: { url: string; open: boolean; onClose: () => void; canDownload: boolean }) {
  const fileType = getFileType(url);
  const fileName = getFileName(url);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) { setLoadError(false); setLoading(true); }
  }, [open, url]);

  const iframeSrc = fileType === 'pdf' ? getPdfSrc(url, canDownload) : url;

  const blockContextMenu = (e: React.MouseEvent) => {
    if (!canDownload) e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0 rounded-none">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {fileType === 'pdf' && <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />}
            {fileType === 'image' && <Eye className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
            {fileType === 'video' && <Video className="w-4 h-4 text-purple-500 flex-shrink-0" />}
            {fileType === 'audio' && <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            {fileType === 'other' && <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />}
            <DialogTitle className="text-sm font-medium truncate">{fileName}</DialogTitle>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium uppercase flex-shrink-0">{fileType}</span>
            {!canDownload && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">View Only</span>
            )}
          </div>
          {canDownload && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <a href={url} target="_blank" rel="noopener noreferrer" download>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"><Download className="w-3 h-3" />Download</Button>
              </a>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"><ExternalLink className="w-3 h-3" />New Tab</Button>
              </a>
            </div>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-gray-900 relative">
          {loading && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /><p className="text-xs text-gray-500">Loading file...</p></div>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <XCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-gray-300 font-medium">Unable to preview this file</p>
                <p className="text-xs text-gray-500">Try downloading it instead.</p>
                {canDownload && (
                  <a href={url} target="_blank" rel="noopener noreferrer" download><Button size="sm" className="mt-2 gap-1.5"><Download className="w-3.5 h-3.5" />Download File</Button></a>
                )}
              </div>
            </div>
          )}
          {fileType === 'pdf' && (
            <iframe src={iframeSrc} className="w-full h-full border-0" title={fileName} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setLoadError(true); }} />
          )}
          {fileType === 'image' && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto" onContextMenu={blockContextMenu}>
              <img src={url} alt={fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none" draggable={canDownload} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setLoadError(true); }} />
            </div>
          )}
          {fileType === 'video' && (
            <div className="w-full h-full flex items-center justify-center p-4" onContextMenu={blockContextMenu}>
              <video src={url} controls className="max-w-full max-h-full rounded-lg" controlsList={canDownload ? " " : "nodownload"} disablePictureInPicture={!canDownload} onLoadStart={() => setLoading(false)} onError={() => { setLoading(false); setLoadError(true); }} />
            </div>
          )}
          {fileType === 'audio' && (
            <div className="w-full h-full flex items-center justify-center" onContextMenu={blockContextMenu}>
              <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center"><FileText className="w-8 h-8 text-amber-400" /></div>
                <p className="text-sm text-gray-300 font-medium text-center truncate max-w-full">{fileName}</p>
                <audio src={url} controls className="w-full" controlsList={canDownload ? " " : "nodownload"} onLoadStart={() => setLoading(false)} onError={() => { setLoading(false); setLoadError(true); }} />
              </div>
            </div>
          )}
          {fileType === 'other' && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full text-center">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center"><FileText className="w-8 h-8 text-gray-400" /></div>
                <p className="text-sm text-gray-300 font-medium">{fileName}</p>
                <p className="text-xs text-gray-500">This file type cannot be previewed inline.</p>
                {canDownload && (
                  <a href={url} target="_blank" rel="noopener noreferrer" download><Button size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" />Download File</Button></a>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileAttachmentCard({ url, label, sublabel, canDownload }: {
  url: string;
  label: string;
  sublabel?: string;
  canDownload: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileType = getFileType(url);
  const fileName = getFileName(url);
  const canPreview = fileType === 'pdf' || fileType === 'image' || fileType === 'video' || fileType === 'audio';

  return (
    <>
      <div className="p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {fileType === 'pdf' ? <FileText className="w-4 h-4 text-red-500" /> :
             fileType === 'image' ? <Eye className="w-4 h-4 text-indigo-500" /> :
             fileType === 'video' ? <Video className="w-4 h-4 text-purple-500" /> :
             <Paperclip className="w-4 h-4 text-indigo-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{fileName}</p>
          </div>
          {!canDownload && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">View Only</span>
          )}
        </div>
        <div className="flex gap-2">
          {canPreview && (
            <Button size="sm" className="flex-1 gap-1.5 bg-indigo-600 hover:bg-indigo-700" onClick={() => setViewerOpen(true)}>
              <Eye className="w-3.5 h-3.5" />View File
            </Button>
          )}
          {canDownload && (
            <a href={url} target="_blank" rel="noopener noreferrer" download className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1.5"><Download className="w-3.5 h-3.5" />Download</Button>
            </a>
          )}
          {canPreview && !canDownload && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setViewerOpen(true)}>
              <Eye className="w-3.5 h-3.5" />View File
            </Button>
          )}
          {!canPreview && canDownload && (
            <a href={url} target="_blank" rel="noopener noreferrer" download className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open</Button>
            </a>
          )}
          {!canPreview && !canDownload && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setViewerOpen(true)}>
              <Eye className="w-3.5 h-3.5" />View File
            </Button>
          )}
        </div>
      </div>
      <FileViewerModal url={url} open={viewerOpen} onClose={() => setViewerOpen(false)} canDownload={canDownload} />
    </>
  );
}

function QuizRenderer({ questions, existingScore, onComplete }: {
  questions: QuizQuestion[];
  existingScore?: number | null;
  onComplete: (score: number) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(existingScore !== null && existingScore !== undefined);
  const [score, setScore] = useState<number>(existingScore ?? 0);
  const [saving, setSaving] = useState(false);

  if (!questions?.length) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
        <AlertCircle className="w-4 h-4" />No questions found.
      </div>
    );
  }

  const handleSubmit = async () => {
    let correct = 0;
    let graded = 0;
    questions.forEach((q, i) => {
      if (q.type === 'multiple_choice') {
        graded++;
        if (answers[i] === q.correct) correct++;
      }
    });
    const pct = graded > 0 ? Math.round((correct / graded) * 100) : 100;
    setSaving(true);
    await onComplete(pct);
    setScore(pct);
    setSubmitted(true);
    setSaving(false);
  };

  const getOptionStyle = (i: number, oi: number) => {
    if (!submitted && answers[i] === oi) return 'bg-indigo-50 border-indigo-500 cursor-pointer';
    if (submitted && oi === (questions[i]?.correct ?? -1)) return 'bg-emerald-50 border-emerald-400 cursor-default';
    if (submitted && oi === answers[i] && oi !== (questions[i]?.correct ?? -1)) return 'bg-red-50 border-red-400 cursor-default';
    return 'bg-gray-50 border-gray-200 hover:bg-indigo-50 cursor-pointer';
  };

  const getCircleStyle = (i: number, oi: number) => {
    if (!submitted && answers[i] === oi) return 'border-indigo-500 bg-indigo-500 text-white';
    if (submitted && oi === (questions[i]?.correct ?? -1)) return 'border-emerald-500 bg-emerald-500 text-white';
    if (submitted && oi === answers[i]) return 'border-red-500 bg-red-500 text-white';
    return 'border-gray-300 text-gray-500';
  };

  return (
    <div className="space-y-6">
      {submitted && (
        <div className={score >= 70 ? 'p-5 rounded-2xl text-center border-2 bg-emerald-50 border-emerald-300' : 'p-5 rounded-2xl text-center border-2 bg-red-50 border-red-300'}>
          <div className={score >= 70 ? 'text-4xl font-black mb-1 text-emerald-600' : 'text-4xl font-black mb-1 text-red-500'}>{score}%</div>
          <p className={score >= 70 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
            {score >= 70 ? '🎉 Passed!' : '😟 Below 70%'}
          </p>
          {score < 70 && (
            <Button size="sm" variant="outline" className="mt-3 border-red-300 text-red-600" onClick={() => { setSubmitted(false); setAnswers({}); setScore(0); }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retake
            </Button>
          )}
        </div>
      )}
      {questions.map((q, i) => (
        <div key={i} className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="font-semibold text-gray-900 mb-4 leading-relaxed">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mr-2">
              {i + 1}
            </span>
            {q.q}
          </p>
          {q.type === 'multiple_choice' && (
            <div className="space-y-2">
              {(q.a || []).filter(Boolean).map((opt, oi) => (
                <button key={oi} disabled={submitted} onClick={() => setAnswers(prev => ({ ...prev, [i]: oi }))} className={'w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all ' + getOptionStyle(i, oi)}>
                  <span className={'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ' + getCircleStyle(i, oi)}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                  {submitted && oi === q.correct && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
                </button>
              ))}
              {submitted && answers[i] !== undefined && answers[i] !== q.correct && q.a?.[q.correct] && (
                <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                  ✓ Correct: <strong>{q.a[q.correct]}</strong>
                </p>
              )}
            </div>
          )}
          {q.type === 'text' && (
            <textarea className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-indigo-400" rows={4} placeholder="Type your answer..." disabled={submitted} onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))} />
          )}
        </div>
      ))}
      {!submitted && (
        <Button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || saving} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base font-semibold">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : 'Submit Quiz'}
        </Button>
      )}
    </div>
  );
}

function SurveyRenderer({ questions, alreadySubmitted, onComplete }: {
  questions: QuizQuestion[];
  alreadySubmitted: boolean;
  onComplete: (answers: Record<number, any>, rating: number | null) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState<Record<number, number>>({});

  if (!questions?.length) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
        <AlertCircle className="w-4 h-4" />No questions.
      </div>
    );
  }

  const handleSubmit = async () => {
    const rv = questions
      .map((q, i) => q.type === 'rating' ? Number(answers[i]) : null)
      .filter((v): v is number => v !== null && !isNaN(v));
    const avgR = rv.length > 0 ? Math.round((rv.reduce((a, b) => a + b, 0) / rv.length) * 10) / 10 : null;
    setSaving(true);
    await onComplete(answers, avgR);
    setSubmitted(true);
    setSaving(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">Thank you for your feedback!</h3>
        <p className="text-gray-500 text-sm">Your response has been recorded.</p>
      </div>
    );
  }

  const allAnswered = questions.every((q, i) =>
    q.type === 'text' ? (answers[i] || '').trim().length > 0 : answers[i] !== undefined
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
        <Info className="w-4 h-4 flex-shrink-0" />Your feedback is anonymous.
      </div>
      {questions.map((q, i) => (
        <div key={i} className="bg-white border-2 border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="font-semibold text-gray-900 mb-4">
            <span className="text-indigo-500 mr-1">{i + 1}.</span>{q.q}
          </p>
          {q.type === 'rating' && (
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} onClick={() => setAnswers(prev => ({ ...prev, [i]: r }))} onMouseEnter={() => setHovered(prev => ({ ...prev, [i]: r }))} onMouseLeave={() => setHovered(prev => ({ ...prev, [i]: 0 }))} className="transition-transform hover:scale-110">
                  <Star className={r <= (hovered[i] || answers[i] || 0) ? 'w-9 h-9 transition-colors text-amber-400 fill-amber-400' : 'w-9 h-9 transition-colors text-gray-200'} />
                </button>
              ))}
              {answers[i] && (
                <span className="text-sm text-gray-600 ml-2 font-medium">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][answers[i]]}
                </span>
              )}
            </div>
          )}
          {q.type === 'multiple_choice' && (
            <div className="space-y-2">
              {(q.a || []).filter(Boolean).map((opt, oi) => (
                <button key={oi} onClick={() => setAnswers(prev => ({ ...prev, [i]: oi }))} className={answers[i] === oi ? 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all bg-indigo-50 border-indigo-500 text-indigo-800' : 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all bg-gray-50 border-gray-200 hover:border-indigo-200'}>
                  <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                </button>
              ))}
            </div>
          )}
          {q.type === 'text' && (
            <textarea className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-indigo-400" rows={4} placeholder="Share your thoughts..." value={answers[i] || ''} onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))} />
          )}
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={!allAnswered || saving} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base font-semibold">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : 'Submit Feedback'}
      </Button>
    </div>
  );
}

function AssignmentRenderer({ lesson, userId, existingSub, onComplete }: {
  lesson: Lesson;
  userId: string;
  existingSub: AssignmentSubmission | null;
  onComplete: () => Promise<void>;
}) {
  const config = lesson.assignment_config;
  const hasConfig = !!config;
  const defaultSubType = hasConfig ? (config.allow_text ? 'text' : config.allow_url ? 'url' : 'file') : 'text';
  const [subType, setSubType] = useState<'text' | 'url' | 'file'>(defaultSubType);
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingSub);
  const { toast } = useToast();

  const instructionsText = hasConfig && config.instructions ? config.instructions : lesson.content || '';
  const showResourceUrl = hasConfig && config.instruction_type === 'url' && config.resource_url;
  const showFileDownload = hasConfig && config.instruction_type === 'file' && lesson.file_url && lesson.file_downloadable !== false;
  const showLegacyFile = !hasConfig && lesson.file_url && lesson.file_downloadable !== false;
  const canText = !hasConfig || config.allow_text;
  const canUrl = !hasConfig || config.allow_url;
  const canFile = !hasConfig || config.allow_file;

  const handleSubmit = async () => {
    if (subType === 'text' && !textInput.trim()) return toast({ title: 'Please write your answer', variant: 'destructive' });
    if (subType === 'url' && !urlInput.trim()) return toast({ title: 'Please enter a URL', variant: 'destructive' });
    if (subType === 'file' && !file) return toast({ title: 'Please select a file', variant: 'destructive' });
    setSubmitting(true);
    try {
      let fileUrl: string | null = null;
      if (subType === 'file' && file) {
        setUploading(true);
        const safeName = file.name.replace(/[^a-zA-Z0-9.*-]/g, '*').replace(/\/+/g, '*');
        const path = 'assignments/' + userId + '/' + lesson.id + '/' + Date.now() + '_' + safeName;
        const { error: upErr } = await supabase.storage.from('course-files').upload(path, file);
        if (upErr) throw upErr;
        const { data: ud } = supabase.storage.from('course-files').getPublicUrl(path);
        fileUrl = ud.publicUrl;
        setUploading(false);
      }
      const submissionPayload: Record<string, any> = {
        user_id: userId,
        lesson_id: lesson.id,
        submission_type: subType,
        file_url: fileUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: 0,
        feedback: '',
        total_marks: 0,
      };
      if (subType === 'text') submissionPayload.content = textInput;
      if (subType === 'url') submissionPayload.content = urlInput;
      const { error } = await supabase.from('assignment_submissions').upsert(submissionPayload, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;
      await onComplete();
      setSubmitted(true);
      toast({ title: '✓ Assignment submitted!' });
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (submitted || existingSub) {
    const sub = existingSub;
    return (
      <div className="space-y-5">
        {instructionsText && (
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Assignment Instructions</p>
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{instructionsText}</div>
          </div>
        )}
        {showResourceUrl && (
          <a href={config!.resource_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
            <Globe className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div><p className="text-sm font-semibold text-indigo-700">Open Assignment Brief</p></div>
          </a>
        )}
        {(showFileDownload || showLegacyFile) && (
          <FileAttachmentCard url={lesson.file_url!} label="Assignment File" sublabel="Attached resource" canDownload={true} />
        )}
        {!showFileDownload && !showLegacyFile && hasConfig && config!.instruction_type === 'file' && lesson.file_url && lesson.file_downloadable === false && (
          <FileAttachmentCard url={lesson.file_url!} label="Assignment File" sublabel="Attached resource (view only)" canDownload={false} />
        )}
        <div className="p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="font-semibold text-emerald-800">Assignment Submitted</p>
            {sub && <span className="text-xs text-emerald-600 ml-auto">{new Date(sub.submitted_at).toLocaleDateString()}</span>}
          </div>
          {sub && (
            <div className="space-y-2">
              {sub.submission_type === 'text' && sub.content && (
                <div className="bg-white rounded-xl p-3 border text-sm text-gray-700 whitespace-pre-wrap">{sub.content}</div>
              )}
              {sub.submission_type === 'url' && sub.content && (
                <a href={sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 underline text-sm">
                  <Globe className="w-4 h-4" />{sub.content}
                </a>
              )}
              {sub.submission_type === 'file' && sub.file_url && (
                <FileAttachmentCard url={sub.file_url} label="Your Submitted File" canDownload={true} />
              )}
            </div>
          )}
          {sub?.score !== null && sub?.score !== undefined && sub.score > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <div className="flex items-center gap-3">
                <div className={sub.score >= 70 ? 'px-3 py-1.5 rounded-lg font-bold text-sm bg-emerald-600 text-white' : 'px-3 py-1.5 rounded-lg font-bold text-sm bg-red-500 text-white'}>{sub.score}%</div>
                <span className="text-emerald-700 text-sm font-medium">Graded</span>
              </div>
              {sub.feedback && (
                <div className="mt-2 p-3 bg-white rounded-xl border text-sm text-gray-600">
                  <span className="font-semibold text-gray-700">Feedback: </span>{sub.feedback}
                </div>
              )}
            </div>
          )}
          {sub && (sub.score === null || sub.score === 0) && <p className="mt-2 text-xs text-emerald-600">⏳ Awaiting instructor grade</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {instructionsText && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Assignment Instructions</p>
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{instructionsText}</div>
        </div>
      )}
      {showResourceUrl && (
        <a href={config!.resource_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
          <Globe className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <div><p className="text-sm font-semibold text-indigo-700">Open Assignment Brief</p></div>
        </a>
      )}
      {(showFileDownload || showLegacyFile) && (
        <FileAttachmentCard url={lesson.file_url!} label="Assignment File" sublabel="Download or view the attached resource" canDownload={true} />
      )}
      {!showFileDownload && !showLegacyFile && hasConfig && config!.instruction_type === 'file' && lesson.file_url && lesson.file_downloadable === false && (
        <FileAttachmentCard url={lesson.file_url!} label="Assignment File" sublabel="View the attached resource" canDownload={false} />
      )}
      {hasConfig && config!.due_note && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{config!.due_note}</span>
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">Submit Your Work</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {canText && (
            <button onClick={() => setSubType('text')} className={subType === 'text' ? 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-indigo-50 border-indigo-500 text-indigo-700' : 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-200'}>
              <AlignLeft className="w-5 h-5" />
              <span className="text-xs font-medium">Write Text</span>
            </button>
          )}
          {canUrl && (
            <button onClick={() => setSubType('url')} className={subType === 'url' ? 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-indigo-50 border-indigo-500 text-indigo-700' : 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-200'}>
              <Globe className="w-5 h-5" />
              <span className="text-xs font-medium">Submit a Link</span>
            </button>
          )}
          {canFile && (
            <button onClick={() => setSubType('file')} className={subType === 'file' ? 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-indigo-50 border-indigo-500 text-indigo-700' : 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-200'}>
              <FileUp className="w-5 h-5" />
              <span className="text-xs font-medium">Upload File</span>
            </button>
          )}
        </div>
        {subType === 'text' && (
          <textarea className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-indigo-400" rows={8} placeholder="Write your assignment answer here..." value={textInput} onChange={e => setTextInput(e.target.value)} />
        )}
        {subType === 'url' && (
          <div>
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input type="url" placeholder="https://..." className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-400" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Google Drive, GitHub, Notion, etc.</p>
          </div>
        )}
        {subType === 'file' && (
          <label className={file ? 'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all border-indigo-400 bg-indigo-50' : 'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all border-gray-200 hover:border-indigo-300'}>
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file ? (
              <>
                <FileText className="w-8 h-8 text-indigo-500" />
                <p className="text-sm font-medium text-indigo-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">Click to select a file</p>
                <p className="text-xs text-gray-400">PDF, DOC, ZIP, images etc.</p>
              </>
            )}
          </label>
        )}
      </div>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base font-semibold">
        {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : <><Send className="w-4 h-4 mr-2" />Submit Assignment</>}
      </Button>
    </div>
  );
}

export default function StudentLearn() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const startedAt = useRef<Date>(new Date());
  const contentRef = useRef<HTMLDivElement>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [submittedSurveys, setSubmittedSurveys] = useState<Set<string>>(new Set());
  const [assignmentSubs, setAssignmentSubs] = useState<Record<string, AssignmentSubmission>>({});
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [userId, setUserId] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState(false);

  useEffect(() => { fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !courseId) return;
      setUserId(user.id);

      const { data: cd } = await supabase.from('courses').select('title').eq('id', courseId).single();
      if (cd) setCourseTitle(cd.title);

      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order_index');
      setModules(mods || []);
      if (!mods?.length) { setLoading(false); return; }

      const initExp: Record<string, boolean> = {};
      mods.forEach(m => { initExp[m.id] = true; });
      setExpanded(initExp);

      const { data: lessData } = await supabase.from('lessons').select('*').in('module_id', mods.map(m => m.id)).order('order_index');
      const map: Record<string, Lesson[]> = {};
      (lessData || []).forEach(l => { if (!map[l.module_id]) map[l.module_id] = []; map[l.module_id].push(l); });
      setLessons(map);

      const { data: prog } = await supabase.from('lesson_progress').select('*').eq('user_id', user.id);
      const progData = prog || [];
      setProgress(progData);

      const surveyIds = (lessData || []).filter(l => l.type === 'survey').map(l => l.id);
      if (surveyIds.length > 0) {
        const { data: sr } = await supabase.from('survey_responses').select('lesson_id').eq('user_id', user.id).in('lesson_id', surveyIds);
        setSubmittedSurveys(new Set((sr || []).map(r => r.lesson_id)));
      }

      const assignIds = (lessData || []).filter(l => l.type === 'assignment').map(l => l.id);
      if (assignIds.length > 0) {
        const { data: ar } = await supabase.from('assignment_submissions').select('*').eq('user_id', user.id).in('lesson_id', assignIds);
        const am: Record<string, AssignmentSubmission> = {};
        (ar || []).forEach(a => { am[a.lesson_id] = a; });
        setAssignmentSubs(am);
      }

      const reqId = searchParams.get('lesson');
      const allLes = lessData || [];
      const nonH = allLes.filter(l => l.type !== 'header');
      const doneIds = new Set(progData.filter(p => p.completed).map(p => p.lesson_id));

      if (reqId) {
        const found = allLes.find(l => l.id === reqId);
        setActiveLesson(found || nonH[0] || null);
      } else {
        setActiveLesson(nonH.find(l => !doneIds.has(l.id)) || nonH[0] || null);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const allLessons = Object.values(lessons).flat();
  const nonHeaders = allLessons.filter(l => l.type !== 'header');
  const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const totalLessons = nonHeaders.length;
  const doneLessons = nonHeaders.filter(l => completedIds.has(l.id)).length;
  const overallPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const activeIdx = activeLesson ? nonHeaders.findIndex(l => l.id === activeLesson.id) : -1;
  const prevLesson = activeIdx > 0 ? nonHeaders[activeIdx - 1] : null;
  const nextLesson = activeIdx < nonHeaders.length - 1 ? nonHeaders[activeIdx + 1] : null;
  const activeProgress = activeLesson ? progress.find(p => p.lesson_id === activeLesson.id) ?? null : null;
  const isDone = activeLesson ? completedIds.has(activeLesson.id) : false;

  const isLessonLocked = useCallback((lesson: Lesson): boolean => {
    const mod = modules.find(m => m.id === lesson.module_id);
    if (mod?.unlock_date && new Date(mod.unlock_date) > new Date()) return true;
    if (lesson.type === 'header') return false;
    const idx = nonHeaders.findIndex(l => l.id === lesson.id);
    if (idx <= 0) return false;
    return !completedIds.has(nonHeaders[idx - 1].id);
  }, [modules, nonHeaders, completedIds]);

  const selectLesson = (lesson: Lesson) => {
    if (lesson.type === 'header') return;
    if (isLessonLocked(lesson)) {
      const idx = nonHeaders.findIndex(l => l.id === lesson.id);
      const prev = idx > 0 ? nonHeaders[idx - 1] : null;
      toast({ title: '🔒 Complete previous lesson first', description: prev ? 'Finish "' + prev.title + '" first.' : undefined, variant: 'destructive' });
      return;
    }
    startedAt.current = new Date();
    setActiveLesson(lesson);
    setSearchParams({ lesson: lesson.id });
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markComplete = async (score?: number): Promise<void> => {
    if (!activeLesson || !userId) return;
    setMarking(true);
    const timeSpent = Math.round((new Date().getTime() - startedAt.current.getTime()) / 1000);
    try {
      const payload: Record<string, any> = { user_id: userId, lesson_id: activeLesson.id, completed: true, time_spent: timeSpent, updated_at: new Date().toISOString() };
      if (score !== undefined) payload.score = score;
      let { error } = await supabase.from('lesson_progress').upsert({ ...payload, completed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
      if (error?.message?.includes('completed_at')) { ({ error } = await supabase.from('lesson_progress').upsert(payload, { onConflict: 'user_id,lesson_id' })); }
      if (error) throw error;
      setProgress(prev => [...prev.filter(p => p.lesson_id !== activeLesson.id), { lesson_id: activeLesson.id, completed: true, score, completed_at: new Date().toISOString(), time_spent: timeSpent }]);
      toast({ title: '✓ Lesson completed!' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); } finally { setMarking(false); }
  };

  const markSurveyComplete = async (answers: Record<number, any>, rating: number | null): Promise<void> => {
    if (!activeLesson || !userId) return;
    setMarking(true);
    try {
      const answersArray = (activeLesson.quiz_data || []).map((q, i) => ({ question: q.q, type: q.type, answer: answers[i] ?? null, label: q.type === 'rating' && answers[i] ? ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][answers[i] as number] || '' : '', optionText: q.type === 'multiple_choice' && answers[i] !== undefined ? (q.a?.[answers[i] as number] || '') : '' }));
      const { error: surveyErr } = await supabase.from('survey_responses').upsert({ user_id: userId, lesson_id: activeLesson.id, answers: answersArray, rating }, { onConflict: 'user_id,lesson_id' });
      if (surveyErr) { console.error('Survey save error details:', surveyErr); throw new Error('Failed to save survey: ' + surveyErr.message); }
      const timeSpent = Math.round((new Date().getTime() - startedAt.current.getTime()) / 1000);
      const { error: progressErr } = await supabase.from('lesson_progress').upsert({ user_id: userId, lesson_id: activeLesson.id, completed: true, time_spent: timeSpent, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
      if (progressErr?.message?.includes('completed_at')) {
        const { error: fallbackErr } = await supabase.from('lesson_progress').upsert({ user_id: userId, lesson_id: activeLesson.id, completed: true, time_spent: timeSpent, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
        if (fallbackErr) throw fallbackErr;
      } else if (progressErr) { throw progressErr; }
      setProgress(prev => [...prev.filter(p => p.lesson_id !== activeLesson.id), { lesson_id: activeLesson.id, completed: true, completed_at: new Date().toISOString(), time_spent: timeSpent }]);
      setSubmittedSurveys(prev => new Set([...prev, activeLesson.id]));
      toast({ title: '✓ Survey submitted successfully!', description: 'Your feedback has been saved.' });
    } catch (e: any) { console.error('markSurveyComplete error:', e); toast({ title: 'Failed to submit survey', description: e.message || 'Please try again or contact support.', variant: 'destructive' }); } finally { setMarking(false); }
  };

  const markAssignmentComplete = async (): Promise<void> => {
    if (!activeLesson || !userId) return;
    const timeSpent = Math.round((new Date().getTime() - startedAt.current.getTime()) / 1000);
    const payload: Record<string, any> = { user_id: userId, lesson_id: activeLesson.id, completed: true, time_spent: timeSpent, updated_at: new Date().toISOString() };
    let { error } = await supabase.from('lesson_progress').upsert({ ...payload, completed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
    if (error?.message?.includes('completed_at')) { ({ error } = await supabase.from('lesson_progress').upsert(payload, { onConflict: 'user_id,lesson_id' })); }
    setProgress(prev => [...prev.filter(p => p.lesson_id !== activeLesson.id), { lesson_id: activeLesson.id, completed: true, time_spent: timeSpent }]);
    const { data: ar } = await supabase.from('assignment_submissions').select('*').eq('user_id', userId).eq('lesson_id', activeLesson.id).single();
    if (ar) setAssignmentSubs(prev => ({ ...prev, [activeLesson.id]: ar }));
  };

  const renderContent = () => {
    if (!activeLesson) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-gray-300">
          <BookOpen className="w-16 h-16" />
          <div className="text-center"><p className="text-gray-500 font-medium">Select a lesson from the sidebar</p></div>
        </div>
      );
    }
    if (isLessonLocked(activeLesson)) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center"><Lock className="w-8 h-8 text-gray-400" /></div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-700">Lesson Locked</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">Complete the previous lesson to unlock this one.</p>
            {prevLesson && <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={() => selectLesson(prevLesson)}>Go to Previous Lesson</Button>}
          </div>
        </div>
      );
    }

    const lessonType = activeLesson.type;
    const isInteractive = lessonType === 'quiz' || lessonType === 'survey' || lessonType === 'assignment' || lessonType === 'header';

    return (
      <div className="max-w-3xl mx-auto pb-16">
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-3 flex-1">
            {isDone && <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />}
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{activeLesson.title}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium capitalize">{lessonType === 'url' ? 'External Link' : lessonType}</span>
            {activeIdx >= 0 && <span className="text-xs text-gray-400">Lesson {activeIdx + 1} of {totalLessons}</span>}
            {isDone && <span className="text-xs px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Completed</span>}
            {activeProgress?.score !== undefined && activeProgress.score !== null && (
              <span className={activeProgress.score >= 70 ? 'text-xs px-3 py-1 rounded-full font-medium bg-emerald-50 text-emerald-600' : 'text-xs px-3 py-1 rounded-full font-medium bg-red-50 text-red-600'}>Score: {activeProgress.score}%</span>
            )}
          </div>
        </div>

        {lessonType === 'text' && (
          <div className="bg-white border rounded-2xl p-8 shadow-sm">
            {activeLesson.content ? <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed text-[15px] whitespace-pre-wrap">{activeLesson.content}</div> : <p className="text-gray-400 italic text-center py-8">No content yet.</p>}
          </div>
        )}

        {lessonType === 'video' && (
          <div className="rounded-2xl overflow-hidden bg-black shadow-xl">
            {activeLesson.content && getYouTubeId(activeLesson.content) ? (
              <div className="aspect-video"><iframe key={activeLesson.id} src={'https://www.youtube.com/embed/' + getYouTubeId(activeLesson.content) + '?rel=0'} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
            ) : activeLesson.content ? (
              <div className="aspect-video"><video key={activeLesson.id} src={activeLesson.content} controls className="w-full h-full" onEnded={() => !isDone && markComplete()} /></div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-gray-500"><div className="text-center"><PlayCircle className="w-12 h-12 mx-auto mb-2 text-gray-600" /><p className="text-sm">No video URL.</p></div></div>
            )}
          </div>
        )}

        {lessonType === 'url' && (activeLesson.content ? (
          <a href={activeLesson.content} target="_blank" rel="noopener noreferrer" className="block">
            <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-10 text-center hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer group">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-200"><ExternalLink className="w-7 h-7 text-indigo-600" /></div>
              <p className="font-bold text-indigo-700 text-lg">Open External Resource</p>
              <p className="text-xs text-gray-400 mt-2 truncate max-w-sm mx-auto">{activeLesson.content}</p>
            </div>
          </a>
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center"><p className="text-gray-400">No URL provided.</p></div>
        ))}

        {lessonType === 'header' && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500 rounded-r-2xl p-6">
            <h2 className="text-xl font-bold text-indigo-800">{activeLesson.title}</h2>
            {activeLesson.content && <p className="text-indigo-600 text-sm mt-2 leading-relaxed">{activeLesson.content}</p>}
          </div>
        )}

        {lessonType === 'quiz' && (
          <QuizRenderer key={activeLesson.id} questions={activeLesson.quiz_data || []} existingScore={activeProgress?.score} onComplete={async (score) => { await markComplete(score); }} />
        )}

        {lessonType === 'survey' && (
          <SurveyRenderer key={activeLesson.id} questions={activeLesson.quiz_data || []} alreadySubmitted={submittedSurveys.has(activeLesson.id)} onComplete={markSurveyComplete} />
        )}

        {lessonType === 'assignment' && (
          <AssignmentRenderer key={activeLesson.id} lesson={activeLesson} userId={userId} existingSub={assignmentSubs[activeLesson.id] ?? null} onComplete={markAssignmentComplete} />
        )}

        {activeLesson.file_url && lessonType !== 'assignment' && (
          <div className="mt-6">
            <FileAttachmentCard url={activeLesson.file_url!} label="Lesson Resource" sublabel="Attached file for this lesson" canDownload={activeLesson.file_downloadable !== false} />
          </div>
        )}

        {!isInteractive && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {isDone ? (
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-semibold">Completed!</p>
                    {activeProgress?.time_spent && <p className="text-xs text-gray-400">Time: {formatTime(activeProgress.time_spent)}</p>}
                  </div>
                </div>
              ) : (
                <Button onClick={() => markComplete()} disabled={marking} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-semibold">
                  {marking ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Mark as Complete</>}
                </Button>
              )}
              {nextLesson && !isLessonLocked(nextLesson) && (
                <Button variant={isDone ? 'default' : 'outline'} className={isDone ? 'bg-indigo-600 hover:bg-indigo-700 h-11 px-6' : 'h-11 px-6'} onClick={() => selectLesson(nextLesson)}>
                  {'Next: ' + (nextLesson.title.length > 28 ? nextLesson.title.slice(0, 28) + '…' : nextLesson.title)}<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {isInteractive && lessonType !== 'header' && isDone && nextLesson && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
            <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6" onClick={() => selectLesson(nextLesson)} disabled={isLessonLocked(nextLesson)}>Continue<ArrowRight className="w-4 h-4 ml-2" /></Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /><p className="text-sm text-gray-500">Loading course...</p></div>
      </div>
    );
  }

  const sidebarWidth = sidebarOpen ? 'w-80' : 'w-0';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={sidebarWidth + ' flex-shrink-0 transition-all duration-300 overflow-hidden'}>
        <div className="w-80 h-full bg-white border-r flex flex-col shadow-sm">
          <div className="p-4 border-b bg-gray-50/80">
            <button onClick={() => navigate('/student/courses')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 mb-3"><ChevronLeft className="w-3 h-3" />Back</button>
            <h2 className="font-bold text-gray-900 text-sm line-clamp-2 mb-3">{courseTitle}</h2>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>{doneLessons}/{totalLessons} lessons</span><span className="font-semibold text-indigo-600">{overallPct}%</span></div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: overallPct + '%', background: overallPct === 100 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#6366f1,#4f46e5)' }} />
            </div>
            {overallPct === 100 && (<div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium"><Trophy className="w-3.5 h-3.5" />Course completed!</div>)}
          </div>
          <div className="flex-1 overflow-y-auto">
            {modules.map((mod, mIdx) => {
              const modLessons = lessons[mod.id] || [];
              const modNonH = modLessons.filter(l => l.type !== 'header');
              const modDone = modNonH.filter(l => completedIds.has(l.id)).length;
              const modLocked = mod.unlock_date && new Date(mod.unlock_date) > new Date();
              const isExp = expanded[mod.id];
              const modComplete = modDone === modNonH.length && modNonH.length > 0;
              return (
                <div key={mod.id} className="border-b border-gray-100">
                  <button disabled={!!modLocked} onClick={() => setExpanded(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left transition-colors">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className={modComplete ? 'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-700' : modLocked ? 'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-400' : 'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-indigo-100 text-indigo-700'}>
                        {modComplete ? '✓' : modLocked ? '🔒' : mIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{mod.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{modLocked ? 'Unlocks ' + new Date(mod.unlock_date!).toLocaleDateString() : modDone + '/' + modNonH.length + ' done'}</p>
                      </div>
                    </div>
                    {!modLocked && (isExp ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />)}
                  </button>
                  {isExp && !modLocked && (
                    <div>
                      {modLessons.map(les => {
                        const isActive = activeLesson?.id === les.id;
                        const isDoneLes = completedIds.has(les.id);
                        const isSurvDone = les.type === 'survey' && submittedSurveys.has(les.id);
                        const isAssignSub = les.type === 'assignment' && !!assignmentSubs[les.id];
                        const locked = les.type !== 'header' && isLessonLocked(les);
                        const Icon = LESSON_ICONS[les.type] || FileText;
                        if (les.type === 'header') {
                          return (<div key={les.id} className="px-4 py-2 bg-gray-50 border-t border-gray-100"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{les.title}</p></div>);
                        }
                        const isComplete = isDoneLes || isSurvDone;
                        let lessonBtnClass = 'w-full flex items-center gap-2.5 pr-3 py-2.5 text-left text-xs border-t border-gray-50 transition-all ';
                        if (isActive) { lessonBtnClass += 'bg-indigo-50 border-l-[3px] border-l-indigo-500'; } else if (locked) { lessonBtnClass += 'opacity-50 cursor-not-allowed hover:bg-gray-50'; } else { lessonBtnClass += 'hover:bg-gray-50 cursor-pointer'; }
                        let iconBgClass = 'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ';
                        if (isComplete) iconBgClass += 'bg-emerald-100'; else if (isAssignSub) iconBgClass += 'bg-amber-100'; else if (isActive) iconBgClass += 'bg-indigo-100'; else iconBgClass += 'bg-gray-100';
                        let textClass = 'flex-1 truncate leading-snug ';
                        if (isActive) textClass += 'text-indigo-700 font-semibold'; else if (isComplete) textClass += 'text-gray-400'; else if (locked) textClass += 'text-gray-400'; else textClass += 'text-gray-700';
                        return (
                          <button key={les.id} onClick={() => selectLesson(les)} style={{ paddingLeft: (16 + (les.indent_level || 0) * 14) + 'px' }} className={lessonBtnClass}>
                            <div className={iconBgClass}>
                              {isComplete ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : isAssignSub ? <Clock className="w-3 h-3 text-amber-600" /> : locked ? <Lock className="w-3 h-3 text-gray-400" /> : <Icon className={isActive ? 'w-3 h-3 text-indigo-600' : 'w-3 h-3 text-gray-500'} />}
                            </div>
                            <span className={textClass}>{les.title}</span>
                            {isAssignSub && !isComplete && (<span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-medium">Submitted</span>)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(p => !p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            {activeLesson && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
                <span className="truncate max-w-[120px] text-gray-400">{modules.find(m => m.id === activeLesson.module_id)?.title}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="font-semibold text-gray-800 truncate max-w-[200px]">{activeLesson.title}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!prevLesson} onClick={() => prevLesson && selectLesson(prevLesson)} className="h-8 px-3"><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline ml-1">Prev</span></Button>
            <span className="text-xs text-gray-400 px-1">{activeIdx >= 0 ? (activeIdx + 1) + '/' + totalLessons : '—'}</span>
            <Button size="sm" variant="outline" disabled={!nextLesson || (nextLesson ? isLessonLocked(nextLesson) : false)} onClick={() => nextLesson && selectLesson(nextLesson)} className="h-8 px-3"><span className="hidden sm:inline mr-1">Next</span><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </header>
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 md:p-10">{renderContent()}</div>
      </div>
    </div>
  );
}