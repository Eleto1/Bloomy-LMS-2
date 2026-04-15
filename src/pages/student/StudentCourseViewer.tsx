import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, CheckCircle2, Lock as LockIcon, ChevronDown, ChevronRight,
  Video, FileText, HelpCircle, ClipboardList, Link as LinkIcon,
  LayoutDashboard, Loader2, ArrowLeft, ArrowRight, Download,
  Upload, ExternalLink, Star, Send, AlertCircle, PlayCircle,
  Trophy, Clock, MessageSquare, Paperclip, Eye, ShieldCheck,
  Maximize2, X
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SMART PASTE UTILITY — converts rich HTML from clipboard to clean plain text
// ─────────────────────────────────────────────────────────────────────────────
function handleSmartPaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  setValue: (val: string) => void
) {
  const clipboard = e.clipboardData;
  const html = clipboard.getData('text/html');
  const text = clipboard.getData('text/plain');

  // If there's HTML content (from Word, Google Docs, browser, etc.), convert it
  if (html) {
    e.preventDefault();
    const clean = htmlToPlainText(html);
    setValue(clean);
    return;
  }

  // If there's only plain text, allow default paste behavior
  if (text) {
    e.preventDefault();
    setValue(text);
  }
}

function htmlToPlainText(html: string): string {
  // Create a temporary DOM element to parse HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Replace block elements with newlines before extracting text
  const blockElements = tmp.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li, tr, hr, blockquote, pre');
  blockElements.forEach(el => {
    if (el.tagName === 'BR') {
      el.replaceWith(document.createTextNode('\n'));
    } else if (el.tagName === 'HR') {
      el.replaceWith(document.createTextNode('\n────────────────\n'));
    } else {
      el.prepend(document.createTextNode('\n'));
    }
  });

  // Convert list items to bullet points
  tmp.querySelectorAll('li').forEach(li => {
    const prefix = li.closest('ol') ? `${Array.from(li.parentElement!.children).indexOf(li) + 1}. ` : '• ';
    li.prepend(document.createTextNode(prefix));
  });

  // Extract text and clean up
  let plain = tmp.textContent || tmp.innerText || '';

  // Clean up excessive newlines (3+ → 2)
  plain = plain.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace on each line
  plain = plain.split('\n').map(line => line.trim()).join('\n');

  // Trim final result
  return plain.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  description: string;
  program: string;
  status: string;
}

interface Module {
  id: string;
  title: string;
  course_id: string;
  order_index: number;
  unlock_date?: string;
  sequential_lessons?: boolean;
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

interface QuizQuestion {
  q: string;
  type: string;
  a: string[];
  correct: number;
}

interface AssignmentConfig {
  instructions: string;
  instruction_type: 'text' | 'url' | 'file';
  resource_url?: string;
  allow_text: boolean;
  allow_url: boolean;
  allow_file: boolean;
  due_note?: string;
}

interface SurveyResponse {
  question: string;
  answer: string;
  type: string;
  rating?: number;
}

interface LessonProgress {
  lesson_id: string;
  user_id: string;
  completed: boolean;
  completed_at: string;
  score?: number;
  time_spent?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Detect file type from URL
// ─────────────────────────────────────────────────────────────────────────────
function getFileType(url: string): 'pdf' | 'image' | 'video' | 'audio' | 'other' {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(lower)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|flac|m4a|aac)$/.test(lower)) return 'audio';
  return 'other';
}

