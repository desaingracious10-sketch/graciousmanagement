import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, MapPin, Pencil, Plus, UserX } from 'lucide-react'
import AddressEditModal from '../components/customers/AddressEditModal.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, formatDate, formatDateTime } from '../components/ui.jsx'

const STORAGE_CUSTOMERS_KEY = 'gracious_customers_extra'
const STORAGE_ADDRESS_LOG_KEY = 'gracious_address_change_log'
const STORAGE_ORDERS_KEY = 'gracious_orders_extra'
const STORAGE_ROUTES_KEY = 'gracious_routes_extra'
const STORAGE_ROUTE_ITEMS_KEY = 'gracious_route_items_extra'
const TABS = [
  { id: 'info', label: 'Info Customer' },
  { id: 'orders', label: 'Riwayat Order' },
  { id: 'delivery', label: 'Riwayat Pengiriman' },
  { id: 'address', label: 'Log Perubahan Alamat' },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = getStoredUser()
  const { rawDb, programs, zones } = useApp()
  const [activeTab, setActiveTab] = useState('info')
  const [customerExtras, setCustomerExtras] = useState(() => readStorageArray(STORAGE_CUSTOMERS_KEY))
  const [addressLogs, setAddressLogs] = useState(() => readStorageArray(STORAGE_ADDRESS_LOG_KEY))
  const [monthFilter, setMonthFilter] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [toast, setToast] = useState(null)

  const customers = useMemo(() => mergeRecords(rawDb.customers || [], customerExtras), [customerExtras, rawDb.customers])
  const orders = useMemo(() => mergeRecords(rawDb.orders || [], readStorageArray(STORAGE_ORDERS_KEY)), [rawDb.orders])
  const routes = useMemo(() => mergeRecords(rawDb.deliveryRoutes || [], readStorageArray(STORAGE_ROUTES_KEY)), [rawDb.deliveryRoutes])
  const routeItems = useMemo(() => mergeRecords(rawDb.deliveryRouteItems || [], readStorageArray(STORAGE_ROUTE_ITEMS_KEY)), [rawDb.deliveryRouteItems])
  const users = rawDb.users || []

  const customer = customers.find((item) => item.id === id) || null
  const customerOrders = useMemo(
    () =>
      orders
        .filter((order) => order.customerId === id)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [id, orders],
  )
  const firstOrder = [...customerOrders].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0] || null
  const latestOrder = customerOrders[0] || null
  const zone = zones.find((item) => item.id === customer?.zoneId) || null
  const customerLogs = addressLogs
    .filter((log) => log.customerId === id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const deliveryHistory = useMemo(() => {
    return routeItems
      .filter((item) => item.customerId === id)
      .map((item) => {
        const route = routes.find((candidate) => candidate.id === item.routeId)
        const driver = users.find((candidate) => candidate.id === route?.driverId)
        const order = orders.find((candidate) => candidate.id === item.orderId)
        return { ...item, route, driver, order }
      })
      .filter((item) => {
        if (!monthFilter) return true
        return String(item.route?.deliveryDate || '').startsWith(monthFilter)
      })
      .sort((a, b) => new Date(`${b.route?.deliveryDate || '1970-01-01'}T00:00:00`) - new Date(`${a.route?.deliveryDate || '1970-01-01'}T00:00:00`))
  }, [id, monthFilter, orders, routeItems, routes, users])

  if (!customer) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Card className="rounded-[28px] p-8 text-center">
            <div className="text-xl font-semibold text-slate-900">Customer tidak ditemukan</div>
            <div className="mt-2 text-sm text-slate-500">ID customer: {id}</div>
          </Card>
        </div>
      </div>
    )
  }

  const derivedStatus = deriveCustomerStatus(customer, customerOrders, customerLogs[0] || null, todayISO())

  function persistCustomers(next) {
    setCustomerExtras(next)
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(next))
  }

  function persistAddressLogs(next) {
    setAddressLogs(next)
    localStorage.setItem(STORAGE_ADDRESS_LOG_KEY, JSON.stringify(next))
  }

  function saveCustomerPatch(nextCustomer) {
    persistCustomers(upsertRecord(customerExtras, nextCustomer))
  }

  function handleDeactivate() {
    if (!window.confirm(`Nonaktifkan customer ${customer.name}?`)) return
    saveCustomerPatch({ ...customer, isActive: false })
    setToast({ tone: 'success', message: `${customer.name} berhasil dinonaktifkan.` })
  }

  function handleAddressSave(payload) {
    saveCustomerPatch({
      ...customer,
      addressPrimary: payload.addressPrimary,
      addressAlternate: payload.addressAlternate || null,
      addressNotes: payload.addressNotes,
      zoneId: payload.zoneId || customer.zoneId,
    })

    persistAddressLogs([
      ...addressLogs,
      {
        id: `addr-log-${Date.now()}`,
        customerId: customer.id,
        oldAddress: customer.addressPrimary || '',
        newAddress: payload.addressPrimary,
        oldAlternateAddress: customer.addressAlternate || '',
        newAlternateAddress: payload.addressAlternate || '',
        oldZoneId: customer.zoneId || '',
        newZoneId: payload.zoneId || customer.zoneId || '',
        reason: payload.reason,
        effectiveDate: payload.effectiveDate,
        additionalNotes: payload.additionalNotes,
        changedBy: currentUser?.id || 'u1',
        createdAt: new Date().toISOString(),
      },
    ])

    setEditingCustomer(null)
    setToast({ tone: 'success', message: `Alamat berhasil diupdate. Perubahan efektif mulai ${formatDate(payload.effectiveDate)}.` })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link to="/customers" className="hover:text-slate-700">
                Data Customer
              </Link>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">{customer.name}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">{customer.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {zone ? <ZoneBadge zone={zone} /> : null}
              {derivedStatus.map((status) => (
                <Badge key={status.key} status={status.tone}>
                  {status.label}
                </Badge>
              ))}
              <Badge status="scheduled">Order Pertama: {sourceLabel(firstOrder?.orderSource)}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditingCustomer(customer)} className="gap-2 rounded-2xl px-4 py-3">
              <Pencil size={16} />
              Edit Alamat
            </Button>
            <Button as={Link} to="/orders/new" className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Plus size={16} />
              Tambah Order
            </Button>
            <Button variant="danger" onClick={handleDeactivate} className="gap-2 rounded-2xl px-4 py-3">
              <UserX size={16} />
              Nonaktifkan
            </Button>
          </div>
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        <Card className="rounded-[28px] p-2 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-teal text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </Card>

        {activeTab === 'info' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_0.85fr]">
            <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="space-y-4 text-sm text-slate-600">
                <InfoRow label="Nama" value={customer.name} />
                <InfoRow label="HP" value={customer.phone || '-'} />
                <InfoRow label="Email" value={customer.email || '-'} />
                <InfoRow label="Alamat Utama" value={customer.addressPrimary || '-'} multiline />
                <InfoRow label="Alamat Alternatif" value={customer.addressAlternate || '-'} multiline />
                <InfoRow label="Catatan Alamat" value={customer.addressNotes || '-'} multiline />
                <InfoRow
                  label="Zona"
                  value={
                    <div className="flex flex-wrap items-center gap-2">
                      {zone ? <ZoneBadge zone={zone} /> : <span>-</span>}
                      <Button variant="secondary" onClick={() => setEditingCustomer(customer)} className="rounded-xl px-3 py-1.5 text-xs">
                        Ubah Zona
                      </Button>
                    </div>
                  }
                />
                <InfoRow label="Pantangan Terakhir" value={latestOrder?.dietaryNotes || customer.dietaryNotes || '-'} multiline />
              </div>
            </Card>

            <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2 text-slate-900">
                <MapPin size={18} className="text-teal" />
                <div className="font-semibold">Peta Alamat Utama</div>
              </div>
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                <iframe
                  title="Map placeholder"
                  className="h-[360px] w-full"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(customer.addressPrimary || '')}&output=embed`}
                  loading="lazy"
                />
              </div>
              <div className="mt-3 text-xs text-slate-500">Embed peta untuk membantu validasi alamat pengiriman utama customer.</div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'orders' ? (
          <Card className="overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {['No Order', 'Program', 'Durasi', 'Mulai', 'Selesai', 'Status'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold text-slate-700">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.length ? (
                    customerOrders.map((order) => {
                      const program = programs.find((item) => item.id === order.programId)
                      return (
                        <tr
                          key={order.id}
                          className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
                          <td className="px-4 py-3 text-slate-700">{program?.name || order.programId}</td>
                          <td className="px-4 py-3 text-slate-700">{durationLabel(order.durationType)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(order.startDate)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(order.endDate)}</td>
                          <td className="px-4 py-3">
                            <Badge status={order.status}>{orderStatusLabel(order.status)}</Badge>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        Belum ada riwayat order customer ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {activeTab === 'delivery' ? (
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Riwayat Pengiriman</div>
                <div className="mt-1 text-sm text-slate-500">Timeline pengiriman customer berdasarkan item rute yang pernah tercatat.</div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Filter Bulan</label>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-4">
              {deliveryHistory.length ? (
                deliveryHistory.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-slate-900">
                          {formatDate(item.route?.deliveryDate)} • {item.route?.routeLabel || 'Rute'}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">Driver: {item.driver?.name || '-'} • Order: {item.order?.orderNumber || '-'}</div>
                      </div>
                      <Badge status={deliveryBadge(item.status)}>{deliveryLabel(item.status)}</Badge>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">Catatan: {item.deliveryNotes || '-'}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                  Belum ada riwayat pengiriman untuk filter bulan ini.
                </div>
              )}
            </div>
          </Card>
        ) : null}

        {activeTab === 'address' ? (
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="space-y-4">
              {customerLogs.length ? (
                customerLogs.map((log) => {
                  const actor = users.find((user) => user.id === log.changedBy)
                  const oldZone = zones.find((zoneItem) => zoneItem.id === log.oldZoneId)
                  const newZone = zones.find((zoneItem) => zoneItem.id === log.newZoneId)
                  return (
                    <div key={log.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{formatDateTime(log.createdAt)}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            Alasan: {log.reason} • Efektif mulai {formatDate(log.effectiveDate)}
                          </div>
                        </div>
                        <div className="text-sm text-slate-500">Diubah oleh {actor?.name || '-'}</div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <AddressBlock title="Alamat Lama" address={log.oldAddress} zone={oldZone?.name} />
                        <AddressBlock title="Alamat Baru" address={log.newAddress} zone={newZone?.name} />
                      </div>
                      {log.additionalNotes ? <div className="mt-3 text-sm text-slate-600">Catatan: {log.additionalNotes}</div> : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                  Belum ada log perubahan alamat untuk customer ini.
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </div>

      <AddressEditModal
        customer={editingCustomer}
        zones={zones}
        open={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        onSave={handleAddressSave}
      />
    </div>
  )
}

function InfoRow({ label, value, multiline = false }) {
  return (
    <div className={`border-b border-slate-100 pb-3 last:border-0 last:pb-0 ${multiline ? '' : 'flex items-start justify-between gap-3'}`}>
      <div className="text-slate-500">{label}</div>
      <div className={`${multiline ? 'mt-1' : 'text-right'} font-medium text-slate-700`}>{value}</div>
    </div>
  )
}

function AddressBlock({ title, address, zone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-600">{address || '-'}</div>
      <div className="mt-2 text-xs text-slate-500">Zona: {zone || '-'}</div>
    </div>
  )
}

function ZoneBadge({ zone }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: `${zone.colorCode}1A`, color: zone.colorCode }}
    >
      {zone.name}
    </span>
  )
}

function deriveCustomerStatus(customer, orders, latestAddressLog, today) {
  const statuses = []
  const firstOrder = [...orders].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0] || null
  if (firstOrder && daysBetween(firstOrder.createdAt, today) <= 7) {
    statuses.push({ key: 'new', tone: 'scheduled', label: 'N' })
  }
  if (latestAddressLog && latestAddressLog.effectiveDate >= today) {
    statuses.push({ key: 'move', tone: 'failed', label: 'Pindah' })
  }

  const activeOrders = orders.filter((order) => order.status === 'active')
  const nearestEnd = activeOrders.map((order) => order.endDate).filter(Boolean).sort()[0]

  if (customer.isActive === false) {
    statuses.push({ key: 'inactive', tone: 'cancelled', label: 'Nonaktif' })
  } else if (!activeOrders.length && nearestEnd && nearestEnd < today) {
    statuses.push({ key: 'expired', tone: 'failed', label: 'Expired' })
  } else if (nearestEnd && diffDays(nearestEnd, today) <= 3 && diffDays(nearestEnd, today) >= 0) {
    statuses.push({ key: 'expiring', tone: 'pending', label: 'Expiring' })
  } else {
    statuses.push({ key: 'active', tone: 'delivered', label: 'Active' })
  }

  return statuses
}

function sourceLabel(value) {
  return (
    {
      manual: 'WA',
      shopee: 'Shopee',
      tokopedia: 'Tokopedia',
    }[value] || '-'
  )
}

function durationLabel(value) {
  return (
    {
      weekly_5: 'Weekly 5 Hari',
      monthly_20: 'Monthly 20 Hari',
      monthly_36: 'Monthly 36 Hari',
      monthly_40: 'Monthly 40 Hari',
    }[value] || value || '-'
  )
}

function orderStatusLabel(value) {
  return (
    {
      draft: 'Draft',
      active: 'Aktif',
      completed: 'Selesai',
      paused: 'Pause',
      cancelled: 'Dibatalkan',
    }[value] || value || '-'
  )
}

function deliveryLabel(value) {
  return (
    {
      delivered: 'Terkirim',
      completed: 'Terkirim',
      failed: 'Gagal',
      pending: 'Belum',
      in_progress: 'Berjalan',
    }[value] || value || '-'
  )
}

function deliveryBadge(value) {
  return (
    {
      delivered: 'delivered',
      completed: 'delivered',
      failed: 'failed',
      pending: 'pending',
      in_progress: 'in_progress',
    }[value] || 'draft'
  )
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

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function diffDays(target, source) {
  const end = new Date(`${target}T00:00:00`)
  const start = new Date(`${source}T00:00:00`)
  return Math.round((end - start) / 86400000)
}

function daysBetween(dateLike, isoDate) {
  const left = new Date(dateLike)
  const right = new Date(`${isoDate}T00:00:00`)
  return Math.floor((right - left) / 86400000)
}

function ToastBanner({ toast }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{toast.message}</div>
}
