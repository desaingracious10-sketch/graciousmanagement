import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import db from '../data/db.json'
import ToastViewport from '../components/ui/Toast.jsx'
import { ConfirmDialog } from '../components/ui.jsx'

export const STORAGE_KEYS = {
  customers: 'gracious_customers_extra',
  orders: 'gracious_orders_extra',
  notifications: 'gracious_admin_notifications',
  routes: 'gracious_routes_extra',
  routeItems: 'gracious_route_items_extra',
  users: 'gracious_users_extra',
  zones: 'gracious_zones_extra',
  addressChangeLogs: 'gracious_address_change_log',
  activityLogs: 'gracious_activity_logs_extra',
  currentUser: 'gracious_user',
  theme: 'gracious_theme',
}

const SAVE_DELAY_MS = 300
let suppressStorageEvents = 0

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState)
  const [toasts, setToasts] = useState([])
  const [booting, setBooting] = useState(true)
  const [theme, setTheme] = useState(() => readStoredTheme())
  const [confirmState, setConfirmState] = useState(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false })
      setBooting(false)
    }, 1500)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    persistStateSlices(state)
  }, [
    state.users,
    state.zones,
    state.customers,
    state.orders,
    state.deliveryRoutes,
    state.deliveryRouteItems,
    state.addressChangeLogs,
    state.activityLogs,
    state.notifications,
    state.currentUser,
  ])

  useEffect(() => {
    const restorePatchedStorage = patchStorageEvents()

    function handleExternalSync() {
      dispatch({ type: 'SYNC_FROM_STORAGE', payload: loadInitialState() })
    }

    window.addEventListener('storage', handleExternalSync)
    window.addEventListener('gracious-storage-updated', handleExternalSync)

    return () => {
      restorePatchedStorage()
      window.removeEventListener('storage', handleExternalSync)
      window.removeEventListener('gracious-storage-updated', handleExternalSync)
    }
  }, [])

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

    async function runSimulatedSave(work, options = {}) {
      dispatch({ type: 'SET_LOADING', payload: true })
      await delay(SAVE_DELAY_MS)
      const result = typeof work === 'function' ? work() : null
      dispatch({ type: 'SET_LOADING', payload: false })

      if (options.toast) {
        showToast(
          typeof options.toast === 'string'
            ? { tone: 'success', message: options.toast }
            : options.toast,
        )
      }

      return result
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

    return {
      ...state,
      rawDb: db,
      booting,
      theme,
      dispatch,
      toasts,
      showToast,
      removeToast,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      confirmAction,
      login: async (username, password) => {
        const normalized = String(username).trim().toLowerCase()
        const found = state.users.find(
          (user) =>
            (user.username || '').toLowerCase() === normalized &&
            user.password === password &&
            user.isActive !== false,
        )

        await delay(SAVE_DELAY_MS)

        if (!found) {
          showToast({ tone: 'error', message: 'Username atau password salah.' })
          return { ok: false, error: 'Username atau password salah. Silakan coba lagi.' }
        }

        const session = {
          id: found.id,
          name: found.name,
          role: found.role,
          username: found.username,
        }

        try {
          localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(session))
        } catch {
          // ignore storage failures; state still updates
        }

        dispatch({ type: 'LOGIN', payload: session })
        showToast({ tone: 'success', message: `Selamat datang, ${found.name}.` })
        return { ok: true, user: session }
      },
      logout: () => {
        try {
          localStorage.removeItem(STORAGE_KEYS.currentUser)
        } catch {
          // ignore
        }
        dispatch({ type: 'LOGOUT' })
        showToast({ tone: 'info', message: 'Sesi login sudah diakhiri.' })
      },
      addOrder: (order, toast = 'Pesanan berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_ORDER', payload: order }), { toast }),
      updateOrder: (order, toast = 'Pesanan berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_ORDER', payload: order }), { toast }),
      deleteOrder: (orderId, toast = 'Pesanan berhasil dihapus.') =>
        runSimulatedSave(() => dispatch({ type: 'DELETE_ORDER', payload: orderId }), { toast }),
      verifyOrder: (payload, toast = 'Pesanan berhasil diverifikasi.') =>
        runSimulatedSave(() => dispatch({ type: 'VERIFY_ORDER', payload }), { toast }),
      addCustomer: (customer, toast = 'Customer berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_CUSTOMER', payload: customer }), { toast }),
      updateCustomer: (customer, toast = 'Data customer berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_CUSTOMER', payload: customer }), { toast }),
      updateAddress: (payload, toast = 'Alamat customer berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_ADDRESS', payload }), { toast }),
      addRoute: (route, toast = 'Rute berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_ROUTE', payload: route }), { toast }),
      updateRoute: (route, toast = 'Rute berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_ROUTE', payload: route }), { toast }),
      finalizeRoute: (payload, toast = 'Rute berhasil difinalize.') =>
        runSimulatedSave(() => dispatch({ type: 'FINALIZE_ROUTE', payload }), { toast }),
      addRouteItem: (item, toast = 'Item rute berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_ROUTE_ITEM', payload: item }), { toast }),
      updateRouteItem: (item, toast = 'Item rute berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_ROUTE_ITEM', payload: item }), { toast }),
      addUser: (user, toast = 'User berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_USER', payload: user }), { toast }),
      updateUser: (user, toast = 'User berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_USER', payload: user }), { toast }),
      deleteUser: (userId, toast = 'User berhasil dihapus.') =>
        runSimulatedSave(() => dispatch({ type: 'DELETE_USER', payload: userId }), { toast }),
      addZone: (zone, toast = 'Zona berhasil ditambahkan.') =>
        runSimulatedSave(() => dispatch({ type: 'ADD_ZONE', payload: zone }), { toast }),
      updateZone: (zone, toast = 'Zona berhasil diperbarui.') =>
        runSimulatedSave(() => dispatch({ type: 'UPDATE_ZONE', payload: zone }), { toast }),
      addActivityLog: (log) => dispatch({ type: 'ADD_ACTIVITY_LOG', payload: log }),
      addSystemNotification: (notification) =>
        dispatch({ type: 'ADD_SYSTEM_NOTIFICATION', payload: notification }),
    }
  }, [state, toasts])

  return (
    <AppContext.Provider value={api}>
      {children}
      {booting ? <LoadingOverlay /> : null}
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
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SYNC_FROM_STORAGE':
      return action.payload
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'LOGIN':
      return { ...state, currentUser: action.payload }
    case 'LOGOUT':
      return { ...state, currentUser: null }
    case 'ADD_ORDER':
      return { ...state, orders: [...state.orders, action.payload] }
    case 'UPDATE_ORDER':
      return { ...state, orders: upsertRecord(state.orders, action.payload) }
    case 'DELETE_ORDER':
      return { ...state, orders: removeRecord(state.orders, action.payload) }
    case 'VERIFY_ORDER': {
      const current = state.orders.find((order) => order.id === action.payload.id)
      if (!current) return state
      return { ...state, orders: upsertRecord(state.orders, { ...current, ...action.payload }) }
    }
    case 'ADD_CUSTOMER':
      return { ...state, customers: [...state.customers, action.payload] }
    case 'UPDATE_CUSTOMER':
      return { ...state, customers: upsertRecord(state.customers, action.payload) }
    case 'UPDATE_ADDRESS': {
      const { customer, log } = action.payload
      return {
        ...state,
        customers: upsertRecord(state.customers, customer),
        addressChangeLogs: log ? [...state.addressChangeLogs, log] : state.addressChangeLogs,
      }
    }
    case 'ADD_ROUTE':
      return { ...state, deliveryRoutes: [...state.deliveryRoutes, action.payload] }
    case 'UPDATE_ROUTE':
      return { ...state, deliveryRoutes: upsertRecord(state.deliveryRoutes, action.payload) }
    case 'FINALIZE_ROUTE': {
      const current = state.deliveryRoutes.find((route) => route.id === action.payload.id)
      if (!current) return state
      return {
        ...state,
        deliveryRoutes: upsertRecord(state.deliveryRoutes, { ...current, ...action.payload }),
      }
    }
    case 'ADD_ROUTE_ITEM':
      return { ...state, deliveryRouteItems: [...state.deliveryRouteItems, action.payload] }
    case 'UPDATE_ROUTE_ITEM':
      return { ...state, deliveryRouteItems: upsertRecord(state.deliveryRouteItems, action.payload) }
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] }
    case 'UPDATE_USER':
      return { ...state, users: upsertRecord(state.users, action.payload) }
    case 'DELETE_USER':
      return { ...state, users: removeRecord(state.users, action.payload) }
    case 'ADD_ZONE':
      return { ...state, zones: [...state.zones, action.payload] }
    case 'UPDATE_ZONE':
      return { ...state, zones: upsertRecord(state.zones, action.payload) }
    case 'ADD_ACTIVITY_LOG':
      return { ...state, activityLogs: [action.payload, ...state.activityLogs] }
    case 'ADD_SYSTEM_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications].slice(0, 20) }
    default:
      return state
  }
}

