import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/ui'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else navigate('/', { replace: true })
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, fullName, phone)
      if (error) {
        setError(error)
      } else {
        setNotice('Account created. If this is a new email you may need to confirm it. You can now log in.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-50 px-4 py-10">
      <div className="relative z-10 w-full max-w-md">
        {/* brand */}
        <div className="mb-6 flex flex-col items-center text-center text-brand-900">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500">
            <GraduationCap className="h-7 w-7 text-gold-600" />
          </div>
          <p className="lux-label text-brand-500">Ardhi University</p>
          <h1 className="lv-logo mt-2 text-3xl text-brand-900">Clearance&nbsp;Assist</h1>
          <p className="mt-2 text-sm text-brand-500">
            Let us handle your graduation clearance while you track every step.
          </p>
        </div>

        {/* card */}
        <div className="rounded-xl border border-brand-100 bg-white p-6 sm:p-7">
          {/* mode switch */}
          <div className="mb-6 flex rounded-full border border-brand-100 p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-full py-2.5 text-sm tracking-[0.025em] transition-all ${
                  mode === m ? 'bg-black text-white' : 'text-brand-500 hover:text-brand-900'
                }`}
              >
                {m === 'login' ? 'Login' : 'Create account'}
              </button>
            ))}
          </div>

          {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}
          {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-normal text-brand-800">Full name</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-300">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Golden Kaloka"
                      required
                      className="h-12 w-full rounded border border-brand-200 bg-white py-3 pl-11 pr-4 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900"
                    />
                  </div>
                </label>

                <div className="rounded border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-500">
                  New accounts are created as students. Staff accounts are activated by an administrator.
                </div>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-normal text-brand-800">Email</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-300">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-12 w-full rounded border border-brand-200 bg-white py-3 pl-11 pr-4 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900"
                />
              </div>
            </label>

            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-normal text-brand-800">Phone number</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-300">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="h-12 w-full rounded border border-brand-200 bg-white py-3 pl-11 pr-4 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900"
                  />
                </div>
                <span className="mt-1 block text-xs text-brand-500">Used for payment confirmation and SMS updates</span>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-normal text-brand-800">Password</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-300">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-12 w-full rounded border border-brand-200 bg-white py-3 pl-11 pr-11 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-300 transition hover:text-brand-900"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-black bg-black py-3 text-sm tracking-[0.025em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a] active:scale-[0.99] disabled:opacity-40"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f8f8f8]/40 border-t-[#f8f8f8]" />
              ) : (
                <>
                  {mode === 'login' ? 'Login' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {mode === 'register' && (
            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-brand-400">
              <Check className="h-3.5 w-3.5 text-gold-600" />
              No role selection needed — everyone starts as a student.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}