function getFileExtension(url: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ext;
  } catch {
    const match = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return match ? match[1].toLowerCase() : 'file';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Google Docs Viewer URL (renders PDFs/docs without native download)
// ─────────────────────────────────────────────────────────────────────────────
function getGoogleDocsViewerUrl(originalUrl: string): string {
  return `https://docs.google.com/gview?url=${encodeURIComponent(originalUrl)}&embedded=true`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Secure iframe wrapper — blocks Google Docs Viewer toolbar buttons
// (Print, Open as Doc, Pop-out) by overlaying a transparent blocker div
// ─────────────────────────────────────────────────────────────────────────────
function SecureViewerFrame({ src, title, height }: {
  src: string; title: string; height: string;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border bg-gray-50">
      {/* The actual viewer */}
      <iframe
        src={src}
        className="w-full border-0"
        style={{ height }}
        title={title}
      />
      {/* Transparent overlay that blocks Google Docs toolbar buttons.
          Covers top 65px of the iframe where Print / Open / Pop-out live.
          The rest of the document remains scrollable beneath. */}
      <div
        className="absolute top-0 left-0 right-0 z-10"
        style={{ height: '65px', background: 'transparent' }}
        title=""
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Fullscreen Modal Overlay (view-only, exit only via button or Escape)
// ─────────────────────────────────────────────────────────────────────────────
function FullscreenModal({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handlePrint = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); e.stopPropagation(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('keydown', handlePrint, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('keydown', handlePrint, true);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
      {/* Top bar — only View label and Exit */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300 font-medium truncate max-w-md">{title || 'View Only'}</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
        >
          <X className="w-4 h-4" />
          Exit Fullscreen
        </button>
      </div>
      {/* Content fills remaining space */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Embedded File Viewer (strict view-only when file_downloadable is false)
// Students only get: VIEW and FULLSCREEN (view-only, no other options)
// ─────────────────────────────────────────────────────────────────────────────
function EmbeddedFileViewer({ url, canDownload }: { url: string; canDownload: boolean }) {
  const fileType = getFileType(url);
  const ext = getFileExtension(url).toUpperCase();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Block Ctrl+P / Ctrl+S / Cmd+P / Cmd+S globally when a view-only file is rendered
  useEffect(() => {
    if (canDownload) return;
    const block = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', block, true);
    return () => document.removeEventListener('keydown', block, true);
  }, [canDownload]);

  // ── Action bar: only VIEW and FULLSCREEN buttons ───────────────────────
  const ActionBar = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {canDownload ? (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs text-indigo-700 font-medium">Download enabled</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">View only — no download</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Fullscreen (always available — view only inside) */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fullscreen
        </button>
        {/* Download button (only when instructor allows) */}
        {canDownload && (
          <a
            href={url}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download File
          </a>
        )}
      </div>
    </div>
  );

  // ──── PDF ────────────────────────────────────────────────────────────────
  // ALWAYS use Google Docs Viewer for inline display (prevents auto-download)
  // canDownload only controls the download button — never the viewer URL
  if (fileType === 'pdf') {
    const viewerSrc = getGoogleDocsViewerUrl(url);
    return (
      <div className="space-y-3">
        <ActionBar />
        <SecureViewerFrame src={viewerSrc} title="PDF viewer" height="700px" />
        <FullscreenModal open={isFullscreen} onClose={() => setIsFullscreen(false)} title="PDF Viewer">
          <div className="relative w-full h-full rounded-lg overflow-hidden">
            <iframe src={viewerSrc} className="w-full h-full border-0" title="PDF viewer fullscreen" />
            <div className="absolute top-0 left-0 right-0 z-10" style={{ height: '65px' }} />
          </div>
        </FullscreenModal>
      </div>
    );
  }

  // ──── Image ─────────────────────────────────────────────────────────────
  if (fileType === 'image') {
    return (
      <div className="space-y-3">
        <ActionBar />
        <div
          className="rounded-xl overflow-hidden border bg-gray-50 p-2"
          onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
          style={canDownload ? undefined : { userSelect: 'none' as const }}
        >
          <img
            src={url}
            alt="Lesson attachment"
            className="max-w-full max-h-[500px] mx-auto rounded-lg object-contain pointer-events-none"
            draggable={false}
            style={{ WebkitUserSelect: 'none' as const, userDrag: 'none' as const }}
          />
        </div>
        <FullscreenModal open={isFullscreen} onClose={() => setIsFullscreen(false)} title="Image — View Only">
          <div
            className="relative"
            onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
            style={canDownload ? undefined : { userSelect: 'none' as const }}
          >
            <img
              src={url}
              alt="Lesson attachment"
              className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
              draggable={false}
              style={{ WebkitUserSelect: 'none' as const, userDrag: 'none' as const }}
            />
          </div>
        </FullscreenModal>
      </div>
    );
  }

  // ──── Video ──────────────────────────────────────────────────────────────
  if (fileType === 'video') {
    return (
      <div className="space-y-3">
        <ActionBar />
        <div className="aspect-video rounded-xl overflow-hidden bg-gray-900">
          <video
            src={url}
            controls
            controlsList={canDownload ? undefined : 'nodownload noremoteplayback'}
            disablePictureInPicture={!canDownload}
            disableRemotePlayback={!canDownload}
            onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
            className="w-full h-full"
          />
        </div>
        <FullscreenModal open={isFullscreen} onClose={() => setIsFullscreen(false)} title="Video — View Only">
          <div className="w-full h-full flex items-center justify-center">
            <video
              src={url}
              controls
              controlsList={canDownload ? undefined : 'nodownload noremoteplayback'}
              disablePictureInPicture={!canDownload}
              disableRemotePlayback={!canDownload}
              onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
              className="max-w-full max-h-full rounded-lg"
              autoPlay
            />
          </div>
        </FullscreenModal>
      </div>
    );
  }

  // ──── Audio ──────────────────────────────────────────────────────────────
  if (fileType === 'audio') {
    return (
      <div className="space-y-3">
        <ActionBar />
        <div className="p-4 bg-gray-50 border rounded-xl">
          <audio
            src={url}
            controls
            controlsList={canDownload ? undefined : 'nodownload'}
            onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
            className="w-full"
          />
        </div>
        <FullscreenModal open={isFullscreen} onClose={() => setIsFullscreen(false)} title="Audio — View Only">
          <div className="w-full max-w-xl p-8">
            <audio
              src={url}
              controls
              controlsList={canDownload ? undefined : 'nodownload'}
              onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
              className="w-full"
              autoPlay
            />
          </div>
        </FullscreenModal>
      </div>
    );
  }

  // ──── Other files (doc, ppt, xls, etc) ─────────────────────────────────
  // ALWAYS use Google Docs Viewer for inline display (prevents auto-download)
  // canDownload only controls the download button — never the viewer URL
  const viewerSrc = getGoogleDocsViewerUrl(url);
  return (
    <div className="space-y-3">
      <ActionBar />
      <SecureViewerFrame src={viewerSrc} title={`File viewer (${ext})`} height="600px" />
      <FullscreenModal open={isFullscreen} onClose={() => setIsFullscreen(false)} title={`${ext} Viewer`}>
        <div className="relative w-full h-full rounded-lg overflow-hidden">
          <iframe src={viewerSrc} className="w-full h-full border-0" title={`File viewer fullscreen (${ext})`} />
          <div className="absolute top-0 left-0 right-0 z-10" style={{ height: '65px' }} />
        </div>
      </FullscreenModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Get icon for lesson type
// ─────────────────────────────────────────────────────────────────────────────
function getLessonIcon(type: string) {
  switch (type) {
    case 'video': return Video;
    case 'quiz': return HelpCircle;
    case 'survey': return ClipboardList;
    case 'assignment': return ClipboardList;
    case 'url': return LinkIcon;
    case 'header': return LayoutDashboard;
    default: return FileText;
  }
}

function getLessonIconColor(type: string) {
  switch (type) {
    case 'video': return 'text-blue-500';
    case 'quiz': return 'text-amber-500';
    case 'survey': return 'text-purple-500';
    case 'assignment': return 'text-blue-500';
    case 'url': return 'text-teal-500';
    case 'header': return 'text-gray-400';
    default: return 'text-gray-500';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentCourseViewer() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── State ────────────────────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassing, setQuizPassing] = useState(false);

  // Survey state
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  // Assignment state
  const [assignText, setAssignText] = useState('');
  const [assignUrl, setAssignUrl] = useState('');
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [assignUploading, setAssignUploading] = useState(false);
  const [assignSubmitted, setAssignSubmitted] = useState(false);
  const [assignExistingSubmission, setAssignExistingSubmission] = useState<any>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  // Active lesson object (needed before signed URL hook below)
  const activeLesson = useMemo(() => {
    if (!activeLessonId) return null;
    return allLessons.find(l => l.id === activeLessonId) || null;
  }, [activeLessonId, allLessons]);

  // ── Signed URL hook: if public URL fails, try signed URL for private storage ──
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!activeLesson?.file_url) return;
    const url = activeLesson.file_url;
    // Only attempt signed URL for Supabase storage URLs (not external links)
    const isSupabaseStorage = url.includes('/storage/v1/');
    if (!isSupabaseStorage) return;
    // Already has a token = already signed
    if (url.includes('token=')) return;
    // Try to extract the storage path and create a signed URL
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/object/public/');
      if (pathParts.length === 2) {
        const bucketAndPath = pathParts[1]; // e.g. "course-files/assignments/resources/file.pdf"
        const firstSlash = bucketAndPath.indexOf('/');
        if (firstSlash > 0) {
          const bucket = bucketAndPath.substring(0, firstSlash);
          const filePath = bucketAndPath.substring(firstSlash + 1);
          supabase.storage.from(bucket).createSignedUrl(filePath, 3600).then(({ data, error }) => {
            if (data?.signedUrl) {
              setSignedUrls(prev => ({ ...prev, [activeLesson.file_url!]: data.signedUrl }));
            }
            if (error) {
              console.warn('[StudentViewer] Signed URL failed, using public URL:', error.message);
            }
          });
        }
      }
    } catch {
      // URL parsing failed, use as-is
    }
  }, [activeLesson?.file_url]);

  // Helper: get the best available URL for a file
  const getFileDisplayUrl = (url: string): string => {
    return signedUrls[url] || url;
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  // (activeLesson moved above signed URL hook)

  const lessonsByModule = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    allLessons.forEach(l => {
      if (!map[l.module_id]) map[l.module_id] = [];
      map[l.module_id].push(l);
    });
    // Sort each module's lessons by order_index
    Object.keys(map).forEach(modId => {
      map[modId].sort((a, b) => a.order_index - b.order_index);
    });
    return map;
  }, [allLessons]);

  const completedIds = useMemo(() => {
    return new Set(
      progress
        .filter(p => p.completed)
        .map(p => p.lesson_id)
    );
  }, [progress]);

  // All non-header lessons across all modules (for sequential lock logic)
  const nonHeadersByModule = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    Object.entries(lessonsByModule).forEach(([modId, lessons]) => {
      map[modId] = lessons.filter(l => l.type !== 'header');
    });
    return map;
  }, [lessonsByModule]);

  // ── isLessonLocked: Respects sequential_lessons flag ──────────────────────
  const isLessonLocked = useCallback((lesson: Lesson): boolean => {
    // Headers are never locked
    if (lesson.type === 'header') return false;

    // Find the module this lesson belongs to
    const mod = modules.find(m => m.id === lesson.module_id);
    if (!mod) return false;

    // Module-level unlock date always applies regardless of sequential setting
    if (mod.unlock_date && new Date(mod.unlock_date) > new Date()) return true;

    // ✅ KEY FIX: Only enforce sequential order if sequential_lessons is enabled
    if (!mod.sequential_lessons) return false;

    // Sequential mode is ON — find this lesson's index among non-header lessons
    const moduleNonHeaders = nonHeadersByModule[mod.id] || [];
    const idx = moduleNonHeaders.findIndex(l => l.id === lesson.id);

    // First lesson is always unlocked
    if (idx <= 0) return false;

    // Check if the previous lesson is completed
    const previousLesson = moduleNonHeaders[idx - 1];
    return !completedIds.has(previousLesson.id);
  }, [modules, nonHeadersByModule, completedIds]);

  // Helper: check if a module is locked (unlock date not reached)
  const isModuleLocked = useCallback((mod: Module): boolean => {
    if (mod.unlock_date && new Date(mod.unlock_date) > new Date()) return true;
    return false;
  }, []);

  // Overall progress percentage
  const overallProgress = useMemo(() => {
    if (allLessons.length === 0) return 0;
    const completableLessons = allLessons.filter(l => l.type !== 'header');
    if (completableLessons.length === 0) return 0;
    const completedCount = completableLessons.filter(l => completedIds.has(l.id)).length;
    return Math.round((completedCount / completableLessons.length) * 100);
  }, [allLessons, completedIds]);

  // ── Load Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (courseId && user) loadData();
  }, [courseId, user]);

  const loadData = async () => {
    if (!courseId || !user) return;
    setLoading(true);

    try {
      // Fetch course
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseErr) throw courseErr;
      if (courseData) setCourse(courseData);

      // Fetch modules (select('*') includes sequential_lessons automatically)
      const { data: modsData, error: modsErr } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (modsErr) throw modsErr;
      if (modsData) {
        setModules(modsData);

        // Fetch all lessons for these modules
        const modIds = modsData.map(m => m.id);
        if (modIds.length > 0) {
          const { data: lessData, error: lessErr } = await supabase
            .from('lessons')
            .select('*')
            .in('module_id', modIds)
            .order('order_index');

          if (lessErr) throw lessErr;
          if (lessData) {
            // ── CRITICAL: Resolve file_url for every lesson ──
            // Admin stores file_url which might be:
            //   1. A full public URL (https://...) — use as-is
            //   2. A Supabase storage path (assignments/resources/...) — convert to public URL
            //   3. A signed URL — use as-is (it has expiry in query params)
            //   4. Empty/null — nothing to show
            const resolvedLessons = lessData.map(lesson => {
              if (!lesson.file_url) return lesson;

              const url = lesson.file_url;
              // Already a full URL (http/https) — use as-is
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return lesson;
              }
              // Storage path — convert to public URL from 'course-files' bucket
              const { data: urlData } = supabase.storage.from('course-files').getPublicUrl(url);
              if (urlData?.publicUrl) {
                return { ...lesson, file_url: urlData.publicUrl };
              }
              return lesson;
            });
            setAllLessons(resolvedLessons);
          }

          // Expand first module by default
          if (modsData.length > 0) {
            const firstModuleWithLessons = modsData.find(m =>
              lessData?.some(l => l.module_id === m.id)
            );
            if (firstModuleWithLessons) {
              setExpandedModules({ [firstModuleWithLessons.id]: true });

              // Set first non-header lesson as active
              const firstLesson = lessData.find(
                l => l.module_id === firstModuleWithLessons.id && l.type !== 'header'
              );
              if (firstLesson) setActiveLessonId(firstLesson.id);
            }
          }
        }
      }

      // Fetch progress for this user
      // NOTE: lesson_progress table does NOT have course_id column
      // We filter by user_id and then match lesson_ids to this course's lessons client-side
      const { data: progData, error: progErr } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id);

      if (progErr && progErr.code !== '42P01') console.warn('Progress load error:', progErr);
      if (progData) setProgress(progData);

    } catch (e: any) {
      console.error('Load error:', e);
      toast({ title: 'Error loading course', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Mark lesson complete ─────────────────────────────────────────────────
  const markComplete = async (lessonId: string) => {
    if (!user || !courseId) return;

    try {
      const existing = progress.find(p => p.lesson_id === lessonId && p.user_id === user.id);

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('lesson_progress')
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        setProgress(prev =>
          prev.map(p =>
            p.id === existing.id
              ? { ...p, completed: true, completed_at: new Date().toISOString() }
              : p
          )
        );
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('lesson_progress')
          .insert({
            user_id: user.id,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setProgress(prev => [...prev, data]);
      }

      toast({ title: 'Lesson completed! ✓' });
    } catch (e: any) {
      console.error('Mark complete error:', e);
      toast({ title: 'Error saving progress', description: e.message, variant: 'destructive' });
    }
  };

  // ── Navigate to lesson ───────────────────────────────────────────────────
  const selectLesson = useCallback((lesson: Lesson) => {
    if (isLessonLocked(lesson)) {
      toast({
        title: 'Lesson locked',
        description: 'Complete the previous lesson first to unlock this one.',
        variant: 'destructive',
      });
      return;
    }
    setActiveLessonId(lesson.id);
    // Reset quiz/survey/assignment state
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setSurveyResponses([]);
    setSurveySubmitted(false);
    setAssignText('');
    setAssignUrl('');
    setAssignFile(null);
    setAssignSubmitted(false);
    setAssignExistingSubmission(null);
  }, [isLessonLocked, toast]);

  // ── Quiz submission ──────────────────────────────────────────────────────
  const submitQuiz = useCallback(() => {
    if (!activeLesson?.quiz_data) return;

    const questions = activeLesson.quiz_data.filter(q => q.type === 'multiple_choice');
    const totalQ = questions.length;
    let correctCount = 0;

    questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correctCount++;
    });

    const score = Math.round((correctCount / totalQ) * 100);
    const passing = score >= 50;

    setQuizScore(score);
    setQuizPassing(passing);
    setQuizSubmitted(true);

    // Save quiz result
    if (user && courseId) {
      supabase
        .from('quiz_results')
        .insert({
          user_id: user.id,
          lesson_id: activeLesson.id,
          course_id: courseId,
          score: correctCount,
          total_questions: totalQ,
          passed: passing,
        })
        .then(({ error }) => {
          if (error) console.warn('Quiz result save error:', error);
          // Mark complete regardless of pass/fail
          markComplete(activeLesson.id);
        });
    }
  }, [activeLesson, quizAnswers, user, courseId, markComplete]);

  // ── Survey submission ────────────────────────────────────────────────────
  const submitSurvey = useCallback(() => {
    if (!activeLesson?.quiz_data || surveyResponses.length === 0) return;

    setSurveySubmitted(true);

    // Save survey (reuse lesson_progress or a survey table)
    if (user && courseId) {
      supabase
        .from('survey_responses')
        .insert({
          user_id: user.id,
          lesson_id: activeLesson.id,
          course_id: courseId,
          responses: surveyResponses,
        })
        .then(({ error }) => {
          if (error) console.warn('Survey save error:', error);
          markComplete(activeLesson.id);
        });
    }
  }, [activeLesson, surveyResponses, user, courseId, markComplete]);

  // ── Assignment submission ────────────────────────────────────────────────
  const submitAssignment = useCallback(async () => {
    if (!activeLesson || !user || !courseId) return;
    if (!assignText && !assignUrl && !assignFile) {
      toast({ title: 'Please provide your submission', variant: 'destructive' });
      return;
    }

    setAssignUploading(true);

    try {
      let fileUrl: string | null = null;

      // Upload file if provided
      if (assignFile) {
        const path = `assignments/${user.id}/${Date.now()}_${assignFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('course-files')
          .upload(path, assignFile);
        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from('course-files').getPublicUrl(path);
        fileUrl = data.publicUrl;
      }

      const submissionType = assignFile ? 'file' : assignUrl ? 'url' : 'text';

      const { error } = await supabase
        .from('assignment_submissions')
        .insert({
          user_id: user.id,
          lesson_id: activeLesson.id,
          course_id: courseId,
          content: assignText || null,
          file_url: fileUrl || (assignUrl || null),
          submission_type: submissionType,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      setAssignSubmitted(true);
      toast({ title: 'Assignment submitted successfully! ✓' });
      markComplete(activeLesson.id);
    } catch (e: any) {
      console.error('Assignment submit error:', e);
      toast({ title: 'Error submitting assignment', description: e.message, variant: 'destructive' });
    } finally {
      setAssignUploading(false);
    }
  }, [activeLesson, user, courseId, assignText, assignUrl, assignFile, toast, markComplete]);

  // Check for existing assignment submission
  useEffect(() => {
    if (activeLesson?.type === 'assignment' && user && courseId && !assignExistingSubmission) {
      supabase
        .from('assignment_submissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('lesson_id', activeLesson.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setAssignExistingSubmission(data[0]);
            setAssignSubmitted(true);
          }
        });
    }
  }, [activeLesson?.id, activeLesson?.type, user, courseId]);

  // ── Navigate next/prev lesson ────────────────────────────────────────────
  const goToNextLesson = useCallback(() => {
    if (!activeLesson) return;
    const flatLessons = allLessons.filter(l => l.type !== 'header').sort((a, b) => {
      const modA = modules.find(m => m.id === a.module_id);
      const modB = modules.find(m => m.id === b.module_id);
      if (!modA || !modB) return 0;
      if (modA.order_index !== modB.order_index) return modA.order_index - modB.order_index;
      return a.order_index - b.order_index;
    });
    const idx = flatLessons.findIndex(l => l.id === activeLesson.id);
    if (idx >= 0 && idx < flatLessons.length - 1) {
      selectLesson(flatLessons[idx + 1]);
    }
  }, [activeLesson, allLessons, modules, selectLesson]);

  const goToPrevLesson = useCallback(() => {
    if (!activeLesson) return;
    const flatLessons = allLessons.filter(l => l.type !== 'header').sort((a, b) => {
      const modA = modules.find(m => m.id === a.module_id);
      const modB = modules.find(m => m.id === b.module_id);
      if (!modA || !modB) return 0;
      if (modA.order_index !== modB.order_index) return modA.order_index - modB.order_index;
      return a.order_index - b.order_index;
    });
    const idx = flatLessons.findIndex(l => l.id === activeLesson.id);
    if (idx > 0) {
      selectLesson(flatLessons[idx - 1]);
    }
  }, [activeLesson, allLessons, modules, selectLesson]);

  // ── Render: Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-gray-500">Loading course...</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-600">Course not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/student/courses')}>
          Back to Courses
        </Button>
      </div>
    );
  }

  // ── Render: Content Area for active lesson ───────────────────────────────
  const renderLessonContent = () => {
    if (!activeLesson) {
      return (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-500">Select a lesson to begin</h3>
          <p className="text-sm text-gray-400 mt-1">Choose from the sidebar to get started</p>
        </div>
      );
    }

    switch (activeLesson.type) {
      case 'header':
        return renderHeaderContent();
      case 'text':
        return renderTextContent();
      case 'video':
        return renderVideoContent();
      case 'quiz':
        return renderQuizContent();
      case 'survey':
        return renderSurveyContent();
      case 'assignment':
        return renderAssignmentContent();
      case 'url':
        return renderUrlContent();
      default:
        return renderTextContent();
    }
  };

  // ── Text Content ─────────────────────────────────────────────────────────
  const renderTextContent = () => {
    const isComplete = completedIds.has(activeLesson!.id);
    const canDownload = activeLesson?.file_downloadable !== false;
    const rawUrl = activeLesson?.file_url;
    const fileUrl = rawUrl ? getFileDisplayUrl(rawUrl) : null;
    const hasFile = !!fileUrl;

    return (
      <div className="space-y-6">
        <div
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: activeLesson?.content || '' }}
        />
        {/* ✅ FIXED: File is ALWAYS shown inline (view or view+download) */}
        {hasFile && (
          <div className="mt-6">
            <EmbeddedFileViewer url={fileUrl!} canDownload={canDownload} />
          </div>
        )}
        {/* Mark complete button */}
        {!isComplete && (
          <div className="pt-4 border-t">
            <Button onClick={() => markComplete(activeLesson!.id)} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Mark as Complete
            </Button>
          </div>
        )}
        {isComplete && (
          <div className="pt-4 border-t flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Lesson completed
          </div>
        )}
      </div>
    );
  };

  // ── Header Content (section divider) ─────────────────────────────────────
  const renderHeaderContent = () => (
    <div className="text-center py-16">
      <LayoutDashboard className="w-12 h-12 mx-auto mb-4 text-indigo-300" />
      <h2 className="text-2xl font-bold text-gray-700">{activeLesson?.title}</h2>
      {activeLesson?.content && (
        <div className="text-gray-500 mt-2 max-w-md mx-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
      )}
    </div>
  );

  // ── Video Content ────────────────────────────────────────────────────────
  const renderVideoContent = () => {
    const isComplete = completedIds.has(activeLesson!.id);
    const rawVideoUrl = activeLesson?.file_url || activeLesson?.content || '';
    const videoUrl = rawVideoUrl ? getFileDisplayUrl(rawVideoUrl) : '';
    const canDownload = activeLesson?.file_downloadable !== false;

    // Check if YouTube URL
    const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);

    return (
      <div className="space-y-6">
        {youtubeMatch ? (
          <div className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
              className="w-full h-full"
              allowFullScreen
              title={activeLesson?.title}
            />
          </div>
        ) : vimeoMatch ? (
          <div className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
              className="w-full h-full"
              allowFullScreen
              title={activeLesson?.title}
            />
          </div>
        ) : videoUrl ? (
          <div className="space-y-2">
            {!canDownload && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">View only — downloading is disabled by instructor</span>
              </div>
            )}
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-900">
              <video
                src={videoUrl}
                controls
                className="w-full h-full"
                controlsList={canDownload ? undefined : 'nodownload noremoteplayback'}
                disablePictureInPicture={!canDownload}
                disableRemotePlayback={!canDownload}
                onContextMenu={canDownload ? undefined : (e: React.MouseEvent) => e.preventDefault()}
                onEnded={() => markComplete(activeLesson!.id)}
              />
            </div>
            {canDownload && (
              <a
                href={videoUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Video
              </a>
            )}
          </div>
        ) : (
          <div className="aspect-video rounded-xl bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <PlayCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No video available</p>
            </div>
          </div>
        )}

        {/* Video description */}
        {activeLesson?.content && !activeLesson?.file_url && (
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: activeLesson.content }}
          />
        )}

        {!isComplete && (
          <div className="pt-4 border-t">
            <Button onClick={() => markComplete(activeLesson!.id)} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Mark as Complete
            </Button>
          </div>
        )}
        {isComplete && (
          <div className="pt-4 border-t flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Lesson completed
          </div>
        )}
      </div>
    );
  };

  // ── Quiz Content ─────────────────────────────────────────────────────────
  const renderQuizContent = () => {
    const questions = activeLesson?.quiz_data?.filter(q => q.type === 'multiple_choice') || [];
    const isComplete = completedIds.has(activeLesson!.id);

    if (questions.length === 0) {
      return (
        <div className="text-center py-12">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-500">No quiz questions</h3>
          <p className="text-sm text-gray-400">This quiz hasn't been set up yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800">
            <HelpCircle className="w-5 h-5" />
            <span className="font-semibold">Quiz: {questions.length} question{questions.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">Select the correct answer for each question. You need 50% to pass.</p>
        </div>

        {quizSubmitted && quizScore !== null ? (
          <div className={`p-6 rounded-xl text-center ${quizPassing ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <Trophy className={`w-12 h-12 mx-auto mb-3 ${quizPassing ? 'text-emerald-500' : 'text-red-400'}`} />
            <h3 className={`text-xl font-bold ${quizPassing ? 'text-emerald-800' : 'text-red-800'}`}>
              {quizPassing ? 'Congratulations! You Passed!' : 'Keep Trying!'}
            </h3>
            <p className={`text-3xl font-bold mt-2 ${quizPassing ? 'text-emerald-600' : 'text-red-500'}`}>
              {quizScore}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              You got {questions.filter((q, i) => quizAnswers[i] === q.correct).length} out of {questions.length} correct
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="p-4 border rounded-xl">
                <p className="font-semibold text-sm text-gray-800 mb-3">
                  <span className="text-indigo-500 mr-2">Q{qIdx + 1}.</span>
                  {q.q}
                </p>
                <div className="space-y-2">
                  {q.a.map((option, oIdx) => {
                    const isSelected = quizAnswers[qIdx] === oIdx;
                    let borderClass = 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50';
                    if (isSelected) borderClass = 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200';
                    // After submission: show correct/wrong
                    if (quizSubmitted) {
                      if (oIdx === q.correct) borderClass = 'border-emerald-500 bg-emerald-50';
                      else if (isSelected && oIdx !== q.correct) borderClass = 'border-red-500 bg-red-50';
                    }
                    return (
                      <button
                        key={oIdx}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${borderClass} ${quizSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                        disabled={quizSubmitted}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300'}`}>
                            {isSelected && '✓'}
                          </span>
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!quizSubmitted && (
          <div className="pt-4 border-t">
            <Button
              onClick={submitQuiz}
              disabled={Object.keys(quizAnswers).length < questions.length}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Quiz
            </Button>
            {Object.keys(quizAnswers).length < questions.length && (
              <p className="text-xs text-gray-400 mt-2">
                Answer all questions before submitting ({Object.keys(quizAnswers).length}/{questions.length})
              </p>
            )}
          </div>
        )}

        {isComplete && (
          <div className="pt-2 flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Quiz completed
          </div>
        )}
      </div>
    );
  };

  // ── Survey Content ───────────────────────────────────────────────────────
  const renderSurveyContent = () => {
    const questions = activeLesson?.quiz_data || [];
    const isComplete = completedIds.has(activeLesson!.id);

    if (questions.length === 0) {
      return (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-500">No survey questions</h3>
        </div>
      );
    }

    const updateResponse = (qIdx: number, value: string, type: string, rating?: number) => {
      setSurveyResponses(prev => {
        const updated = [...prev];
        updated[qIdx] = {
          question: questions[qIdx]?.q || '',
          answer: value,
          type,
          rating,
        };
        return updated;
      });
    };

    return (
      <div className="space-y-6">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-2 text-purple-800">
            <ClipboardList className="w-5 h-5" />
            <span className="font-semibold">Survey: {questions.length} question{questions.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm text-purple-700 mt-1">Your feedback is anonymous and helps us improve.</p>
        </div>

        {surveySubmitted ? (
          <div className="p-6 rounded-xl text-center bg-purple-50 border border-purple-200">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-purple-500" />
            <h3 className="text-xl font-bold text-purple-800">Thank you for your feedback!</h3>
            <p className="text-sm text-purple-600 mt-1">Your response has been recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="p-4 border rounded-xl">
                <p className="font-semibold text-sm text-gray-800 mb-3">
                  <span className="text-purple-500 mr-2">Q{qIdx + 1}.</span>
                  {q.q}
                </p>
                {q.type === 'rating' && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => updateResponse(qIdx, `${star} star${star > 1 ? 's' : ''}`, 'rating', star)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            (surveyResponses[qIdx]?.rating || 0) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {q.a.map((option, oIdx) => (
                      <button
                        key={oIdx}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                          surveyResponses[qIdx]?.answer === option
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                        onClick={() => updateResponse(qIdx, option, 'multiple_choice')}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'text' && (
                  <Textarea
                    placeholder="Type or paste your answer here..."
                    rows={3}
                    className="resize-none"
                    value={surveyResponses[qIdx]?.answer || ''}
                    onChange={e => updateResponse(qIdx, e.target.value, 'text')}
                    onPaste={e => {
                      const clipboard = e.clipboardData;
                      const html = clipboard.getData('text/html');
                      const text = clipboard.getData('text/plain');
                      if (html) {
                        e.preventDefault();
                        updateResponse(qIdx, htmlToPlainText(html), 'text');
                        return;
                      }
                      if (text) {
                        e.preventDefault();
                        updateResponse(qIdx, text, 'text');
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!surveySubmitted && (
          <div className="pt-4 border-t">
            <Button onClick={submitSurvey} className="gap-2">
              <Send className="w-4 h-4" />
              Submit Survey
            </Button>
          </div>
        )}

        {isComplete && (
          <div className="pt-2 flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Survey completed
          </div>
        )}
      </div>
    );
  };

  // ── Assignment Content ───────────────────────────────────────────────────
  const renderAssignmentContent = () => {
    const config = activeLesson?.assignment_config;
    const isComplete = completedIds.has(activeLesson!.id);
    const rawFileUrl = activeLesson?.file_url;
    const assignmentFileUrl = rawFileUrl ? getFileDisplayUrl(rawFileUrl) : null;
    const canDownloadFile = activeLesson?.file_downloadable !== false;

    // Debug: log what we have for this assignment
    console.log('[StudentViewer] Assignment data:', {
      lessonId: activeLesson?.id,
      title: activeLesson?.title,
      type: activeLesson?.type,
      'file_url (raw)': rawFileUrl || '(empty)',
      'file_url (resolved)': assignmentFileUrl || '(empty)',
      file_downloadable: activeLesson?.file_downloadable,
      'config': config ? {
        instruction_type: config.instruction_type,
        has_instructions: !!config.instructions,
        resource_url: config.resource_url || '(empty)',
        due_note: config.due_note || '(empty)',
      } : '(null)',
    });

    return (
      <div className="space-y-6">
        {/* ─── SECTION 1: Assignment Brief File (MOST PROMINENT) ─── */}
        {/* Always show if file_url exists on this lesson — this is the uploaded brief */}
        {assignmentFileUrl && (
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-blue-100/60 border-b border-blue-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Paperclip className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-blue-900">Assignment Brief</p>
                  <p className="text-[10px] text-blue-600">Uploaded by your instructor — {canDownloadFile ? 'you can view & download' : 'view only'}</p>
                </div>
              </div>
              <a
                href={assignmentFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open File
              </a>
            </div>
            <div className="p-4">
              <EmbeddedFileViewer
                url={assignmentFileUrl}
                canDownload={canDownloadFile}
              />
            </div>
            {canDownloadFile && (
              <div className="px-5 pb-4">
                <a
                  href={assignmentFileUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File to Your Device
                </a>
              </div>
            )}
          </div>
        )}

        {/* ─── SECTION 2: Assignment Instructions (text or URL) ─── */}
        {config?.instructions && config.instruction_type !== 'file' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-800">
              <MessageSquare className="w-5 h-5" />
              <span className="font-semibold">Assignment Instructions</span>
            </div>
            {config.instruction_type === 'url' && config.resource_url ? (
              <a
                href={config.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Assignment Brief (External Link)
              </a>
            ) : (
              <div
                className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 whitespace-pre-wrap leading-relaxed"
              >
                {config.instructions}
              </div>
            )}
          </div>
        )}

        {/* ─── SECTION 3: External resource URL (if different from file) ─── */}
        {config?.instruction_type === 'url' && config.resource_url && (
          <a
            href={config.resource_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl hover:shadow-md transition-shadow group"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
              <ExternalLink className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-teal-800">External Resource</p>
              <p className="text-xs text-teal-600 truncate">{config.resource_url}</p>
            </div>
          </a>
        )}

        {/* ─── SECTION 4: Due date ─── */}
        {config?.due_note && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{config.due_note}</span>
          </div>
        )}

        {/* ─── SECTION 5: Additional lesson content ─── */}
        {activeLesson?.content && activeLesson.type === 'assignment' && (
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: activeLesson.content }}
          />
        )}

        {/* ─── SECTION 6: Accepted submission methods ─── */}
        {config && (
          <div className="flex flex-wrap gap-2">
            {config.allow_text !== false && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-[10px] text-gray-600 font-medium">
                <FileText className="w-3 h-3" /> Written Text
              </span>
            )}
            {config.allow_url !== false && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-[10px] text-gray-600 font-medium">
                <LinkIcon className="w-3 h-3" /> URL / Link
              </span>
            )}
            {config.allow_file !== false && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-[10px] text-gray-600 font-medium">
                <Upload className="w-3 h-3" /> File Upload
              </span>
            )}
          </div>
        )}

        {/* ─── SECTION 7: Existing submission info ─── */}
        {assignExistingSubmission && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-2">
              <CheckCircle2 className="w-4 h-4" />
              You have already submitted this assignment
            </div>
            <p className="text-xs text-emerald-600">
              Submitted on {new Date(assignExistingSubmission.submitted_at).toLocaleString()}
              {assignExistingSubmission.status === 'graded' && (
                <> — Grade: {assignExistingSubmission.score !== null ? `${assignExistingSubmission.score}/100` : 'Pending'}</>
              )}
            </p>
            {assignExistingSubmission.feedback && (
              <div className="mt-2 p-3 bg-white border border-emerald-100 rounded-lg">
                <p className="text-xs text-gray-500 font-semibold mb-1">Feedback:</p>
                <p className="text-sm text-gray-700">{assignExistingSubmission.feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── SECTION 8: Submission form ─── */}
        {!assignSubmitted && (
          <div className="space-y-4 pt-4 border-t">
            <p className="font-semibold text-sm text-gray-800">Submit Your Work</p>

            {config?.allow_text !== false && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Text Response</label>
                <Textarea
                  placeholder="Type or paste your answer here..."
                  rows={4}
                  value={assignText}
                  onChange={e => setAssignText(e.target.value)}
                  onPaste={e => handleSmartPaste(e, setAssignText)}
                />
              </div>
            )}

            {config?.allow_url !== false && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">URL (e.g., Google Doc link)</label>
                <Input
                  placeholder="https://..."
                  value={assignUrl}
                  onChange={e => setAssignUrl(e.target.value)}
                />
              </div>
            )}

            {config?.allow_file !== false && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Upload File</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setAssignFile(file);
                    }}
                  />
                  {assignFile ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600">
                      <Paperclip className="w-4 h-4" />
                      <span className="text-sm font-medium">{assignFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">Click to upload a file</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={submitAssignment} disabled={assignUploading} className="gap-2">
              {assignUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {assignUploading ? 'Uploading...' : 'Submit Assignment'}
            </Button>
          </div>
        )}

        {isComplete && !assignSubmitted && (
          <div className="pt-2 flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Assignment completed
          </div>
        )}
      </div>
    );
  };

  // ── URL Content ──────────────────────────────────────────────────────────
  const renderUrlContent = () => {
    const rawUrl = activeLesson?.file_url || activeLesson?.content || '';
    const url = rawUrl ? getFileDisplayUrl(rawUrl) : '';
    const isComplete = completedIds.has(activeLesson!.id);

    return (
      <div className="space-y-6">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-6 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl hover:shadow-md transition-shadow group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
              <ExternalLink className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-teal-800">{activeLesson?.title}</p>
              <p className="text-sm text-teal-600 truncate max-w-md">{url}</p>
            </div>
          </a>
        ) : (
          <div className="text-center py-12">
            <LinkIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm text-gray-400">No link available</p>
          </div>
        )}

        {!isComplete && (
          <div className="pt-4 border-t">
            <Button onClick={() => markComplete(activeLesson!.id)} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Mark as Complete
            </Button>
          </div>
        )}
        {isComplete && (
          <div className="pt-4 border-t flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Lesson completed
          </div>
        )}
      </div>
    );
  };

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <div className={`flex flex-col h-full bg-gray-50 border-r ${sidebarOpen ? 'w-80' : 'w-0'} transition-all overflow-hidden`}>
      {/* Course header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-bold text-sm text-gray-800 truncate">{course?.title}</h2>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Course Progress</span>
            <span className="font-semibold text-indigo-600">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Modules & Lessons */}
      <div className="flex-1 overflow-y-auto">
        {modules.map((mod, modIdx) => {
          const isExpanded = expandedModules[mod.id] || false;
          const isLocked = isModuleLocked(mod);
          const isSequential = mod.sequential_lessons === true;
          const moduleLessons = lessonsByModule[mod.id] || [];
          const moduleCompleteCount = moduleLessons
            .filter(l => l.type !== 'header' && completedIds.has(l.id)).length;
          const moduleTotalCount = moduleLessons.filter(l => l.type !== 'header').length;

          return (
            <div key={mod.id} className={`border-b ${isSequential ? 'border-l-2 border-l-indigo-300' : ''}`}>
              {/* Module header */}
              <button
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors ${isLocked ? 'opacity-50' : ''}`}
                onClick={() => !isLocked && setExpandedModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isLocked ? (
                    <LockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {modIdx + 1}. {mod.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{moduleCompleteCount}/{moduleTotalCount} completed</span>
                      {isSequential && (
                        <span className="inline-flex items-center gap-0.5 text-indigo-500 font-medium">
                          <LockIcon className="w-2.5 h-2.5" />
                          Sequential
                        </span>
                      )}
                      {mod.unlock_date && (
                        <span className="text-blue-500">
                          {new Date(mod.unlock_date) > new Date()
                            ? `Unlocks ${new Date(mod.unlock_date).toLocaleDateString()}`
                            : 'Unlocked'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {moduleTotalCount > 0 && moduleCompleteCount === moduleTotalCount && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </button>

              {/* Sequential mode banner */}
              {isExpanded && isSequential && !isLocked && (
                <div className="mx-4 mb-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-600">
                  <LockIcon className="w-3 h-3" />
                  <span>Complete each lesson in order to unlock the next</span>
                </div>
              )}

              {/* Lessons list */}
              {isExpanded && !isLocked && (
                <div className="pb-2">
                  {moduleLessons.map(lesson => {
                    const locked = isLessonLocked(lesson);
                    const isComplete = completedIds.has(lesson.id);
                    const isActive = activeLessonId === lesson.id;
                    const Icon = getLessonIcon(lesson.type);
                    const iconColor = getLessonIconColor(lesson.type);

                    if (lesson.type === 'header') {
                      return (
                        <div
                          key={lesson.id}
                          className="px-6 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100/50"
                        >
                          {lesson.title}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={lesson.id}
                        className={`w-full flex items-center gap-2.5 px-5 py-2 text-left text-sm transition-all ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-700 border-r-2 border-r-indigo-500'
                            : locked
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => selectLesson(lesson)}
                        disabled={locked}
                        style={{ marginLeft: `${(lesson.indent_level || 0) * 16}px` }}
                      >
                        {/* Status icon */}
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : locked ? (
                          <LockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                        ) : (
                          <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                        )}

                        {/* Title */}
                        <span className={`truncate flex-1 ${isActive ? 'font-semibold' : ''}`}>
                          {lesson.title}
                        </span>

                        {/* Indicators */}
                        {lesson.file_url && !lesson.file_downloadable && (
                          <Paperclip className="w-3 h-3 text-gray-300 shrink-0" />
                        )}
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
  );

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      {renderSidebar()}

      {/* Toggle sidebar */}
      <button
        className="w-8 flex items-center justify-center bg-gray-100 border-r hover:bg-gray-200 transition-colors shrink-0"
        onClick={() => setSidebarOpen(prev => !prev)}
      >
        {sidebarOpen ? <ChevronDown className="w-4 h-4 text-gray-500 rotate-180" /> : <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />}
      </button>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        {activeLesson && (
          <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const Icon = getLessonIcon(activeLesson.type);
                return <Icon className={`w-5 h-5 shrink-0 ${getLessonIconColor(activeLesson.type)}`} />;
              })()}
              <div className="min-w-0">
                <h1 className="font-bold text-lg text-gray-800 truncate">{activeLesson.title}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Badge variant="outline" className="text-[10px] h-5">
                    {activeLesson.type}
                  </Badge>
                  {(() => {
                    const mod = modules.find(m => m.id === activeLesson.module_id);
                    return mod ? <span>{mod.title}</span> : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={goToPrevLesson} className="gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextLesson} className="gap-1">
                <span className="hidden sm:inline">Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6">
            {renderLessonContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
