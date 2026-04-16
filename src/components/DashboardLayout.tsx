import { useState } from 'react';
import { InstituteProvider, useInstitute } from '@/lib/institute-context';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, Users, BookOpen, CalendarDays, ClipboardList, 
  FileText, Settings, BarChart3, DollarSign, GraduationCap, LogOut, Layers,
  ChevronLeft, ChevronRight, Linkedin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const allNavItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'instructor', 'student'] },
  { name: 'Students', href: '/students', icon: Users, roles: ['admin', 'instructor'] },
  { name: 'Instructors', href: '/instructors', icon: GraduationCap, roles: ['admin'] },
  { name: 'Courses/Programs', href: '/courses', icon: BookOpen, roles: ['admin', 'instructor', 'student'] },
  { name: 'Cohorts', href: '/cohorts', icon: Layers, roles: ['admin'] },
  { name: 'Attendance', href: '/attendance', icon: CalendarDays, roles: ['admin', 'instructor'] },
  { name: 'Students Progress', href: '/progress', icon: BarChart3, roles: ['admin', 'instructor', 'student'] },
  { name: 'Survey Analytics', href: '/Survey-Analytics', icon: BarChart3, roles: ['admin'] },
  { name: 'Final Assessment', href: '/final-assessment', icon: FileText, roles: ['admin', 'instructor', 'student'] },
  { name: 'Gradebook', href: '/gradebook', icon: ClipboardList, roles: ['admin'] },
  { name: 'Payments', href: '/payments', icon: DollarSign, roles: ['admin'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <a
            href="https://www.linkedin.com/in/koredesamuel"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 transition-colors duration-200"
          >
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Bloomy LMS. Created and owned by&nbsp;
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground underline-offset-4 group-hover:underline transition-colors duration-200">
              Korede Samuel
            </span>
            <Linkedin
              className="text-[#0A66C2] group-hover:brightness-125 transition-all duration-200"
              size={18}
              strokeWidth={1.8}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

function SidebarContent() {
  const { role, profile, user, signOut } = useAuth();
  const { name, logoUrl } = useInstitute();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = allNavItems.filter(item => item.roles.includes(role || ''));

  // ── Build full path without trailing slash ──
  // Dashboard href is '/' — we must return '/admin' NOT '/admin/'
  const getFullPath = (href: string) => {
    const prefix = `/${role}`;
    if (href === '/') return prefix;  // '/admin' not '/admin/'
    return `${prefix}${href}`;        // '/admin/students'
  };

  // ── Active detection that works with nested routes ──
  const isActive = (fullPath: string) => {
    // Dashboard: only active on exact /admin or /admin/
    if (fullPath === `/${role}`) {
      return location.pathname === fullPath || location.pathname === `${fullPath}/`;
    }
    // All other items: active if pathname starts with the full path
    return location.pathname.startsWith(fullPath);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-slate-900 text-white flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {/* Header with collapse toggle */}
        <div className={cn(
          'flex items-center border-b border-slate-700 transition-all duration-300',
          collapsed ? 'p-3 justify-center' : 'p-4 justify-between'
        )}>
          <Link to={getFullPath('/')} className={cn(
            'flex items-center gap-3 overflow-hidden transition-all duration-300',
            collapsed ? 'gap-0' : ''
          )}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={name || 'Academy'}
                className={cn(
                  'rounded-lg object-cover shrink-0 transition-all duration-300',
                  collapsed ? 'w-8 h-8' : 'w-8 h-8'
                )}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            )}
            <span className={cn(
              'font-bold text-lg whitespace-nowrap transition-all duration-300',
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            )}>
              {name || 'Academy'}
            </span>
          </Link>

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-slate-800 transition-all duration-300 cursor-pointer shrink-0',
              collapsed ? 'absolute top-4 right-0 translate-x-1/2 bg-slate-800 border border-slate-600 rounded-full shadow-lg hover:shadow-xl z-50' : ''
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {filteredNavItems.map((item) => {
            const fullPath = getFullPath(item.href);
            const active = isActive(fullPath);
            return (
              <Link
                key={item.name}
                to={fullPath}
                title={collapsed ? item.name : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-300',
                  collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className={cn(
                  'whitespace-nowrap transition-all duration-300',
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className={cn(
          'border-t border-slate-700 transition-all duration-300',
          collapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-4'
        )}>
          <div className={cn(
            'flex items-center gap-3 overflow-hidden transition-all duration-300',
            collapsed ? 'justify-center' : 'mb-3'
          )}>
            <Avatar className={cn('shrink-0 transition-all duration-300', collapsed ? 'h-9 w-9' : 'h-8 w-8')}>
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
              <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className={cn(
              'overflow-hidden transition-all duration-300',
              collapsed ? 'opacity-0 w-0' : 'flex-1'
            )}>
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-gray-400 capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            title="Logout"
            className={cn(
              'transition-all duration-300',
              collapsed
                ? 'w-full justify-center text-gray-400 hover:text-white hover:bg-slate-800 p-2'
                : 'w-full justify-start text-gray-300 hover:text-white hover:bg-slate-800'
            )}
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={cn(
              'transition-all duration-300',
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto ml-2'
            )}>
              Logout
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Content - margin adjusts with sidebar */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-auto transition-all duration-300 ease-in-out',
          collapsed ? 'ml-[72px]' : 'ml-64'
        )}
      >
        <div className="flex-1 p-6">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <InstituteProvider>
      <SidebarContent />
    </InstituteProvider>
  );
}
