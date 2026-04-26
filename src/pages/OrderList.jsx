import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Eye, Filter, MoreHorizontal, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Select, Skeleton, formatDate, formatIDR } from '../components/ui.jsx'

const PAGE_SIZE = 15
const STATUS_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'active', label: 'Aktif' },
  { id: 'completed', label: 'Selesai' },
]
const SOURCE_OPTIONS = [
  { value: '', label: 'Semua sumber' },
  { value: 'manual', label: 'Manual WA' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'tokopedia', label: 'Tokopedia' },
]

export default function OrderList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentUser = getStoredUser()
  const { rawDb, customers, orders, programs, verifyOrder, updateOrder, deleteOrder, isLoading } = useApp()
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [confirmState, setConfirmState] = useState(null)

  const activeFilter = searchParams.get('filter') || 'all'
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers])
  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program])), [programs])
  const userMap = useMemo(() => new Map((rawDb.users || []).map((user) => [user.id, user])), [rawDb.users])

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()

    return orders
      .filter((order) => {
        const customer = customerMap.get(order.customerId)
        const customerName = customer?.name?.toLowerCase() || ''
        const orderNumber = order.orderNumber?.toLowerCase() || ''
        const matchesSearch =
          !query ||
          customerName.includes(query) ||
          orderNumber.includes(query) ||
          customer?.phone?.toLowerCase()?.includes(query)

        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'pending' && order.paymentStatus === 'pending') ||
          (activeFilter === 'verified' && order.paymentStatus === 'verified') ||
          (activeFilter === 'active' && order.status === 'active') ||
          (activeFilter === 'completed' && order.status === 'completed')

        const matchesProgram = !programFilter || order.programId === programFilter
        const matchesSource = !sourceFilter || normalizeSource(order.orderSource) === sourceFilter
        const matchesDateFrom = !dateFrom || order.startDate >= dateFrom
        const matchesDateTo = !dateTo || order.startDate <= dateTo

        return matchesSearch && matchesFilter && matchesProgram && matchesSource && matchesDateFrom && matchesDateTo
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [activeFilter, customerMap, dateFrom, dateTo, orders, programFilter, search, sourceFilter])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function updateFilter(nextFilter) {
    setPage(1)
    if (nextFilter === 'all') {
      searchParams.delete('filter')
      setSearchParams(searchParams, { replace: true })
      return
    }
    setSearchParams({ filter: nextFilter }, { replace: true })
  }

  async function handleVerify(order) {
    await verifyOrder({
      ...order,
      paymentStatus: 'verified',
      status: order.status === 'draft' ? 'active' : order.status,
      verifiedBy: currentUser?.id || 'u1',
      verifiedAt: new Date().toISOString(),
    })
  }

  async function handleReject(order) {
    setConfirmState({
      title: `Yakin ingin tolak transfer ${order.orderNumber}?`,
      description: 'Aksi ini tidak bisa dibatalkan.',
      confirmLabel: 'Ya, Tolak',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null)
        await updateOrder({
          ...order,
          paymentStatus: 'rejected',
          verifiedBy: currentUser?.id || 'u1',
          verifiedAt: new Date().toISOString(),
        }, 'Status pembayaran berhasil ditolak.')
      },
    })
  }

  async function handleDelete(order) {
    setConfirmState({
      title: `Yakin ingin hapus ${order.orderNumber}?`,
      description: 'Aksi ini tidak bisa dibatalkan.',
      confirmLabel: 'Ya, Hapus',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null)
        await deleteOrder(order.id)
      },
    })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>{currentUser?.role === 'sales' ? 'Dashboard Sales' : 'Dashboard'}</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Daftar Pesanan</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Daftar Pesanan</h1>
            <p className="mt-2 text-sm text-slate-500">Pantau status transfer, cari order customer, dan akses aksi cepat per pesanan.</p>
          </div>
          <Button as={Link} to="/orders/new" className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
            <Plus size={16} />
            Input Pesanan Baru
          </Button>
        </header>

        <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = filter.id === activeFilter
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => updateFilter(filter.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-teal text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.6fr))]">
            <Field label="Search">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                  placeholder="Nama customer atau no order"
                />
              </div>
            </Field>

            <Field label="Program">
              <Select
                value={programFilter}
                onChange={(event) => {
                  setProgramFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Semua program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Periode Mulai">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value)
                    setPage(1)
                  }}
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </Field>

            <Field label="Sumber Order">
              <Select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value)
                  setPage(1)
                }}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
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
            ) : pagedOrders.length ? (
              pagedOrders.map((order) => {
                const customer = customerMap.get(order.customerId)
                const program = programMap.get(order.programId)
                return (
                  <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{order.orderNumber}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{customer?.name || 'Customer tidak ditemukan'}</div>
                      </div>
                      <TransferBadge status={order.paymentStatus} />
                    </div>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {program?.name || order.programId} • {mealTypeLabel(order.mealType)} • {durationLabel(order.durationType)}
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(order.startDate)} - {formatDate(order.endDate)}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}`)}>Detail</Button>
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState
                icon="📦"
                title="Belum ada pesanan masuk."
                description="Input pesanan baru untuk mulai membangun pipeline delivery."
                actionLabel="Input pesanan baru →"
                actionTo="/orders/new"
              />
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="hidden min-w-full text-sm md:table">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['No Order', 'Customer', 'Program', 'Meal', 'Durasi', 'Mulai', 'Selesai', 'Nominal', 'Status Transfer', 'Aksi'].map((head) => (
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
                      <td colSpan={10} className="px-4 py-3">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : pagedOrders.length ? (
                  pagedOrders.map((order) => {
                    const customer = customerMap.get(order.customerId)
                    const program = programMap.get(order.programId)
                    const sales = userMap.get(order.createdBy)

                    return (
                      <tr key={order.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{customer?.name || 'Customer tidak ditemukan'}</div>
                          <div className="text-xs text-slate-500">{customer?.phone || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{program?.name || order.programId}</td>
                        <td className="px-4 py-3 text-slate-700">{mealTypeLabel(order.mealType)}</td>
                        <td className="px-4 py-3 text-slate-700">{durationLabel(order.durationType)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(order.startDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(order.endDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatIDR(order.paymentAmount || order.pricePromo || 0)}</td>
                        <td className="px-4 py-3">
                          <TransferBadge status={order.paymentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <details className="group relative">
                            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50">
                              <MoreHorizontal size={16} />
                            </summary>
                            <div className="absolute right-0 top-11 z-10 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                              <ActionButton icon={Eye} label="Lihat Detail" onClick={() => navigate(`/orders/${order.id}`)} />
                              {order.paymentStatus !== 'verified' ? (
                                <ActionButton icon={Pencil} label="Edit" onClick={() => navigate(`/orders/${order.id}`)} />
                              ) : null}
                              {currentUser?.role === 'superadmin' ? (
                                <>
                                  <ActionButton icon={CheckCircle2} label="Verifikasi Transfer" onClick={() => handleVerify(order)} />
                                  <ActionButton icon={XCircle} label="Tolak Transfer" onClick={() => handleReject(order)} />
                                  <ActionButton icon={Trash2} label="Hapus" danger onClick={() => handleDelete(order)} />
                                </>
                              ) : null}
                              {sales ? <div className="px-3 py-2 text-xs text-slate-400">Sales: {sales.name}</div> : null}
                            </div>
                          </details>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                      <div className="mx-auto max-w-md">
                        <Filter size={20} className="mx-auto text-slate-300" />
                        <div className="mt-3 font-medium text-slate-700">Belum ada pesanan masuk.</div>
                        <div className="mt-1 text-sm text-slate-500">Input pesanan baru atau ubah filter untuk melihat order lain.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Menampilkan {(currentPage - 1) * PAGE_SIZE + (pagedOrders.length ? 1 : 0)}-
              {(currentPage - 1) * PAGE_SIZE + pagedOrders.length} dari {filteredOrders.length} pesanan
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                {currentPage} / {totalPages}
              </div>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </Card>
      </div>
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

function TransferBadge({ status }) {
  const map = {
    pending: { tone: 'pending', label: 'Menunggu Verifikasi' },
    verified: { tone: 'delivered', label: 'Terverifikasi' },
    rejected: { tone: 'failed', label: 'Ditolak' },
  }

  const current = map[status] || { tone: 'draft', label: status || 'Belum ada status' }
  return <Badge status={current.tone}>{current.label}</Badge>
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

function normalizeSource(value) {
  return {
    manual: 'manual',
    'Manual WA': 'manual',
    shopee: 'shopee',
    Shopee: 'shopee',
    tokopedia: 'tokopedia',
    Tokopedia: 'tokopedia',
  }[value] || value || ''
}

function mealTypeLabel(value) {
  return (
    {
      lunch_only: 'Lunch Only',
      dinner_only: 'Dinner Only',
      lunch_dinner: 'Lunch + Dinner',
    }[value] || value || '-'
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
