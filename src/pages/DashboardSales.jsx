import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Eye, Package, Plus, Upload, Users, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, Table, formatDate, formatIDR } from '../components/ui.jsx'

const STORAGE_PROOF_KEY = 'gracious_sales_uploaded_proofs'

const PACKAGE_SUMMARIES = {
  p1: { weekly: 476000, monthly: 1680000 },
  p2: { weekly: 625000, monthly: 2250000 },
  p3: { weekly: 625000, monthly: 2250000 },
  p4: { weekly: 575000, monthly: 1975000 },
  p5: { weekly: 1150000, monthly: 3950000 },
  p6: { weekly: 625000, monthly: 2250000 },
  p7: { weekly: 399000, monthly: 1450000 },
}

export default function DashboardSales() {
  const { orders, customers, programs, users } = useApp()
  const currentUser = getStoredUser()
  const [openProgramId, setOpenProgramId] = useState(PROGRAM_ORDER[0])
  const [proofUploads, setProofUploads] = useState(() => readProofUploads())
  const [toast, setToast] = useState(null)

  const fileInputRefs = useRef({})
  const todayIso = '2026-04-26'

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
        const uploadedProof = proofUploads[order.id]
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: customer?.name || order.customerId,
          packageName: `${program?.name || order.programId} • ${mealTypeLabel(order.mealType)}`,
          startDate: formatDate(order.startDate),
          amount: formatIDR(order.paymentAmount),
          paymentStatus: order.paymentStatus,
          hasProof: Boolean(order.paymentProof || uploadedProof),
          proofLabel: uploadedProof?.name || order.paymentProof?.name || '',
        }
      }),
    [myOrders, customers, programs, proofUploads],
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

  function handleProofSelected(orderId, event) {
    const file = event.target.files?.[0]
    if (!file) return

    const nextUploads = {
      ...proofUploads,
      [orderId]: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
    }
    setProofUploads(nextUploads)
    localStorage.setItem(STORAGE_PROOF_KEY, JSON.stringify(nextUploads))
    setToast({ tone: 'success', message: `Bukti transfer untuk ${orderId} berhasil diunggah.` })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fef9ee_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Sales Workspace</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gracious-navy">
                Selamat datang, {currentUser?.name || 'Admin Sales'} 👋
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Kamu sudah input {metrics.todayOrders} pesanan hari ini
              </p>
            </div>
            <Link
              to="/orders/new"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-teal px-6 py-4 text-base font-semibold text-white shadow-[0_20px_45px_rgba(13,148,136,0.24)] transition hover:-translate-y-0.5 hover:bg-teal-dark"
            >
              <Plus size={20} />
              Input Pesanan Baru
            </Link>
          </div>
        </section>

        {toast ? <ToastBanner toast={toast} /> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Pesanan Saya Hari Ini" value={metrics.todayOrders} icon={Package} tint="teal" />
          <MetricCard title="Menunggu Verifikasi" value={metrics.pendingOrders} icon={Wallet} tint="amber" />
          <MetricCard title="Pesanan Aktif Bulan Ini" value={metrics.activeThisMonth} icon={Package} tint="navy" />
          <MetricCard title="Total Customer Saya" value={metrics.totalCustomers} icon={Users} tint="green" />
        </section>

        <section>
          <Card className="rounded-[28px] border-teal/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(255,255,255,0.95))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Action Center</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">+ Input Pesanan Baru</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Buka Smart Paste untuk copy-paste chat WhatsApp customer dan isi order lebih cepat.
                </p>
              </div>
              <Button as={Link} to="/orders/new" className="rounded-2xl px-6 py-3 text-base bg-teal hover:bg-teal-dark">
                <Plus size={18} />
                Buka Form Order
              </Button>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pesanan Terbaru Saya</h2>
                <p className="text-sm text-slate-500">10 pesanan terakhir yang kamu input di dashboard ini.</p>
              </div>
            </div>
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
                      <Button
                        as={Link}
                        to={`/orders/${row.id}`}
                        variant="secondary"
                        className="rounded-xl px-3 py-2"
                      >
                        <Eye size={14} />
                        Lihat
                      </Button>
                      {!row.hasProof ? (
                        <>
                          <button
                            type="button"
                            onClick={() => triggerProofUpload(row.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                          >
                            <Upload size={14} />
                            Upload Bukti
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
              rows={latestRows}
              empty="Belum ada pesanan yang kamu input."
            />
          </Card>

          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Daftar Paket</h2>
              <p className="text-sm text-slate-500">Quick reference harga paket Gracious untuk bantu closing lebih cepat.</p>
            </div>
            <div className="space-y-3">
              {packageRows.map((program) => {
                const summary = PACKAGE_SUMMARIES[program.id]
                const expanded = openProgramId === program.id
                return (
                  <div key={program.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setOpenProgramId(expanded ? null : program.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{program.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Weekly {formatIDR(summary?.weekly || 0)} | Monthly {formatIDR(summary?.monthly || 0)}
                        </div>
                      </div>
                      {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    {expanded ? (
                      <div className="border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                        <div className="mb-3 font-medium text-slate-800">Semua variasi harga</div>
                        <div className="grid gap-2">
                          {Object.entries(program.prices || {}).map(([key, amount]) => (
                            <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                              <span>{humanizePriceKey(key)}</span>
                              <span className="font-medium text-slate-800">{formatIDR(amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
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
    <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {displayValue.toLocaleString('id-ID')}
          </div>
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl border bg-gradient-to-br ${tintClasses[tint]}`}>
          <Icon size={22} />
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

function readProofUploads() {
  try {
    const raw = localStorage.getItem(STORAGE_PROOF_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const PROGRAM_ORDER = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
