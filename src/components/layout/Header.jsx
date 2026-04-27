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
  urgent: { dot: 'bg-rose-500', icon: '🔴', accent: 'text-rose-700 dark:text-rose-300' },
  warning: { dot: 'bg-amber-500', icon: '🟡', accent: 'text-amber-700 dark:text-amber-300' },
  info: { dot: 'bg-sky-500', icon: '🔵', accent: 'text-sky-700 dark:text-sky-300' },
  success: { dot: 'bg-emerald-500', icon: '🟢', accent: 'text-emerald-700 dark:text-emerald-300' },
}

function NotificationPanel({ notifications, onItemClick, onMarkAllRead }) {
  const hasAny = notifications.length > 0
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div
      className="absolute right-0 z-30 mt-3 w-[min(360px,calc(100vw-2rem))] origin-top-right animate-scale-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-800"
      role="dialog"
      aria-label="Notifikasi"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Bell size={16} className="text-teal" /> Notifikasi
        </div>
        {hasUnread ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-semibold text-teal hover:text-teal-dark"
          >
            Tandai Semua Baca
          </button>
        ) : null}
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {hasAny ? (
          <ul className="space-y-2">
            {notifications.slice(0, 8).map((item) => {
              const style = TYPE_STYLES[item.type] || TYPE_STYLES.info
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                      item.isRead
                        ? 'border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800'
                        : 'border-teal/20 bg-teal/5 shadow-[0_8px_24px_rgba(13,148,136,0.08)] dark:border-teal/30 dark:bg-teal/10'
                    }`}
                  >
                    <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-slate-300' : style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{style.icon}</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                      </div>
                      {item.message ? (
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.message}</div>
                      ) : null}
                      {item.linkLabel ? (
                        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${style.accent}`}>
                          {item.linkLabel} <ArrowRight size={12} />
                        </div>
                      ) : null}
                    </div>
                  </button>
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
              Tidak ada notifikasi lain
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kamu sudah handle semuanya. Mantap! 👌
            </div>
          </div>
        )}
      </div>
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