function loadInitialState() {
  if (typeof window === 'undefined') {
    return createStateSnapshot()
  }

  return createStateSnapshot({
    users: mergeRecords(db.users || [], readStorageArray(STORAGE_KEYS.users)),
    zones: mergeRecords(db.zones || [], readStorageArray(STORAGE_KEYS.zones)),
    programs: db.programs || [],
    customers: mergeRecords(db.customers || [], readStorageArray(STORAGE_KEYS.customers)),
    orders: mergeRecords(db.orders || [], readStorageArray(STORAGE_KEYS.orders)),
    deliveryRoutes: mergeRecords(db.deliveryRoutes || [], readStorageArray(STORAGE_KEYS.routes)),
    deliveryRouteItems: mergeRecords(db.deliveryRouteItems || [], readStorageArray(STORAGE_KEYS.routeItems)),
    addressChangeLogs: readStorageArray(STORAGE_KEYS.addressChangeLogs),
    activityLogs: mergeRecords(db.activity_logs || db.activityLogs || [], readStorageArray(STORAGE_KEYS.activityLogs)),
    notifications: readStorageArray(STORAGE_KEYS.notifications),
    currentUser: readStoredUser(),
    isLoading: true,
  })
}

function createStateSnapshot(overrides = {}) {
  return {
    users: [],
    zones: [],
    programs: [],
    customers: [],
    orders: [],
    deliveryRoutes: [],
    deliveryRouteItems: [],
    addressChangeLogs: [],
    activityLogs: [],
    notifications: [],
    currentUser: null,
    isLoading: false,
    ...overrides,
  }
}

