import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import RoutePrintSheet from '../components/print/RoutePrintSheet.jsx'
import { useApp } from '../context/AppContext.jsx'
import { Button, EmptyState, Field, Input, Select, todayISO } from '../components/ui.jsx'

const ALL_ROUTES = 'all'
const MOVED_STATUS = 'pindah_alamat'

export default function RoutePrint() {
  const [searchParams] = useSearchParams()
  const { deliveryRoutes, deliveryRouteItems, customers, orders, programs, users, zones } = useApp()
  const initialDate = searchParams.get('date') || todayISO()
  const printOnly = searchParams.get('mode') === 'print'
  const initialRoute = searchParams.get('route') || ALL_ROUTES
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedRouteId, setSelectedRouteId] = useState(initialRoute)

  const routesForDate = useMemo(
    () =>
      deliveryRoutes
        .filter((route) => route.deliveryDate === selectedDate)
        .sort((a, b) => routeLabelToNumber(a.routeLabel) - routeLabelToNumber(b.routeLabel)),
    [deliveryRoutes, selectedDate],
  )

  useEffect(() => {
    if (selectedRouteId === ALL_ROUTES) return
    if (!routesForDate.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId(ALL_ROUTES)
    }
  }, [routesForDate, selectedRouteId])

  useEffect(() => {
    if (!printOnly) return undefined
    const timeoutId = window.setTimeout(() => {
      document.body.classList.add('route-printing')
      window.print()
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
      document.body.classList.remove('route-printing')
    }
  }, [printOnly])

  const filteredRoutes = useMemo(() => {
    if (selectedRouteId === ALL_ROUTES) return routesForDate
    return routesForDate.filter((route) => route.id === selectedRouteId)
  }, [routesForDate, selectedRouteId])

  const routeSheets = useMemo(
    () =>
      filteredRoutes.map((route) =>
        buildRouteSheet(route, {
          selectedDate,
          deliveryRouteItems,
          customers,
          orders,
          programs,
          users,
          zones,
        }),
      ),
    [customers, deliveryRouteItems, filteredRoutes, orders, programs, selectedDate, users, zones],
  )

  const totalPoints = routeSheets.reduce((sum, route) => sum + route.pointCount, 0)
  const totalStops = routeSheets.reduce((sum, route) => sum + route.deliveryCount, 0)

  function runPrint() {
    document.body.classList.add('route-printing')
    window.print()
    window.setTimeout(() => document.body.classList.remove('route-printing'), 500)
  }

  function handlePrint() {
    runPrint()
  }

  function handleSavePdf() {
    runPrint()
  }

  function handleOpenPrintPreview() {
    const routeParam = selectedRouteId === ALL_ROUTES ? '' : `&route=${selectedRouteId}`
    window.open(`/routes/print?date=${selectedDate}&mode=print${routeParam}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`px-4 py-8 sm:px-6 lg:px-8 ${printOnly ? 'print-area' : ''}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className={`${printOnly ? 'hidden' : 'no-print'} rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fffaf2_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)] sm:px-8 dark:border-slate-700 dark:bg-slate-800`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Print Route</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gracious-navy dark:text-slate-100">Cetak Rute Driver</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                Preview dibuat mengikuti format Word operasional tim, lalu bisa langsung dicetak atau disimpan sebagai PDF A4 landscape.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handlePrint} className="gap-2 rounded-2xl px-4 py-3">
                <Printer size={16} />
                Print
              </Button>
              <Button onClick={handleSavePdf} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
                <Download size={16} />
                Simpan PDF
              </Button>
              <Button variant="secondary" onClick={handleOpenPrintPreview} className="rounded-2xl px-4 py-3">
                Preview Tab Baru
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(280px,1fr)_repeat(2,minmax(0,180px))]">
            <Field label="Tanggal Pengiriman">
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </Field>

            <Field label="Rute / Driver">
              <Select value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)}>
                <option value={ALL_ROUTES}>Semua Rute</option>
                {routesForDate.map((route) => {
                  const driver = users.find((user) => user.id === route.driverId)
                  return (
                    <option key={route.id} value={route.id}>
                      {route.routeLabel} - {driver?.name || 'Driver belum ditentukan'}
                    </option>
                  )
                })}
              </Select>
            </Field>

            <SummaryTile label="Total Rute" value={routeSheets.length} />
            <SummaryTile label="Total Point" value={totalPoints} />
            <SummaryTile label="Total Stop" value={`${totalStops}x`} />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Tombol <strong>Simpan PDF</strong> akan membuka dialog print browser. Pilih <strong>Save as PDF</strong> untuk menyimpan dokumen.
          </div>
        </section>

        {routeSheets.length ? (
          <RoutePrintSheet routes={routeSheets} />
        ) : (
          <EmptyState
            icon="🗺️"
            title="Belum ada rute hari ini."
            description="Pilih tanggal lain atau susun rute terlebih dahulu dari halaman builder."
            actionLabel="Buat rute sekarang →"
            actionTo="/routes/builder"
          />
        )}
      </div>
    </div>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  )
}

