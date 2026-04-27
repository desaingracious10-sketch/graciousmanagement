import { Home, Link2, Plus, UtensilsCrossed } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { icon: Home, label: 'Beranda', path: '/dashboard/sales', match: ['/dashboard/sales'] },
  { icon: Plus, label: 'Input', path: '/orders/new', match: ['/orders'] },
  { icon: Link2, label: 'Link', path: '/generate-link', match: ['/generate-link'] },
  { icon: UtensilsCrossed, label: 'Menu', path: '/menu-manager', match: ['/menu-manager'] },
]

export default function SalesBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-8px_24px_rgba(15,23,42,0.06)] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {TABS.map(({ icon: Icon, label, path, match }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard/sales'}
            className={({ isActive }) => {
              const active =
                isActive || match.some((m) => typeof window !== 'undefined' && window.location.pathname.startsWith(m))
              return `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-[0.97] ${
                active ? 'text-teal' : 'text-slate-500'
              }`
            }}
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition ${
                    isActive ? 'bg-teal/10 text-teal' : 'text-slate-500'
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
