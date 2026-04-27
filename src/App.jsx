import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { getRoleHome, getStoredUser, useAuth } from './hooks/useAuth.js'
import Layout from './components/layout/Layout.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const DashboardSuperAdmin = lazy(() => import('./pages/DashboardSuperAdmin.jsx'))
const DashboardSales = lazy(() => import('./pages/DashboardSales.jsx'))
const DashboardAddress = lazy(() => import('./pages/DashboardAddress.jsx'))
const DashboardDriver = lazy(() => import('./pages/DashboardDriver.jsx'))
const OrderList = lazy(() => import('./pages/OrderList.jsx'))
const NewOrder = lazy(() => import('./pages/NewOrder.jsx'))
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'))
const CustomerList = lazy(() => import('./pages/CustomerList.jsx'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'))
const RouteList = lazy(() => import('./pages/RouteList.jsx'))
const RouteBuilder = lazy(() => import('./pages/RouteBuilder.jsx'))
const RoutePrint = lazy(() => import('./pages/RoutePrint.jsx'))
const ZoneManager = lazy(() => import('./pages/ZoneManager.jsx'))
const DriverList = lazy(() => import('./pages/DriverList.jsx'))
const UserManager = lazy(() => import('./pages/UserManager.jsx'))
const CustomerPortal = lazy(() => import('./pages/portal/CustomerPortal.jsx'))
const GeneratePortalLink = lazy(() => import('./pages/sales/GeneratePortalLink.jsx'))
const MenuManager = lazy(() => import('./pages/sales/MenuManager.jsx'))

function useSession() {
  const { currentUser } = useAuth()
  return currentUser || getStoredUser()
}

function ProtectedRoute({ roles, children }) {
  const user = useSession()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function HomeRedirect() {
  const user = useSession()
  return <Navigate to={user ? getRoleHome(user.role) : '/login'} replace />
}

function RoleGuard({ roles }) {
  const user = useSession()
  if (!user) return <Navigate to="/login" replace />
  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portal/:token" element={<CustomerPortal />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route element={<RoleGuard roles={['superadmin']} />}>
            <Route path="/dashboard/admin" element={<DashboardSuperAdmin />} />
            <Route path="/users" element={<UserManager />} />
          </Route>

          <Route element={<RoleGuard roles={['sales']} />}>
            <Route path="/dashboard/sales" element={<DashboardSales />} />
          </Route>

          <Route element={<RoleGuard roles={['address_admin']} />}>
            <Route path="/dashboard/alamat" element={<DashboardAddress />} />
          </Route>

          <Route element={<RoleGuard roles={['driver']} />}>
            <Route path="/dashboard/driver" element={<DashboardDriver />} />
          </Route>

          <Route element={<RoleGuard roles={['superadmin', 'sales']} />}>
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/generate-link" element={<GeneratePortalLink />} />
            <Route path="/menu-manager" element={<MenuManager />} />
          </Route>

          <Route element={<RoleGuard roles={['superadmin', 'address_admin']} />}>
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/routes" element={<RouteList />} />
            <Route path="/routes/builder" element={<RouteBuilder />} />
            <Route path="/routes/print" element={<RoutePrint />} />
            <Route path="/zones" element={<ZoneManager />} />
            <Route path="/drivers" element={<DriverList />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

function RouteLoadingFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--gray-50)] px-4 dark:bg-[#0f1923]">
      <div className="w-full max-w-xl space-y-4">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-[20px] bg-gradient-to-br from-teal to-gracious-navy" />
        <div className="mx-auto h-4 w-48 animate-shimmer rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="h-16 animate-shimmer rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-16 animate-shimmer rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-16 animate-shimmer rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  )
}
