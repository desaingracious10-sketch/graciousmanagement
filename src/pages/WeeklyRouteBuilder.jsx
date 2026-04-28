import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MapPin,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Badge, Button, Card, Field, Select } from '../components/ui.jsx'

// ─── DATE HELPERS ────────────────────────────────────────────────

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toIso(d) {
  const x = startOfDay(d)
  const yyyy = x.getFullYear()
  const mm = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getMonday(d = new Date()) {
  const x = startOfDay(d)
  const dow = x.getDay()
  const diff = (dow + 6) % 7
  x.setDate(x.getDate() - diff)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return startOfDay(x)
}

function formatID(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildBatchLabel(weekStart) {
  const d = new Date(weekStart)
  const monthLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const weekNum = Math.ceil(d.getDate() / 7)
  return `${monthLabel} Minggu ${weekNum}`
}

// ─── MAIN PAGE ───────────────────────────────────────────────────

export default function WeeklyRouteBuilder() {
  const {
    customers,
    orders,
    drivers,
    zones,
    deliveryRoutes,
    deliveryRouteItems,
    addRoute,
    updateRoute,
    finalizeRoute,
    addRouteItem,
    refreshData,
    showToast,
    confirmAction,
  } = useApp()

  // Default ke MINGGU DEPAN (paling sering dipakai admin alamat)
  const [weekStart, setWeekStart] = useState(() => addDays(getMonday(), 7))
  const [showGuide, setShowGuide] = useState(true)
  const [printMode, setPrintMode] = useState(false)

  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart])
  const weekStartIso = toIso(weekStart)
  const weekEndIso = toIso(weekEnd)
  const batchLabel = buildBatchLabel(weekStart)

  // Lookup maps
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers])

  // Routes minggu yang dipilih
  const weekRoutes = useMemo(
    () => deliveryRoutes.filter((r) => r.weekStart === weekStartIso),
    [deliveryRoutes, weekStartIso],
  )

  // Items minggu ini, keyed by routeId
  const itemsByRoute = useMemo(() => {
    const map = new Map()
    const weekRouteIds = new Set(weekRoutes.map((r) => r.id))
    for (const item of deliveryRouteItems) {
      if (!weekRouteIds.has(item.routeId)) continue
      if (!map.has(item.routeId)) map.set(item.routeId, [])
      map.get(item.routeId).push(item)
    }
    return map
  }, [deliveryRouteItems, weekRoutes])

  // Order yang sudah ter-assign minggu ini
  const assignedOrderIds = useMemo(() => {
    const ids = new Set()
    for (const items of itemsByRoute.values()) {
      for (const item of items) {
        if (item.orderId) ids.add(item.orderId)
      }
    }
    return ids
  }, [itemsByRoute])

  // Customer/order yang aktif minggu ini, BELUM ter-assign
  const unassignedCustomers = useMemo(() => {
    return orders
      .filter((order) => {
        if (order.paymentStatus !== 'verified') return false
        if (['completed', 'cancelled'].includes(order.status)) return false
        if (assignedOrderIds.has(order.id)) return false
        // Order overlap dengan minggu pilihan
        const start = order.startDate || ''
        const end = order.endDate || ''
        if (!start || !end) return false
        return start <= weekEndIso && end >= weekStartIso
      })
      .map((order) => {
        const customer = customerMap.get(order.customerId)
        const zone = customer?.zoneId ? zoneMap.get(customer.zoneId) : null
        return {
          order,
          customer,
          zone,
          zoneId: customer?.zoneId || null,
          zoneName: zone?.name || 'Tanpa Zona',
        }
      })
      .filter((entry) => entry.customer)
      .sort((a, b) => (a.zoneName || '').localeCompare(b.zoneName || ''))
  }, [assignedOrderIds, customerMap, orders, weekEndIso, weekStartIso, zoneMap])

  // Group unassigned by zona
  const unassignedByZone = useMemo(() => {
    const groups = new Map()
    for (const entry of unassignedCustomers) {
      const key = entry.zoneId || '__none__'
      if (!groups.has(key)) groups.set(key, { zoneId: entry.zoneId, zoneName: entry.zoneName, items: [] })
      groups.get(key).items.push(entry)
    }
    return Array.from(groups.values()).sort((a, b) => a.zoneName.localeCompare(b.zoneName))
  }, [unassignedCustomers])

  // Ringkasan per driver/route untuk Step 3
  const routeSummaries = useMemo(() => {
    return weekRoutes.map((route) => {
      const driver = driverMap.get(route.driverId) || null
      const zone = route.zoneId ? zoneMap.get(route.zoneId) : null
      const items = itemsByRoute.get(route.id) || []
      const customerNames = items
        .map((it) => customerMap.get(it.customerId)?.name)
        .filter(Boolean)
      return {
        route,
        driver,
        zone,
        items,
        count: items.length,
        customerNames,
      }
    })
  }, [customerMap, driverMap, itemsByRoute, weekRoutes, zoneMap])

  // ─── ACTIONS ────────────────────────────────────────────────

  async function handleCreateRoute(driverId) {
    if (!driverId) {
      showToast({ tone: 'error', message: 'Pilih driver terlebih dulu.' })
      return null
    }

    // Cek apakah driver sudah punya rute minggu ini
    const existing = weekRoutes.find((r) => r.driverId === driverId)
    if (existing) {
      showToast({ tone: 'warning', message: 'Driver ini sudah punya rute minggu ini.' })
      return existing
    }

    const driver = driverMap.get(driverId)
    const nextLabel = `RUTE ${weekRoutes.length + 1}`
    const created = await addRoute(
      {
        batchLabel,
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
        driverId,
        routeLabel: nextLabel,
        zoneId: driver?.primaryZoneId || null,
        status: 'draft',
      },
      `${nextLabel} untuk ${driver?.name || 'driver'} dibuat.`,
    )
    return created
  }

  async function handleAssignCustomer(orderEntry, routeId) {
    if (!routeId) return
    const route = weekRoutes.find((r) => r.id === routeId)
    if (!route) return
    const items = itemsByRoute.get(routeId) || []
    const sequenceNumber = `${route.routeLabel?.replace(/\D/g, '') || '1'}.${items.length + 1}`

    await addRouteItem({
      routeId,
      orderId: orderEntry.order.id,
      customerId: orderEntry.customer.id,
      sequenceNumber,
      deliveryAddress: orderEntry.customer.addressPrimary || '',
      deliveryNotes: orderEntry.order.specialNotes || orderEntry.customer.addressNotes || '',
      status: 'pending',
      statusLabel: 'active',
      untilDate: orderEntry.order.endDate || null,
      pointValue: 2,
      isCuti: false,
    }, `${orderEntry.customer.name} ditambahkan ke ${route.routeLabel}.`)
  }

  async function handleFinalize(route) {
    const ok = await confirmAction({
      title: `Finalize ${route.routeLabel}?`,
      description: `Setelah difinalize, driver akan dapat notifikasi dan rute siap untuk diprint. Total ${(itemsByRoute.get(route.id) || []).length} customer.`,
      confirmLabel: 'Ya, Finalize',
    })
    if (!ok) return
    await finalizeRoute({ id: route.id }, `${route.routeLabel} berhasil difinalize.`)
  }

  async function handleDeleteRoute(route) {
    const items = itemsByRoute.get(route.id) || []
    if (items.length > 0) {
      showToast({
        tone: 'warning',
        message: `${route.routeLabel} masih punya ${items.length} customer. Hapus customer-nya dulu.`,
      })
      return
    }
    const ok = await confirmAction({
      title: `Hapus ${route.routeLabel}?`,
      description: 'Rute kosong ini akan dihapus permanen.',
      confirmLabel: 'Ya, Hapus',
      danger: true,
    })
    if (!ok) return
    await updateRoute(
      { id: route.id, status: 'cancelled' },
      `${route.routeLabel} dihapus.`,
    )
    refreshData()
  }

  function handlePrint() {
    setPrintMode(true)
    // Tunggu render lalu trigger print
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintMode(false), 500)
    }, 200)
  }

  // ─── DERIVED CHECKS ─────────────────────────────────────────

  const totalAssigned = Array.from(itemsByRoute.values()).reduce((sum, items) => sum + items.length, 0)
  const totalCustomers = totalAssigned + unassignedCustomers.length
  const allAssigned = unassignedCustomers.length === 0 && totalAssigned > 0
  const hasFinalized = weekRoutes.some((r) => r.status === 'finalized')

  // ─── RENDER ─────────────────────────────────────────────────

  if (printMode) {
    return (
      <PrintSheet
        batchLabel={batchLabel}
        weekStart={weekStart}
        weekEnd={weekEnd}
        routeSummaries={routeSummaries}
        customerMap={customerMap}
      />
    )
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER + WEEK NAVIGATOR */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard Rute</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Builder Mingguan</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">
              Buat Rute Mingguan
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Atur pengiriman catering Senin–Jumat dalam satu batch. Cocok untuk perencanaan minggu depan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="rounded-2xl px-3 py-2.5"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Minggu Sebelumnya</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeekStart(addDays(getMonday(), 7))}
              className="rounded-2xl px-4 py-2.5"
            >
              <CalendarDays size={16} className="mr-2" />
              Minggu Depan
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="rounded-2xl px-3 py-2.5"
            >
              <span className="hidden sm:inline">Minggu Berikutnya</span>
              <ChevronRight size={16} />
            </Button>
          </div>
        </header>

        {/* BATCH BANNER */}
        <Card className="rounded-[28px] border border-teal/20 bg-gradient-to-br from-teal/5 via-white to-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-dark">
                Batch yang sedang dikerjakan
              </div>
              <div className="mt-1 text-2xl font-semibold text-gracious-navy">{batchLabel}</div>
              <div className="mt-1 text-sm text-slate-600">
                Senin {formatID(weekStart)} — Jumat {formatID(weekEnd)}
              </div>
            </div>
            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="text-3xl font-semibold text-teal-dark">{totalCustomers}</div>
                <div className="text-xs text-slate-500">Total customer</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-emerald-600">{totalAssigned}</div>
                <div className="text-xs text-slate-500">Sudah diatur</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-amber-600">{unassignedCustomers.length}</div>
                <div className="text-xs text-slate-500">Belum diatur</div>
              </div>
            </div>
          </div>
        </Card>

        {/* PANDUAN */}
        {showGuide ? (
          <Card className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                  <HelpCircle size={20} />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="font-semibold text-sky-900">📘 Panduan: 3 Langkah Membuat Rute Mingguan</div>
                    <div className="text-xs text-sky-700">Ikuti urutan ini supaya tidak ada customer yang terlewat.</div>
                  </div>
                  <ol className="space-y-1.5 text-sm text-sky-900">
                    <li>
                      <strong>1. Buat rute per driver</strong> — di section "Rute & Driver" di bawah, pilih driver
                      lalu klik "Tambah Rute". Satu driver = satu rute per minggu.
                    </li>
                    <li>
                      <strong>2. Tugaskan customer ke rute</strong> — di section "Customer Belum Diatur",
                      klik dropdown "Pilih Rute" pada tiap customer. Customer otomatis ditambahkan ke rute driver.
                    </li>
                    <li>
                      <strong>3. Review & Finalize</strong> — pastikan total customer sesuai, klik "Finalize" pada tiap rute.
                      Driver akan dapat notifikasi otomatis. Lalu klik "Print Semua Rute" di bawah.
                    </li>
                  </ol>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-full p-1.5 text-sky-700 transition hover:bg-sky-100"
                aria-label="Sembunyikan panduan"
              >
                <X size={16} />
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <HelpCircle size={14} />
            Tampilkan panduan
          </button>
        )}

        {/* STEP 1: RUTE & DRIVER */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                <span className="text-teal-dark">Langkah 1.</span> Rute & Driver
              </h2>
              <p className="text-sm text-slate-500">
                Buat satu rute untuk tiap driver yang akan kerja minggu ini.
              </p>
            </div>
          </div>

          <RouteCreator drivers={drivers} weekRoutes={weekRoutes} onCreate={handleCreateRoute} />

          {weekRoutes.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Belum ada rute untuk minggu ini. Pilih driver di atas, lalu klik "Tambah Rute".
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {routeSummaries.map((rs) => (
                <RouteCard
                  key={rs.route.id}
                  summary={rs}
                  onFinalize={() => handleFinalize(rs.route)}
                  onDelete={() => handleDeleteRoute(rs.route)}
                />
              ))}
            </div>
          )}
        </section>

        {/* STEP 2: CUSTOMER BELUM DIATUR */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              <span className="text-teal-dark">Langkah 2.</span> Customer Belum Diatur
              {unassignedCustomers.length > 0 ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {unassignedCustomers.length}
                </span>
              ) : null}
            </h2>
            <p className="text-sm text-slate-500">
              Hanya order ber-status <em>verified</em> yang tanggalnya beririsan dengan minggu pilihan.
              Klik "Pilih Rute" pada masing-masing customer.
            </p>
          </div>

          {unassignedCustomers.length === 0 ? (
            <Card className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
              <div className="mt-2 font-medium text-emerald-900">
                {totalAssigned > 0
                  ? 'Semua customer sudah diatur ke rute. Lanjut ke Langkah 3.'
                  : 'Tidak ada customer aktif untuk minggu ini.'}
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {unassignedByZone.map((group) => (
                <Card key={group.zoneId || 'no-zone'} className="rounded-[20px] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin size={16} className="text-teal-dark" />
                    <span className="font-semibold text-slate-800">{group.zoneName}</span>
                    <span className="text-xs text-slate-500">({group.items.length} customer)</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.items.map((entry) => (
                      <UnassignedRow
                        key={entry.order.id}
                        entry={entry}
                        weekRoutes={weekRoutes}
                        driverMap={driverMap}
                        onAssign={(routeId) => handleAssignCustomer(entry, routeId)}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* STEP 3: REVIEW & PRINT */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              <span className="text-teal-dark">Langkah 3.</span> Review & Print
            </h2>
            <p className="text-sm text-slate-500">
              Cek total per driver, finalize tiap rute, lalu print untuk pegangan driver.
            </p>
          </div>

          <Card className="rounded-[28px] p-5">
            {weekRoutes.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada rute untuk diprint.</div>
            ) : (
              <>
                <ReviewChecklist
                  hasRoutes={weekRoutes.length > 0}
                  allAssigned={allAssigned}
                  hasFinalized={hasFinalized}
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={handlePrint}
                    className="gap-2 rounded-2xl bg-teal px-5 py-3 hover:bg-teal-dark"
                  >
                    <Printer size={16} />
                    Print Semua Rute
                  </Button>
                  <Button as={Link} to="/routes" variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                    Lihat Daftar Rute Lama
                  </Button>
                </div>
              </>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}

// ─── ROUTE CREATOR (Step 1 helper) ───────────────────────────────

function RouteCreator({ drivers, weekRoutes, onCreate }) {
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const usedDriverIds = new Set(weekRoutes.map((r) => r.driverId))
  const availableDrivers = drivers.filter((d) => d.isActive !== false && !usedDriverIds.has(d.id))

  async function handleCreate() {
    if (!selectedDriverId) return
    const result = await onCreate(selectedDriverId)
    if (result) setSelectedDriverId('')
  }

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Pilih driver yang akan ditugaskan">
          <Select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
            <option value="">— Pilih driver —</option>
            {availableDrivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} {driver.vehicleType ? `(${driver.vehicleType})` : ''}
              </option>
            ))}
          </Select>
          {availableDrivers.length === 0 ? (
            <div className="mt-1 text-xs text-amber-600">
              Semua driver aktif sudah punya rute minggu ini.
            </div>
          ) : null}
        </Field>
        <Button
          onClick={handleCreate}
          disabled={!selectedDriverId}
          className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark disabled:opacity-50"
        >
          <Plus size={16} />
          Tambah Rute
        </Button>
      </div>
    </Card>
  )
}

// ─── ROUTE CARD ────────────────────────────────────────────────────

function RouteCard({ summary, onFinalize, onDelete }) {
  const { route, driver, zone, items } = summary
  const isFinalized = route.status === 'finalized'

  return (
    <Card className="rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{route.routeLabel}</div>
          <div className="text-sm text-slate-500">{driver?.name || 'Belum ada driver'}</div>
        </div>
        <Badge status={isFinalized ? 'delivered' : 'scheduled'}>
          {isFinalized ? 'FINALIZED' : 'DRAFT'}
        </Badge>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Zona utama</span>
          <span className="font-medium text-slate-800">{zone?.name || '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Total customer</span>
          <span className="font-medium text-slate-800">{items.length}</span>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 max-h-32 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-0.5">
              <span>• {item.deliveryAddress?.slice(0, 40) || '-'}</span>
            </div>
          ))}
          {items.length > 5 ? <div className="pt-1 text-slate-500">+ {items.length - 5} lagi</div> : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
          Belum ada customer. Tugaskan dari Step 2.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!isFinalized ? (
          <Button
            onClick={onFinalize}
            disabled={items.length === 0}
            className="flex-1 gap-2 rounded-xl bg-teal px-3 py-2 hover:bg-teal-dark disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            Finalize
          </Button>
        ) : (
          <div className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700">
            Driver sudah dinotif
          </div>
        )}
        <Button
          variant="secondary"
          onClick={onDelete}
          disabled={items.length > 0}
          className="rounded-xl px-3 py-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          title={items.length > 0 ? 'Hapus customer-nya dulu' : 'Hapus rute kosong'}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  )
}

// ─── UNASSIGNED ROW ────────────────────────────────────────────────

function UnassignedRow({ entry, weekRoutes, driverMap, onAssign }) {
  const [routeId, setRouteId] = useState('')
  const phone = entry.customer?.phone || '-'

  function handleAssign() {
    if (!routeId) return
    onAssign(routeId)
    setRouteId('')
  }

  return (
    <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex-1">
        <div className="font-medium text-slate-900">{entry.customer?.name}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          📞 {phone}
          {entry.order?.endDate ? ` · sampai ${entry.order.endDate}` : ''}
        </div>
        <div className="mt-1 text-xs text-slate-600 line-clamp-2">
          📍 {entry.customer?.addressPrimary || '-'}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          className="min-w-[180px]"
        >
          <option value="">Pilih Rute…</option>
          {weekRoutes.map((route) => {
            const driver = driverMap.get(route.driverId)
            return (
              <option key={route.id} value={route.id}>
                {route.routeLabel} — {driver?.name || 'Belum ada driver'}
              </option>
            )
          })}
        </Select>
        <Button
          onClick={handleAssign}
          disabled={!routeId}
          className="gap-1 rounded-xl bg-teal px-3 py-2 hover:bg-teal-dark disabled:opacity-50"
        >
          <Plus size={14} />
          Tugaskan
        </Button>
      </div>
    </div>
  )
}

// ─── REVIEW CHECKLIST ──────────────────────────────────────────────

function ReviewChecklist({ hasRoutes, allAssigned, hasFinalized }) {
  const items = [
    { ok: hasRoutes, label: 'Minimal 1 rute sudah dibuat untuk minggu ini' },
    { ok: allAssigned, label: 'Semua customer aktif sudah ditugaskan' },
    { ok: hasFinalized, label: 'Minimal 1 rute sudah difinalize (driver dapat notif)' },
  ]
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">Checklist sebelum print:</div>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          {item.ok ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={18} className="text-amber-500" />
          )}
          <span className={item.ok ? 'text-slate-700' : 'text-amber-700'}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── PRINT SHEET ───────────────────────────────────────────────────

function PrintSheet({ batchLabel, weekStart, weekEnd, routeSummaries, customerMap }) {
  return (
    <div className="bg-white p-8 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white; }
        }
      `}</style>
      <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
        <div className="border-b border-slate-300 pb-4">
          <div className="text-2xl font-bold text-slate-900">Gracious Delivery — Rute Mingguan</div>
          <div className="text-sm text-slate-600">{batchLabel}</div>
          <div className="text-sm text-slate-600">
            Senin {formatID(weekStart)} – Jumat {formatID(weekEnd)}
          </div>
        </div>

        {routeSummaries.map((rs) => (
          <div key={rs.route.id} className="break-inside-avoid">
            <div className="mb-2 flex items-baseline justify-between border-b border-slate-200 pb-1">
              <div>
                <div className="text-lg font-bold text-slate-900">{rs.route.routeLabel}</div>
                <div className="text-sm text-slate-600">
                  Driver: {rs.driver?.name || '-'} {rs.driver?.vehicleNumber ? `· ${rs.driver.vehicleNumber}` : ''}
                </div>
                <div className="text-sm text-slate-600">Zona: {rs.zone?.name || '-'}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {rs.count} customer<br />
                Status: {rs.route.status?.toUpperCase() || 'DRAFT'}
              </div>
            </div>
            {rs.items.length === 0 ? (
              <div className="text-sm italic text-slate-500">Belum ada customer di rute ini.</div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-2 py-1.5 w-10">No</th>
                    <th className="border border-slate-300 px-2 py-1.5">Nama</th>
                    <th className="border border-slate-300 px-2 py-1.5">Alamat</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-32">No HP</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-32">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {rs.items.map((item, idx) => {
                    const c = customerMap.get(item.customerId)
                    return (
                      <tr key={item.id}>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1.5">{c?.name || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1.5">{item.deliveryAddress || c?.addressPrimary || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1.5">{c?.phone || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-xs">{item.deliveryNotes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}

        <div className="pt-6 text-xs text-slate-500">
          Dicetak pada {new Date().toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  )
}
