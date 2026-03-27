import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, Users, BookOpen, CalendarDays, FileText, Settings, 
  LogOut, ClipboardList, GraduationCap, BarChart2, DollarSign, FileCheck, BarChart, FileWarning
} from 'lucide-react';

const adminNav = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Students', path: '/admin/students', icon: Users },
  { label: 'Instructors', path: '/admin/instructors', icon: GraduationCap },
  { label: 'Courses', path: '/admin/courses', icon: BookOpen },
  { label: 'Cohorts', path: '/admin/cohorts', icon: Users },
  { label: 'Attendance', path: '/admin/attendance', icon: ClipboardList },
  { label: 'Progress', path: '/admin/progress', icon: BarChart },
  { label: 'Final Assessment', path: '/admin/final-assessment', icon: FileWarning },
  { label: 'Gradebook', path: '/admin/gradebook', icon: FileCheck },
  { label: 'Payments', path: '/admin/payments', icon: DollarSign },
  { label: 'Reports', path: '/admin/reports', icon: BarChart2 },
  { label: 'Survey Analytics', path: '/admin/survey-responses', icon: BarChart2 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function DashboardLayout() {
  const location = useLocation();
  const { role, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight">Bloomy Academy</h1>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <Button onClick={signOut} variant="ghost" className="w-full justify-start text-gray-400 hover:text-white hover:bg-slate-800">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}