function buildRouteSheet(route, context) {
  const { selectedDate, deliveryRouteItems, customers, orders, programs, users, zones } = context
  const driver = users.find((user) => user.id === route.driverId)
  const zone = zones.find((entry) => entry.id === route.zoneId)
  const items = deliveryRouteItems
    .filter((item) => item.routeId === route.id)
    .sort((a, b) => sortSequence(a.sequenceNumber, b.sequenceNumber))

  const entries = items.map((item) => {
    const customer = customers.find((entry) => entry.id === item.customerId)
    const order = orders.find((entry) => entry.id === item.orderId)
    const program = programs.find((entry) => entry.id === (item.programId || order?.programId))
    const untilDate = item.untilDate || order?.endDate || route.deliveryDate
    const dietaryNotes = compactText(item.dietaryNotes || order?.dietaryNotes || customer?.dietaryNotes || '')
    const rawRequestNotes = compactText(item.deliveryNotes || order?.specialNotes || customer?.addressNotes || '')
    const requestNotes = rawRequestNotes && rawRequestNotes !== dietaryNotes ? rawRequestNotes : ''
    const moved = item.statusLabel === MOVED_STATUS || /(pindah)/i.test(`${requestNotes} ${customer?.addressNotes || ''}`)
    const exhausted = !moved && isSameOrBefore(untilDate, selectedDate)
    const isNew = order?.createdAt ? daysFromCreated(order.createdAt, selectedDate) <= 7 : false

    return {
      id: item.id,
      sequenceNumber: item.sequenceNumber || '-',
      statusLabel: buildStatusLabel(item.sequenceNumber, untilDate, { moved, exhausted }),
      customerName: customer?.name || 'Customer',
      showNewLabel: isNew,
      phone: customer?.phone || '-',
      address: formatAddress(item.deliveryAddress || customer?.addressAlternate || customer?.addressPrimary || '-'),
      programText: buildProgramText(program, order),
      dietaryNotes,
      requestNotes,
      statusTone: moved ? MOVED_STATUS : exhausted ? 'habis' : 'normal',
      highlightProgram: isMotherhoodProgram(program),
    }
  })

  return {
    id: route.id,
    routeLabel: route.routeLabel || `RUTE ${routeLabelToNumber(route.routeLabel) || ''}`.trim(),
    dayLabel: formatRouteDay(route.deliveryDate),
    driverName: (driver?.name || 'Driver belum ditentukan').toUpperCase(),
    deliveryCount: entries.length,
    pointCount: route.routePointCount || items.length,
    zoneName: zone?.name || '',
    routeNotes: compactText(route.notes || ''),
    rows: pairEntries(entries),
  }
}

function buildStatusLabel(sequenceNumber, untilDate, flags) {
  const dateLabel = formatShortDate(untilDate)
  if (flags.moved) return `X UNTIL ${dateLabel} PINDAH ALAMAT`
  if (flags.exhausted) return `HABIS UNTIL ${dateLabel}`
  return `${sequenceNumber} UNTIL ${dateLabel}`
}

function buildProgramText(program, order) {
  const programName = shortProgramLabel(program?.name || order?.programId || '-')
  const meal = mealTypePrintLabel(order?.mealType)
  const duration = durationPrintLabel(order?.durationType)
  return [programName, meal, duration].filter(Boolean).join(' ')
}

function mealTypePrintLabel(value) {
  return ({ lunch_only: 'Lunch', dinner_only: 'Dinner', lunch_dinner: 'Lunch+Dinner' }[value] || '')
}

function durationPrintLabel(value) {
  return ({ weekly_5: '5 Hari', monthly_20: '20 Hari', monthly_36: '36 Hari', monthly_40: '40 Hari' }[value] || '')
}

function shortProgramLabel(value) {
  return String(value || '').replace(/Program/gi, '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim()
}

function isMotherhoodProgram(program) {
  return /promil|bumil|ivf/i.test(`${program?.name || ''} ${program?.category || ''}`)
}

function formatRouteDay(isoDate) {
  if (!isoDate) return '-'
  const date = new Date(`${isoDate}T00:00:00`)
  const weekday = date.toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase()
  return `${weekday} ${formatShortDate(isoDate)}`
}

function formatShortDate(isoDate) {
  if (!isoDate) return '--/--'
  const [year, month, day] = String(isoDate).split('-')
  if (!year || !month || !day) return '--/--'
  return `${day}/${month}`
}

function pairEntries(entries) {
  const rows = []
  for (let index = 0; index < entries.length; index += 2) rows.push([entries[index], entries[index + 1] || null])
  return rows
}

function sortSequence(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' })
}

function routeLabelToNumber(routeLabel) {
  const match = String(routeLabel || '').match(/(\d+)/)
  return Number(match?.[1] || 0)
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function formatAddress(value) {
  return String(value || '-').split(',').map((part) => part.trim()).filter(Boolean).join(',\n')
}

function isSameOrBefore(leftIso, rightIso) {
  if (!leftIso || !rightIso) return false
  return leftIso <= rightIso
}

function daysFromCreated(createdAt, selectedDate) {
  if (!createdAt || !selectedDate) return Number.POSITIVE_INFINITY
  const created = new Date(createdAt)
  const date = new Date(`${selectedDate}T00:00:00`)
  const diff = date.getTime() - created.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
