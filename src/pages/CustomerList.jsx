import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, UserCheck, UserX } from 'lucide-react'
import AddressEditModal from '../components/customers/AddressEditModal.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Select, Skeleton, formatDate } from '../components/ui.jsx'

const STORAGE_CUSTOMERS_KEY = 'gracious_customers_extra'
const STORAGE_ADDRESS_LOG_KEY = 'gracious_address_change_log'

export default function CustomerList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentUser = getStoredUser()
  const { rawDb, programs, zones, isLoading, softDeleteCustomer, updateCustomer, upcomingBirthdays = [] } = useApp()
  const [customerExtras, setCustomerExtras] = useState(() => readStorageArray(STORAGE_CUSTOMERS_KEY))
  const [addressLogs, setAddressLogs] = useState(() => readStorageArray(STORAGE_ADDRESS_LOG_KEY))
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => deriveInitialStatusFilter(searchParams.get('filter')))
  const [programFilter, setProgramFilter] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

  const customers = useMemo(() => mergeRecords(rawDb.customers || [], customerExtras), [customerExtras, rawDb.customers])
  const orders = useMemo(() => mergeRecords(rawDb.orders || [], readStorageArray('gracious_orders_extra')), [rawDb.orders])

  const customerRows = useMemo(() => {
    const today = todayISO()
    const query = search.trim().toLowerCase()

    return customers
      .map((customer) => {
        const customerOrders = orders
          .filter((order) => order.customerId === customer.id)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        const firstOrder = [...customerOrders].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0] || null
        const activeOrders = customerOrders.filter((order) => order.status === 'active' && order.startDate <= today && order.endDate >= today)
        const latestOrder = customerOrders[0] || null
        const latestActiveProgram = activeOrders[0] || latestOrder
        const zone = zones.find((item) => item.id === customer.zoneId) || null
        const latestAddressLog = addressLogs
          .filter((log) => log.customerId === customer.id)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null

        const status = deriveCustomerStatus(customer, customerOrders, latestAddressLog, today)
        const program = programs.find((item) => item.id === latestActiveProgram?.programId) || null

        return {
          customer,
          customerOrders,
          firstOrder,
          activeOrders,
          latestAddressLog,
          zone,
          status,
          program,
        }
      })
      .filter((row) => {
        const haystack = `${row.customer.name} ${row.customer.phone} ${row.customer.addressPrimary || ''}`.toLowerCase()
        const matchesSearch = !query || haystack.includes(query)
        const matchesZone = !zoneFilter || row.customer.zoneId === zoneFilter
        const matchesStatus =
          !statusFilter ||
          (statusFilter === 'aktif' && row.customer.isActive) ||
          (statusFilter === 'nonaktif' && row.customer.isActive === false) ||
          (statusFilter === 'expiring' && row.status.some((status) => status.key === 'expiring')) ||
          (statusFilter === 'moved' && row.status.some((status) => status.key === 'move'))
        const matchesProgram = !programFilter || row.program?.id === programFilter
        return matchesSearch && matchesZone && matchesStatus && matchesProgram
      })
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name))
  }, [addressLogs, customers, orders, programs, search, statusFilter, zoneFilter, programFilter, zones])

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

  function handleDeactivate(row) {
    setConfirmState({
      title: `Yakin ingin nonaktifkan ${row.customer.name}?`,
      description: 'Customer akan disembunyikan dari daftar aktif. Bisa diaktifkan kembali kapan saja.',
      confirmLabel: 'Ya, Nonaktifkan',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await updateCustomer(
            { id: row.customer.id, isActive: false },
            `${row.customer.name} berhasil dinonaktifkan.`,
          )
        } catch {
          // toast handled by withToast
        }
      },
    })
  }

  function handleReactivate(row) {
    setConfirmState({
      title: `Aktifkan kembali ${row.customer.name}?`,
      description: 'Customer akan kembali muncul di daftar customer aktif.',
      confirmLabel: 'Ya, Aktifkan',
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await updateCustomer(
            { id: row.customer.id, isActive: true },
            `${row.customer.name} berhasil diaktifkan kembali.`,
          )
        } catch {
          // toast handled by withToast
        }
      },
    })
  }

  function handleHardDelete(row) {
    setConfirmState({
      title: `Hapus customer ${row.customer.name}?`,
      description: 'Customer tidak akan tampil di sistem, tapi riwayat pesanan tetap tersimpan. Tidak boleh ada pesanan aktif.',
      confirmLabel: 'Ya, Hapus',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await softDeleteCustomer(row.customer.id, `Customer ${row.customer.name} berhasil dihapus.`)
        } catch (error) {
          setToast({ tone: 'error', message: error?.message || 'Gagal menghapus customer.' })
        }
      },
    })
  }

  function handleAddressSave(payload) {
    const customer = editingCustomer
    if (!customer) return

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
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Data Customer</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Data Customer</h1>
            <p className="mt-2 text-sm text-slate-500">Cari customer aktif, pantau status paket, dan akses perubahan alamat dari satu tempat.</p>
          </div>
          {['superadmin', 'sales'].includes(currentUser?.role) ? (
            <Button as={Link} to="/orders/new" className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Plus size={16} />
              Tambah Customer
            </Button>
          ) : null}
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        {['superadmin', 'address_admin'].includes(currentUser?.role) && upcomingBirthdays.length > 0 ? (
          <UpcomingBirthdaysCard rows={upcomingBirthdays} zones={zones} />
        ) : null}

        <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.6fr))]">
            <Field label="Search">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nama, HP, atau alamat" />
              </div>
            </Field>

            <Field label="Zona">
              <Select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                <option value="">Semua zona</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Semua status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
                <option value="expiring">Expiring</option>
                <option value="moved">Pindah Alamat</option>
              </Select>
            </Field>

            <Field label="Program">
              <Select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
                <option value="">Semua program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="block space-y-3 p-4 md:hidden">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)
            ) : customerRows.length ? (
              customerRows.map((row) => (
                <div key={row.customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{row.customer.name}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{row.customer.phone || '-'}</div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{shorten(row.customer.addressPrimary, 110)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status.map((status) => (
                      <CustomerStatusBadge key={status.key} status={status} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/customers/${row.customer.id}`)}>Detail</Button>
                    <Button variant="secondary" onClick={() => setEditingCustomer(row.customer)}>Edit Alamat</Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon="👥"
                title="Belum ada customer."
                description="Tambahkan customer pertama untuk mulai mengelola pengiriman."
                actionLabel="Tambah customer pertama →"
                actionTo="/orders/new"
              />
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="hidden min-w-full text-sm md:table">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['Nama', 'No HP', 'Alamat', 'Zona', 'Program Aktif', 'Status', 'Aksi'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-semibold text-slate-700">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`loading-${index}`} className="border-b border-slate-100 last:border-0">
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : customerRows.length ? (
                  customerRows.map((row) => (
                    <tr key={row.customer.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.customer.name}</div>
                        <div className="text-xs text-slate-500">Bergabung {formatDate(row.customer.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.customer.phone || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{shorten(row.customer.addressPrimary, 72)}</td>
                      <td className="px-4 py-3">
                        {row.zone ? <ZoneBadge zone={row.zone} /> : <span className="text-slate-400">Belum ada zona</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.program?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.status.map((status) => (
                            <CustomerStatusBadge key={status.key} status={status} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <details className="group relative">
                          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50">
                            <MoreHorizontal size={16} />
                          </summary>
                          <div className="absolute right-0 top-11 z-10 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <ActionButton icon={Eye} label="Lihat Detail" onClick={() => navigate(`/customers/${row.customer.id}`)} />
                            <ActionButton icon={Pencil} label="Edit Alamat" onClick={() => setEditingCustomer(row.customer)} />
                            {row.customer.isActive === false ? (
                              <ActionButton icon={UserCheck} label="Aktifkan Kembali" onClick={() => handleReactivate(row)} />
                            ) : (
                              <ActionButton icon={UserX} label="Nonaktifkan" danger onClick={() => handleDeactivate(row)} />
                            )}
                            {currentUser?.role === 'superadmin' ? (
                              <ActionButton icon={Trash2} label="Hapus Permanen" danger onClick={() => handleHardDelete(row)} />
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      Belum ada customer. Tambah customer pertama →
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AddressEditModal
        customer={editingCustomer}
        zones={zones}
        open={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        onSave={handleAddressSave}
      />
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
      />
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
        danger ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

function CustomerStatusBadge({ status }) {
  return <Badge status={status.tone}>{status.label}</Badge>
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
  const nearestEnd = activeOrders
    .map((order) => order.endDate)
    .filter(Boolean)
    .sort()[0]

  if (customer.isActive === false) {
    statuses.push({ key: 'inactive', tone: 'cancelled', label: 'Nonaktif' })
    return statuses
  }

  if (!activeOrders.length && nearestEnd && nearestEnd < today) {
    statuses.push({ key: 'expired', tone: 'failed', label: 'Expired' })
  } else if (nearestEnd && diffDays(nearestEnd, today) <= 3 && diffDays(nearestEnd, today) >= 0) {
    statuses.push({ key: 'expiring', tone: 'pending', label: 'Expiring' })
  } else {
    statuses.push({ key: 'active', tone: 'delivered', label: 'Active' })
  }

  return statuses
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

function shorten(value, max) {
  if (!value) return '-'
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function deriveInitialStatusFilter(filter) {
  if (filter === 'expiring') return 'expiring'
  if (filter === 'moved') return 'moved'
  return ''
}

function ToastBanner({ toast }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{toast.message}</div>
}

function UpcomingBirthdaysCard({ rows, zones }) {
  const sorted = [...rows].sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999)).slice(0, 20)
  return (
    <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">🎂 Ulang Tahun Customer Terdekat</div>
          <div className="text-xs text-slate-500">{sorted.length} customer dalam waktu dekat — kirim ucapan untuk retensi.</div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-semibold text-slate-600">Nama</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Tanggal Lahir</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Zona</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Sisa Hari</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const zoneName = row.zoneName || zones.find((z) => z.id === row.zoneId)?.name || '-'
              const days = Number(row.daysUntil ?? row.days_until ?? 0)
              const status = row.subscriptionStatus || row.status || (row.isActive === false ? 'Nonaktif' : 'Aktif')
              return (
                <tr key={row.id || row.customerId || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name || row.customerName || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.birthDate ? formatDate(row.birthDate) : '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{zoneName}</td>
                  <td className="px-3 py-2"><BirthdayDaysBadge days={days} /></td>
                  <td className="px-3 py-2 text-slate-600">{status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function BirthdayDaysBadge({ days }) {
  if (days === 0) {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
        🎂 Hari ini!
      </span>
    )
  }
  if (days >= 1 && days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        🎉 {days} hari lagi
      </span>
    )
  }
  return <span className="text-xs text-slate-500">{days} hari lagi</span>
}
