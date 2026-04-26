import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Map, MapPinned, Printer, Truck, UserRoundSearch, Users } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Badge, Button, Card, Table } from '../components/ui.jsx'

const TODAY_ISO = '2026-04-26'
const YESTERDAY_ISO = '2026-04-25'

export default function DashboardAddress() {
  const { deliveryRoutes, deliveryRouteItems, customers, orders, users, zones, programs } = useApp()

  const todaysRoutes = deliveryRoutes.filter((route) => route.deliveryDate === TODAY_ISO)
  const finalizedCount = todaysRoutes.filter((route) => route.status === 'finalized').length
  const draftCount = todaysRoutes.filter((route) => route.status === 'draft').length
  const todayRouteIds = new Set(todaysRoutes.map((route) => route.id))
  const todayRouteItems = deliveryRouteItems.filter((item) => todayRouteIds.has(item.routeId))
  const deliveredToday = todayRouteItems.filter((item) => item.status === 'delivered').length

  const routeCards = todaysRoutes.map((route) => buildRouteCard(route, deliveryRouteItems, customers, orders, users, zones, programs))
  const attentionRows = buildAttentionRows(todayRouteItems, customers, orders)
  const unassignedRows = buildUnassignedRows(orders, deliveryRouteItems, customers, zones, programs)

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fef9ee_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)] sm:px-8">
          {todaysRoutes.length === 0 ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                  <AlertTriangle size={14} />
                  Route Alert
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gracious-navy">
                  Rute hari ini belum dibuat!
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Belum ada rute pengiriman untuk {TODAY_ISO}. Buat rute sekarang agar driver bisa mulai distribusi tepat waktu.
                </p>
              </div>
              <Button as={Link} to="/routes/builder" className="rounded-2xl px-6 py-3 text-base bg-teal hover:bg-teal-dark">
                <Map size={18} />
                Buat Rute Sekarang
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Route Control</div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gracious-navy">
                    Status Rute Hari Ini
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Pantau progres pengiriman, finalisasi rute, dan customer yang perlu penyesuaian alamat.
                  </p>
                </div>
                <div className="rounded-2xl border border-teal/15 bg-white/80 px-4 py-3 text-sm text-slate-600">
                  <div className="font-medium text-slate-900">
                    {deliveredToday} dari {todayRouteItems.length} customer hari ini sudah terdeliver
                  </div>
                  <div className="mt-1">Tetap prioritaskan rute yang masih draft sebelum driver berangkat.</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard title="Rute Total" value={todaysRoutes.length} icon={Map} tint="teal" />
                <SummaryCard title="Sudah Finalized" value={finalizedCount} icon={CheckCircle2} tint="green" />
                <SummaryCard title="Masih Draft" value={draftCount} icon={AlertTriangle} tint="amber" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Progress Pengiriman Hari Ini</span>
                  <span>
                    {deliveredToday} / {todayRouteItems.length}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${todayRouteItems.length ? (deliveredToday / todayRouteItems.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cards Rute per Driver</h2>
            <p className="text-sm text-slate-500">Setiap card merangkum rute aktif per driver untuk pengiriman hari ini.</p>
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
                    <span>Zona</span>
                    <span className="font-medium text-slate-800">{route.zoneName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Jumlah titik</span>
                    <span className="font-medium text-slate-800">{route.pointCount}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer pertama
                  </div>
                  <div className="space-y-2">
                    {route.customersPreview.map((customer) => (
                      <div key={customer.id} className="flex items-start justify-between gap-3 text-sm">
                        <div className="font-medium text-slate-800">{customer.name}</div>
                        <div className="text-right text-slate-500">{customer.packageShort}</div>
                      </div>
                    ))}
                    {route.remainingCustomers > 0 ? (
                      <div className="pt-1 text-xs font-medium text-slate-500">
                        ...dan {route.remainingCustomers} customer lainnya
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <Button as={Link} to="/routes" variant="secondary" className="flex-1 rounded-xl">
                    Edit Rute
                  </Button>
                  <Button as={Link} to="/routes" variant="primary" className="flex-1 rounded-xl bg-teal hover:bg-teal-dark">
                    Finalize
                  </Button>
                  <Button as={Link} to="/routes/print" variant="secondary" className="rounded-xl px-3">
                    <Printer size={14} />
                    Print
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Customer Perlu Perhatian</h2>
                <p className="text-sm text-slate-500">Filter otomatis untuk pindah alamat, paket habis, dan catatan khusus.</p>
              </div>
            </div>
            <Table
              columns={[
                { key: 'name', label: 'Nama' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <AttentionBadge status={row.statusKey} label={row.status} />,
                },
                { key: 'note', label: 'Keterangan' },
                {
                  key: 'action',
                  label: 'Aksi',
                  render: (row) => (
                    <div className="flex gap-2">
                      <Button as={Link} to="/customers" variant="secondary" className="rounded-xl px-3 py-2">
                        {row.statusKey === 'pindah_alamat' ? 'Edit Alamat' : 'Update Status'}
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={attentionRows}
              empty="Belum ada customer yang butuh tindakan khusus hari ini."
            />
          </Card>

          <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Customer Baru Belum Di-Assign</h2>
                <p className="text-sm text-slate-500">Order verified yang belum masuk rute manapun untuk pengiriman aktif.</p>
              </div>
            </div>
            <div className="space-y-3">
              {unassignedRows.length ? (
                unassignedRows.map((row) => (
                  <div key={row.orderId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-sm text-slate-500">{row.address}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-teal/10 px-2.5 py-1 font-medium text-teal-dark">
                            Zona: {row.zone}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
                            Paket: {row.packageName}
                          </span>
                        </div>
                      </div>
                      <Button as={Link} to="/routes/builder" variant="primary" className="rounded-xl bg-teal hover:bg-teal-dark">
                        Assign ke Rute
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Semua order verified yang aktif sudah masuk ke rute hari ini.
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction to="/routes/builder" icon={Map} label="Buat Rute Baru" tint="teal" />
          <QuickAction to="/routes" icon={Truck} label="Daftar Semua Rute" tint="navy" />
          <QuickAction to="/customers" icon={Users} label="Data Customer" tint="gold" />
          <QuickAction to="/routes/print" icon={Printer} label="Print Semua Rute" tint="green" />
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, tint }) {
  const tintClasses = {
    teal: 'from-teal/15 to-teal/5 text-teal border-teal/10',
    green: 'from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'from-amber-100 to-amber-50 text-amber-700 border-amber-100',
  }

  return (
    <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            {value.toLocaleString('id-ID')}
          </div>
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl border bg-gradient-to-br ${tintClasses[tint]}`}>
          <Icon size={22} />
        </div>
      </div>
    </Card>
  )
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
      className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
    >
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tintClasses[tint]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 font-medium text-slate-800">{label}</div>
      <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5" />
    </Link>
  )
}

function AttentionBadge({ status, label }) {
  const map = {
    pindah_alamat: 'bg-rose-100 text-rose-700',
    habis: 'bg-amber-100 text-amber-800',
    catatan: 'bg-sky-100 text-sky-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-700'}`}>{label}</span>
}

function buildRouteCard(route, deliveryRouteItems, customers, orders, users, zones, programs) {
  const driver = users.find((user) => user.id === route.driverId)
  const zone = zones.find((item) => item.id === route.zoneId)
  const items = deliveryRouteItems.filter((item) => item.routeId === route.id)

  const customersPreview = items.slice(0, 3).map((item) => {
    const customer = customers.find((entry) => entry.id === item.customerId)
    const order = orders.find((entry) => entry.id === item.orderId)
    const program = programs.find((entry) => entry.id === order?.programId)
    return {
      id: item.id,
      name: customer?.name || item.customerId,
      packageShort: shortProgramLabel(program?.name || order?.programId || '-'),
    }
  })

  return {
    id: route.id,
    label: route.routeLabel,
    driverName: driver?.name || 'Driver belum ditentukan',
    zoneName: zone?.name || route.zoneId,
    pointCount: route.routePointCount || items.length,
    status: route.status,
    statusLabel: routeStatusLabel(route.status),
    customersPreview,
    remainingCustomers: Math.max(0, items.length - customersPreview.length),
  }
}

function buildAttentionRows(todayRouteItems, customers, orders) {
  const rows = []
  const seen = new Set()

  for (const item of todayRouteItems) {
    const customer = customers.find((entry) => entry.id === item.customerId)
    const order = orders.find((entry) => entry.id === item.orderId)
    if (!customer || !order) continue

    if ((customer.addressNotes || '').toLowerCase().includes('pindah') || item.statusLabel === 'pindah_alamat') {
      const key = `${customer.id}-pindah`
      if (!seen.has(key)) {
        rows.push({
          id: key,
          name: customer.name,
          status: 'Pindah Alamat',
          statusKey: 'pindah_alamat',
          note: customer.addressNotes || 'Perlu konfirmasi alamat baru',
        })
        seen.add(key)
      }
    }

    if (order.endDate === TODAY_ISO || order.endDate === YESTERDAY_ISO) {
      const key = `${customer.id}-habis`
      if (!seen.has(key)) {
        rows.push({
          id: key,
          name: customer.name,
          status: 'Paket Habis',
          statusKey: 'habis',
          note: `Paket berakhir pada ${order.endDate}`,
        })
        seen.add(key)
      }
    }

    if (order.specialNotes) {
      const key = `${customer.id}-catatan`
      if (!seen.has(key)) {
        rows.push({
          id: key,
          name: customer.name,
          status: 'Catatan Khusus',
          statusKey: 'catatan',
          note: order.specialNotes,
        })
        seen.add(key)
      }
    }
  }

  return rows.slice(0, 12)
}

function buildUnassignedRows(orders, deliveryRouteItems, customers, zones, programs) {
  const assignedOrderIds = new Set(deliveryRouteItems.map((item) => item.orderId))

  return orders
    .filter(
      (order) =>
        order.paymentStatus === 'verified' &&
        order.status === 'active' &&
        order.startDate <= TODAY_ISO &&
        order.endDate >= TODAY_ISO &&
        !assignedOrderIds.has(order.id),
    )
    .map((order) => {
      const customer = customers.find((entry) => entry.id === order.customerId)
      const zone = zones.find((entry) => entry.id === customer?.zoneId || entry.id === order.zoneId)
      const program = programs.find((entry) => entry.id === order.programId)
      return {
        orderId: order.id,
        name: customer?.name || order.customerId,
        address: customer?.addressPrimary || '-',
        zone: zone?.name || 'Zona belum ada',
        packageName: shortProgramLabel(program?.name || order.programId),
      }
    })
    .slice(0, 10)
}

function shortProgramLabel(name) {
  return String(name)
    .replace('Program', '')
    .replace('Diet', '')
    .replace(/\s+/g, ' ')
    .trim()
}

function routeStatusLabel(status) {
  return (
    {
      draft: 'Draft',
      finalized: 'Finalized',
      in_progress: 'Berjalan',
      completed: 'Selesai',
    }[status] || status
  )
}
