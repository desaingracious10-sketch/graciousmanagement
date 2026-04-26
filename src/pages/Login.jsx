import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Leaf, Loader2, Lock, Mail } from 'lucide-react'
import { getRoleHome, REMEMBER_KEY, useAuth } from '../hooks/useAuth.js'

const DEMO_ACCOUNTS = [
  { label: 'Admin Utama', email: 'admin@gracioushealthy.com', password: 'admin123' },
  { label: 'Admin Sales', email: 'sales@gracious.com', password: 'sales123' },
  { label: 'Admin Alamat', email: 'alamat@gracious.com', password: 'alamat123' },
  { label: 'Driver', email: 'drivername@gracious.com', password: 'driver123' },
]

export default function Login() {
  const { isLoggedIn, currentUser, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!shake) return undefined

    const timeoutId = window.setTimeout(() => setShake(false), 500)
    return () => window.clearTimeout(timeoutId)
  }, [shake])

  if (isLoggedIn) {
    return <Navigate to={getRoleHome(currentUser.role)} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return

    setError('')
    setLoading(true)

    await new Promise((resolve) => window.setTimeout(resolve, 450))

    const result = await login(email, password)
    if (!result.ok) {
      setLoading(false)
      setError(result.error)
      setShake(true)
      return
    }

    if (remember) localStorage.setItem(REMEMBER_KEY, email.trim())
    else localStorage.removeItem(REMEMBER_KEY)

    navigate(getRoleHome(result.user.role), { replace: true })
  }

  function fillDemo(account) {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream via-[#fffdf7] to-white px-4 py-10">
      <div
        className={`w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur animate-fade-in-up ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal via-teal-dark to-gracious-navy text-white shadow-[0_16px_36px_rgba(13,148,136,0.28)] animate-pulse-once">
            <Leaf size={28} strokeWidth={2.2} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gracious-navy">
            Gracious Delivery
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem Manajemen Pengiriman Catering Sehat
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gracious-gold/30 bg-gracious-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gracious-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gracious-gold" />
            Halal Indonesia
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gracious-navy">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@gracious.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pl-10 text-sm text-slate-800 shadow-sm transition focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gracious-navy"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="........"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pl-10 pr-10 text-sm text-slate-800 shadow-sm transition focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className="flex select-none items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal"
            />
            Ingat saya
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal py-3 font-medium text-white shadow-[0_16px_28px_rgba(13,148,136,0.22)] transition hover:-translate-y-0.5 hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Memproses...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-teal/15 bg-teal/10 p-3.5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-dark">
            Demo Accounts
          </div>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-white"
              >
                <span className="font-medium text-gracious-navy">{account.label}:</span>{' '}
                <span className="text-slate-600">
                  {account.email} / {account.password}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
