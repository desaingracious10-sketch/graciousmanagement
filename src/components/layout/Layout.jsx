import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useNotifications } from '../../hooks/useNotifications.js'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUser } = useAuth()
  const notifications = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()

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
        <main className="min-h-[calc(100vh-81px)] overflow-x-hidden animate-page-fade">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