function persistStateSlices(state) {
  if (typeof window === 'undefined') return

  suppressStorageEvents += 1
  try {
    writeStorageArray(STORAGE_KEYS.users, buildPersistedExtras(db.users || [], state.users))
    writeStorageArray(STORAGE_KEYS.zones, buildPersistedExtras(db.zones || [], state.zones))
    writeStorageArray(STORAGE_KEYS.customers, buildPersistedExtras(db.customers || [], state.customers))
    writeStorageArray(STORAGE_KEYS.orders, buildPersistedExtras(db.orders || [], state.orders))
    writeStorageArray(STORAGE_KEYS.routes, buildPersistedExtras(db.deliveryRoutes || [], state.deliveryRoutes))
    writeStorageArray(
      STORAGE_KEYS.routeItems,
      buildPersistedExtras(db.deliveryRouteItems || [], state.deliveryRouteItems),
    )
    writeStorageArray(STORAGE_KEYS.addressChangeLogs, state.addressChangeLogs)
    writeStorageArray(
      STORAGE_KEYS.activityLogs,
      buildPersistedExtras(db.activity_logs || db.activityLogs || [], state.activityLogs),
    )
    writeStorageArray(STORAGE_KEYS.notifications, state.notifications)

    if (state.currentUser) {
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(state.currentUser))
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentUser)
    }
  } finally {
    suppressStorageEvents = Math.max(0, suppressStorageEvents - 1)
  }
}

function patchStorageEvents() {
  const storageProto = Object.getPrototypeOf(window.localStorage)
  const originalSetItem = storageProto.setItem
  const originalRemoveItem = storageProto.removeItem

  storageProto.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value)
    if (suppressStorageEvents > 0) return
    window.dispatchEvent(new CustomEvent('gracious-storage-updated', { detail: { key } }))
  }

  storageProto.removeItem = function patchedRemoveItem(key) {
    originalRemoveItem.call(this, key)
    if (suppressStorageEvents > 0) return
    window.dispatchEvent(new CustomEvent('gracious-storage-updated', { detail: { key } }))
  }

  return () => {
    storageProto.setItem = originalSetItem
    storageProto.removeItem = originalRemoveItem
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.currentUser)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEYS.theme) || 'light'
  } catch {
    return 'light'
  }
}

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStorageArray(key, value) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []))
}

function mergeRecords(base, extras) {
  const map = new Map()

  for (const item of base) {
    if (item?.id) map.set(item.id, item)
  }

  for (const item of extras) {
    if (!item?.id) continue
    if (item._deleted) {
      map.delete(item.id)
      continue
    }
    map.set(item.id, { ...(map.get(item.id) || {}), ...item })
  }

  return Array.from(map.values())
}

function upsertRecord(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id)
  if (index === -1) return [...items, nextItem]
  const next = [...items]
  next[index] = nextItem
  return next
}

function removeRecord(items, id) {
  return items.filter((item) => item.id !== id)
}

function buildPersistedExtras(base, current) {
  const baseMap = new Map(base.filter((item) => item?.id).map((item) => [item.id, item]))
  const currentMap = new Map(current.filter((item) => item?.id).map((item) => [item.id, item]))
  const extras = []

  for (const item of current) {
    if (!item?.id) continue
    const original = baseMap.get(item.id)
    if (!original) {
      extras.push(item)
      continue
    }
    if (!isShallowEqualRecord(original, item)) {
      extras.push(item)
    }
  }

  for (const item of base) {
    if (!item?.id) continue
    if (!currentMap.has(item.id)) {
      extras.push({ id: item.id, _deleted: true })
    }
  }

  return extras
}

function isShallowEqualRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[95] grid place-items-center bg-white/88 backdrop-blur-sm dark:bg-slate-950/88">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br from-teal via-teal-dark to-gracious-navy text-3xl text-white shadow-[0_20px_45px_rgba(13,148,136,0.25)]">
          🍱
        </div>
        <div className="mt-5 text-2xl font-semibold tracking-tight text-gracious-navy dark:text-slate-100">Gracious Delivery</div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Menyiapkan dashboard operasional Anda...</div>
        <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-teal/20 border-t-teal" />
      </div>
    </div>
  )
}
