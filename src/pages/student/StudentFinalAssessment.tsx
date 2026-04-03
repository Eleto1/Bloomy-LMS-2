import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  FileText, Download, Globe, Upload, Send, Loader2,
  CheckCircle2, Clock, AlertCircle, FileUp, AlignLeft,
  Eye, CalendarDays, Award, MessageSquare, X
} from 'lucide-react';

interface Assessment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  file_url?: string;
  total_marks?: number;
  due_date?: string;
  status?: string;
  created_at: string;
}

interface Submission {
  id: string;
  assessment_id: string;
  submission_type: string;
  content: string | null;
  file_url: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submitted_at: string;
  graded_at?: string;
}

export default function StudentFinalAssessment() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [subType, setSubType] = useState<'text' | 'url' | 'file'>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchAssessments();
  }, [user]);

  const fetchAssessments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: aData } = await supabase
        .from('assessments')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      setAssessments(aData || []);

      if (aData && aData.length > 0) {
        const ids = aData.map(a => a.id);
        const { data: sData } = await supabase
          .from('assessment_submissions')
          .select('*')
          .eq('user_id', user.id)
          .in('assessment_id', ids);

        const map: Record<string, Submission> = {};
        (sData || []).forEach(s => { map[s.assessment_id] = s; });
        setSubmissions(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeAssessment = assessments.find(a => a.id === activeId);
  const activeSubmission = activeId ? submissions[activeId] : null;

  const openSubmit = (id: string) => {
    setActiveId(id);
    setSubType('text');
    setTextInput('');
    setUrlInput('');
    setFile(null);
  };

  const closePanel = () => {
    setActiveId(null);
    setSubType('text');
    setTextInput('');
    setUrlInput('');
    setFile(null);
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (d?: string) => {
    if (!d) return 'No deadline';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleSubmit = async () => {
    if (!activeId || !user) return;
    if (subType === 'text' && !textInput.trim()) {
      return toast({ title: 'Please write your answer', variant: 'destructive' });
    }
    if (subType === 'url' && !urlInput.trim()) {
      return toast({ title: 'Please enter a URL', variant: 'destructive' });
    }
    if (subType === 'file' && !file) {
      return toast({ title: 'Please select a file', variant: 'destructive' });
    }

    setSubmitting(true);
    try {
      let fileUrl: string | null = null;

      if (subType === 'file' && file) {
        setUploading(true);
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
        const path = 'assessments/' + user.id + '/' + activeId + '/' + Date.now() + '_' + safeName;
        const { error: upErr } = await supabase.storage.from('course-files').upload(path, file);
        if (upErr) throw upErr;
        const { data: ud } = supabase.storage.from('course-files').getPublicUrl(path);
        fileUrl = ud.publicUrl;
        setUploading(false);
      }

      const payload: Record<string, any> = {
        user_id: user.id,
        assessment_id: activeId,
        submission_type: subType,
        file_url: fileUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: null,
        feedback: null,
      };

      if (subType === 'text') payload.content = textInput.trim();
      if (subType === 'url') payload.content = urlInput.trim();

      const { error } = await supabase
        .from('assessment_submissions')
        .upsert(payload, { onConflict: 'user_id,assessment_id' });

      if (error) throw error;

      const { data: newSub } = await supabase
        .from('assessment_submissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('assessment_id', activeId)
        .single();

      if (newSub) {
        setSubmissions(prev => ({ ...prev, [activeId]: newSub }));
      }

      toast({ title: '✓ Assessment submitted successfully!' });
      closePanel();
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const getStatusBadge = (sub?: Submission, dueDate?: string) => {
    if (!sub) {
      if (isOverdue(dueDate)) {
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="w-3 h-3" />Overdue
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
          <Clock className="w-3 h-3" />Pending
        </span>
      );
    }
    if (sub.status === 'graded' || (sub.score !== null && sub.score !== undefined)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />Graded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
        <Send className="w-3 h-3" />Submitted
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500">Loading assessments...</p>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <FileText className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700">No Assessments</h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">There are no final assessments available right now. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Final Assessments</h1>
        <p className="text-sm text-gray-500 mt-1">View, download, and submit your final assessments below.</p>
      </div>

      <div className="space-y-4">
        {assessments.map(assessment => {
          const sub = submissions[assessment.id];
          const overdue = isOverdue(assessment.due_date);
          const canSubmit = !sub && !overdue;

          return (
            <div key={assessment.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Top Row */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">{assessment.title}</h3>
                      {getStatusBadge(sub, assessment.due_date)}
                    </div>
                    {assessment.description && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{assessment.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {assessment.due_date && (
                        <span className={'flex items-center gap-1 ' + (overdue && !sub ? 'text-red-500 font-medium' : '')}>
                          <CalendarDays className="w-3.5 h-3.5" />
                          Due: {formatDate(assessment.due_date)}
                        </span>
                      )}
                      {assessment.total_marks && (
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          Total: {assessment.total_marks} marks
                        </span>
                      )}
                    </div>
                  </div>

                  {assessment.file_url && (
                    <a
                      href={assessment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-medium flex-shrink-0 border border-indigo-100"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              {/* Submitted Content Preview */}
              {sub && (
                <div className="px-5 pb-5">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Submission</p>
                      <span className="text-xs text-gray-400">
                        Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                      </span>
                    </div>

                    {sub.submission_type === 'text' && sub.content && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border">{sub.content}</p>
                    )}
                    {sub.submission_type === 'url' && sub.content && (
                      <a href={sub.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                        <Globe className="w-4 h-4" />{sub.content}
                      </a>
                    )}
                    {sub.submission_type === 'file' && sub.file_url && (
                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                        <FileText className="w-4 h-4" />View submitted file
                      </a>
                    )}

                    {/* Grade & Feedback */}
                    {(sub.status === 'graded' || (sub.score !== null && sub.score !== undefined)) && (
                      <div className="pt-3 mt-3 border-t border-gray-200 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className={sub.score !== null && sub.score >= (assessment.total_marks ? assessment.total_marks * 0.7 : 70)
                            ? 'px-3 py-1.5 rounded-lg font-bold text-sm bg-emerald-600 text-white'
                            : 'px-3 py-1.5 rounded-lg font-bold text-sm bg-red-500 text-white'
                          }>
                            {sub.score ?? 0}{assessment.total_marks ? '/' + assessment.total_marks : '%'}
                          </div>
                          <span className="text-sm font-medium text-gray-600">Score</span>
                        </div>
                        {sub.feedback && (
                          <div className="flex items-start gap-2 bg-white rounded-lg p-3 border">
                            <MessageSquare className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Feedback</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{sub.feedback}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Awaiting Grade */}
                    {sub.status !== 'graded' && (sub.score === null || sub.score === undefined) && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        <Clock className="w-3.5 h-3.5" />
                        Awaiting instructor grade
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="px-5 pb-5 flex justify-end">
                {canSubmit && (
                  <Button
                    onClick={() => openSubmit(assessment.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 h-10 px-5 font-medium"
                  >
                    <Send className="w-4 h-4 mr-2" />Submit Assessment
                  </Button>
                )}
                {!sub && overdue && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />Submission closed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Modal / Panel */}
      {activeId && activeAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePanel} />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Submit Assessment</h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeAssessment.title}</p>
              </div>
              <button onClick={closePanel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Instructions */}
              {activeAssessment.instructions && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Instructions</p>
                  <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{activeAssessment.instructions}</p>
                </div>
              )}

              {/* Download file if attached */}
              {activeAssessment.file_url && (
                <a
                  href={activeAssessment.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  <Download className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-700">Download Assessment File</p>
                    <p className="text-xs text-indigo-500">Click to open or download</p>
                  </div>
                </a>
              )}

              {/* Submission Type Selector */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3">How would you like to submit?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'text' as const, label: 'Write Text', Icon: AlignLeft },
                    { type: 'url' as const, label: 'Submit Link', Icon: Globe },
                    { type: 'file' as const, label: 'Upload File', Icon: FileUp }
                  ].map(({ type, label, Icon }) => (
                    <button
                      key={type}
                      onClick={() => setSubType(type)}
                      className={subType === type
                        ? 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-200'
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              {subType === 'text' && (
                <textarea
                  className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-indigo-400"
                  rows={10}
                  placeholder="Write your assessment answer here..."
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                />
              )}

              {subType === 'url' && (
                <div>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      placeholder="https://..."
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Google Drive, GitHub, Notion, Figma, etc.</p>
                </div>
              )}

              {subType === 'file' && (
                <label className={file
                  ? 'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all border-indigo-400 bg-indigo-50'
                  : 'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all border-gray-200 hover:border-indigo-300'
                }>
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
                      <p className="text-xs text-gray-400">PDF, DOC, ZIP, images, etc.</p>
                    </>
                  )}
                </label>
              )}

              {/* Warning for overdue (shouldn't happen but safety) */}
              {isOverdue(activeAssessment.due_date) && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  This assessment is past the due date. Submission may not be accepted.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <Button variant="outline" onClick={closePanel} disabled={submitting} className="h-10 px-5">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="bg-indigo-600 hover:bg-indigo-700 h-10 px-5 font-medium"
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> :
                  submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> :
                  <><Send className="w-4 h-4 mr-2" />Submit Assessment</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}