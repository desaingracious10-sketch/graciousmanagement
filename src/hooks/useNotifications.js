import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const READ_KEY = 'gracious_notif_read'

function loadReadMap() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function saveReadMap(map) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function makeSig(entityIds) {
  if (!entityIds.length) return '0'
  return [...entityIds].sort().join('|')
}

function differenceInDays(targetIso, todayIso) {
  const t = new Date(`${targetIso?.slice(0, 10)}T00:00:00`).getTime()
  const n = new Date(`${todayIso}T00:00:00`).getTime()
  if (Number.isNaN(t) || Number.isNaN(n)) return Infinity
  return Math.round((t - n) / 86400000)
}

function isToday(value, todayIso) {
  return (value || '').slice(0, 10) === todayIso
}

export function useNotifications() {
  const {
    currentUser,
    orders,
    customers,
    deliveryRoutes,
    deliveryRouteItems,
    notifications: savedNotifications,
  } = useApp()

  const [tick, setTick] = useState(0)
  const [readMap, setReadMap] = useState(loadReadMap)

  // Poll every 30s so time-based notifications (expiring, today's routes) stay fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  const role = currentUser?.role
  const userId = currentUser?.id

  const computed = useMemo(() => {
    const now = new Date()
    const todayIso = now.toISOString().slice(0, 10)
    const items = []

    function add({ idKey, type, category, titleBuilder, message, link, linkLabel, entityIds }) {
      if (!entityIds || entityIds.length === 0) return
      const signature = makeSig(entityIds)
      const id = `${idKey}`
      const isRead = readMap[id] === signature
      items.push({
        id,
        type,
        category,
        title: titleBuilder(entityIds.length),
        message,
        count: entityIds.length,
        link,
        linkLabel,
        isRead,
        signature,
        createdAt: now.toISOString(),
        entityIds,
      })
    }

    if (role === 'superadmin') {
      const pending = orders.filter((o) => o.paymentStatus === 'pending')
      add({
        idKey: 'sa-pending-orders',
        type: 'urgent',
        category: 'order',
        titleBuilder: (n) => `${n} Pesanan Menunggu Verifikasi`,
        message: 'Transfer perlu dicek segera',
        link: '/orders?filter=pending',
        linkLabel: 'Lihat & Verifikasi',
        entityIds: pending.map((o) => o.id),
      })

      const expiring = orders.filter((o) => {
        if (!o.endDate || o.status === 'completed' || o.status === 'cancelled') return false
        if (o.status !== 'active') return false
        const d = differenceInDays(o.endDate, todayIso)
        return d >= 0 && d <= 3
      })
      add({
        idKey: 'sa-expiring',
        type: 'warning',
        category: 'customer',
        titleBuilder: (n) => `${n} Customer Paket Habis 3 Hari`,
        message: 'Perlu follow up perpanjangan',
        link: '/customers?filter=expiring',
        linkLabel: 'Lihat Customer',
        entityIds: expiring.map((o) => o.id),
      })

      const draftToday = deliveryRoutes.filter(
        (r) => isToday(r.deliveryDate, todayIso) && r.status === 'draft',
      )
      add({
        idKey: 'sa-draft-routes',
        type: 'warning',
        category: 'route',
        titleBuilder: (n) => `${n} Rute Hari Ini Masih Draft`,
        message: 'Finalize sebelum jam 8 pagi',
        link: '/routes',
        linkLabel: 'Ke Halaman Rute',
        entityIds: draftToday.map((r) => r.id),
      })

      const moved = deliveryRouteItems.filter((i) => i.statusLabel === 'pindah_alamat')
      add({
        idKey: 'sa-moved',
        type: 'urgent',
        category: 'customer',
        titleBuilder: (n) => `${n} Alamat Perlu Diupdate`,
        message: 'Customer pindah, alamat lama harus diganti',
        link: '/customers',
        linkLabel: 'Lihat Customer',
        entityIds: moved.map((i) => i.id),
      })
    }

    if (role === 'sales' && userId) {
      const rejected = orders.filter(
        (o) => o.createdBy === userId && o.paymentStatus === 'rejected',
      )
      add({
        idKey: 'sl-rejected',
        type: 'urgent',
        category: 'order',
        titleBuilder: (n) => `${n} Transfer Ditolak`,
        message: 'Cek alasan & follow up customer',
        link: '/orders?filter=rejected',
        linkLabel: 'Lihat Pesanan',
        entityIds: rejected.map((o) => o.id),
      })

      const dayAgo = now.getTime() - 24 * 60 * 60 * 1000
      const verified = orders.filter(
        (o) =>
          o.createdBy === userId &&
          o.paymentStatus === 'verified' &&
          o.verifiedAt &&
          new Date(o.verifiedAt).getTime() >= dayAgo,
      )
      add({
        idKey: 'sl-verified',
        type: 'success',
        category: 'order',
        titleBuilder: (n) => `${n} Transfer Terverifikasi! 🎉`,
        message: 'Pesanan kamu sudah aktif',
        link: '/orders',
        linkLabel: 'Lihat Pesanan',
        entityIds: verified.map((o) => o.id),
      })
    }

    if (role === 'address_admin') {
      const assignedCustomerIds = new Set(deliveryRouteItems.map((i) => i.customerId).filter(Boolean))
      const unassigned = customers.filter((c) => !assignedCustomerIds.has(c.id))
      add({
        idKey: 'aa-unassigned',
        type: 'urgent',
        category: 'customer',
        titleBuilder: (n) => `${n} Customer Baru Perlu Di-assign`,
        message: 'Belum masuk rute manapun',
        link: '/routes/builder',
        linkLabel: 'Buka Route Builder',
        entityIds: unassigned.map((c) => c.id),
      })

      const todayRoutes = deliveryRoutes.filter((r) => isToday(r.deliveryDate, todayIso))
      if (todayRoutes.length === 0) {
        add({
          idKey: 'aa-no-route-today',
          type: 'urgent',
          category: 'route',
          titleBuilder: () => 'Rute Hari Ini Belum Ada',
          message: 'Buat rute pengiriman sekarang',
          link: '/routes/builder',
          linkLabel: 'Buat Rute',
          entityIds: [todayIso],
        })
      }
    }

    if (role === 'driver' && userId) {
      const ready = deliveryRoutes.filter(
        (r) => r.driverId === userId && isToday(r.deliveryDate, todayIso) && r.status === 'finalized',
      )
      add({
        idKey: 'dr-ready',
        type: 'info',
        category: 'route',
        titleBuilder: () => 'Rute Kamu Sudah Siap!',
        message: 'Cek detail dan mulai pengiriman',
        link: '/dashboard/driver',
        linkLabel: 'Lihat Rute',
        entityIds: ready.map((r) => r.id),
      })
    }

    // Append explicit notifications stored in Supabase (e.g. "pesanan baru dari sales X")
    savedNotifications.forEach((n, idx) => {
      const id = `saved-${n.id || idx}`
      const tone = n.tone || n.type || 'info'
      const type =
        tone === 'error' || tone === 'urgent'
          ? 'urgent'
          : tone === 'warning'
            ? 'warning'
            : tone === 'success'
              ? 'success'
              : 'info'
      const signature = `${n.id || idx}-${n.isRead ? '1' : '0'}`
      items.push({
        id,
        type,
        category: n.scope || n.category || 'system',
        title: n.title || n.message || 'Notifikasi sistem',
        message: n.message || '',
        count: 1,
        link: n.href || (n.orderId ? `/orders/${n.orderId}` : '/'),
        linkLabel: 'Lihat',
        isRead: readMap[id] === signature || !!n.isRead,
        signature,
        createdAt: n.createdAt || now.toISOString(),
        entityIds: [n.id || `${idx}`],
      })
    })

    return items
  }, [
    role,
    userId,
    orders,
    customers,
    deliveryRoutes,
    deliveryRouteItems,
    savedNotifications,
    readMap,
    tick,
  ])

  const sorted = useMemo(() => {
    const order = { urgent: 0, warning: 1, info: 2, success: 3 }
    return [...computed].sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
      const oa = order[a.type] ?? 9
      const ob = order[b.type] ?? 9
      if (oa !== ob) return oa - ob
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }, [computed])

  const unreadCount = useMemo(
    () =>
      sorted.filter((n) => !n.isRead && (n.type === 'urgent' || n.type === 'warning')).length,
    [sorted],
  )

  const criticalCount = useMemo(() => sorted.filter((n) => n.type === 'urgent').length, [sorted])
  const totalCount = sorted.length

  const menuCounts = useMemo(() => {
    return {
      orders: sorted
        .filter((n) => n.category === 'order' && !n.isRead)
        .reduce((s, n) => s + n.count, 0),
      customers: sorted
        .filter((n) => n.category === 'customer' && !n.isRead)
        .reduce((s, n) => s + n.count, 0),
      routes: sorted
        .filter((n) => n.category === 'route' && !n.isRead)
        .reduce((s, n) => s + n.count, 0),
    }
  }, [sorted])

  const markAllRead = useCallback(() => {
    setReadMap((prev) => {
      const next = { ...prev }
      computed.forEach((n) => {
        next[n.id] = n.signature
      })
      saveReadMap(next)
      return next
    })
  }, [computed])

  const markRead = useCallback(
    (id) => {
      setReadMap((prev) => {
        const item = computed.find((n) => n.id === id)
        if (!item) return prev
        const next = { ...prev, [id]: item.signature }
        saveReadMap(next)
        return next
      })
    },
    [computed],
  )

  return {
    notifications: sorted,
    unreadCount,
    criticalCount,
    totalCount,
    menuCounts,
    counts: {
      pendingOrders: orders.filter((o) => o.paymentStatus === 'pending').length,
      expiringOrders: sorted.find((n) => n.id === 'sa-expiring')?.count || 0,
      draftRoutes: sorted.find((n) => n.id === 'sa-draft-routes')?.count || 0,
      movedCustomers: sorted.find((n) => n.id === 'sa-moved')?.count || 0,
    },
    markAllRead,
    markRead,
  }
}
