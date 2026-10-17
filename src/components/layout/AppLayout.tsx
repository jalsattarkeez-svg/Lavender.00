import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Timer,
  History,
  BarChart3,
  Target,
  CalendarClock,
  Settings,
  LogOut,
  Menu,
  X,
  FlaskConical,
  ListChecks,
  Calendar,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useT } from '@/lib/i18n';

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/plan', labelKey: 'nav.dailyPlan', icon: ListChecks },
  { to: '/learning', labelKey: 'nav.learning', icon: BookOpen },
  { to: '/study', labelKey: 'nav.study', icon: Timer },
  { to: '/planner', labelKey: 'nav.planner', icon: Calendar },
  { to: '/revision', labelKey: 'nav.revision', icon: RotateCcw },
  { to: '/history', labelKey: 'nav.history', icon: History },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/goals', labelKey: 'nav.goals', icon: Target },
  { to: '/exams', labelKey: 'nav.exams', icon: CalendarClock },
  { to: '/mistakes', labelKey: 'nav.mistakes', icon: AlertCircle },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'there';

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender-600 shadow-md shadow-lavender-600/20">
          <FlaskConical size={22} className="text-white" />
        </div>
        <div>
          <span className="block text-sm font-bold text-lavender-900">{t('app.name')}</span>
          <span className="block text-xs text-lavender-400">{t('app.tagline')}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-lavender-300"
                title={t('nav.comingSoon')}
              >
                <Icon size={18} />
                {t(item.labelKey)}
                <span className="ms-auto text-xs">{t('nav.comingSoon')}</span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-lavender-100 text-lavender-800'
                    : 'text-lavender-500 hover:bg-lavender-50 hover:text-lavender-700'
                }`
              }
            >
              <Icon size={18} />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-lavender-100 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender-200 text-sm font-semibold text-lavender-700">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-lavender-800">{displayName}</p>
            <p className="truncate text-xs text-lavender-400">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-lavender-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          {t('auth.signout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-lavender-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-r border-lavender-100 bg-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-lavender-950/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-64 flex-col border-r border-lavender-100 bg-white animate-slide-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute end-3 top-3 rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-50"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-lavender-100 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lavender-600">
            <FlaskConical size={18} className="text-white" />
          </div>
          <span className="text-sm font-bold text-lavender-900">{t('app.name')}</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-lavender-600 hover:bg-lavender-100"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ps-64">
        <div className="pt-16 lg:pt-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
