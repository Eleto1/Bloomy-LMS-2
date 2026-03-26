import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, CreditCard, BarChart3, Settings,
  ClipboardList, CalendarDays, FileText, Award, MessageSquare, User, LogOut,
  ChevronLeft, Bell, Menu, Megaphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Students', path: '/admin/students', icon: Users },
  { label: 'Instructors', path: '/admin/instructors', icon: GraduationCap },
  { label: 'Courses', path: '/admin/courses', icon: BookOpen },
  { label: 'Cohorts', path: '/admin/cohorts', icon: CalendarDays },
  { label: 'Attendance', path: '/admin/attendance', icon: ClipboardList },
  { label: 'Student Progress', path: '/admin/progress', icon: Award },
  { label: 'Final Assessment', path: '/admin/final-assessment', icon: FileText },
  { label: 'Gradebook', path: '/admin/gradebook', icon: BarChart3 },
  { label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const instructorNav: NavItem[] = [
  { label: 'Dashboard', path: '/instructor', icon: LayoutDashboard },
  { label: 'Students', path: '/instructor/students', icon: Users },
  { label: 'Attendance', path: '/instructor/attendance', icon: ClipboardList },
  { label: 'Assignments', path: '/instructor/assignments', icon: FileText },
  { label: 'Grades', path: '/instructor/grades', icon: BarChart3 },
  { label: 'Announcements', path: '/instructor/announcements', icon: Megaphone },
];

const studentNav: NavItem[] = [
  { label: 'Dashboard', path: '/student', icon: LayoutDashboard },
  { label: 'Courses', path: '/student/courses', icon: BookOpen },
  { label: 'My Schedule', path: '/student/schedule', icon: CalendarDays },
  { label: 'Assignments', path: '/student/assignments', icon: FileText },
  { label: 'Grades', path: '/student/grades', icon: BarChart3 },
  { label: 'Community', path: '/student/community', icon: MessageSquare },
  { label: 'Certificates', path: '/student/certificates', icon: Award },
  { label: 'Profile', path: '/student/profile', icon: User },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { role, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const navItems = role === 'admin' ? adminNav : role === 'instructor' ? instructorNav : studentNav;
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'instructor' ? 'Instructor' : 'Student';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4 text-accent-foreground" />
        </div>
        {sidebarOpen && <span className="font-display font-bold text-sidebar-foreground text-sm">BloomyTech</span>}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        {sidebarOpen && (
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-semibold text-sidebar-foreground truncate">{user?.email}</div>
            <div className="text-xs text-sidebar-foreground/50">{roleLabel}</div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted flex">
      <aside className={`hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <SidebarContent />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:block text-muted-foreground hover:text-foreground">
              <ChevronLeft className={`w-5 h-5 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
            <h1 className="font-display font-semibold text-foreground">
              {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;