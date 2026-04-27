import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Eye, Package, Plus, Sparkles, Upload, Users, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { getTransferProofUrl, uploadTransferProof } from '../lib/imageUpload.js'
import { Badge, Button, Card, Table, formatDate, formatIDR } from '../components/ui.jsx'

const PACKAGE_SUMMARIES = {
  p1: { weekly: 476000, monthly: 1680000 },
  p2: { weekly: 625000, monthly: 2250000 },
  p3: { weekly: 625000, monthly: 2250000 },
  p4: { weekly: 575000, monthly: 1975000 },
  p5: { weekly: 1150000, monthly: 3950000 },
  p6: { weekly: 625000, monthly: 2250000 },
  p7: { weekly: 399000, monthly: 1450000 },
}

const FILTER_CHIPS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Ditolak' },
]

export default function DashboardSales() {
  const { orders, customers, programs, users, updateOrder } = useApp()
  const navigate = useNavigate()
  const currentUser = getStoredUser()
  const [openProgramId, setOpenProgramId] = useState(PROGRAM_ORDER[0])
  const [toast, setToast] = useState(null)
  const [smartPaste, setSmartPaste] = useState('')
  const [filter, setFilter] = useState('all')

  const fileInputRefs = useRef({})
  const todayIso = '2026-04-26'

  function todayHuman() {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function handleParseAndOpen() {
    if (!smartPaste.trim()) {
      setToast({ tone: 'warning', message: 'Paste teks WhatsApp customer dulu.' })
      return
    }
    try {
      sessionStorage.setItem('gracious_pending_smart_paste', smartPaste)
    } catch {
      // ignore
    }
    navigate('/orders/new')
  }

  const myOrders = useMemo(
    () =>
      orders
        .filter((order) => order.createdBy === currentUser?.id)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [orders, currentUser],
  )

  const metrics = useMemo(() => {
    const todayOrders = myOrders.filter((order) => (order.createdAt || '').startsWith(todayIso))
    const pendingOrders = myOrders.filter((order) => order.paymentStatus === 'pending')
    const monthOrders = myOrders.filter((order) => order.startDate?.startsWith('2026-04'))
    const uniqueCustomerIds = new Set(myOrders.map((order) => order.customerId))

    return {
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      activeThisMonth: monthOrders.length,
      totalCustomers: uniqueCustomerIds.size,
    }
  }, [myOrders])

  const latestRows = useMemo(
    () =>
      myOrders.slice(0, 10).map((order) => {
        const customer = customers.find((item) => item.id === order.customerId)
        const program = programs.find((item) => item.id === order.programId)
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: customer?.name || order.customerId,
          packageName: `${program?.name || order.programId} • ${mealTypeLabel(order.mealType)}`,
          startDate: formatDate(order.startDate),
          amount: formatIDR(order.paymentAmount),
          paymentStatus: order.paymentStatus,
          hasProof: Boolean(order.paymentProof),
          proofLabel: order.paymentProof?.name || '',
        }
      }),
    [myOrders, customers, programs],
  )

  const packageRows = useMemo(
    () =>
      programs
        .filter((program) => PROGRAM_ORDER.includes(program.id))
        .sort((a, b) => PROGRAM_ORDER.indexOf(a.id) - PROGRAM_ORDER.indexOf(b.id)),
    [programs],
  )

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function triggerProofUpload(orderId) {
    fileInputRefs.current[orderId]?.click()
  }

  async function handleProofSelected(orderId, event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const order = orders.find((item) => item.id === orderId)
      if (!order) return
      const storedProof = await uploadTransferProof(file, orderId)
      const previewUrl = await getTransferProofUrl(storedProof.path)
      await updateOrder({
        ...order,
        paymentProof: {
          name: file.name,
          type: file.type,
          size: file.size,
          bucket: storedProof.bucket,
          path: storedProof.path,
          preview: previewUrl,
          uploadedAt: new Date().toISOString(),
        },
      }, null)
      setToast({ tone: 'success', message: `Bukti transfer untuk ${order.orderNumber} berhasil diunggah.` })
    } catch (error) {
      console.error('[Gracious] sales proof upload failed:', error)
      setToast({ tone: 'warning', message: error?.message || 'Upload bukti transfer gagal.' })
    } finally {
      event.target.value = ''
    }
  }

  const filteredCards = useMemo(() => {
    if (filter === 'all') return latestRows
    return latestRows.filter((row) => row.paymentStatus === filter)
  }, [latestRows, filter])

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl space-y-5 lg:space-y-8">
        <section>
          <div className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Halo, {currentUser?.name?.split(' ')[0] || 'Sales'} 👋
          </div>
          <div className="mt-1 text-sm text-slate-500 capitalize">{todayHuman()}</div>
        </section>

        {toast ? <ToastBanner toast={toast} /> : null}

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-[#0a7068] p-5 text-white shadow-[0_18px_40px_rgba(13,148,136,0.28)]">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-teal-50/90">
            <Sparkles size={16} /> Smart Paste
          </div>
          <div className="mt-2 text-lg font-semibold">✨ Paste teks WhatsApp customer</div>
          <textarea
            value={smartPaste}
            onChange={(e) => setSmartPaste(e.target.value)}
            rows={4}
            placeholder={'Contoh:\n74. Nama: Wegi Randol\nAlamat: ...\npaket: Diet Lunch 5 hari'}
            className="mt-3 w-full rounded-2xl border-0 bg-white/95 p-3 text-base text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-white/60"
            style={{ fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={handleParseAndOpen}
            className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-base font-semibold text-teal-dark transition active:scale-[0.98]"
          >
            Parse &amp; Input Pesanan →
          </button>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard title="Hari Ini" value={metrics.todayOrders} icon={Package} tint="teal" />
          <MetricCard title="Pending" value={metrics.pendingOrders} icon={Wallet} tint="amber" />
          <MetricCard title="Bulan Ini" value={metrics.activeThisMonth} icon={Package} tint="navy" />
          <MetricCard title="Customer Saya" value={metrics.totalCustomers} icon={Users} tint="green" />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pesanan Terbaru</h2>
              <p className="text-xs text-slate-500">10 pesanan terakhir kamu.</p>
            </div>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {FILTER_CHIPS.map((chip) => {
              const active = filter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] ${
                    active
                      ? 'bg-teal text-white shadow-[0_8px_16px_rgba(13,148,136,0.25)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                Belum ada pesanan{filter !== 'all' ? ' di filter ini' : ''}.
              </div>
            ) : (
              filteredCards.map((row) => (
                <OrderCard
                  key={row.id}
                  row={row}
                  onTriggerUpload={() => triggerProofUpload(row.id)}
                  onProofChange={(event) => handleProofSelected(row.id, event)}
                  fileInputRefs={fileInputRefs}
                />
              ))
            )}
          </div>

          <Card className="hidden rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] lg:block">
            <Table
              columns={[
                { key: 'orderNumber', label: 'No Order' },
                { key: 'customerName', label: 'Nama Customer' },
                { key: 'packageName', label: 'Paket' },
                { key: 'startDate', label: 'Tanggal Mulai' },
                { key: 'amount', label: 'Nominal' },
                {
                  key: 'paymentStatus',
                  label: 'Status Transfer',
                  render: (row) => <PaymentBadge status={row.paymentStatus} />,
                },
                {
                  key: 'actions',
                  label: 'Aksi',
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button as={Link} to={`/orders/${row.id}`} variant="secondary" className="rounded-xl px-3 py-2">
                        <Eye size={14} /> Lihat
                      </Button>
                      {!row.hasProof ? (
                        <>
                          <button
                            type="button"
                            onClick={() => triggerProofUpload(row.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                          >
                            <Upload size={14} /> Upload Bukti
                          </button>
                          <input
                            ref={(node) => {
                              if (node) fileInputRefs.current[row.id] = node
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleProofSelected(row.id, event)}
                          />
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                          Bukti: {row.proofLabel || 'Sudah diunggah'}
                        </span>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={filteredCards}
              empty="Belum ada pesanan yang kamu input."
            />
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Daftar Paket</h2>
          <p className="text-xs text-slate-500">Quick reference harga paket untuk bantu closing.</p>
          <div className="mt-3 space-y-2">
            {packageRows.map((program) => {
              const summary = PACKAGE_SUMMARIES[program.id]
              const expanded = openProgramId === program.id
              return (
                <div key={program.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenProgramId(expanded ? null : program.id)}
                    className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition active:scale-[0.99]"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{program.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Weekly {formatIDR(summary?.weekly || 0)} · Monthly {formatIDR(summary?.monthly || 0)}
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </button>
                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      <div className="grid gap-2">
                        {Object.entries(program.prices || {}).map(([key, amount]) => (
                          <div key={key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5">
                            <span className="text-xs">{humanizePriceKey(key)}</span>
                            <span className="text-sm font-semibold text-slate-800">{formatIDR(amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function OrderCard({ row, onTriggerUpload, onProofChange, fileInputRefs }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{row.orderNumber}</div>
          <div className="mt-0.5 truncate text-base font-bold text-slate-900">{row.customerName}</div>
        </div>
        <PaymentBadge status={row.paymentStatus} />
      </div>
      <div className="mt-2 text-sm text-slate-600">{row.packageName}</div>
      <div className="mt-1 text-xs text-slate-500">Mulai {row.startDate} · {row.amount}</div>

      <div className="mt-4 flex flex-col gap-2">
        <Link
          to={`/orders/${row.id}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition active:scale-[0.98]"
        >
          <Eye size={15} /> Lihat Detail
        </Link>
        {!row.hasProof ? (
          <>
            <button
              type="button"
              onClick={onTriggerUpload}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-amber-100 px-4 text-sm font-semibold text-amber-800 transition active:scale-[0.98]"
            >
              <Upload size={15} /> Upload Bukti
            </button>
            <input
              ref={(node) => {
                if (node) fileInputRefs.current[row.id] = node
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onProofChange}
            />
          </>
        ) : (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-xs font-medium text-emerald-700">
            ✅ Bukti sudah diunggah
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, tint }) {
  const displayValue = useCountUp(value)
  const tintClasses = {
    teal: 'from-teal/15 to-teal/5 text-teal border-teal/10',
    amber: 'from-amber-100 to-amber-50 text-amber-700 border-amber-100',
    navy: 'from-gracious-navy/15 to-gracious-navy/5 text-gracious-navy border-gracious-navy/10',
    green: 'from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-100',
  }

  return (
    <Card className="rounded-2xl p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:p-5 sm:shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 sm:text-sm">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
            {displayValue.toLocaleString('id-ID')}
          </div>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-xl border bg-gradient-to-br sm:h-12 sm:w-12 sm:rounded-2xl ${tintClasses[tint]}`}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  )
}

function PaymentBadge({ status }) {
  if (status === 'pending') return <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Menunggu Verifikasi</span>
  if (status === 'verified') return <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Terverifikasi</span>
  if (status === 'rejected') return <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-800">Ditolak</span>
  return <Badge status={status}>{status}</Badge>
}

function ToastBanner({ toast }) {
  const cls = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  }[toast.tone] || 'border-slate-200 bg-white text-slate-700'

  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${cls}`}>{toast.message}</div>
}

function humanizePriceKey(key) {
  return key
    .replaceAll('_', ' ')
    .replace('weekly 5', 'Weekly 5 Hari')
    .replace('monthly 20', 'Monthly 20 Hari')
    .replace('monthly 36', 'Monthly 36 Hari')
    .replace('monthly 40', 'Monthly 40 Hari')
    .replace('lunch dinner', 'Lunch + Dinner')
    .replace('lunch', 'Lunch Only')
    .replace('dinner', 'Dinner Only')
}

function mealTypeLabel(value) {
  return (
    {
      lunch_only: 'Lunch Only',
      dinner_only: 'Dinner Only',
      lunch_dinner: 'Lunch + Dinner',
    }[value] || value
  )
}

function useCountUp(target) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const numericTarget = Number(target) || 0
    let frameId = 0
    const startedAt = performance.now()
    const duration = 850

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplay(Math.round(numericTarget * eased))
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [target])

  return display
}

const PROGRAM_ORDER = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
