import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bell, BellOff, ChevronDown, LogOut, Menu, Moon, Sun } from 'lucide-react'
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
  const notifRef = useRef(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!openNotifications) return undefined
    function onClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setOpenNotifications(false)
      }
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [openNotifications])

  function openNotifPanel() {
    const next = !openNotifications
    setOpenNotifications(next)
    setOpenMenu(false)
    if (next && typeof notifications.markAllRead === 'function') {
      notifications.markAllRead()
    }
  }

  function handleNotifClick(notif) {
    setOpenNotifications(false)
    if (typeof notifications.markRead === 'function') {
      notifications.markRead(notif.id)
    }
    if (notif.link) navigate(notif.link)
  }

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

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={openNotifPanel}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {notifications.unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(244,63,94,0.45)] animate-pulse-once">
                  {notifications.unreadCount}
                </span>
              ) : null}
            </button>
            {openNotifications ? (
              <NotificationPanel
                notifications={notifications.notifications}
                onItemClick={handleNotifClick}
                onMarkAllRead={notifications.markAllRead}
              />
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
                <div className="text-xs text-slate-500 dark:text-slate-400">@{currentUser?.username}</div>
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

const TYPE_STYLES = {
  urgent:  { dot: 'bg-rose-500',    icon: '🔴', accent: 'text-rose-700 dark:text-rose-300',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',    border: 'border-rose-200/60 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/10' },
  warning: { dot: 'bg-amber-500',   icon: '🟡', accent: 'text-amber-700 dark:text-amber-300',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',  border: 'border-amber-200/60 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10' },
  info:    { dot: 'bg-sky-500',     icon: '🔵', accent: 'text-sky-700 dark:text-sky-300',      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',          border: 'border-sky-200/60 bg-sky-50/60 dark:border-sky-500/20 dark:bg-sky-500/10' },
  success: { dot: 'bg-emerald-500', icon: '🟢', accent: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10' },
}

function NotificationPanel({ notifications, onItemClick, onMarkAllRead }) {
  const hasAny = notifications.length > 0
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div
      className="absolute right-0 z-30 mt-3 w-[min(400px,calc(100vw-2rem))] origin-top-right animate-scale-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-800"
      role="dialog"
      aria-label="Notifikasi"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Bell size={16} className="text-teal" />
          Notifikasi
          {hasUnread && (
            <span className="inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {notifications.filter((n) => !n.isRead).length}
            </span>
          )}
        </div>
        {hasUnread ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-semibold text-teal transition hover:text-teal-dark"
          >
            Tandai Semua Baca
          </button>
        ) : null}
      </div>

      {/* List */}
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {hasAny ? (
          <ul className="space-y-1.5">
            {notifications.slice(0, 10).map((item) => {
              const style = TYPE_STYLES[item.type] || TYPE_STYLES.info
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-2xl border px-3 py-3 transition ${
                      item.isRead
                        ? 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900/40'
                        : style.border
                    }`}
                  >
                    {/* Top row: dot + title + count badge */}
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                          item.isRead ? 'bg-slate-300 dark:bg-slate-600' : style.dot
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">{style.icon}</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {item.title}
                          </span>
                          {item.count > 1 && (
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                              {item.count}
                            </span>
                          )}
                        </div>
                        {item.message ? (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {item.message}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Action button — always visible, prominent */}
                    {item.link ? (
                      <div className="mt-2.5 pl-4">
                        <button
                          type="button"
                          onClick={() => onItemClick(item)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 active:scale-95 ${style.badge}`}
                        >
                          {item.linkLabel || 'Lihat'}
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-700">
              <BellOff size={20} />
            </div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Tidak ada notifikasi
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kamu sudah handle semuanya. Mantap! 👌
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasAny && (
        <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-700">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Update otomatis setiap 30 detik
          </p>
        </div>
      )}
    </div>
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
