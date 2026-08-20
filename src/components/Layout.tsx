import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  Bell,
  LogOut,
  GraduationCap,
  Users,
  Settings,
  Wallet,
  ListChecks,
  UserCircle2,
  Home,
  Shirt,
  Images,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'
import { timeAgo } from '../lib/utils'

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
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-sm font-semibold text-slate-700">Notifications</p>
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No notifications yet</p>}
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <button
                  key={n.id}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => load())
                  }}
                >
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
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
  icon: React.ComponentType<{ className?: string }>
}

const studentNav: NavItem[] = [
  { to: '/student', label: 'Home', icon: Home },
  { to: '/student/apply', label: 'Apply', icon: GraduationCap },
  { to: '/student/regalia', label: 'Regalia', icon: Shirt },
  { to: '/student/profile', label: 'Profile', icon: UserCircle2 },
]

const agentNav: NavItem[] = [
  { to: '/agent', label: 'Tasks', icon: ListChecks },
  { to: '/agent/profile', label: 'Profile', icon: UserCircle2 },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/requests', label: 'Requests', icon: ClipboardList },
  { to: '/admin/agents', label: 'Agents', icon: Users },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/stages', label: 'Stages', icon: ListChecks },
  { to: '/admin/payments', label: 'Payments', icon: Wallet },
  { to: '/admin/gowns', label: 'Orders', icon: Shirt },
  { to: '/admin/regalia', label: 'Catalog', icon: Images },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function Shell({ children, nav }: { children: ReactNode; nav: NavItem[] }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  if (!profile) {
    navigate('/auth', { replace: true })
    return null
  }

  const roleLabel = profile.role
  const initials = (profile.full_name || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-brand-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-100 bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-brand-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="lv-logo text-sm text-slate-900">Clearance Assist</p>
            <p className="text-[11px] capitalize text-slate-400">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/student' || item.to === '/agent' || item.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-brand-100 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{profile.full_name}</p>
              <p className="truncate text-[11px] text-slate-400">{profile.email}</p>
            </div>
            <button onClick={() => void signOut()} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-brand-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="lv-logo text-sm leading-tight text-slate-900">Clearance Assist</p>
              <p className="text-[11px] capitalize leading-tight text-slate-400">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <button onClick={() => void signOut()} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Admin mobile pills */}
        {roleLabel === 'admin' && (
          <div className="no-scrollbar sticky top-[57px] z-10 flex gap-1.5 overflow-x-auto border-b border-brand-100 bg-brand-50 px-3 py-2 lg:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-sm'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav (non-admin) */}
      {roleLabel !== 'admin' && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-md">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/student' || item.to === '/agent'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                    isActive ? 'text-brand-600' : 'text-slate-400'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
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

export function AdminTitle() {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <NotificationsBell />
      <Link to="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
        Dashboard
      </Link>
    </div>
  )
}