import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import ToastViewport from '../components/ui/Toast.jsx'
import { ConfirmDialog } from '../components/ui.jsx'
import { SUPABASE_CONFIGURED } from '../lib/supabase.js'
import * as db from '../lib/db.js'

// Only session/UI state lives in localStorage now. All app data goes through Supabase.
export const STORAGE_KEYS = {
  currentUser: 'gracious_user',
  theme: 'gracious_theme',
}

const AppContext = createContext(null)

const initialState = {
  users: [],
  drivers: [],
  zones: [],
  programs: [],
  customers: [],
  orders: [],
  deliveryRoutes: [],
  deliveryRouteItems: [],
  addressChangeLogs: [],
  activityLogs: [],
  notifications: [],
  weeklyMenus: [],
  upcomingBirthdays: [],
  currentUser: null,
  isLoading: true,
  isConnected: false,
  loadError: null,
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload }
    case 'SET_LOAD_ERROR':
      return { ...state, loadError: action.payload }
    case 'HYDRATE':
      return { ...state, ...action.payload, isLoading: false, isConnected: true, loadError: null }
    case 'LOGIN':
      return { ...state, currentUser: action.payload }
    case 'LOGOUT':
      return { ...state, currentUser: null }
    case 'UPSERT': {
      const { key, item } = action.payload
      const list = state[key] || []
      const idx = list.findIndex((entry) => entry.id === item.id)
      const next = idx === -1 ? [item, ...list] : list.map((entry) => (entry.id === item.id ? { ...entry, ...item } : entry))
      return { ...state, [key]: next }
    }
    case 'REMOVE': {
      const { key, id } = action.payload
      return { ...state, [key]: (state[key] || []).filter((entry) => entry.id !== id) }
    }
    case 'PREPEND': {
      const { key, item } = action.payload
      return { ...state, [key]: [item, ...(state[key] || [])] }
    }
    case 'PATCH_ITEM': {
      const { key, id, patch } = action.payload
      return {
        ...state,
        [key]: (state[key] || []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      }
    }
    case 'SET_LIST':
      return { ...state, [action.payload.key]: action.payload.list }
    default:
      return state
  }
}

function readStoredUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.currentUser)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Schema Gracious memakai users.id bertipe TEXT (mis. "u1"). Tidak boleh
    // memaksa bentuk UUID di sini — kalau dipaksa, semua user yang valid di DB
    // akan ter-logout otomatis. Cukup pastikan id ada.
    if (!parsed?.id) {
      localStorage.removeItem(STORAGE_KEYS.currentUser)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    return localStorage.getItem(STORAGE_KEYS.theme) || 'light'
  } catch {
    return 'light'
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => ({
    ...initialState,
    currentUser: readStoredUser(),
  }))
  const [toasts, setToasts] = useState([])
  const [theme, setTheme] = useState(() => readStoredTheme())
  const [confirmState, setConfirmState] = useState(null)
  const refreshTimeoutRef = useRef(null)

  // ===== THEME PERSIST =====
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme)
    } catch {
      // ignore
    }
  }, [theme])

  // ===== INITIAL DATA LOAD FROM SUPABASE =====
  const loadAllData = useCallback(async () => {
    if (!SUPABASE_CONFIGURED) {
      dispatch({
        type: 'SET_LOAD_ERROR',
        payload:
          'Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env (atau di Vercel env settings) lalu reload.',
      })
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const [
        users,
        drivers,
        zones,
        programs,
        customers,
        orders,
        deliveryRoutes,
        deliveryRouteItems,
        addressChangeLogs,
        activityLogs,
        weeklyMenus,
        upcomingBirthdays,
      ] = await Promise.all([
        db.getUsers(),
        db.getDrivers().catch(() => []),
        db.getZones(),
        db.getPrograms(),
        db.getCustomers(),
        db.getOrders(),
        db.getDeliveryRoutes(),
        db.getDeliveryRouteItems(),
        db.getAddressChangeLogs().catch(() => []),
        db.getActivityLogs(50).catch(() => []),
        db.getWeeklyMenus().catch(() => []),
        db.getUpcomingBirthdays().catch(() => []),
      ])

      dispatch({
        type: 'HYDRATE',
        payload: {
          users,
          drivers,
          zones,
          programs,
          customers,
          orders,
          deliveryRoutes,
          deliveryRouteItems,
          addressChangeLogs,
          activityLogs,
          weeklyMenus,
          upcomingBirthdays,
        },
      })
    } catch (error) {
      console.error('[Gracious] loadAllData failed:', error)
      dispatch({
        type: 'SET_LOAD_ERROR',
        payload: error?.message || 'Gagal memuat data dari server. Cek koneksi internet & konfigurasi Supabase.',
      })
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // ===== NOTIFICATIONS LOAD WHEN USER CHANGES =====
  useEffect(() => {
    if (!state.currentUser || !SUPABASE_CONFIGURED) return
    let cancelled = false
    db.getNotifications(state.currentUser.id, state.currentUser.role)
      .then((notifs) => {
        if (!cancelled) {
          dispatch({ type: 'SET_LIST', payload: { key: 'notifications', list: notifs } })
        }
      })
      .catch((error) => console.error('[Gracious] notif load failed:', error))
    return () => {
      cancelled = true
    }
  }, [state.currentUser])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return undefined

    function queueRefresh() {
      window.clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = window.setTimeout(() => {
        loadAllData()
      }, 180)
    }

    const subscriptions = [
      db.subscribeToTable('orders', queueRefresh),
      db.subscribeToTable('delivery_routes', queueRefresh),
      db.subscribeToTable('delivery_route_items', queueRefresh),
      db.subscribeToTable('customers', queueRefresh),
      db.subscribeToTable('users', queueRefresh),
      db.subscribeToTable('zones', queueRefresh),
      db.subscribeToTable('weekly_menus', queueRefresh),
      db.subscribeToTable('drivers', queueRefresh),
      db.subscribeToTable('activity_logs', queueRefresh),
      db.subscribeToTable('notifications', () => {
        queueRefresh()
        if (!state.currentUser) return
        db.getNotifications(state.currentUser.id, state.currentUser.role)
          .then((notifs) => {
            dispatch({ type: 'SET_LIST', payload: { key: 'notifications', list: notifs } })
          })
          .catch((error) => console.error('[Gracious] notif refresh failed:', error))
      }),
    ].filter(Boolean)

    return () => {
      window.clearTimeout(refreshTimeoutRef.current)
      subscriptions.forEach((channel) => db.unsubscribe(channel))
    }
  }, [loadAllData, state.currentUser])

  // ===== TOAST + CONFIRM HELPERS =====
  const api = useMemo(() => {
    function showToast(input) {
      const toast = {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        duration: 3000,
        ...input,
      }
      setToasts((current) => [...current, toast])
      return toast.id
    }

    function removeToast(id) {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }

    function confirmAction(options) {
      return new Promise((resolve) => {
        setConfirmState({
          ...options,
          onConfirm: () => {
            setConfirmState(null)
            resolve(true)
          },
          onCancel: () => {
            setConfirmState(null)
            resolve(false)
          },
        })
      })
    }

    async function withToast(work, { successToast, errorToast } = {}) {
      try {
        const result = await work()
        if (successToast) {
          showToast(typeof successToast === 'string' ? { tone: 'success', message: successToast } : successToast)
        }
        return result
      } catch (error) {
        console.error('[Gracious] action failed:', error)
        showToast({
          tone: 'error',
          message: errorToast || error?.message || 'Operasi gagal. Coba lagi.',
        })
        throw error
      }
    }

    // ===== AUTH =====
    async function login(username, password) {
      if (!SUPABASE_CONFIGURED) {
        const err = 'Supabase belum dikonfigurasi.'
        showToast({ tone: 'error', message: err })
        return { ok: false, error: err }
      }
      const result = await db.loginUser(username, password)
      if (!result.ok) {
        showToast({ tone: 'error', message: result.error })
        return result
      }
      try {
        localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(result.user))
      } catch {
        // ignore
      }
      dispatch({ type: 'LOGIN', payload: result.user })
      showToast({ tone: 'success', message: `Selamat datang, ${result.user.name}.` })
      return { ok: true, user: result.user }
    }

    function logout() {
      try {
        localStorage.removeItem(STORAGE_KEYS.currentUser)
      } catch {
        // ignore
      }
      dispatch({ type: 'LOGOUT' })
      showToast({ tone: 'info', message: 'Sesi login sudah diakhiri.' })
    }

    // ===== ORDER ACTIONS (backward-compat names: addOrder, updateOrder, deleteOrder, verifyOrder) =====
    const addOrder = (order, toast = 'Pesanan berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createOrder(order)
          dispatch({ type: 'PREPEND', payload: { key: 'orders', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateOrder = (order, toast = 'Pesanan berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = order
          const updated = await db.updateOrder(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'orders', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const deleteOrder = (orderId, toast = 'Pesanan berhasil dihapus.') =>
      withToast(
        async () => {
          await db.deleteOrder(orderId)
          dispatch({ type: 'REMOVE', payload: { key: 'orders', id: orderId } })
        },
        { successToast: toast },
      )

    const verifyOrder = (payload, toast = 'Pesanan berhasil diverifikasi.') =>
      withToast(
        async () => {
          // Support both legacy shape ({ id, paymentStatus, ... }) and new ({ id })
          const id = typeof payload === 'string' ? payload : payload.id
          const updated = await db.verifyOrder(
            id,
            state.currentUser?.id,
            state.currentUser?.name,
          )
          dispatch({ type: 'UPSERT', payload: { key: 'orders', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const rejectOrder = (payload, toast = 'Pesanan ditolak.') =>
      withToast(
        async () => {
          const { id, reason } = typeof payload === 'string' ? { id: payload, reason: '' } : payload
          const updated = await db.rejectOrder(id, state.currentUser?.id, reason || '')
          dispatch({ type: 'UPSERT', payload: { key: 'orders', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    // ===== CUSTOMERS =====
    const addCustomer = (customer, toast = 'Customer berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createCustomer(customer)
          dispatch({ type: 'PREPEND', payload: { key: 'customers', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateCustomer = (customer, toast = 'Data customer berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = customer
          const updated = await db.updateCustomer(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'customers', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const regeneratePortalToken = (customerId, toast = 'Link portal customer diperbarui.') =>
      withToast(
        async () => {
          const updated = await db.regenerateCustomerPortalToken(customerId)
          dispatch({ type: 'UPSERT', payload: { key: 'customers', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const updateAddress = (payload, toast = 'Alamat customer berhasil diperbarui.') =>
      withToast(
        async () => {
          // payload shape from existing pages: { customer, log }
          const { customer, log } = payload
          const newAddress = customer.addressPrimary
          const reason = log?.reason || log?.changeReason || ''
          const changedBy = log?.changedBy || state.currentUser?.id
          const updated = await db.updateCustomerAddress(customer.id, newAddress, reason, changedBy)
          dispatch({ type: 'UPSERT', payload: { key: 'customers', item: updated } })
          if (log) {
            dispatch({
              type: 'PREPEND',
              payload: {
                key: 'addressChangeLogs',
                item: {
                  ...log,
                  id: log.id || `addr-log-${Date.now()}`,
                  customerId: customer.id,
                  newAddress,
                },
              },
            })
          }
          return updated
        },
        { successToast: toast },
      )

    // ===== ROUTES =====
    const addRoute = (route, toast = 'Rute berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createDeliveryRoute(route)
          dispatch({ type: 'PREPEND', payload: { key: 'deliveryRoutes', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateRoute = (route, toast = 'Rute berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = route
          const updated = await db.updateDeliveryRoute(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'deliveryRoutes', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const deleteRoute = (routeId, toast = 'Rute berhasil dihapus.') =>
      withToast(
        async () => {
          await db.deleteDeliveryRoute(routeId, state.currentUser?.id)
          // Bersihkan item-item rute dari state — db sudah delete cascade-nya manual
          dispatch({ type: 'REMOVE', payload: { key: 'deliveryRoutes', id: routeId } })
          // Filter out items yang refer ke rute ini
          const itemsToKeep = state.deliveryRouteItems.filter((item) => item.routeId !== routeId)
          dispatch({ type: 'SET_LIST', payload: { key: 'deliveryRouteItems', list: itemsToKeep } })
        },
        { successToast: toast },
      )

    const finalizeRoute = (payload, toast = 'Rute berhasil difinalize.') =>
      withToast(
        async () => {
          // payload = { id, ...extraUpdates }
          const { id, status: _ignoredStatus, ...rest } = payload
          const updated = await db.finalizeRoute(id, state.currentUser?.id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'deliveryRoutes', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const addRouteItem = (item, toast = 'Item rute berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createRouteItem(item)
          dispatch({ type: 'PREPEND', payload: { key: 'deliveryRouteItems', item: created } })
          // Refresh route point count
          if (created.routeId) {
            const refreshedRoutes = await db.getDeliveryRoutes()
            dispatch({ type: 'SET_LIST', payload: { key: 'deliveryRoutes', list: refreshedRoutes } })
          }
          return created
        },
        { successToast: toast },
      )

    const updateRouteItem = (item, toast = 'Item rute berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = item
          const updated = await db.updateRouteItem(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'deliveryRouteItems', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    // ===== USERS =====
    const addUser = (user, toast = 'User berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createUser(user)
          dispatch({ type: 'PREPEND', payload: { key: 'users', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateUser = (user, toast = 'User berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = user
          const updated = await db.updateUser(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'users', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const deleteUser = (userId, toast = 'User berhasil dinonaktifkan.') =>
      withToast(
        async () => {
          await db.deactivateUser(userId)
          dispatch({ type: 'PATCH_ITEM', payload: { key: 'users', id: userId, patch: { isActive: false } } })
        },
        { successToast: toast },
      )

    const hardDeleteUser = (userId, toast = 'User berhasil dihapus permanen.') =>
      withToast(
        async () => {
          await db.hardDeleteUser(userId, state.currentUser?.id)
          dispatch({ type: 'REMOVE', payload: { key: 'users', id: userId } })
        },
        { successToast: toast },
      )

    const softDeleteCustomer = (customerId, toast = 'Customer berhasil dihapus.') =>
      withToast(
        async () => {
          await db.softDeleteCustomer(customerId, state.currentUser?.id)
          dispatch({ type: 'REMOVE', payload: { key: 'customers', id: customerId } })
        },
        { successToast: toast },
      )

    // ===== DRIVERS =====
    const addDriver = (driver, toast = 'Driver berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createDriver(driver, state.currentUser?.id)
          dispatch({ type: 'PREPEND', payload: { key: 'drivers', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateDriver = (driver, toast = 'Driver berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = driver
          const updated = await db.updateDriver(id, rest, state.currentUser?.id)
          dispatch({ type: 'UPSERT', payload: { key: 'drivers', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    const deleteDriver = (driverId, toast = 'Driver berhasil dinonaktifkan.') =>
      withToast(
        async () => {
          await db.deleteDriver(driverId, state.currentUser?.id)
          dispatch({ type: 'PATCH_ITEM', payload: { key: 'drivers', id: driverId, patch: { isActive: false } } })
        },
        { successToast: toast },
      )

    // ===== ZONES =====
    const addZone = (zone, toast = 'Zona berhasil ditambahkan.') =>
      withToast(
        async () => {
          const created = await db.createZone(zone)
          dispatch({ type: 'PREPEND', payload: { key: 'zones', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateZone = (zone, toast = 'Zona berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = zone
          const updated = await db.updateZone(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'zones', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    // ===== ACTIVITY LOG / NOTIF =====
    const addActivityLog = async (log) => {
      try {
        await db.addActivityLog(log.userId, log.action, log.entityType, log.entityId, log.details)
        dispatch({ type: 'PREPEND', payload: { key: 'activityLogs', item: { ...log, id: `log-${Date.now()}` } } })
      } catch (error) {
        console.error('[Gracious] activity log failed:', error)
      }
    }

    const addSystemNotification = async (notification) => {
      try {
        const created = await db.createNotification(notification)
        dispatch({ type: 'PREPEND', payload: { key: 'notifications', item: created } })
        return created
      } catch (error) {
        console.error('[Gracious] notif insert failed:', error)
      }
    }

    const addWeeklyMenu = (menu, toast = 'Menu mingguan berhasil disimpan.') =>
      withToast(
        async () => {
          const created = await db.createWeeklyMenu(menu)
          dispatch({ type: 'PREPEND', payload: { key: 'weeklyMenus', item: created } })
          return created
        },
        { successToast: toast },
      )

    const updateWeeklyMenu = (menu, toast = 'Menu mingguan berhasil diperbarui.') =>
      withToast(
        async () => {
          const { id, ...rest } = menu
          const updated = await db.updateWeeklyMenu(id, rest)
          dispatch({ type: 'UPSERT', payload: { key: 'weeklyMenus', item: updated } })
          return updated
        },
        { successToast: toast },
      )

    return {
      // ===== STATE =====
      ...state,
      booting: state.isLoading,
      // Backward-compat: rawDb is no longer used (data comes from Supabase). Keep as empty stub.
      rawDb: {
        users: state.users,
        zones: state.zones,
        programs: state.programs,
        customers: state.customers,
        orders: state.orders,
        deliveryRoutes: state.deliveryRoutes,
        deliveryRouteItems: state.deliveryRouteItems,
      },
      theme,
      // ===== UI HELPERS =====
      dispatch,
      toasts,
      showToast,
      removeToast,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      confirmAction,
      // ===== ACTIONS =====
      login,
      logout,
      addOrder,
      updateOrder,
      deleteOrder,
      verifyOrder,
      rejectOrder,
      addCustomer,
      updateCustomer,
      softDeleteCustomer,
      updateAddress,
      regeneratePortalToken,
      addRoute,
      updateRoute,
      finalizeRoute,
      deleteRoute,
      addRouteItem,
      updateRouteItem,
      addUser,
      updateUser,
      deleteUser,
      hardDeleteUser,
      addDriver,
      updateDriver,
      deleteDriver,
      addZone,
      updateZone,
      addActivityLog,
      addSystemNotification,
      addWeeklyMenu,
      updateWeeklyMenu,
      refreshData: loadAllData,
    }
  }, [state, toasts, theme, loadAllData])

  return (
    <AppContext.Provider value={api}>
      {children}
      {state.isLoading ? <LoadingOverlay /> : null}
      {state.loadError ? <ErrorScreen message={state.loadError} onRetry={loadAllData} /> : null}
      <ToastViewport toasts={toasts} onDismiss={api.removeToast} />
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        danger={confirmState?.danger}
        onConfirm={confirmState?.onConfirm}
        onCancel={confirmState?.onCancel}
      />
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[95] grid place-items-center bg-white/88 backdrop-blur-sm dark:bg-slate-950/88">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br from-teal via-teal-dark to-gracious-navy text-3xl text-white shadow-[0_20px_45px_rgba(13,148,136,0.25)]">
          🍱
        </div>
        <div className="mt-5 text-2xl font-semibold tracking-tight text-gracious-navy dark:text-slate-100">
          Gracious Delivery
        </div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Memuat data dari server...
        </div>
        <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-teal/20 border-t-teal" />
      </div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-white/95 px-6 backdrop-blur dark:bg-slate-950/95">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-rose-100 text-rose-600 dark:bg-rose-900/40">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.5a15 15 0 0 1 20 0" />
            <path d="M5 12.5a10 10 0 0 1 14 0" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gracious-navy dark:text-slate-100">
          Gagal terhubung ke server
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 font-medium text-white shadow-[0_16px_28px_rgba(13,148,136,0.22)] transition hover:-translate-y-0.5 hover:bg-teal-dark"
        >
          🔄 Coba Lagi
        </button>
      </div>
    </div>
  )
}
