import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { dashboardFor } from '../lib/utils'

export function NotificationsBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!profile) return
    const load = () => {
      supabase
        .from('notifications')
        .select('read')
        .eq('user_id', profile.id)
        .then(({ data }) => {
          setUnread(((data ?? []) as { read: boolean }[]).filter((n) => !n.read).length)
        })
    }
    load()

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [profile])

  if (!profile) return null

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative rounded-full p-2 text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-900"
      title="Notifications"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  )
}

interface NavItem {
  to: string
  label: string
}

const studentNav: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/student', label: 'Dashboard' },
  { to: '/student/apply', label: 'Apply' },
  { to: '/student/gown', label: 'Gown' },
  { to: '/student/profile', label: 'Profile' },
]

const agentNav: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/agent', label: 'Tasks' },
  { to: '/agent/profile', label: 'Profile' },
]

const adminNav: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/admin', label: 'Overview' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/agents', label: 'Agents' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/stages', label: 'Stages' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/gowns', label: 'Orders' },
  { to: '/admin/regalia', label: 'Catalog' },
  { to: '/admin/settings', label: 'Settings' },
]

function isRoot(to: string) {
  return to === '/' || to === '/student' || to === '/agent' || to === '/admin'
}

export function SiteNav({ mode = 'app', nav = [], left }: { mode?: 'marketing' | 'app'; nav?: NavItem[]; left?: ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const initials = (profile?.full_name || 'U').slice(0, 2).toUpperCase()

  function goAccount() {
    setMenuOpen(false)
    navigate(dashboardFor(profile?.role))
  }

  const mobileLinks: ({ to: string; label: string; anchor?: boolean })[] =
    mode === 'marketing'
      ? [
          { to: '/', label: 'Home' },
          { to: '#shop', label: 'Regalia', anchor: true },
          { to: '/regalia/sash', label: 'Sashes' },
          { to: '/regalia/suit', label: 'Suits' },
          { to: '/regalia/shoes', label: 'Shoes' },
        ]
      : nav

  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-5 py-4 sm:px-8">
        <nav className="flex items-center gap-6">
          <button
            onClick={() => setNavOpen(true)}
            className="-ml-1 rounded-full p-2 text-brand-900 transition-colors hover:bg-brand-50 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-6 lg:flex">
            {left ?? (mode === 'marketing' ? (
              <>
                <a href="#shop" className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900">
                  Regalia
                </a>
                <a href="#services" className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900">
                  Services
                </a>
              </>
            ) : (
              <Link to="/" className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900">
                Home
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex justify-center">
          <Link to="/" className="lv-logo text-xl text-brand-900 sm:text-2xl">
            Finalists
          </Link>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {mode === 'app' && <NotificationsBell />}
          {profile ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-brand-50 sm:pr-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-bold text-[#f8f8f8]">
                  {initials}
                </span>
                <span className="hidden text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 sm:block">
                  {profile.full_name?.split(' ')[0] ?? 'Account'}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setMenuOpen(false)} />
                  <div className="fixed inset-x-3 bottom-0 z-40 rounded-t-2xl border border-brand-100 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-3 sm:w-60 sm:rounded-2xl sm:pb-2 sm:shadow-xl">
                    <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-brand-100 sm:hidden" />
                    <div className="border-b border-brand-100 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-brand-900">{profile.full_name}</p>
                      <p className="truncate text-xs text-brand-400">{profile.email}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.0625rem] text-brand-300">{profile.role}</p>
                    </div>
                    <button onClick={goAccount} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-brand-700 transition-colors hover:bg-brand-50">
                      My dashboard
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        void signOut()
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="rounded-full border border-black bg-black px-5 py-2 text-[0.625rem] uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {mode === 'app' && nav.length > 0 && (
        <nav className="no-scrollbar hidden overflow-x-auto border-t border-brand-100 lg:block">
          <div className="mx-auto flex max-w-7xl items-center gap-7 px-5 sm:px-8">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={isRoot(item.to)}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 py-3 text-[0.625rem] uppercase tracking-[0.0625rem] transition-colors ${
                    isActive ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-500 hover:text-brand-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Mobile menu */}
      {navOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
              <span className="lv-logo text-lg text-brand-900">Finalists</span>
              <button
                onClick={() => setNavOpen(false)}
                className="rounded-full p-2 text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-900"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {mobileLinks.map((l) =>
                l.anchor ? (
                  <a
                    key={l.to}
                    href={l.to}
                    onClick={() => setNavOpen(false)}
                    className="block border-b border-brand-100 py-4 text-[0.75rem] uppercase tracking-[0.1em] text-brand-800 transition-colors hover:text-brand-500"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setNavOpen(false)}
                    className="block border-b border-brand-100 py-4 text-[0.75rem] uppercase tracking-[0.1em] text-brand-800 transition-colors hover:text-brand-500"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
            <div className="border-t border-brand-100 p-3">
              {profile ? (
                <button
                  onClick={() => {
                    setNavOpen(false)
                    goAccount()
                  }}
                  className="w-full rounded-full border border-black bg-black px-5 py-3 text-[0.625rem] uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
                >
                  My dashboard
                </button>
              ) : (
                <button
                  onClick={() => {
                    setNavOpen(false)
                    navigate('/auth')
                  }}
                  className="w-full rounded-full border border-black bg-black px-5 py-3 text-[0.625rem] uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function Shell({ children, nav }: { children: ReactNode; nav: NavItem[] }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!profile) {
    navigate('/auth', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-white font-sans text-brand-900">
      <SiteNav mode="app" nav={nav} />
      <main key={location.pathname} className="page-in mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const nav = profile?.role === 'agent' ? agentNav : studentNav
  return <Shell nav={nav}>{children}</Shell>
}

export function AdminShell({ children }: { children: ReactNode }) {
  return <Shell nav={adminNav}>{children}</Shell>
}