import { useInstitute } from '@/lib/institute-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Bell,
  Palette,
  Shield,
  Save,
  Camera,
  Check,
  X,
  Trash2,
  Upload,
  Globe,
  Clock,
  Mail,
  Phone,
  MapPin,
  Copy,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  Plug,
  Database,
  RefreshCw,
} from 'lucide-react';

/* ═══════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════ */
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}
let _tid = 0;

function ToastContainer({ list, dismiss }: { list: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
      {list.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md text-sm font-medium transition-all duration-300 animate-slide-in-right ${
            t.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : t.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
        >
          {t.type === 'success' && <Check className="w-4 h-4" />}
          {t.type === 'error' && <X className="w-4 h-4" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
          {t.message}
          <button onClick={() => dismiss(t.id)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB NAVIGATION
   ═══════════════════════════════════════════ */
const navItems = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'data', label: 'Data', icon: Database },
];

/* ═══════════════════════════════════════════
   REAL EXPORT HELPER
   ═══════════════════════════════════════════ */
function downloadFile(data: unknown[], filename: string, format: 'csv' | 'json') {
  let content: string;
  let mime: string;
  let ext: string;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    mime = 'application/json';
    ext = 'json';
  } else {
    if (data.length === 0) {
      content = '';
    } else {
      const headers = Object.keys(data[0] as Record<string, unknown>);
      const rows = data.map((row) => {
        const obj = row as Record<string, unknown>;
        return headers.map((h) => {
          const val = obj[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',');
      });
      content = [headers.join(','), ...rows].join('\n');
    }
    mime = 'text/csv';
    ext = 'csv';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
const AdminSettings = () => {
  const { refresh: refreshGlobal } = useInstitute();
  const [tab, setTab] = useState('general');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Logo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [stats, setStats] = useState({
    students: 0,
    courses: 0,
    enrollments: 0,
    attendance: 0,
  });

  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    desc: '',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    theme: 'light',
    accent: '#10b981',
    emailNotif: true,
    payAlerts: true,
    courseUpdates: false,
    marketing: false,
    twoFa: false,
    curPw: '',
    newPw: '',
    confPw: '',
    session: '30',
    webhookUrl: '',
    slackWebhook: '',
    apiKey: '',
  });

  // ── Fetch real data from Supabase on mount ──
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [settingsRes, profilesRes, coursesRes, enrollmentsRes, attendanceRes] = await Promise.all([
          supabase.from('institute_settings').select('*').single(),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
          supabase.from('attendance').select('id', { count: 'exact', head: true }),
        ]);

        if (settingsRes.data) {
          const s = settingsRes.data;
          setF((prev) => ({
            ...prev,
            name: s.institute_name || '',
            email: s.email || '',
            phone: s.phone || '',
            location: s.location || '',
            website: s.website || '',
            desc: s.description || '',
            timezone: s.timezone || 'Africa/Lagos',
            currency: s.currency || 'NGN',
            theme: s.theme || 'light',
            accent: s.accent_color || '#10b981',
            emailNotif: s.email_notifications ?? true,
            payAlerts: s.payment_alerts ?? true,
            courseUpdates: s.course_updates ?? false,
            marketing: s.marketing_emails ?? false,
            twoFa: s.two_factor_enabled ?? false,
            session: String(s.session_timeout || '30'),
            webhookUrl: s.webhook_url || '',
            slackWebhook: s.slack_webhook || '',
            apiKey: s.api_key || '',
          }));
          // Load saved logo URL
          if (s.logo_url) setLogoUrl(s.logo_url);
        }

        setStats({
          students: profilesRes.count ?? 0,
          courses: coursesRes.count ?? 0,
          enrollments: enrollmentsRes.count ?? 0,
          attendance: attendanceRes.count ?? 0,
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  const orig = { ...f };

  const set = useCallback((k: string, v: string | boolean) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  }, []);

  const toast = useCallback(
    (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
      const id = ++_tid;
      setToasts((prev) => [...prev, { id, message: msg, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── REAL LOGO UPLOAD to Supabase Storage ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast('Invalid file type. Use PNG, JPG, SVG, or WebP.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('File too large. Maximum size is 2MB.', 'error');
      return;
    }

    setUploadingLogo(true);
    try {
      // Upload to Supabase Storage bucket 'institute-logos'
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('institute-logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('institute-logos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update state and mark as dirty
      setLogoUrl(publicUrl);
      setDirty(true);
      toast('Logo uploaded successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      console.error('Logo upload error:', msg);
      toast(`Upload failed: ${msg}`, 'error');
    } finally {
      setUploadingLogo(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── REAL LOGO REMOVE from Supabase Storage ──
  const handleLogoRemove = async () => {
    if (!logoUrl) return;

    // Extract file name from URL
    // URL looks like: https://.../storage/v1/object/public/institute-logos/logo-1234.png
    const urlParts = logoUrl.split('/');
    const bucketIndex = urlParts.indexOf('institute-logos');
    if (bucketIndex === -1 || bucketIndex + 1 >= urlParts.length) {
      toast('Could not determine file to delete.', 'error');
      return;
    }
    const fileName = urlParts.slice(bucketIndex + 1).join('/');

    try {
      const { error } = await supabase.storage
        .from('institute-logos')
        .remove([fileName]);

      if (error) throw error;

      setLogoUrl('');
      setDirty(true);
      toast('Logo removed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Remove failed';
      console.error('Logo remove error:', msg);
      toast(`Remove failed: ${msg}`, 'error');
    }
  };

  // ── REAL SAVE to Supabase ──
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('institute_settings').upsert({
        id: 1,
        institute_name: f.name,
        email: f.email,
        phone: f.phone,
        location: f.location,
        website: f.website,
        description: f.desc,
        timezone: f.timezone,
        currency: f.currency,
        theme: f.theme,
        accent_color: f.accent,
        email_notifications: f.emailNotif,
        payment_alerts: f.payAlerts,
        course_updates: f.courseUpdates,
        marketing_emails: f.marketing,
        two_factor_enabled: f.twoFa,
        session_timeout: parseInt(f.session) || 30,
        webhook_url: f.webhookUrl,
        slack_webhook: f.slackWebhook,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setDirty(false);
      Object.assign(orig, f);
      await refreshGlobal();
      toast('Settings saved — updated everywhere!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Save error:', msg);
      toast(`Failed to save: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setF({ ...orig });
    setDirty(false);
    toast('Changes discarded.', 'warning');
  };

  // ── REAL PASSWORD CHANGE via Supabase Auth ──
  const handlePasswordChange = async () => {
    if (!f.newPw || f.newPw !== f.confPw) {
      toast('Please fix password errors.', 'error');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: f.newPw });
      if (error) throw error;
      toast('Password updated successfully!');
      set('curPw', '');
      set('newPw', '');
      set('confPw', '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast(`Password update failed: ${msg}`, 'error');
    }
  };

  // ── REAL EXPORT ──
  const handleExport = async (type: 'students' | 'courses' | 'enrollments' | 'attendance') => {
    setExporting(type);
    try {
      let data: unknown[] = [];
      let filename = type;
      let format: 'csv' | 'json' = 'csv';

      switch (type) {
        case 'students': {
          const { data: d } = await supabase.from('profiles').select('*').eq('role', 'student');
          data = (d || []) as unknown[];
          filename = 'student_records';
          format = 'csv';
          break;
        }
        case 'courses': {
          const { data: d } = await supabase.from('courses').select('*');
          data = (d || []) as unknown[];
          filename = 'course_data';
          format = 'json';
          break;
        }
        case 'enrollments': {
          const { data: d } = await supabase.from('enrollments').select('*');
          data = (d || []) as unknown[];
          filename = 'enrollment_records';
          format = 'csv';
          break;
        }
        case 'attendance': {
          const { data: d } = await supabase.from('attendance').select('*');
          data = (d || []) as unknown[];
          filename = 'attendance_logs';
          format = 'csv';
          break;
        }
      }

      if (data.length === 0) {
        toast('No records to export.', 'warning');
      } else {
        downloadFile(data, filename, format);
        toast(`Exported ${data.length} records as ${format.toUpperCase()}.`);
      }
    } catch (err) {
      console.error('Export error:', err);
      toast('Export failed.', 'error');
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: GENERAL
     ═══════════════════════════════════════════ */
  function GeneralSection() {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Branding</h3>
          <p className="text-sm text-muted-foreground mb-5">Customize how your institute appears to students and staff.</p>
          <div className="flex flex-col sm:flex-row items-start gap-6 p-5 rounded-2xl bg-muted/30 border border-border/50">
            <div className="relative group">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Institute logo"
                  className="w-24 h-24 rounded-2xl border-2 border-border shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl border-2 border-border shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl font-bold text-white">
                  {f.name ? f.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'BT'}
                </div>
              )}
              {/* Upload overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingLogo ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Institute Logo</p>
                <p className="text-xs text-muted-foreground">Recommended: 512x512px, PNG, JPG, SVG, or WebP. Max 2MB.</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /> Upload New</>
                  )}
                </Button>
                {logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-2"
                    onClick={handleLogoRemove}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Contact Information</h3>
          <p className="text-sm text-muted-foreground mb-5">Displayed across your platform and shared documents.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-medium"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Institute Name</Label>
              <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter institute name" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-medium"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address</Label>
              <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@institute.com" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-medium"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number</Label>
              <Input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+234 800 000 0000" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-medium"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Location</Label>
              <Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" className="h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-2 text-xs font-medium"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> Website</Label>
              <Input type="url" value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourinstitute.com" className="h-10" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">Description</Label>
              <textarea value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Brief description of your institute..." rows={3} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              <p className="text-[11px] text-muted-foreground text-right">{f.desc.length}/300</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Regional Settings</h3>
          <p className="text-sm text-muted-foreground mb-5">Configure locale preferences.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-medium"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> Timezone</Label>
              <select value={f.timezone} onChange={(e) => set('timezone', e.target.value)} className="w-full h-10 rounded-lg border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Currency</Label>
              <select value={f.currency} onChange={(e) => set('currency', e.target.value)} className="w-full h-10 rounded-lg border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="NGN">Nigerian Naira</option>
                <option value="USD">US Dollar ($)</option>
                <option value="GBP">British Pound</option>
                <option value="KES">Kenyan Shilling</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: APPEARANCE
     ═══════════════════════════════════════════ */
  function AppearanceSection() {
    const themes = [
      { id: 'light', label: 'Light', Icon: Sun, bg: 'bg-white border-border' },
      { id: 'dark', label: 'Dark', Icon: Moon, bg: 'bg-zinc-900 border-zinc-700' },
      { id: 'system', label: 'System', Icon: Monitor, bg: 'bg-gradient-to-br from-white to-zinc-900 border-border' },
    ];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1'];

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Theme</h3>
          <p className="text-sm text-muted-foreground mb-5">Choose how your dashboard looks and feels.</p>
          <div className="grid grid-cols-3 gap-4">
            {themes.map((t) => (
              <button key={t.id} onClick={() => set('theme', t.id)} className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${f.theme === t.id ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : 'border-border hover:bg-muted/30'}`}>
                {f.theme === t.id && (<div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>)}
                <div className={`w-full h-20 rounded-xl ${t.bg} shadow-inner`} />
                <div className="flex items-center gap-2"><t.Icon className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium text-foreground">{t.label}</span></div>
              </button>
            ))}
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Accent Color</h3>
          <p className="text-sm text-muted-foreground mb-5">Customize the primary accent color.</p>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => (
              <button key={c} onClick={() => set('accent', c)} className={`relative w-10 h-10 rounded-xl transition-all duration-200 cursor-pointer ${f.accent === c ? 'ring-2 ring-offset-2 ring-offset-background scale-110 shadow-lg' : 'hover:scale-110'}`} style={{ backgroundColor: c, ringColor: c }}>
                {f.accent === c && <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />}
              </button>
            ))}
            <input type="color" value={f.accent} onChange={(e) => set('accent', e.target.value)} className="w-10 h-10 p-0.5 rounded-xl cursor-pointer border-2 border-dashed border-border hover:border-foreground/30" />
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: NOTIFICATIONS
     ═══════════════════════════════════════════ */
  function NotificationsSection() {
    const items = [
      { k: 'emailNotif', t: 'New Enrollment Alerts', d: 'Receive an email when a student enrolls', badge: 'Recommended' },
      { k: 'payAlerts', t: 'Payment Notifications', d: 'Notified when payments are received or overdue', badge: 'Recommended' },
      { k: 'courseUpdates', t: 'Course Update Alerts', d: 'Notifications when courses are modified', badge: null },
      { k: 'marketing', t: 'Marketing & Tips', d: 'Product updates and best practices', badge: null },
    ];
    return (
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Email Notifications</h3>
        <p className="text-sm text-muted-foreground mb-5">Choose which emails you receive.</p>
        <div className="rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
          {items.map((item) => (
            <div key={item.k} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.t}</span>
                  {item.badge && <span className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 rounded-full font-medium">{item.badge}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.d}</p>
              </div>
              <Switch checked={f[item.k] as boolean} onCheckedChange={(v) => set(item.k, v)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: SECURITY
     ═══════════════════════════════════════════ */
  function SecuritySection() {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground mb-5">Add an extra layer of security to your account.</p>
          <div className={`p-5 rounded-2xl border transition-all duration-300 ${f.twoFa ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/20'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.twoFa ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                  <ShieldCheck className={`w-5 h-5 ${f.twoFa ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{f.twoFa ? '2FA is Enabled' : '2FA is Disabled'}</span>
                    <span className={`text-[10px] px-1.5 py-0 h-4 rounded-full font-medium border-0 ${f.twoFa ? 'bg-emerald-500 text-white' : 'bg-amber-500/10 text-amber-600'}`}>{f.twoFa ? 'Protected' : 'At Risk'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.twoFa ? 'Your account is protected with 2FA.' : 'Enable 2FA to secure your account.'}</p>
                </div>
              </div>
              <Switch checked={f.twoFa} onCheckedChange={(v) => { set('twoFa', v); toast(v ? '2FA enabled.' : '2FA disabled.', v ? 'success' : 'warning'); }} />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Change Password</h3>
          <p className="text-sm text-muted-foreground mb-5">Update your password via Supabase Auth.</p>
          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Password</Label>
              <div className="relative">
                <Input type="password" value={f.newPw} onChange={(e) => set('newPw', e.target.value)} placeholder="Enter new password" className="h-10 pr-10" />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"><EyeOff className="w-4 h-4" /></button>
              </div>
              {f.newPw && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map((l) => (
                    <div key={l} className={`h-1 flex-1 rounded-full transition-colors ${f.newPw.length >= l * 3 ? (f.newPw.length >= 12 ? 'bg-emerald-500' : f.newPw.length >= 8 ? 'bg-amber-500' : 'bg-red-500') : 'bg-muted'}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-2">{f.newPw.length < 6 ? 'Weak' : f.newPw.length < 10 ? 'Fair' : f.newPw.length < 12 ? 'Good' : 'Strong'}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirm New Password</Label>
              <Input type="password" value={f.confPw} onChange={(e) => set('confPw', e.target.value)} placeholder="Confirm new password" className="h-10" />
              {f.confPw && f.newPw !== f.confPw && <p className="text-[11px] text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Passwords do not match</p>}
              {f.confPw && f.newPw === f.confPw && f.newPw.length > 0 && <p className="text-[11px] text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Passwords match</p>}
            </div>
            <Button size="sm" variant="outline" className="gap-2 mt-2" onClick={handlePasswordChange}>
              <Key className="w-3.5 h-3.5" /> Update Password
            </Button>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Session Management</h3>
          <p className="text-sm text-muted-foreground mb-5">Control session activity timeout.</p>
          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs font-medium">Auto-logout after inactivity</Label>
            <select value={f.session} onChange={(e) => set('session', e.target.value)} className="w-full h-10 rounded-lg border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: INTEGRATIONS
     ═══════════════════════════════════════════ */
  function IntegrationsSection() {
    const maskedKey = f.apiKey ? f.apiKey.slice(0, 8) + '••••••••••••••••' : 'No API key generated';
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">API Configuration</h3>
          <p className="text-sm text-muted-foreground mb-5">Manage your API key for external integrations.</p>
          <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">API Key</p>
                <p className="text-xs text-muted-foreground">Use this key to authenticate API requests.</p>
              </div>
              {f.apiKey && <span className="text-[10px] px-2 py-0.5 h-5 bg-emerald-500/10 text-emerald-600 rounded-full font-medium">Active</span>}
            </div>
            {f.apiKey ? (
              <div className="flex gap-2">
                <Input readOnly value={showKey ? f.apiKey : maskedKey} className="h-10 font-mono text-xs flex-1 bg-background" />
                <button onClick={() => setShowKey(!showKey)} className="px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => { navigator.clipboard.writeText(f.apiKey); toast('API key copied!'); }}><Copy className="w-3.5 h-3.5" /> Copy</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast('API key generation requires server setup.', 'warning')}><RefreshCw className="w-3.5 h-3.5" /> Generate API Key</Button>
            )}
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Webhooks</h3>
          <p className="text-sm text-muted-foreground mb-5">Receive real-time HTTP callbacks for events.</p>
          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Webhook URL</Label>
              <Input value={f.webhookUrl} onChange={(e) => set('webhookUrl', e.target.value)} placeholder="https://your-server.com/webhooks/bloomy" className="h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Slack Webhook (Optional)</Label>
              <Input value={f.slackWebhook} onChange={(e) => set('slackWebhook', e.target.value)} placeholder="https://hooks.slack.com/services/..." className="h-10 font-mono text-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              {['enrollment.created', 'payment.received', 'payment.failed', 'course.published'].map((event) => (
                <span key={event} className="text-[11px] font-mono px-2 py-1 rounded-lg border border-border/50 bg-muted/30 text-muted-foreground">{event}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SECTION: DATA
     ═══════════════════════════════════════════ */
  function DataSection() {
    const exportItems = [
      { key: 'students' as const, label: 'Student Records', count: stats.students, fmt: 'CSV' },
      { key: 'enrollments' as const, label: 'Enrollment Records', count: stats.enrollments, fmt: 'CSV' },
      { key: 'courses' as const, label: 'Course Data', count: stats.courses, fmt: 'JSON' },
      { key: 'attendance' as const, label: 'Attendance Logs', count: stats.attendance, fmt: 'CSV' },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Export Data</h3>
          <p className="text-sm text-muted-foreground mb-5">Download your actual data from Supabase.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {exportItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:bg-muted/20 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.count > 0 ? `${item.count.toLocaleString()} record${item.count !== 1 ? 's' : ''}` : 'No records yet'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="gap-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 disabled:hover:opacity-40" disabled={item.count === 0 || exporting !== null} onClick={() => handleExport(item.key)}>
                  {exporting === item.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {exporting === item.key ? 'Exporting...' : item.fmt}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Backup & Restore</h3>
          <p className="text-sm text-muted-foreground mb-5">Create manual backups or restore from a previous state.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={async () => {
              const { data } = await supabase.from('profiles').select('*').eq('role', 'student');
              if (data) { downloadFile(data, 'students_backup', 'json'); toast(`Backup: ${data.length} student records downloaded.`); }
            }}><Download className="w-4 h-4" /> Create Backup Now</Button>
            <Button variant="outline" className="gap-2" onClick={() => toast('Select a backup file to restore.', 'warning')}><Upload className="w-4 h-4" /> Restore from Backup</Button>
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div className="rounded-2xl border-2 border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-500">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Irreversible and destructive actions.</p>
              {!confirmDelete ? (
                <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600 gap-2" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4" /> Delete All Data</Button>
              ) : (
                <div className="space-y-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-xs font-medium text-red-400">Type &quot;DELETE&quot; to confirm:</p>
                  <div className="flex gap-2">
                    <Input placeholder="DELETE" className="h-9" id="confirm-delete-input" />
                    <Button variant="destructive" size="sm" className="gap-2 shrink-0" onClick={async () => {
                      const input = document.getElementById('confirm-delete-input');
                      if (input && (input as HTMLInputElement).value === 'DELETE') {
                        const { error } = await supabase.from('attendance').delete().neq('id', '0');
                        if (error) toast('Delete failed: ' + error.message, 'error');
                        else { toast('All attendance data deleted.', 'warning'); setStats((p) => ({ ...p, attendance: 0 })); }
                      } else { toast('Type DELETE to confirm.', 'error'); }
                      setConfirmDelete(false);
                    }}><Trash2 className="w-3.5 h-3.5" /> Confirm</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  const sectionMap: Record<string, () => JSX.Element> = {
    general: GeneralSection,
    appearance: AppearanceSection,
    notifications: NotificationsSection,
    security: SecuritySection,
    integrations: IntegrationsSection,
    data: DataSection,
  };

  const ActiveSection = sectionMap[tab];

  return (
    <>
      <ToastContainer list={toasts} dismiss={dismiss} />
      <div className="animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>Dashboard</span><ChevronRight className="w-3 h-3" /><span className="text-foreground font-medium">Settings</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground tracking-tight">Settings</h2>
              <p className="text-muted-foreground text-sm mt-1">Manage your institute configuration and preferences</p>
            </div>
            {dirty && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs text-amber-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes</span>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={reset}>Discard</Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 mb-6 overflow-x-auto">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${tab === n.id ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
              <n.icon className="w-4 h-4" />{n.label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          {ActiveSection()}
        </div>

        <div className={`mt-6 flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${dirty ? 'border-border bg-card shadow-sm animate-fade-in' : 'border-transparent'}`}>
          <div>
            {dirty ? <p className="text-sm text-foreground font-medium">You have unsaved changes</p> : <p className="text-sm text-muted-foreground">All changes saved</p>}
            {dirty && <p className="text-xs text-muted-foreground mt-0.5">Review your changes before saving</p>}
          </div>
          <div className="flex gap-3">
            {dirty && <Button variant="ghost" size="sm" onClick={reset} className="text-xs">Discard</Button>}
            <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-2 min-w-[120px]">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSettings;