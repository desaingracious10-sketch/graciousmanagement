import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Map,
  MapPin,
  Package,
  Plus,
  Printer,
  TrendingUp,
  Truck,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { uploadMenuImage } from '../lib/imageUpload.js'
import { Badge, Button, Card, Field, Input, Table, formatDate, formatDateTime, formatIDR } from '../components/ui.jsx'

export default function DashboardSuperAdmin() {
  const {
    users,
    customers,
    orders,
    deliveryRoutes,
    deliveryRouteItems,
    programs,
    activityLogs,
    weeklyMenus,
    addWeeklyMenu,
    updateWeeklyMenu,
    showToast,
  } = useApp()
  const [verificationModal, setVerificationModal] = useState(null)

  const todayIso = '2026-04-26'
  const today = new Date(`${todayIso}T00:00:00`)

  const metrics = useMemo(() => {
    const activeTodayOrders = orders.filter((order) =>
      order.status === 'active' && order.startDate <= todayIso && order.endDate >= todayIso,
    )
    const uniqueActiveCustomers = new Set(activeTodayOrders.map((order) => order.customerId))

    const todaysRoutes = deliveryRoutes.filter((route) => route.deliveryDate === todayIso)
    const finalizedRoutes = todaysRoutes.filter((route) => route.status === 'finalized')
    const draftRoutes = todaysRoutes.filter((route) => route.status === 'draft')

    const pendingVerificationOrders = orders.filter((order) => order.paymentStatus === 'pending')
    const activeMonthOrders = orders.filter((order) => order.status === 'active' && order.startDate.startsWith('2026-04'))
    const verifiedThisMonth = orders.filter(
      (order) => order.paymentStatus === 'verified' && order.createdAt?.startsWith('2026-04'),
    )
    const verifiedLastMonth = orders.filter(
      (order) => order.paymentStatus === 'verified' && order.createdAt?.startsWith('2026-03'),
    )
    const revenueThisMonth = verifiedThisMonth.reduce((sum, order) => sum + (order.paymentAmount || 0), 0)
    const revenueLastMonth = verifiedLastMonth.reduce((sum, order) => sum + (order.paymentAmount || 0), 0)
    const revenueDelta = revenueLastMonth
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 100

    const activeDrivers = users.filter((user) => user.role === 'driver' && user.isActive)
    const driversOnDuty = new Set(todaysRoutes.map((route) => route.driverId))

    const nearlyExpiredOrders = orders.filter((order) => {
      if (order.status !== 'active') return false
      const endDate = new Date(`${order.endDate}T00:00:00`)
      const diffDays = Math.round((endDate - today) / 86400000)
      return diffDays >= 0 && diffDays <= 3
    })

    const movedAddressItems = deliveryRouteItems.filter((item) => item.statusLabel === 'pindah_alamat')

    return {
      totalCustomerAktif: uniqueActiveCustomers.size,
      todaysRoutes,
      finalizedRoutes: finalizedRoutes.length,
      draftRoutes: draftRoutes.length,
      pendingVerificationOrders,
      activeMonthOrders: activeMonthOrders.length,
      revenueThisMonth,
      revenueLastMonth,
      revenueDelta,
      activeDrivers: activeDrivers.length,
      driversOnDuty: driversOnDuty.size,
      nearlyExpiredOrders,
      movedAddressItems: movedAddressItems.length,
    }
  }, [orders, deliveryRoutes, deliveryRouteItems, users])

  const revenueChartData = useMemo(() => buildRevenueChartData(orders), [orders])
  const verificationRows = useMemo(
    () => metrics.pendingVerificationOrders.slice(0, 5).map((order) => buildVerificationRow(order, customers, programs, users)),
    [metrics.pendingVerificationOrders, customers, programs, users],
  )
  const routeCards = useMemo(
    () => metrics.todaysRoutes.map((route) => buildRouteCard(route, deliveryRouteItems, users)),
    [metrics.todaysRoutes, deliveryRouteItems, users],
  )
  const timelineItems = useMemo(
    () => buildTimeline(activityLogs, orders, deliveryRoutes, customers, users),
    [activityLogs, orders, deliveryRoutes, customers, users],
  )

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fef9ee_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)] sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Gracious Control Center</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gracious-navy">
                Selamat pagi, Admin Utama 👋
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Minggu, 26 April 2026 | Hari pengiriman aktif
              </p>
            </div>
            <div className="rounded-2xl border border-teal/15 bg-white/80 px-4 py-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">{metrics.todaysRoutes.length} rute aktif terjadwal hari ini</div>
              <div className="mt-1">Pantau verifikasi transfer, kesiapan driver, dan customer yang hampir habis paket.</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Customer Aktif Hari Ini"
            value={metrics.totalCustomerAktif}
            icon={Users}
            color="teal"
            href="/customers?filter=active"
          />
          <MetricCard
            title="Rute Hari Ini"
            value={metrics.todaysRoutes.length}
            icon={Map}
            color="navy"
            href="/routes"
            subtitle={`${metrics.finalizedRoutes} sudah finalized, ${metrics.draftRoutes} masih draft`}
          />
          <MetricCard
            title="Pesanan Baru (Belum Diverifikasi)"
            value={metrics.pendingVerificationOrders.length}
            icon={AlertCircle}
            color={metrics.pendingVerificationOrders.length > 0 ? 'orange' : 'teal'}
            href="/orders?filter=pending"
          />
          <MetricCard
            title="Pesanan Aktif Bulan Ini"
            value={metrics.activeMonthOrders}
            icon={Package}
            color="teal"
          />
          <MetricCard
            title="Revenue Bulan Ini"
            value={metrics.revenueThisMonth}
            formatter={(value) => formatIDR(value)}
            icon={TrendingUp}
            color="green"
            subtitle={`${metrics.revenueDelta >= 0 ? '+' : ''}${metrics.revenueDelta.toFixed(1)}% vs bulan lalu`}
          />
          <MetricCard
            title="Total Driver Aktif"
            value={metrics.activeDrivers}
            icon={Truck}
            color="navy"
            subtitle={`${metrics.driversOnDuty} sedang bertugas hari ini`}
          />
          <MetricCard
            title="Customer Hampir Habis Paket"
            value={metrics.nearlyExpiredOrders.length}
            icon={Clock3}
            color="yellow"
            href="/customers?filter=expiring"
          />
          <MetricCard
            title="Pindah Alamat Perlu Update"
            value={metrics.movedAddressItems}
            icon={MapPin}
            color="red"
            href="/customers?filter=moved"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Revenue 6 Bulan Terakhir</h2>
                <p className="text-sm text-slate-500">Pantau tren pemasukan verified order per bulan.</p>
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `${value} jt`}
                  />
                  <Tooltip formatter={(value) => formatIDR(value * 1000000)} />
                  <Bar dataKey="revenueMillions" radius={[12, 12, 4, 4]} fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                <p className="text-sm text-slate-500">Akses cepat untuk tugas admin yang paling sering dipakai.</p>
              </div>
            </div>
            <div className="grid gap-3">
              <QuickAction to="/users" icon={UserPlus} label="Tambah User" tint="teal" />
              <QuickAction to="/orders" icon={Package} label="Lihat Semua Order" tint="navy" />
              <QuickAction to="/routes/builder" icon={Map} label="Buat Rute" tint="gold" />
              <QuickAction to="/dashboard/admin" icon={TrendingUp} label="Laporan" tint="green" />
            </div>
          </Card>
        </section>

        <WeeklyMenuSection
          weeklyMenus={weeklyMenus}
          addWeeklyMenu={addWeeklyMenu}
          updateWeeklyMenu={updateWeeklyMenu}
          showToast={showToast}
        />

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Daftar Pesanan Perlu Verifikasi</h2>
                <p className="text-sm text-slate-500">Maksimal 5 pesanan terbaru yang masih pending verifikasi transfer.</p>
              </div>
              <Badge status="pending">{metrics.pendingVerificationOrders.length} pending</Badge>
            </div>
            <Table
              columns={[
                { key: 'customer', label: 'Nama Customer' },
                { key: 'program', label: 'Paket' },
                { key: 'amount', label: 'Nominal' },
                { key: 'date', label: 'Tanggal Input' },
                { key: 'sales', label: 'Sales' },
                {
                  key: 'action',
                  label: '',
                  render: (row) => (
                    <button
                      type="button"
                      onClick={() => setVerificationModal(row)}
                      className="inline-flex rounded-xl bg-teal px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-dark"
                    >
                      Verifikasi
                    </button>
                  ),
                },
              ]}
              rows={verificationRows}
              empty="Tidak ada pesanan pending verifikasi."
            />
            <div className="mt-4 flex justify-end">
              <Link to="/orders?filter=pending" className="inline-flex items-center gap-2 text-sm font-medium text-teal-dark hover:text-teal">
                Lihat semua {metrics.pendingVerificationOrders.length} pesanan
                <ArrowRight size={14} />
              </Link>
            </div>
          </Card>

          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Activity Log Terbaru</h2>
                <p className="text-sm text-slate-500">10 aktivitas terbaru lintas order, route, customer, dan user.</p>
              </div>
            </div>
            <div className="space-y-4">
              {timelineItems.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className={`mt-1 grid h-10 w-10 place-items-center rounded-2xl ${item.iconBg}`}>
                    <item.icon size={18} className={item.iconColor} />
                  </div>
                  <div className="flex-1 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="text-sm font-medium text-slate-800">{item.description}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.userName} • {item.relativeTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Status Rute Hari Ini</h2>
            <p className="text-sm text-slate-500">Pantau setiap rute yang aktif hari ini beserta progres titik pengiriman.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {routeCards.map((route) => (
              <Card key={route.id} className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{route.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{route.driverName}</div>
                  </div>
                  <Badge status={route.status}>{route.statusLabel}</Badge>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Jumlah titik</span>
                    <span className="font-medium text-slate-800">{route.totalPoints}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Zona</span>
                    <span className="font-medium text-slate-800">{route.zoneName}</span>
                  </div>
                </div>
                {route.status === 'in_progress' ? (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span>
                        {route.completedPoints} / {route.totalPoints} titik
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${route.totalPoints ? (route.completedPoints / route.totalPoints) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="mt-5 flex gap-3">
                  <Button as={Link} to="/routes" variant="secondary" className="flex-1 rounded-xl">
                    Lihat Detail
                  </Button>
                  <Button as={Link} to="/routes/print" variant="primary" className="flex-1 rounded-xl bg-gracious-navy hover:bg-[#17314f]">
                    <Printer size={14} />
                    Print
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BottomAction to="/users" icon={Plus} label="Tambah User" />
          <BottomAction to="/orders" icon={Package} label="Lihat Semua Order" />
          <BottomAction to="/routes/builder" icon={Map} label="Buat Rute" />
          <BottomAction to="/dashboard/admin" icon={TrendingUp} label="Laporan" />
        </section>
      </div>

      {verificationModal ? (
        <VerificationModal
          row={verificationRows.find((item) => item.id === verificationModal.id) || verificationModal}
          onClose={() => setVerificationModal(null)}
        />
      ) : null}
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon: Icon, color, href, formatter = defaultFormatter }) {
  const displayValue = useCountUp(value)
  const palette = {
    teal: 'from-teal/15 to-teal/5 text-teal border-teal/10',
    navy: 'from-gracious-navy/15 to-gracious-navy/5 text-gracious-navy border-gracious-navy/10',
    orange: 'from-amber-100 to-orange-50 text-amber-600 border-amber-100',
    green: 'from-emerald-100 to-emerald-50 text-emerald-600 border-emerald-100',
    yellow: 'from-amber-100 to-yellow-50 text-amber-600 border-amber-100',
    red: 'from-rose-100 to-rose-50 text-rose-600 border-rose-100',
  }

  const content = (
    <Card className="group rounded-[28px] border p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {formatter(displayValue)}
          </div>
          {subtitle ? <div className="mt-2 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl border bg-gradient-to-br ${palette[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </Card>
  )

  return href ? <Link to={href}>{content}</Link> : content
}

function QuickAction({ to, icon: Icon, label, tint }) {
  const tintClasses = {
    teal: 'bg-teal/10 text-teal-dark',
    navy: 'bg-gracious-navy/10 text-gracious-navy',
    gold: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:bg-white hover:shadow-sm"
    >
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tintClasses[tint]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 text-sm font-medium text-slate-800">{label}</div>
      <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5" />
    </Link>
  )
}

function BottomAction({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-teal/20 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal/10 text-teal-dark">
          <Icon size={18} />
        </div>
        <span className="font-medium text-slate-800">{label}</span>
      </div>
      <ArrowRight size={16} className="text-slate-400" />
    </Link>
  )
}

function VerificationModal({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal-dark">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Konfirmasi Verifikasi</h3>
            <p className="text-sm text-slate-500">Simulasi verifikasi pembayaran untuk pesanan ini.</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">{row.customer}</div>
          <div className="mt-1">{row.program}</div>
          <div className="mt-1">{row.amount}</div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" className="rounded-xl" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="primary" className="rounded-xl bg-teal hover:bg-teal-dark" onClick={onClose}>
            Verifikasi
          </Button>
        </div>
      </div>
    </div>
  )
}

function WeeklyMenuSection({ weeklyMenus, addWeeklyMenu, updateWeeklyMenu, showToast }) {
  const [weekLabel, setWeekLabel] = useState(() => getCurrentWeekLabel())
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekStart())
  const [dayName, setDayName] = useState('Monday')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const recentMenus = useMemo(
    () =>
      [...weeklyMenus]
        .sort((a, b) => new Date(b.weekStart || b.createdAt || 0) - new Date(a.weekStart || a.createdAt || 0))
        .slice(0, 6),
    [weeklyMenus],
  )

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleUpload() {
    if (!selectedFile) {
      showToast({ tone: 'warning', message: 'Pilih gambar menu dulu.' })
      return
    }

    setIsUploading(true)
    try {
      const uploaded = await uploadMenuImage(selectedFile, weekLabel, dayName)
      const existing = weeklyMenus.find(
        (item) => item.weekLabel === weekLabel && item.dayName === dayName,
      )

      const payload = {
        id: existing?.id || `wm-${Date.now()}`,
        weekLabel,
        weekStart,
        dayName,
        imagePath: uploaded.path,
        imageUrl: uploaded.publicUrl,
        updatedAt: new Date().toISOString(),
      }

      if (existing?.id) await updateWeeklyMenu(payload, 'Menu mingguan berhasil diperbarui.')
      else await addWeeklyMenu({ ...payload, createdAt: new Date().toISOString() }, 'Menu mingguan berhasil disimpan.')

      setSelectedFile(null)
      setPreviewUrl('')
    } catch (error) {
      console.error('[Gracious] weekly menu upload failed:', error)
      showToast({ tone: 'error', message: error?.message || 'Upload menu mingguan gagal.' })
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Weekly Menu</h2>
            <p className="text-sm text-slate-500">Upload gambar menu per hari untuk kebutuhan operasional minggu berjalan.</p>
          </div>
          <ImagePlus className="text-teal" size={20} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Week Label">
            <Input value={weekLabel} onChange={(event) => setWeekLabel(event.target.value)} />
          </Field>
          <Field label="Week Start">
            <Input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
          </Field>
          <Field label="Hari">
            <select value={dayName} onChange={(event) => setDayName(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-600">
            <Upload size={16} />
            Pilih gambar menu
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        {previewUrl ? <img src={previewUrl} alt="Preview weekly menu" className="mt-4 h-48 w-full rounded-[24px] object-cover" /> : null}

        <Button onClick={() => void handleUpload()} disabled={isUploading} className="mt-5 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          {isUploading ? 'Mengunggah...' : 'Upload Menu Image'}
        </Button>
      </Card>

      <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Menu Terbaru</h2>
          <p className="text-sm text-slate-500">Riwayat singkat menu mingguan yang sudah tersimpan.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {recentMenus.length ? (
            recentMenus.map((menu) => (
              <div key={menu.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                {menu.imageUrl ? <img src={menu.imageUrl} alt={`${menu.dayName} menu`} className="h-40 w-full object-cover" /> : null}
                <div className="p-4">
                  <div className="font-medium text-slate-900">{menu.dayName}</div>
                  <div className="mt-1 text-sm text-slate-500">{menu.weekLabel || menu.weekStart}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 md:col-span-2">
              Belum ada weekly menu yang tersimpan.
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

function buildRevenueChartData(orders) {
  const months = [
    { key: '2025-11', monthLabel: 'Nov' },
    { key: '2025-12', monthLabel: 'Des' },
    { key: '2026-01', monthLabel: 'Jan' },
    { key: '2026-02', monthLabel: 'Feb' },
    { key: '2026-03', monthLabel: 'Mar' },
    { key: '2026-04', monthLabel: 'Apr' },
  ]

  return months.map((month) => {
    const total = orders
      .filter((order) => order.paymentStatus === 'verified' && order.createdAt?.startsWith(month.key))
      .reduce((sum, order) => sum + (order.paymentAmount || 0), 0)

    return {
      ...month,
      revenueMillions: Number((total / 1000000).toFixed(1)),
    }
  })
}

function buildVerificationRow(order, customers, programs, users) {
  const customer = customers.find((item) => item.id === order.customerId)
  const program = programs.find((item) => item.id === order.programId)
  const sales = users.find((item) => item.id === order.createdBy)

  return {
    id: order.id,
    customer: customer?.name || order.customerId,
    program: `${program?.name || order.programId} • ${mealLabel(order.mealType)}`,
    amount: formatIDR(order.paymentAmount),
    date: formatDateTime(order.createdAt),
    sales: sales?.name || '-',
  }
}

function buildRouteCard(route, deliveryRouteItems, users) {
  const driver = users.find((user) => user.id === route.driverId)
  const routeItems = deliveryRouteItems.filter((item) => item.routeId === route.id)
  const completedPoints = routeItems.filter((item) => item.status === 'delivered').length

  return {
    id: route.id,
    label: route.routeLabel,
    driverName: driver?.name || 'Driver belum assigned',
    totalPoints: route.routePointCount || routeItems.length,
    completedPoints,
    status: route.status,
    statusLabel: statusLabel(route.status),
    zoneName: zoneLabel(route.zoneId),
  }
}

function buildTimeline(activityLogs, orders, routes, customers, users) {
  if (activityLogs.length > 0) {
    return activityLogs
      .slice(0, 10)
      .map((log) => ({
        id: log.id,
        description: log.description || log.action || 'Aktivitas sistem',
        relativeTime: timeAgo(log.createdAt).label,
        userName: findUserName(log.userId, users),
        ...activityIcon(log.type),
      }))
  }

  const fallback = [
    ...orders.slice(-4).map((order) => ({
      id: `order-${order.id}`,
      description: `${order.orderNumber} dibuat untuk ${customerName(order.customerId, customers)}`,
      relativeTime: timeAgo(order.createdAt).label,
      relativeMinutes: timeAgo(order.createdAt).minutes,
      userName: findUserName(order.createdBy, users),
      ...activityIcon('order'),
    })),
    ...routes.slice(-3).map((route) => ({
      id: `route-${route.id}`,
      description: `${route.routeLabel} disusun untuk ${route.deliveryDate}`,
      relativeTime: timeAgo(route.createdAt).label,
      relativeMinutes: timeAgo(route.createdAt).minutes,
      userName: findUserName(route.createdBy, users),
      ...activityIcon('route'),
    })),
    ...customers.slice(-2).map((customer) => ({
      id: `customer-${customer.id}`,
      description: `Customer baru ${customer.name} ditambahkan`,
      relativeTime: timeAgo(customer.createdAt).label,
      relativeMinutes: timeAgo(customer.createdAt).minutes,
      userName: 'Sistem',
      ...activityIcon('customer'),
    })),
    ...users.slice(-1).map((user) => ({
      id: `user-${user.id}`,
      description: `Akun ${user.name} aktif di dashboard`,
      relativeTime: timeAgo(user.createdAt).label,
      relativeMinutes: timeAgo(user.createdAt).minutes,
      userName: 'Sistem',
      ...activityIcon('user'),
    })),
  ]

  return fallback
    .sort((a, b) => b.relativeMinutes - a.relativeMinutes)
    .slice(0, 10)
    .map(({ relativeMinutes, ...item }) => item)
}

function activityIcon(type) {
  switch (type) {
    case 'route':
      return { icon: Map, iconBg: 'bg-gracious-navy/10', iconColor: 'text-gracious-navy' }
    case 'customer':
      return { icon: Users, iconBg: 'bg-amber-100', iconColor: 'text-amber-700' }
    case 'user':
      return { icon: UserPlus, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' }
    default:
      return { icon: Package, iconBg: 'bg-teal/10', iconColor: 'text-teal-dark' }
  }
}

function customerName(customerId, customers) {
  return customers.find((item) => item.id === customerId)?.name || customerId
}

function findUserName(userId, users) {
  return users.find((item) => item.id === userId)?.name || 'Sistem'
}

function zoneLabel(zoneId) {
  const labels = {
    z1: 'Jakarta Selatan',
    z6: 'Bekasi',
    z7: 'Tangerang Selatan',
  }
  return labels[zoneId] || zoneId || '-'
}

function statusLabel(status) {
  return (
    {
      draft: 'Draft',
      finalized: 'Finalized',
      in_progress: 'Berjalan',
      completed: 'Selesai',
    }[status] || status
  )
}

function mealLabel(value) {
  return (
    {
      lunch_only: 'Lunch Only',
      dinner_only: 'Dinner Only',
      lunch_dinner: 'Lunch + Dinner',
    }[value] || value
  )
}

function defaultFormatter(value) {
  return Number(value).toLocaleString('id-ID')
}

function getCurrentWeekStart() {
  const date = new Date()
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function getCurrentWeekLabel() {
  return `Week of ${formatDate(getCurrentWeekStart())}`
}

function useCountUp(target) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const numericTarget = Number(target) || 0
    let frameId = 0
    const startedAt = performance.now()
    const duration = 900

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplay(Math.round(numericTarget * eased))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [target])

  return display
}

function timeAgo(dateString) {
  const now = new Date('2026-04-26T09:45:23')
  const then = new Date(dateString)
  const diffMinutes = Math.max(1, Math.round((now - then) / 60000))

  if (diffMinutes < 60) return { label: `${diffMinutes} menit lalu`, minutes: diffMinutes }
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return { label: `${diffHours} jam lalu`, minutes: diffMinutes }
  const diffDays = Math.round(diffHours / 24)
  return { label: `${diffDays} hari lalu`, minutes: diffMinutes }
}
