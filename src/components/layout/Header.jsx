import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useApp } from '../../context/AppContext.jsx'

const PAGE_LABELS = {
  '/dashboard/admin': 'Dashboard',
  '/dashboard/sales': 'Dashboard Sales',
  '/dashboard/alamat': 'Dashboard Rute',
  '/dashboard/driver': 'Rute Hari Ini',
  '/orders': 'Semua Pesanan',
  '/orders/new': 'Input Pesanan Baru',
  '/customers': 'Data Customer',
  '/routes': 'Daftar Rute',
  '/routes/builder': 'Buat Rute Hari Ini',
  '/routes/print': 'Cetak Rute',
  '/zones': 'Kelola Zona',
  '/drivers': 'Daftar Driver',
  '/users': 'User Manager',
}

export default function Header({ currentUser, notifications, onMenuClick }) {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const { theme, toggleTheme } = useApp()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [openMenu, setOpenMenu] = useState(false)
  const [openNotifications, setOpenNotifications] = useState(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const breadcrumb = useMemo(() => getPageLabel(pathname), [pathname])

  useEffect(() => {
    document.title = `Gracious Delivery | ${breadcrumb}`
  }, [breadcrumb])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur transition-colors dark:border-slate-700/80 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Halaman aktif</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{breadcrumb}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 xl:block">
            {formatIndonesianDateTime(now)}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenNotifications((value) => !value)
                setOpenMenu(false)
              }}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {notifications.totalCount > 0 ? (
                <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
                  {notifications.totalCount}
                </span>
              ) : null}
            </button>
            {openNotifications ? (
              <div className="absolute right-0 mt-3 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.15)] dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-2 px-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Notifikasi</div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {notifications.notifications.length ? (
                    notifications.notifications.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</div>
                        <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">Belum ada notifikasi baru.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenMenu((value) => !value)
                setOpenNotifications(false)
              }}
              className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gracious-navy font-semibold text-white">
                {getInitials(currentUser?.name)}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentUser?.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.email}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {openMenu ? (
              <div className="absolute right-0 mt-3 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.15)] dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(false)
                    navigate('/login')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Profil
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function getInitials(name) {
  if (!name) return 'GD'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getPageLabel(pathname) {
  if (pathname.startsWith('/orders/') && pathname !== '/orders/new') return 'Detail Pesanan'
  if (pathname.startsWith('/customers/') && pathname !== '/customers') return 'Detail Customer'
  return PAGE_LABELS[pathname] || 'Dashboard'
}

function formatIndonesianDateTime(date) {
  const datePart = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  const timePart = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

  return `${capitalize(datePart)} | ${timePart}`
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}
