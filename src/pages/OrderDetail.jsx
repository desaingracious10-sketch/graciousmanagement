import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Clock3, MapPin, PauseCircle, ReceiptText, Route, Upload, User, Wallet, XCircle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, formatDate, formatDateTime, formatIDR } from '../components/ui.jsx'

const TABS = [
  { id: 'info', label: 'Info Pesanan' },
  { id: 'payment', label: 'Pembayaran' },
  { id: 'history', label: 'Riwayat Pengiriman' },
]

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = getStoredUser()
  const { rawDb, programs, zones, orders, customers, updateOrder, verifyOrder, deliveryRoutes, deliveryRouteItems } = useApp()
  const [activeTab, setActiveTab] = useState('info')

  const users = rawDb.users || []
  const routes = deliveryRoutes
  const routeItems = deliveryRouteItems

  const order = orders.find((item) => item.id === id) || null
  const customer = customers.find((item) => item.id === order?.customerId) || null
  const program = programs.find((item) => item.id === order?.programId) || null
  const zone = zones.find((item) => item.id === (order?.zoneId || customer?.zoneId)) || null
  const salesUser = users.find((item) => item.id === order?.createdBy) || null
  const verifier = users.find((item) => item.id === order?.verifiedBy) || null

  const customerRouteHistory = useMemo(() => {
    if (!customer) return []
    return routeItems
      .filter((item) => item.customerId === customer.id)
      .map((item) => {
        const route = routes.find((candidate) => candidate.id === item.routeId)
        const driver = users.find((candidate) => candidate.id === route?.driverId)
        return {
          ...item,
          route,
          driver,
        }
      })
      .sort((a, b) => new Date(`${b.route?.deliveryDate || '1970-01-01'}T00:00:00`) - new Date(`${a.route?.deliveryDate || '1970-01-01'}T00:00:00`))
  }, [customer, routeItems, routes, users])

  const latestRoute = customerRouteHistory[0] || null
  const visibleTabs = currentUser?.role === 'superadmin' ? TABS : TABS.filter((tab) => tab.id !== 'payment')

  if (!order) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Card className="rounded-[28px] p-8 text-center">
            <div className="text-xl font-semibold text-slate-900">Order tidak ditemukan</div>
            <div className="mt-2 text-sm text-slate-500">ID order: {id}</div>
            <Button as={Link} to="/orders" className="mt-6 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              Kembali ke daftar pesanan
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  async function handleVerify() {
    await verifyOrder({
      ...order,
      paymentStatus: 'verified',
      status: order.status === 'draft' ? 'active' : order.status,
      verifiedBy: currentUser?.id || 'u1',
      verifiedAt: new Date().toISOString(),
    })
  }

  async function handleReject() {
    await updateOrder({
      ...order,
      paymentStatus: 'rejected',
      verifiedBy: currentUser?.id || 'u1',
      verifiedAt: new Date().toISOString(),
    }, 'Status pembayaran berhasil ditolak.')
  }

  async function handleUploadProof(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      await updateOrder({
        ...order,
        paymentProof: {
          name: file.name,
          type: file.type,
          size: file.size,
          preview: typeof reader.result === 'string' ? reader.result : '',
        },
      }, 'Bukti pembayaran berhasil diunggah.')
    }

    if (file.type === 'application/pdf') {
      reader.readAsDataURL(file)
      return
    }

    reader.readAsDataURL(file)
  }

  async function handleStatusUpdate(nextStatus) {
    await updateOrder({ ...order, status: nextStatus })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link to="/orders" className="hover:text-slate-700">
                Daftar Pesanan
              </Link>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Detail Pesanan</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">{order.orderNumber}</h1>
            <p className="mt-2 text-sm text-slate-500">Detail lengkap pesanan, status transfer, dan riwayat pengiriman customer.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={order.status}>{orderStatusLabel(order.status)}</Badge>
            <TransferBadge status={order.paymentStatus} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] p-2 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap gap-2">
                {visibleTabs.map((tab) => {
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
              <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="grid gap-6 lg:grid-cols-2">
                  <DetailSection icon={ReceiptText} title="Info Pesanan">
                    <InfoRow label="No Order" value={order.orderNumber} />
                    <InfoRow label="Tanggal Dibuat" value={formatDateTime(order.createdAt)} />
                    <InfoRow label="Dibuat Oleh" value={salesUser?.name || '-'} />
                    <InfoRow label="Program" value={program?.name || order.programId} />
                    <InfoRow label="Meal Type" value={mealTypeLabel(order.mealType)} />
                    <InfoRow label="Durasi" value={durationLabel(order.durationType)} />
                    <InfoRow label="Periode" value={`${formatDate(order.startDate)} - ${formatDate(order.endDate)}`} />
                    <InfoRow label="Sumber Order" value={sourceLabel(order.orderSource)} badge />
                  </DetailSection>

                  <DetailSection icon={User} title="Info Customer">
                    <InfoRow label="Nama" value={customer?.name || '-'} />
                    <InfoRow label="HP" value={customer?.phone || '-'} />
                    <InfoRow label="Email" value={customer?.email || '-'} />
                    <InfoRow label="Alamat Utama" value={customer?.addressPrimary || '-'} multiline />
                    <InfoRow label="Alamat Alternatif" value={customer?.addressAlternate || '-'} multiline />
                    <InfoRow label="Catatan Alamat" value={customer?.addressNotes || '-'} multiline />
                  </DetailSection>
                </div>

                <div className="mt-6 grid gap-4">
                  <DetailBlock title="Catatan Diet & Pantangan" value={order.dietaryNotes || customer?.dietaryNotes || '-'} />
                  <DetailBlock title="Catatan Khusus Pengiriman" value={order.specialNotes || '-'} />
                </div>
              </Card>
            ) : null}

            {activeTab === 'payment' && currentUser?.role === 'superadmin' ? (
              <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                  <DetailSection icon={Wallet} title="Pembayaran">
                    <InfoRow label="Nominal Transfer" value={formatIDR(order.paymentAmount || order.pricePromo || 0)} />
                    <InfoRow label="Metode Pembayaran" value={paymentMethodLabel(order.paymentMethod)} />
                    <InfoRow label="Status Verifikasi" value={transferLabel(order.paymentStatus)} badgeStatus={mapTransferBadge(order.paymentStatus)} />
                    <InfoRow label="Diverifikasi Oleh" value={verifier?.name || '-'} />
                    <InfoRow label="Waktu Verifikasi" value={order.verifiedAt ? formatDateTime(order.verifiedAt) : '-'} />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button onClick={handleVerify} className="gap-2 rounded-2xl bg-emerald-600 px-4 py-3 hover:bg-emerald-700">
                        <CheckCircle2 size={16} />
                        Verifikasi
                      </Button>
                      <Button onClick={handleReject} variant="danger" className="gap-2 rounded-2xl px-4 py-3">
                        <XCircle size={16} />
                        Tolak
                      </Button>
                    </div>
                  </DetailSection>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Bukti Transfer</div>
                    <div className="mt-3">
                      {order.paymentProof?.preview ? (
                        order.paymentProof.type === 'application/pdf' ? (
                          <iframe title="Bukti transfer PDF" src={order.paymentProof.preview} className="h-[420px] w-full rounded-2xl border border-slate-200 bg-white" />
                        ) : (
                          <img src={order.paymentProof.preview} alt="Bukti transfer" className="max-h-[420px] w-full rounded-2xl border border-slate-200 object-contain bg-white" />
                        )
                      ) : order.paymentProof?.name ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                          <div className="font-medium text-slate-800">{order.paymentProof.name}</div>
                          <div className="mt-1">Tipe: {order.paymentProof.type || '-'}</div>
                          <div>Ukuran: {order.paymentProof.size ? `${Math.round(order.paymentProof.size / 1024)} KB` : '-'}</div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                          Belum ada bukti transfer yang tersimpan.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {activeTab === 'history' ? (
              <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-slate-900">Riwayat Pengiriman Customer</h2>
                  <p className="text-sm text-slate-500">Timeline pengiriman customer ini dari data rute yang sudah tercatat.</p>
                </div>

                <div className="space-y-4">
                  {customerRouteHistory.length ? (
                    customerRouteHistory.map((item) => (
                      <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-medium text-slate-900">
                              {item.route?.routeLabel || 'Rute'} • {formatDate(item.route?.deliveryDate)}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              Driver: {item.driver?.name || '-'} • Estimasi: {item.estimatedTime || '-'}
                            </div>
                          </div>
                          <Badge status={item.status}>{deliveryStatusLabel(item.status)}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div>Status: {deliveryStatusLabel(item.status)}</div>
                          <div>Terkirim: {item.deliveredAt ? formatDateTime(item.deliveredAt) : '-'}</div>
                          <div className="sm:col-span-2">Catatan: {item.deliveryNotes || order.specialNotes || '-'}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada riwayat pengiriman untuk customer ini.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Status Order</div>
                  <div className="text-sm text-slate-500">Aksi cepat menyesuaikan status transfer dan progres order.</div>
                </div>
                <Badge status={order.status}>{orderStatusLabel(order.status)}</Badge>
              </div>

              <div className="grid gap-3">
                {order.paymentStatus === 'pending' && currentUser?.role === 'superadmin' ? (
                  <>
                    <Button onClick={handleVerify} className="gap-2 rounded-2xl bg-emerald-600 px-4 py-3 hover:bg-emerald-700">
                      <CheckCircle2 size={16} />
                      Verifikasi Transfer
                    </Button>
                    <Button onClick={handleReject} variant="danger" className="gap-2 rounded-2xl px-4 py-3">
                      <XCircle size={16} />
                      Tolak Transfer
                    </Button>
                  </>
                ) : null}

                {order.paymentStatus === 'pending' && currentUser?.role === 'sales' ? (
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-teal px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-dark">
                    <Upload size={16} />
                    Upload Bukti Transfer
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="hidden" onChange={handleUploadProof} />
                  </label>
                ) : null}

                {order.paymentStatus === 'verified' && currentUser?.role === 'address_admin' ? (
                  <Button as={Link} to="/routes/builder" className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
                    <Route size={16} />
                    Tambahkan ke Rute
                  </Button>
                ) : null}

                {order.status === 'active' ? (
                  <>
                    <Button onClick={() => handleStatusUpdate('paused')} variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                      <PauseCircle size={16} />
                      Pause
                    </Button>
                    <Button onClick={() => handleStatusUpdate('completed')} className="gap-2 rounded-2xl bg-gracious-navy px-4 py-3 hover:bg-slate-800">
                      <CheckCircle2 size={16} />
                      Complete Early
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>

            <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-5">
                <div className="text-sm font-semibold text-slate-900">Zona & Rute</div>
                <div className="text-sm text-slate-500">Ringkasan assign area dan histori rute terbaru.</div>
              </div>
              <div className="space-y-4 text-sm text-slate-600">
                <InfoRow label="Zona" value={zone?.name || '-'} />
                <InfoRow
                  label="Rute Terakhir"
                  value={latestRoute?.route ? `${latestRoute.route.routeLabel} • ${formatDate(latestRoute.route.deliveryDate)}` : '-'}
                />
                <InfoRow label="Driver" value={latestRoute?.driver?.name || '-'} />
                <InfoRow label="Status Titik" value={latestRoute ? deliveryStatusLabel(latestRoute.status) : '-'} />
              </div>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Customer verified akan masuk ke pool assign rute dan bisa diproses oleh admin pengatur alamat.
              </div>
            </Card>

            <Button variant="secondary" onClick={() => navigate('/orders')} className="w-full rounded-2xl px-4 py-3">
              Kembali ke daftar pesanan
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center gap-2 text-slate-900">
        <Icon size={18} className="text-teal" />
        <div className="font-semibold">{title}</div>
      </div>
      <div className="space-y-3 text-sm text-slate-600">{children}</div>
    </div>
  )
}

function DetailBlock({ title, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 whitespace-pre-line text-sm text-slate-600">{value}</div>
    </div>
  )
}

function InfoRow({ label, value, multiline = false, badge = false, badgeStatus = 'pending' }) {
  return (
    <div className={`border-b border-slate-200/80 pb-3 last:border-0 last:pb-0 ${multiline ? '' : 'flex items-start justify-between gap-3'}`}>
      <div className="text-slate-500">{label}</div>
      <div className={`${multiline ? 'mt-1' : 'text-right'} font-medium text-slate-700`}>
        {badge ? <Badge status={badgeStatus}>{value}</Badge> : value}
      </div>
    </div>
  )
}

function TransferBadge({ status }) {
  return <Badge status={mapTransferBadge(status)}>{transferLabel(status)}</Badge>
}

function mapTransferBadge(status) {
  return (
    {
      pending: 'pending',
      verified: 'delivered',
      rejected: 'failed',
    }[status] || 'draft'
  )
}

function transferLabel(status) {
  return (
    {
      pending: 'Menunggu Verifikasi',
      verified: 'Terverifikasi',
      rejected: 'Ditolak',
    }[status] || status || '-'
  )
}

function paymentMethodLabel(value) {
  return (
    {
      bank_transfer: 'Bank Transfer',
      transfer_bca: 'Transfer BCA',
      transfer_bri: 'Transfer BRI',
      transfer_mandiri: 'Transfer Mandiri',
      transfer_bni: 'Transfer BNI',
      qris: 'QRIS',
      shopee_pay: 'Shopee Pay',
      tokopedia_pay: 'Tokopedia Pay',
    }[value] || value || '-'
  )
}

function sourceLabel(value) {
  return (
    {
      manual: 'WA',
      shopee: 'Shopee',
      tokopedia: 'Tokopedia',
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

function deliveryStatusLabel(value) {
  return (
    {
      pending: 'Belum',
      delivered: 'Selesai',
      failed: 'Gagal',
      completed: 'Selesai',
      in_progress: 'Berjalan',
    }[value] || value || '-'
  )
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
