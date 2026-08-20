import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'
import { timeAgo, dashboardFor } from '../lib/utils'

export function NotificationsBell() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!profile) return
    load()

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [profile])

  const load = () => {
    if (!profile) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setItems((data ?? []) as Notification[])
        setUnread(((data ?? []) as Notification[]).filter((n) => !n.read).length)
      })
  }

  if (!profile) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-full p-2 text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-900" title="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-3 w-80 max-w-[90vw] rounded-2xl border border-brand-100 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-sm font-semibold text-brand-900">Notifications</p>
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-brand-400">No notifications yet</p>}
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <button
                  key={n.id}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-brand-50"
                  onClick={() => {
                    supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => load())
                  }}
                >
                  <p className="text-sm font-medium text-brand-800">{n.title}</p>
                  <p className="text-xs text-brand-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-brand-300">{timeAgo(n.created_at)}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
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
  { to: '/student/regalia', label: 'Regalia' },
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

  const initials = (profile?.full_name || 'U').slice(0, 2).toUpperCase()

  function goAccount() {
    setMenuOpen(false)
    navigate(dashboardFor(profile?.role))
  }

  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-5 py-4 sm:px-8">
        <nav className="flex items-center gap-6">
          {left ?? (mode === 'marketing' ? (
            <>
              <a href="#shop" className="hidden text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900 sm:block">
                Regalia
              </a>
              <a href="#services" className="hidden text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900 sm:block">
                Services
              </a>
            </>
          ) : (
            <Link to="/" className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900">
              Home
            </Link>
          ))}
        </nav>

        <div className="flex justify-center">
          <Link to="/" className="lv-logo text-xl text-brand-900 sm:text-2xl">
            Clearance&nbsp;Assist
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
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-40 mt-3 w-60 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl">
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
        <nav className="no-scrollbar overflow-x-auto border-t border-brand-100">
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
    </header>
  )
}

function Shell({ children, nav }: { children: ReactNode; nav: NavItem[] }) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  if (!profile) {
    navigate('/auth', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-white font-sans text-brand-900">
      <SiteNav mode="app" nav={nav} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
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