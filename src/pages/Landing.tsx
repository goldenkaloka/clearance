import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SiteNav } from '../components/Layout'
import { dashboardFor, homeFor } from '../lib/utils'

const CATEGORIES = [
  { img: '/sash-1.jpg', label: 'Sashes', note: 'Sashes', to: '/regalia/sash' },
  { img: '/suit-male-1.jpg', label: 'Suits — Men', note: 'Male graduates', to: '/regalia/suit' },
  { img: '/suit-female-1.jpg', label: 'Suits — Women', note: 'Female graduates', to: '/regalia/suit' },
  { img: '/shoe-male-1.jpg', label: 'Shoes — Men', note: 'Male graduates', to: '/regalia/shoes' },
  { img: '/shoe-female-1.jpg', label: 'Shoes — Women', note: 'Female graduates', to: '/regalia/shoes' },
]

export default function Landing() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  function go(path: string) {
    if (!profile) {
      navigate(`/auth?next=${encodeURIComponent(path)}`)
      return
    }
    if (profile.role === 'student') navigate(path)
    else navigate(homeFor(profile.role))
  }

  function goAccount() {
    if (profile) navigate(dashboardFor(profile.role))
    else navigate('/auth')
  }

  const label = 'text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500'
  const pill =
    'inline-flex items-center gap-2 rounded-full border border-black bg-black px-7 py-3 text-xs uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]'
  const ghostPill =
    'inline-flex items-center gap-2 rounded-full border border-white/80 bg-transparent px-7 py-3 text-xs uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]'

  return (
    <div className="min-h-screen bg-white font-sans text-brand-900">
      {/* top bar */}
      <SiteNav mode="marketing" />

      {/* hero */}
      <section className="relative h-[92vh] min-h-[560px] w-full overflow-hidden bg-brand-50">
        <img src="/hero.jpg" alt="Graduation regalia" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
            <p className="lux-label text-white/80">Ardhi University</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-normal leading-tight tracking-[0.02em] text-white sm:text-6xl">
              Graduation, beautifully handled
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85">
              Your clearance and regalia — every step tracked, so you only show up and graduate.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={() => navigate('/regalia/suit')} className={pill}>
                Explore regalia <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => go('/student/apply')} className={ghostPill}>
                Start clearance
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* shop by category */}
      <section id="shop" className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <div className="flex items-baseline justify-between">
            <p className={label}>Shop by category</p>
            <p className="hidden text-xs text-brand-400 sm:block">Gowns · Sashes · Suits · Shoes</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className="group text-left"
              >
                <div className="overflow-hidden bg-brand-50">
                  <img
                    src={c.img}
                    alt={c.label}
                    className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm tracking-[0.025em] text-brand-900">{c.label}</p>
                    <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-400">{c.note}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-brand-300 transition-colors group-hover:text-gold-600" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* editorial: complete your regalia */}
      <section className="bg-brand-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-2">
          <div className="relative overflow-hidden">
            <img
              src="/suit-gown-sash.jpg"
              alt="Gown, suit and sash"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div>
            <p className={label}>Gown · Suit · Sash</p>
            <h2 className="mt-5 text-3xl font-normal tracking-[0.02em] sm:text-4xl">
              Complete your regalia
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-500">
              Browse the gown, sash, suit and shoes on display — call or WhatsApp us and we'll arrange
              sizes and delivery before the ceremony.
            </p>
            <button onClick={() => navigate('/regalia/suit')} className={`${pill} mt-8`}>
              Browse regalia <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* services */}
      <section id="services" className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <p className={label}>Our services</p>
          <div className="mt-12 grid gap-px border-y border-brand-100 bg-brand-100 sm:grid-cols-2">
            <div className="bg-white p-10 sm:p-14">
              <p className={label}>01 — Gowns & regalia</p>
              <h2 className="mt-5 text-3xl font-normal tracking-[0.02em] sm:text-4xl">
                Graduation gown, sash, suit & shoes
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-500">
                Browse the gown, sash, suit and shoes for male or female students — then call or WhatsApp
                us and we'll fit and prepare your regalia.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <button
                  onClick={() => navigate('/regalia/suit')}
                  className="inline-flex items-center gap-2 border-b border-brand-900 pb-1 text-xs uppercase tracking-[0.2em] text-brand-900 transition-colors hover:border-gold-600 hover:text-gold-600"
                >
                  Browse samples <ArrowUpRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => go('/student/gown')}
                  className="inline-flex items-center gap-2 border-b border-brand-900 pb-1 text-xs uppercase tracking-[0.2em] text-brand-900 transition-colors hover:border-gold-600 hover:text-gold-600"
                >
                  Order a gown <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="bg-white p-10 sm:p-14">
              <p className={label}>02 — Graduation clearance</p>
              <h2 className="mt-5 text-3xl font-normal tracking-[0.02em] sm:text-4xl">
                Clearance, tracked step by step
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-500">
                We handle every department on the ARU clearance form while you follow your progress
                in real time.
              </p>
              <button
                onClick={() => go('/student/apply')}
                className="mt-8 inline-flex items-center gap-2 border-b border-brand-900 pb-1 text-xs uppercase tracking-[0.2em] text-brand-900 transition-colors hover:border-gold-600 hover:text-gold-600"
              >
                Start clearance <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-brand-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <GraduationCap className="h-5 w-5 text-gold-600" />
                <span className="lv-logo text-lg text-brand-900">Finalists</span>
              </div>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-brand-500">
                Graduation clearance and regalia for Ardhi University students.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className={label}>Services</p>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <Link to="/regalia/sash" className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      Sashes
                    </Link>
                  </li>
                  <li>
                    <Link to="/regalia/suit" className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      Suits
                    </Link>
                  </li>
                  <li>
                    <Link to="/regalia/shoes" className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      Shoes
                    </Link>
                  </li>
                  <li>
                    <button onClick={() => go('/student/apply')} className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      Clearance
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <p className={label}>Account</p>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <button onClick={goAccount} className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      {profile ? 'My account' : 'Sign in'}
                    </button>
                  </li>
                  <li>
                    <button onClick={goAccount} className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                      {profile ? 'Dashboard' : 'Create account'}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-14 border-t border-brand-100 pt-6 text-center">
            <p className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-300">
              © {new Date().getFullYear()} Finalists · Ardhi University
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}