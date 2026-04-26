import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'

export function useNotifications() {
  const { orders, customers, deliveryRoutes, deliveryRouteItems, notifications: savedNotifications } = useApp()

  return useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)

    const pendingOrders = orders.filter((order) => order.paymentStatus === 'pending')
    const expiringOrders = orders.filter((order) => {
      if (!order.endDate || order.status === 'completed' || order.status === 'cancelled') return false
      const diffDays = differenceInDays(order.endDate, todayIso)
      return diffDays >= 0 && diffDays <= 3
    })
    const draftRoutes = deliveryRoutes.filter(
      (route) => route.deliveryDate === todayIso && route.status === 'draft',
    )
    const movedCustomers = deliveryRouteItems.filter((item) => item.statusLabel === 'pindah_alamat')

    const notifications = [
      ...aggregateNotification(
        'pending-orders',
        pendingOrders.length,
        'warning',
        (count) => `${count} pesanan menunggu verifikasi`,
        '/orders?filter=pending',
        'orders',
        true,
      ),
      ...aggregateNotification(
        'expiring-packages',
        expiringOrders.length,
        'info',
        (count) => `${count} customer mau habis paket`,
        '/customers?filter=expiring',
        'customers',
        false,
      ),
      ...aggregateNotification(
        'draft-routes',
        draftRoutes.length,
        'warning',
        (count) => `${count} rute belum difinalize`,
        '/routes?filter=draft',
        'routes',
        true,
      ),
      ...aggregateNotification(
        'moved-addresses',
        movedCustomers.length,
        'error',
        (count) => `${count} customer pindah alamat`,
        '/customers?filter=moved',
        'customers',
        true,
      ),
      ...savedNotifications.map((item) => ({
        ...item,
        scope: item.scope || 'orders',
        tone: item.tone || 'info',
        href: item.href || (item.orderId ? `/orders/${item.orderId}` : '/orders'),
        isCritical: !!item.isCritical,
      })),
    ]

    const totalCount = notifications.length
    const criticalCount = notifications.filter((item) => item.isCritical).length
    const menuCounts = {
      orders: notifications.filter((item) => item.scope === 'orders').length,
      customers: notifications.filter((item) => item.scope === 'customers').length,
      routes: notifications.filter((item) => item.scope === 'routes').length,
    }

    return {
      notifications,
      totalCount,
      criticalCount,
      menuCounts,
      counts: {
        pendingOrders: pendingOrders.length,
        expiringOrders: expiringOrders.length,
        draftRoutes: draftRoutes.length,
        movedCustomers: movedCustomers.length,
      },
    }
  }, [customers, deliveryRouteItems, deliveryRoutes, orders, savedNotifications])
}

function aggregateNotification(id, count, tone, messageBuilder, href, scope, isCritical) {
  if (!count) return []
  return [
    {
      id,
      tone,
      label: messageBuilder(count),
      message: messageBuilder(count),
      href,
      scope,
      isCritical,
    },
  ]
}

function differenceInDays(leftIso, rightIso) {
  const left = new Date(`${leftIso}T00:00:00`)
  const right = new Date(`${rightIso}T00:00:00`)
  return Math.round((left - right) / 86400000)
}
