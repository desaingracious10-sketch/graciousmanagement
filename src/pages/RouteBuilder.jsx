import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bot,
  CalendarDays,
  ChevronRight,
  GripVertical,
  MapPin,
  Plus,
  Printer,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { detectZone } from '../utils/zoneDetector.js'
import { Badge, Button, Card, Field, Input, Select, Textarea, formatDate, todayISO } from '../components/ui.jsx'

const STORAGE_ROUTES_KEY = 'gracious_routes_extra'
const STORAGE_ROUTE_ITEMS_KEY = 'gracious_route_items_extra'
const STORAGE_BUILDER_NOTES_KEY = 'gracious_route_builder_notes'

const WEEKDAYS = [
  { idx: 1, label: 'Sen', full: 'Senin' },
  { idx: 2, label: 'Sel', full: 'Selasa' },
  { idx: 3, label: 'Rab', full: 'Rabu' },
  { idx: 4, label: 'Kam', full: 'Kamis' },
  { idx: 5, label: 'Jum', full: 'Jumat' },
]

function getMondayOfWeek(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  const dow = d.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const diff = (dow + 6) % 7 // days since Monday
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function addIsoDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function buildBatchInfo(isoDate) {
  const monday = getMondayOfWeek(isoDate)
  const friday = addIsoDays(monday, 4)
  const monthLabel = new Date(`${monday}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const weekNum = Math.ceil(new Date(`${monday}T00:00:00`).getDate() / 7)
  return {
    weekStart: monday,
    weekEnd: friday,
    batchLabel: `${monthLabel} Week ${weekNum}`,
  }
}

export default function RouteBuilder() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()
  const { rawDb } = useApp()
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [routeExtras, setRouteExtras] = useState(() => readStorageArray(STORAGE_ROUTES_KEY))
  const [routeItemExtras, setRouteItemExtras] = useState(() => readStorageArray(STORAGE_ROUTE_ITEMS_KEY))
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [activeRouteId, setActiveRouteId] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [dragPayload, setDragPayload] = useState(null)
  const [toast, setToast] = useState(null)
  const [builderNotes, setBuilderNotes] = useState(() => readStorageObject(STORAGE_BUILDER_NOTES_KEY))
  const [suggestions, setSuggestions] = useState([])

  const users = rawDb.users || []
  const customers = mergeRecords(rawDb.customers || [], readStorageArray('gracious_customers_extra'))
  const orders = mergeRecords(rawDb.orders || [], readStorageArray('gracious_orders_extra'))
  const routes = useMemo(() => mergeRecords(rawDb.deliveryRoutes || [], routeExtras), [rawDb.deliveryRoutes, routeExtras])
  const routeItems = useMemo(() => mergeRecords(rawDb.deliveryRouteItems || [], routeItemExtras), [rawDb.deliveryRouteItems, routeItemExtras])
  const zones = rawDb.zones || []
  const programs = rawDb.programs || []
  const drivers = users.filter((user) => user.role === 'driver' && user.isActive)

  const selectedDateRoutes = useMemo(
    () =>
      routes
        .filter((route) => route.deliveryDate === selectedDate)
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
    [routes, selectedDate],
  )

  const selectedDateRouteIds = useMemo(() => new Set(selectedDateRoutes.map((route) => route.id)), [selectedDateRoutes])

  useEffect(() => {
    if (!selectedDateRoutes.length) {
      setActiveRouteId('')
      setSelectedRouteId('')
      return
    }

    if (!selectedDateRoutes.some((route) => route.id === activeRouteId)) {
      setActiveRouteId(selectedDateRoutes[0].id)
    }
    if (!selectedDateRoutes.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId(selectedDateRoutes[0].id)
    }
  }, [activeRouteId, selectedDateRoutes, selectedRouteId])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const itemsByRoute = useMemo(() => {
    const map = new Map()
    for (const item of routeItems) {
      if (!selectedDateRouteIds.has(item.routeId)) continue
      if (!map.has(item.routeId)) map.set(item.routeId, [])
      map.get(item.routeId).push(item)
    }

    for (const [routeId, items] of map.entries()) {
      items.sort((a, b) => sortSequence(a.sequenceNumber, b.sequenceNumber))
      map.set(routeId, items)
    }
    return map
  }, [routeItems, selectedDateRouteIds])

  const assignedOrderIds = useMemo(() => {
    const ids = new Set()
    for (const item of routeItems) {
      if (selectedDateRouteIds.has(item.routeId) && item.orderId) ids.add(item.orderId)
    }
    return ids
  }, [routeItems, selectedDateRouteIds])

  const customerPool = useMemo(() => {
    const query = search.trim().toLowerCase()

    return orders
      .filter((order) => {
        const activeOnDate =
          order.startDate &&
          order.endDate &&
          order.startDate <= selectedDate &&
          order.endDate >= selectedDate
        const validPayment = order.paymentStatus === 'verified'
        const validStatus = !['completed', 'cancelled'].includes(order.status)
        return activeOnDate && validPayment && validStatus && !assignedOrderIds.has(order.id)
      })
      .map((order) => {
        const customer = customers.find((item) => item.id === order.customerId)
        const program = programs.find((item) => item.id === order.programId)
        const detectedZone = detectZone(customer?.addressPrimary || '')
        const zone = zones.find((item) => item.id === (customer?.zoneId || detectedZone.zoneId))
        const isNew = order.createdAt ? daysBetween(order.createdAt, selectedDate) <= 7 : false
        const isSpecial = /vip|priority|prioritas|bumil|ivf|busui/i.test(`${program?.name || ''} ${order.specialNotes || ''}`)
        const needsAttention = /pindah|cuti|libur|lobby|jam|security/i.test(order.specialNotes || customer?.addressNotes || '')

        return {
          order,
          customer,
          program,
          zone,
          detectedZone,
          isNew,
          isSpecial,
          needsAttention,
        }
      })
      .filter((entry) => {
        const haystack = `${entry.customer?.name || ''} ${entry.customer?.phone || ''}`.toLowerCase()
        const matchesQuery = !query || haystack.includes(query)
        const filterZoneId =
          zoneFilter === 'all'
            ? true
            : (entry.zone?.id || entry.detectedZone.zoneId || '') === zoneFilter
        return matchesQuery && filterZoneId
      })
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name))
  }, [assignedOrderIds, customers, orders, programs, search, selectedDate, zoneFilter, zones])

  const activeRoute = selectedDateRoutes.find((route) => route.id === activeRouteId) || null
  const activeRouteItems = activeRoute ? itemsByRoute.get(activeRoute.id) || [] : []

  const zoneSummary = useMemo(() => {
    return zones
      .map((zone) => {
        const customersInZone = customerPool.filter((entry) => (entry.zone?.id || entry.detectedZone.zoneId) === zone.id)
        const suggestedDriver = suggestions.find((entry) => entry.zoneId === zone.id)?.driverName || '-'
        return {
          ...zone,
          count: customersInZone.length,
          suggestedDriver,
        }
      })
      .filter((zone) => zone.count > 0)
  }, [customerPool, suggestions, zones])

  const driverStatus = useMemo(() => {
    const currentLoads = new Map()
    for (const route of selectedDateRoutes) {
      const count = (itemsByRoute.get(route.id) || []).length
      currentLoads.set(route.driverId, (currentLoads.get(route.driverId) || 0) + count)
    }

    const idealCapacity = Math.max(4, Math.ceil((customerPool.length + Array.from(currentLoads.values()).reduce((sum, value) => sum + value, 0)) / Math.max(drivers.length, 1)))

    return drivers.map((driver) => {
      const primaryZoneId = inferDriverZone(driver.id, routes)
      const primaryZone = zones.find((zone) => zone.id === primaryZoneId)
      const assignedCount = currentLoads.get(driver.id) || 0
      return {
        ...driver,
        primaryZoneName: primaryZone?.name || 'Belum ditentukan',
        assignedCount,
        idealCapacity,
        status: assignedCount >= idealCapacity ? 'sudah penuh' : 'tersedia',
      }
    })
  }, [customerPool.length, drivers, itemsByRoute, routes, selectedDateRoutes, zones])

  const currentGlobalNote = builderNotes[selectedDate] || ''

  function persistRoutes(nextRoutes) {
    setRouteExtras(nextRoutes)
    localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(nextRoutes))
  }

  function persistRouteItems(nextItems) {
    setRouteItemExtras(nextItems)
    localStorage.setItem(STORAGE_ROUTE_ITEMS_KEY, JSON.stringify(nextItems))
  }

  function createRouteDraft(overrides = {}) {
    const nextIndex = selectedDateRoutes.length + 1
    const batch = buildBatchInfo(selectedDate)
    return {
      id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deliveryDate: selectedDate,
      driverId: '',
      routeLabel: `RUTE ${nextIndex}`,
      zoneId: '',
      routePointCount: 0,
      status: 'draft',
      createdBy: currentUser?.id || 'u4',
      createdAt: new Date().toISOString(),
      notes: currentGlobalNote,
      // Batch fields untuk operasi mingguan
      batchLabel: batch.batchLabel,
      weekStart: batch.weekStart,
      weekEnd: batch.weekEnd,
      ...overrides,
    }
  }

  function addRoute(routeOverrides = {}) {
    const route = createRouteDraft(routeOverrides)
    persistRoutes(upsertRecord(routeExtras, route))
    setActiveRouteId(route.id)
    setSelectedRouteId(route.id)
    return route
  }

  function updateRoute(routeId, patch) {
    const current = routes.find((route) => route.id === routeId)
    if (!current) return
    persistRoutes(upsertRecord(routeExtras, { ...current, ...patch }))
  }

  function deleteRoute(routeId) {
    if (!window.confirm('Hapus rute ini beserta semua item di dalamnya?')) return
    persistRoutes(upsertRecord(routeExtras, { id: routeId, _deleted: true }))
    const currentItems = routeItems.filter((item) => item.routeId === routeId)
    let nextExtras = [...routeItemExtras]
    for (const item of currentItems) {
      nextExtras = upsertRecord(nextExtras, { id: item.id, _deleted: true })
    }
    persistRouteItems(nextExtras)
    setToast({ tone: 'success', message: 'Rute berhasil dihapus.' })
  }

  function saveBuilderNote(value) {
    const next = { ...builderNotes, [selectedDate]: value }
    setBuilderNotes(next)
    localStorage.setItem(STORAGE_BUILDER_NOTES_KEY, JSON.stringify(next))
  }

  function assignOrderToRoute(orderId, routeId, insertIndex = null) {
    const entry = customerPool.find((item) => item.order.id === orderId)
    const targetRoute = routes.find((route) => route.id === routeId)
    if (!entry || !targetRoute) return

    const routeEntries = itemsByRoute.get(routeId) || []
    const sequenceNumber = buildNextSequence(routeEntries, targetRoute.routeLabel, insertIndex)
    const newItem = {
      id: `ri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      routeId,
      sequenceNumber,
      orderId: entry.order.id,
      customerId: entry.customer.id,
      deliveryAddress: entry.customer.addressPrimary,
      deliveryNotes: entry.order.specialNotes || entry.customer.addressNotes || '',
      estimatedTime: '',
      status: 'pending',
      statusLabel: 'active',
      deliveredAt: null,
      proofOfDelivery: null,
      untilDate: entry.order.endDate,
      dietaryNotes: entry.order.dietaryNotes || entry.customer.dietaryNotes || '',
      programId: entry.order.programId,
    }

    persistRouteItems(upsertRecord(routeItemExtras, newItem))
    refreshRoutePointCount(routeId)
    if (!targetRoute.zoneId) {
      updateRoute(routeId, { zoneId: entry.customer.zoneId || entry.detectedZone.zoneId || '' })
    }
  }

  function moveItemToRoute(itemId, targetRouteId, insertIndex = null) {
    const item = routeItems.find((current) => current.id === itemId)
    const targetRoute = routes.find((route) => route.id === targetRouteId)
    if (!item || !targetRoute) return

    const targetEntries = itemsByRoute.get(targetRouteId) || []
    const nextSequence = buildNextSequence(targetEntries, targetRoute.routeLabel, insertIndex)
    const nextItem = {
      ...item,
      routeId: targetRouteId,
      sequenceNumber: nextSequence,
    }

    persistRouteItems(upsertRecord(routeItemExtras, nextItem))
    refreshRoutePointCount(item.routeId)
    refreshRoutePointCount(targetRouteId)
  }

  function updateRouteItem(itemId, patch) {
    const current = routeItems.find((item) => item.id === itemId)
    if (!current) return
    persistRouteItems(upsertRecord(routeItemExtras, { ...current, ...patch }))
  }

  function removeRouteItem(itemId) {
    const current = routeItems.find((item) => item.id === itemId)
    if (!current) return
    persistRouteItems(upsertRecord(routeItemExtras, { id: itemId, _deleted: true }))
    refreshRoutePointCount(current.routeId)
  }

  function refreshRoutePointCount(routeId) {
    const allItems = mergeRecords(rawDb.deliveryRouteItems || [], routeItemExtras)
    const count = allItems.filter((item) => item.routeId === routeId).length
    const route = routes.find((entry) => entry.id === routeId)
    if (route) updateRoute(routeId, { routePointCount: count })
  }

  function onDragStart(payload) {
    setDragPayload(payload)
  }

  function onDropRoute(routeId) {
    if (!dragPayload) return
    if (dragPayload.type === 'pool') assignOrderToRoute(dragPayload.orderId, routeId)
    if (dragPayload.type === 'route-item') moveItemToRoute(dragPayload.itemId, routeId)
    setDragPayload(null)
  }

  function onReorder(itemId, targetIndex) {
    const item = routeItems.find((current) => current.id === itemId)
    if (!item) return
    const routeEntries = [...(itemsByRoute.get(item.routeId) || [])].filter((entry) => entry.id !== itemId)
    routeEntries.splice(targetIndex, 0, item)
    const nextExtras = [...routeItemExtras]

    routeEntries.forEach((entry, index) => {
      const sequenceNumber = `${routeLabelToNumber(routes.find((route) => route.id === item.routeId)?.routeLabel)}.${index + 1}`
      const patched = { ...entry, sequenceNumber }
      const existingIndex = nextExtras.findIndex((extra) => extra.id === patched.id)
      if (existingIndex >= 0) nextExtras[existingIndex] = patched
      else nextExtras.push(patched)
    })

    persistRouteItems(nextExtras)
  }

  function generateSuggestions() {
    if (!customerPool.length || !drivers.length) {
      setSuggestions([])
      setToast({ tone: 'warning', message: 'Tidak ada customer atau driver yang bisa dibagi otomatis.' })
      return
    }

    const groups = groupBy(customerPool, (entry) => entry.zone?.id || entry.detectedZone.zoneId || 'unknown')
    const loads = new Map(drivers.map((driver) => [driver.id, 0]))
    const suggestionRows = []

    for (const [zoneId, entries] of groups.entries()) {
      const preferredDrivers = [...drivers].sort((a, b) => {
        const aMatch = inferDriverZone(a.id, routes) === zoneId ? 1 : 0
        const bMatch = inferDriverZone(b.id, routes) === zoneId ? 1 : 0
        if (aMatch !== bMatch) return bMatch - aMatch
        return (loads.get(a.id) || 0) - (loads.get(b.id) || 0)
      })

      entries.forEach((entry, index) => {
        const driver = preferredDrivers[index % preferredDrivers.length]
        loads.set(driver.id, (loads.get(driver.id) || 0) + 1)
        suggestionRows.push({
          zoneId,
          zoneName: zones.find((zone) => zone.id === zoneId)?.name || 'Zona belum terdeteksi',
          driverId: driver.id,
          driverName: driver.name,
          orderId: entry.order.id,
          customerName: entry.customer.name,
        })
      })
    }

    setSuggestions(suggestionRows)
  }

  function applySuggestions() {
    if (!suggestions.length) return
    const hasExistingAssignments = selectedDateRoutes.some((route) => (itemsByRoute.get(route.id) || []).length > 0)
    if (hasExistingAssignments && !window.confirm('Menerapkan saran akan mengganti pembagian rute pada tanggal ini. Lanjutkan?')) {
      return
    }

    let nextRouteExtras = [...routeExtras]
    let nextItemExtras = [...routeItemExtras]

    for (const route of selectedDateRoutes) {
      nextRouteExtras = upsertRecord(nextRouteExtras, { id: route.id, _deleted: true })
      const currentItems = routeItems.filter((item) => item.routeId === route.id)
      for (const item of currentItems) {
        nextItemExtras = upsertRecord(nextItemExtras, { id: item.id, _deleted: true })
      }
    }

    const groupedSuggestions = groupBy(suggestions, (item) => `${item.driverId}-${item.zoneId}`)
    const createdRoutes = []

    for (const [key, entries] of groupedSuggestions.entries()) {
      const [driverId, zoneId] = key.split('-')
      const route = createRouteDraft({
        driverId,
        zoneId,
        routeLabel: `RUTE ${createdRoutes.length + 1}`,
        routePointCount: entries.length,
      })
      createdRoutes.push(route)
      nextRouteExtras = upsertRecord(nextRouteExtras, route)

      entries.forEach((entry, index) => {
        const poolEntry = customerPool.find((item) => item.order.id === entry.orderId)
        if (!poolEntry) return
        nextItemExtras = upsertRecord(nextItemExtras, {
          id: `ri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${index}`,
          routeId: route.id,
          sequenceNumber: `${createdRoutes.length}.${index + 1}`,
          orderId: poolEntry.order.id,
          customerId: poolEntry.customer.id,
          deliveryAddress: poolEntry.customer.addressPrimary,
          deliveryNotes: poolEntry.order.specialNotes || poolEntry.customer.addressNotes || '',
          estimatedTime: '',
          status: 'pending',
          statusLabel: 'active',
          deliveredAt: null,
          proofOfDelivery: null,
          untilDate: poolEntry.order.endDate,
          dietaryNotes: poolEntry.order.dietaryNotes || poolEntry.customer.dietaryNotes || '',
          programId: poolEntry.order.programId,
        })
      })
    }

    persistRoutes(nextRouteExtras)
    persistRouteItems(nextItemExtras)
    setActiveRouteId(createdRoutes[0]?.id || '')
    setSelectedRouteId(createdRoutes[0]?.id || '')
    setToast({ tone: 'success', message: 'Saran pembagian otomatis berhasil diterapkan.' })
  }

  function saveDraft() {
    selectedDateRoutes.forEach((route) => updateRoute(route.id, { status: 'draft', notes: currentGlobalNote }))
    setToast({ tone: 'success', message: 'Draft rute harian berhasil disimpan.' })
  }

  function finalizeAll() {
    selectedDateRoutes.forEach((route) => updateRoute(route.id, { status: 'finalized', notes: currentGlobalNote }))
    setToast({ tone: 'success', message: 'Semua rute berhasil difinalisasi.' })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard Rute</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Route Builder</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Route Builder Harian</h1>
            <p className="mt-2 text-sm text-slate-500">
              Susun customer aktif ke rute driver, atur urutan titik, lalu finalize lembar operasional harian.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/routes')} className="rounded-2xl px-4 py-3">
              Daftar Semua Rute
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/routes/print?date=${selectedDate}`)} className="gap-2 rounded-2xl px-4 py-3">
              <Printer size={16} />
              Print Hari Ini
            </Button>
            <Button
              onClick={() => navigate(`/routes/print?weekStart=${buildBatchInfo(selectedDate).weekStart}`)}
              className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark"
            >
              <Printer size={16} />
              Print Batch (Sen–Jum)
            </Button>
          </div>
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
          <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Customer Aktif Hari Ini ({customerPool.length})</h2>
                <p className="mt-1 text-sm text-slate-500">Customer verified yang belum masuk rute pada tanggal terpilih.</p>
              </div>
              <CalendarDays className="text-teal" size={20} />
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Tanggal pengiriman">
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </Field>

              <Field label="Search customer">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Cari nama customer"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ZoneChip active={zoneFilter === 'all'} label="Semua Zona" onClick={() => setZoneFilter('all')} />
              {zones.map((zone) => (
                <ZoneChip key={zone.id} active={zoneFilter === zone.id} label={zone.name} onClick={() => setZoneFilter(zone.id)} />
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {customerPool.length ? (
                customerPool.map((entry) => (
                  <button
                    key={entry.order.id}
                    type="button"
                    draggable
                    title={`Saran zona: ${(entry.zone?.name || entry.detectedZone.zoneName || 'Belum terdeteksi')} (${Math.round((entry.detectedZone.confidence || 0) * 100)}%)`}
                    onDragStart={() => onDragStart({ type: 'pool', orderId: entry.order.id })}
                    className="w-full rounded-[24px] border border-slate-200 bg-white p-4 text-left transition hover:border-teal/30 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <GripVertical size={15} className="mt-0.5 text-slate-400" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{entry.customer.name}</span>
                            <ProgramPill program={entry.program} />
                            {entry.zone ? <ZoneBadge zone={entry.zone} /> : null}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{shorten(entry.customer.addressPrimary, 92)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!selectedRouteId && !selectedDateRoutes.length) {
                            const route = addRoute()
                            assignOrderToRoute(entry.order.id, route.id)
                            return
                          }
                          assignOrderToRoute(entry.order.id, selectedRouteId || activeRouteId)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal/20 bg-teal/5 text-teal-dark transition hover:bg-teal/10"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {entry.isNew ? <FlagBadge tone="blue" label="N" /> : null}
                      {entry.isSpecial ? <FlagBadge tone="gold" label="⭐" /> : null}
                      {entry.needsAttention ? <FlagBadge tone="amber" label="⚠️" /> : null}
                    </div>

                    {entry.order.specialNotes ? (
                      <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{entry.order.specialNotes}</div>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada customer pool untuk tanggal dan filter saat ini.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Rute Builder</h2>
                <p className="mt-1 text-sm text-slate-500">Drag customer dari pool ke rute, atur sequence, dan finalize jika sudah siap.</p>
              </div>
              <button
                type="button"
                onClick={() => addRoute()}
                className="inline-flex items-center gap-2 rounded-2xl border border-teal/20 bg-teal/5 px-3 py-2 text-sm font-medium text-teal-dark transition hover:bg-teal/10"
              >
                <Plus size={16} />
                Tambah Rute Baru
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {selectedDateRoutes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => {
                    setActiveRouteId(route.id)
                    setSelectedRouteId(route.id)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropRoute(route.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    route.id === activeRouteId ? 'border-teal bg-teal/5 text-teal-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">{route.routeLabel}</div>
                  <div className="mt-1 text-xs">{(itemsByRoute.get(route.id) || []).length} titik</div>
                </button>
              ))}
            </div>

            {activeRoute ? (
              <div className="mt-5 space-y-5">
                <div
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropRoute(activeRoute.id)}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Nama rute">
                      <Input value={activeRoute.routeLabel} onChange={(event) => updateRoute(activeRoute.id, { routeLabel: event.target.value })} />
                    </Field>
                    <Field label="Driver">
                      <Select value={activeRoute.driverId || ''} onChange={(event) => updateRoute(activeRoute.id, { driverId: event.target.value })}>
                        <option value="">Pilih driver</option>
                        {drivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Zona utama">
                      <Select value={activeRoute.zoneId || ''} onChange={(event) => updateRoute(activeRoute.id, { zoneId: event.target.value })}>
                        <option value="">Pilih zona</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Counter</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="text-lg font-semibold text-slate-900">{activeRouteItems.length} titik</div>
                        <div className="text-sm text-slate-500">POINT {activeRouteItems.length}</div>
                        <Badge status={activeRoute.status}>{activeRoute.status === 'finalized' ? 'Finalized' : 'Draft'}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => updateRoute(activeRoute.id, { status: 'finalized' })} className="rounded-2xl bg-emerald-600 px-4 py-3 hover:bg-emerald-700">
                      Finalize
                    </Button>
                    <Button as={Link} to={`/routes/print?date=${selectedDate}`} variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                      <Printer size={16} />
                      Print
                    </Button>
                    <Button onClick={() => deleteRoute(activeRoute.id)} variant="danger" className="gap-2 rounded-2xl px-4 py-3">
                      <Trash2 size={16} />
                      Hapus Rute
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {activeRouteItems.length ? (
                    activeRouteItems.map((item, index) => {
                      const order = orders.find((entry) => entry.id === item.orderId)
                      const customer = customers.find((entry) => entry.id === item.customerId)
                      const program = programs.find((entry) => entry.id === (item.programId || order?.programId))

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => onDragStart({ type: 'route-item', itemId: item.id })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (dragPayload?.type === 'route-item' && dragPayload.itemId !== item.id) {
                              onReorder(dragPayload.itemId, index)
                              setDragPayload(null)
                            }
                          }}
                          className="rounded-[24px] border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <GripVertical size={16} className="mt-1 text-slate-400" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    value={item.sequenceNumber || ''}
                                    onChange={(event) => updateRouteItem(item.id, { sequenceNumber: event.target.value })}
                                    className="w-20"
                                  />
                                  <div className="font-semibold text-slate-900">{customer?.name || 'Customer'}</div>
                                  <ProgramPill program={program} />
                                </div>
                                <div className="mt-1 truncate text-sm text-slate-500">{item.dietaryNotes || order?.dietaryNotes || customer?.dietaryNotes || 'Tidak ada catatan diet'}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRouteItem(item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[120px_160px_minmax(0,1fr)]">
                            <Field label="UNTIL">
                              <Input
                                type="date"
                                value={item.untilDate || order?.endDate || ''}
                                onChange={(event) => updateRouteItem(item.id, { untilDate: event.target.value })}
                              />
                            </Field>
                            <Field label="Status">
                              <Select
                                value={item.statusLabel || 'active'}
                                onChange={(event) => updateRouteItem(item.id, { statusLabel: event.target.value })}
                              >
                                <option value="active">active</option>
                                <option value="habis">habis</option>
                                <option value="pindah_alamat">pindah_alamat</option>
                              </Select>
                            </Field>
                            <Field label="Catatan pengiriman hari ini">
                              <Input
                                value={item.deliveryNotes || ''}
                                onChange={(event) => updateRouteItem(item.id, { deliveryNotes: event.target.value })}
                                placeholder="Contoh: Titip lobby, Jam 11"
                              />
                            </Field>
                          </div>

                          <CutiToggleRow
                            cutiDates={item.cutiDates || []}
                            weekStart={activeRoute.weekStart || buildBatchInfo(selectedDate).weekStart}
                            onChange={(nextDates) => updateRouteItem(item.id, { cutiDates: nextDates, isCuti: nextDates.length > 0 })}
                          />
                        </div>
                      )
                    })
                  ) : (
                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onDropRoute(activeRoute.id)}
                      className="rounded-[24px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Drag customer ke area ini atau klik tombol `+` dari panel kiri untuk assign manual.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                Belum ada rute di tanggal ini. Klik <strong>Tambah Rute Baru</strong> untuk mulai menyusun lembar pengiriman.
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Saran Pembagian AI</h2>
                <p className="mt-1 text-sm text-slate-500">Kelompokkan customer per zona dan seimbangkan beban driver untuk hari ini.</p>
              </div>
              <Bot className="text-teal" size={20} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={generateSuggestions} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
                <WandSparkles size={16} />
                Generate Pembagian Otomatis
              </Button>
              {suggestions.length ? (
                <>
                  <Button onClick={applySuggestions} variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                    <Sparkles size={16} />
                    Terapkan Saran
                  </Button>
                  <Button onClick={() => setSuggestions([])} variant="secondary" className="rounded-2xl px-4 py-3">
                    Abaikan
                  </Button>
                </>
              ) : null}
            </div>

            {suggestions.length ? (
              <div className="mt-4 space-y-2 rounded-[24px] border border-teal/15 bg-teal/5 p-4">
                {summarizeSuggestions(suggestions).map((item) => (
                  <div key={`${item.driverId}-${item.zoneId}`} className="text-sm text-slate-700">
                    <span className="font-medium">{item.driverName}</span>: {item.count} customer ({item.zoneName})
                  </div>
                ))}
              </div>
            ) : null}

            <section className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Zone Summary</h3>
              <div className="mt-3 space-y-3">
                {zoneSummary.length ? (
                  zoneSummary.map((zone) => (
                    <div key={zone.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{zone.name}</div>
                        <div className="text-xs text-slate-500">{zone.count} customer</div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, zone.count * 12)}%`,
                            backgroundColor: zone.colorCode,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Driver: {zone.suggestedDriver}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada customer pool yang perlu diringkas per zona.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Driver Status</h3>
              <div className="mt-3 space-y-3">
                {driverStatus.map((driver) => (
                  <div key={driver.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{driver.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Zona utama: {driver.primaryZoneName}</div>
                      </div>
                      <Badge status={driver.status === 'sudah penuh' ? 'failed' : 'delivered'}>{driver.status}</Badge>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      {driver.assignedCount} customer assigned • Kapasitas ideal {driver.idealCapacity}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <Field label="Catatan global rute">
                <Textarea
                  value={currentGlobalNote}
                  rows={5}
                  onChange={(event) => saveBuilderNote(event.target.value)}
                  placeholder="Contoh: Cuaca hujan, driver hati-hati"
                />
              </Field>
            </section>

            <div className="mt-6 grid gap-3">
              <Button onClick={saveDraft} variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                <Save size={16} />
                Simpan Draft
              </Button>
              <Button onClick={finalizeAll} className="gap-2 rounded-2xl bg-emerald-600 px-4 py-3 hover:bg-emerald-700">
                <Sparkles size={16} />
                Finalize Semua Rute
              </Button>
              <Button as={Link} to={`/routes/print?date=${selectedDate}`} variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                <Printer size={16} />
                Preview Print
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CutiToggleRow({ cutiDates = [], weekStart, onChange }) {
  function toggle(idx) {
    const dateIso = addIsoDays(weekStart, idx - 1)
    const exists = cutiDates.includes(dateIso)
    const next = exists ? cutiDates.filter((d) => d !== dateIso) : [...cutiDates, dateIso].sort()
    onChange(next)
  }
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Cuti per Hari (centang = TIDAK dikirim)
        </div>
        {cutiDates.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-medium text-amber-800 underline hover:text-amber-900"
          >
            Reset
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {WEEKDAYS.map((d) => {
          const dateIso = addIsoDays(weekStart, d.idx - 1)
          const isOff = cutiDates.includes(dateIso)
          return (
            <button
              key={d.idx}
              type="button"
              onClick={() => toggle(d.idx)}
              className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold transition ${
                isOff
                  ? 'border-rose-300 bg-rose-100 text-rose-700'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
              title={`${d.full} (${dateIso})${isOff ? ' — CUTI' : ''}`}
            >
              {d.label} {isOff ? '✗' : '✓'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProgramPill({ program }) {
  const tones = {
    p1: 'bg-emerald-50 text-emerald-700',
    p2: 'bg-violet-50 text-violet-700',
    p3: 'bg-rose-50 text-rose-700',
    p4: 'bg-sky-50 text-sky-700',
    p5: 'bg-amber-50 text-amber-700',
    p6: 'bg-indigo-50 text-indigo-700',
    p7: 'bg-teal/10 text-teal-dark',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[program?.id] || 'bg-slate-100 text-slate-600'}`}>
      {shorten(program?.name || 'Program', 18)}
    </span>
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

function ZoneChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? 'bg-teal text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

function FlagBadge({ tone, label }) {
  const tones = {
    blue: 'bg-sky-100 text-sky-700',
    gold: 'bg-amber-100 text-amber-700',
    amber: 'bg-amber-50 text-amber-900',
  }
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{label}</span>
}

function ToastBanner({ toast }) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  }

  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles[toast.tone] || styles.success}`}>{toast.message}</div>
}

function summarizeSuggestions(items) {
  const map = new Map()
  for (const item of items) {
    const key = `${item.driverId}-${item.zoneId}`
    if (!map.has(key)) {
      map.set(key, { ...item, count: 0 })
    }
    map.get(key).count += 1
  }
  return Array.from(map.values())
}

function inferDriverZone(driverId, routes) {
  const scored = {}
  routes
    .filter((route) => route.driverId === driverId && route.zoneId)
    .forEach((route) => {
      scored[route.zoneId] = (scored[route.zoneId] || 0) + 1
    })

  return Object.entries(scored).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

function groupBy(list, getKey) {
  const map = new Map()
  for (const item of list) {
    const key = getKey(item)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return map
}

function buildNextSequence(routeEntries, routeLabel, insertIndex = null) {
  const routeNo = routeLabelToNumber(routeLabel)
  const nextIndex = insertIndex === null ? routeEntries.length + 1 : insertIndex + 1
  return `${routeNo}.${nextIndex}`
}

function routeLabelToNumber(routeLabel) {
  const matched = String(routeLabel || '').match(/(\d+)/)
  return matched?.[1] || '1'
}

function sortSequence(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' })
}

function shorten(value, max) {
  if (!value) return '-'
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function daysBetween(isoDateTime, isoDate) {
  const left = new Date(isoDateTime)
  const right = new Date(`${isoDate}T00:00:00`)
  return Math.floor((right - left) / 86400000)
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

function readStorageObject(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
