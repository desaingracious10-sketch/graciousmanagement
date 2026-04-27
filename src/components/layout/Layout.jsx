import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useNotifications } from '../../hooks/useNotifications.js'
import usePullToRefresh from '../../hooks/usePullToRefresh.js'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import SalesBottomNav from './SalesBottomNav.jsx'
import SalesFab from './SalesFab.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUser } = useAuth()
  const { refreshData } = useApp()
  const notifications = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()

  const isSales = currentUser?.role === 'sales'

  const { pull, refreshing, threshold } = usePullToRefresh(refreshData, isSales)

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        return
      }

      if (!(event.ctrlKey || event.metaKey)) return
      const targetTag = event.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(targetTag)) return

      if (event.key.toLowerCase() === 'n' && currentUser?.role === 'sales') {
        event.preventDefault()
        navigate('/orders/new')
      }

      if (event.key.toLowerCase() === 'r' && currentUser?.role === 'address_admin') {
        event.preventDefault()
        navigate('/routes/builder')
      }

      if (event.key.toLowerCase() === 'p' && location.pathname.startsWith('/routes/print')) {
        event.preventDefault()
        window.print()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentUser?.role, location.pathname, navigate])

  const pulling = pull > 0 || refreshing
  const indicatorY = refreshing ? threshold : pull
  const ready = pull >= threshold

  return (
    <div className="min-h-screen bg-[var(--gray-50)] text-slate-900 transition-colors dark:bg-[#0f1923] dark:text-slate-100">
      <Sidebar
        currentUser={currentUser}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notifications={notifications}
      />
      <div className="min-h-screen lg:pl-[260px]">
        <Header
          currentUser={currentUser}
          notifications={notifications}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {isSales && pulling ? (
          <div
            className="pointer-events-none fixed inset-x-0 top-[81px] z-30 flex justify-center transition-transform lg:hidden"
            style={{ transform: `translateY(${Math.max(indicatorY - 24, 0)}px)` }}
          >
            <div
              className={`grid h-10 w-10 place-items-center rounded-full bg-white shadow-md ${
                refreshing ? 'animate-spin text-teal' : ready ? 'text-teal' : 'text-slate-400'
              }`}
            >
              <RefreshCw size={18} />
            </div>
          </div>
        ) : null}

        <main
          className={`min-h-[calc(100vh-81px)] overflow-x-hidden animate-page-fade ${
            isSales && !location.pathname.startsWith('/orders/new')
              ? 'pb-[calc(80px+env(safe-area-inset-bottom))] lg:pb-0'
              : ''
          }`}
        >
          <Outlet />
        </main>

        {isSales && !location.pathname.startsWith('/orders/new') ? (
          <>
            <SalesFab />
            <SalesBottomNav />
          </>
        ) : null}
      </div>
    </div>
  )
}
