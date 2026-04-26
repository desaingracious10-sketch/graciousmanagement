import { BarChart3, ClipboardList, Home, Map, MapPinned, Package, PlusCircle, Truck, UserCog, Users, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  sales: 'Sales',
  address_admin: 'Address Admin',
  driver: 'Driver',
}

const MENU_BY_ROLE = {
  superadmin: [
    { label: 'Dashboard', to: '/dashboard/admin', icon: Home },
    { label: 'Semua Pesanan', to: '/orders', icon: Package, badgeKey: 'orders' },
    { label: 'Customer', to: '/customers', icon: Users, badgeKey: 'customers' },
    { label: 'Kelola Rute', to: '/routes', icon: Map, badgeKey: 'routes' },
    { label: 'Driver', to: '/drivers', icon: Truck },
    { label: 'Zona', to: '/zones', icon: MapPinned },
    { label: 'User Manager', to: '/users', icon: UserCog },
    { type: 'divider' },
    { label: 'Laporan & Statistik', to: '/dashboard/admin', icon: BarChart3 },
  ],
  sales: [
    { label: 'Dashboard Sales', to: '/dashboard/sales', icon: Home },
    { label: 'Input Pesanan Baru', to: '/orders/new', icon: PlusCircle, prominent: true },
    { label: 'Pesanan Saya', to: '/orders', icon: ClipboardList, badgeKey: 'orders' },
    { label: 'Customer', to: '/customers', icon: Users, badgeKey: 'customers' },
  ],
  address_admin: [
    { label: 'Dashboard Rute', to: '/dashboard/alamat', icon: Home },
    { label: 'Buat Rute Hari Ini', to: '/routes/builder', icon: Map, badgeKey: 'routes', prominent: true },
    { label: 'Daftar Rute', to: '/routes', icon: ClipboardList, badgeKey: 'routes' },
    { label: 'Data Customer', to: '/customers', icon: Users, badgeKey: 'customers' },
    { label: 'Kelola Zona', to: '/zones', icon: MapPinned },
    { label: 'Driver', to: '/drivers', icon: Truck },
  ],
  driver: [{ label: 'Rute Hari Ini', to: '/dashboard/driver', icon: Truck, badgeKey: 'routes' }],
}

export default function Sidebar({ currentUser, open, onClose, notifications }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const menu = MENU_BY_ROLE[currentUser?.role] || []
  const initials = getInitials(currentUser?.name)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm transition lg:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-gracious-navy text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl">🍱</div>
            <div>
              <div className="font-semibold tracking-tight text-white">Gracious Delivery</div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-teal-light">Healthy Catering</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menu.map((item, index) =>
            item.type === 'divider' ? (
              <div key={`divider-${index}`} className="my-4 border-t border-white/10" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-r-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-l-[3px] border-teal bg-teal/20 text-white'
                      : item.prominent
                        ? 'bg-teal text-white shadow-[0_10px_30px_rgba(13,148,136,0.25)] hover:bg-teal-dark'
                        : 'border-l-[3px] border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={isActive || item.prominent ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                    <span className="flex-1">{item.label}</span>
                    {item.badgeKey && notifications.menuCounts[item.badgeKey] > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                        {notifications.menuCounts[item.badgeKey]}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal font-semibold text-white">{initials}</div>
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{currentUser?.name}</div>
                <div className="mt-1 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-light">
                  {ROLE_LABELS[currentUser?.role] || currentUser?.role}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
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
