import { useMemo, useState } from 'react'
import { ChevronRight, LayoutGrid, List, MapPin, Plus, Printer, Trash2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { Button, Card, Input, todayISO } from '../components/ui.jsx'

const STATUS_CONFIG = {
  draft: { label: 'DRAFT', cls: 'bg-slate-200 text-slate-700' },
  finalized: { label: 'FINALIZED', cls: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'SEDANG JALAN', cls: 'bg-sky-100 text-sky-700' },
  completed: { label: 'SELESAI', cls: 'bg-teal/10 text-teal-dark' },
}

function formatDeliveryDate(isoDate) {
  if (!isoDate) return '-'
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function isToday(isoDate) {
  return isoDate === todayISO()
}

function startOfWeek(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

export default function RouteList() {
  const navigate = useNavigate()
  const { deliveryRoutes, deliveryRouteItems, users, zones, updateRoute, confirmAction, showToast } = useApp()

  const [view, setView] = useState('cards') // 'cards' | 'list'
  const [filter, setFilter] = useState('all') // 'all' | 'today' | 'week'
  const [dateFilter, setDateFilter] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const today = todayISO()
  const weekStart = startOfWeek(today)

  const filteredRoutes = useMemo(() => {
    let list = [...deliveryRoutes]

    // Date filter
    if (dateFilter) {
      list = list.filter((r) => r.deliveryDate === dateFilter)
    } else if (filter === 'today') {
      list = list.filter((r) => r.deliveryDate === today)
    } else if (filter === 'week') {
      list = list.filter((r) => r.deliveryDate >= weekStart && r.deliveryDate <= today)
    }

    // Driver search
    if (driverSearch.trim()) {
      const q = driverSearch.trim().toLowerCase()
      list = list.filter((r) => {
        const driver = users.find((u) => u.id === r.driverId)
        return (driver?.name || r.driverName || '').toLowerCase().includes(q)
      })
    }

    // Sort: newest date first, then by routeLabel
    list.sort((a, b) => {
      if (b.deliveryDate !== a.deliveryDate) return b.deliveryDate.localeCompare(a.deliveryDate)
      return (a.routeLabel || '').localeCompare(b.routeLabel || '', undefined, { numeric: true })
    })

    return list
  }, [deliveryRoutes, filter, dateFilter, driverSearch, today, weekStart, users])

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = new Map()
    for (const route of filteredRoutes) {
      const date = route.deliveryDate || 'unknown'
      if (!map.has(date)) map.set(date, [])
      map.get(date).push(route)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredRoutes])

  async function handleFinalize(route) {
    const ok = await confirmAction({
      title: `Finalize ${route.routeLabel}?`,
      description: 'Rute akan difinalisasi dan siap untuk dicetak.',
      confirmLabel: 'Finalize',
    })
    if (!ok) return
    await updateRoute({ ...route, status: 'finalized' }, '')
    showToast({ tone: 'success', message: `${route.routeLabel} berhasil difinalisasi.` })
  }

  async function handleMarkCompleted(route) {
    const ok = await confirmAction({
      title: `Tandai ${route.routeLabel} selesai?`,
      description: 'Status rute akan diubah menjadi Selesai.',
      confirmLabel: 'Tandai Selesai',
    })
    if (!ok) return
    await updateRoute({ ...route, status: 'completed' }, '')
    showToast({ tone: 'success', message: `${route.routeLabel} ditandai selesai.` })
  }

  async function handleDelete(route) {
    const ok = await confirmAction({
      title: `Hapus ${route.routeLabel}?`,
      description: 'Semua data pengiriman dalam rute ini akan dihapus.',
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!ok) return
    await updateRoute({ ...route, status: 'cancelled' }, '')
    showToast({ tone: 'success', message: `${route.routeLabel} berhasil dihapus.` })
  }

  const isEmpty = filteredRoutes.length === 0

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Daftar Rute</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Daftar Rute Pengiriman</h1>
            <p className="mt-2 text-sm text-slate-500">Kelola semua rute pengiriman driver harian.</p>
          </div>
          <Button
            onClick={() => navigate('/routes/builder')}
            className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark"
          >
            <Plus size={16} />
            Buat Rute Baru
          </Button>
        </header>

        {/* Filters */}
        <Card className="rounded-[28px] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-end gap-4">
            {/* Quick filter tabs */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'today', label: 'Hari Ini' },
                { id: 'week', label: 'Minggu Ini' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setFilter(tab.id); setDateFilter('') }}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    filter === tab.id && !dateFilter
                      ? 'bg-teal text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date picker */}
            <div className="flex-1 min-w-[160px] max-w-[200px]">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setFilter('all') }}
                placeholder="Pilih tanggal"
              />
            </div>

            {/* Driver search */}
            <div className="flex-1 min-w-[180px] max-w-[260px]">
              <Input
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Cari nama driver..."
              />
            </div>

            {/* View toggle */}
            <div className="ml-auto flex gap-1 rounded-2xl border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setView('cards')}
                className={`rounded-xl p-2 transition ${view === 'cards' ? 'bg-teal text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Grid Cards"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-xl p-2 transition ${view === 'list' ? 'bg-teal text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                title="List Table"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </Card>

        {/* Empty state */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
            <div className="text-6xl">🗺️</div>
            <div className="mt-4 text-xl font-semibold text-slate-700">Belum ada rute pengiriman</div>
            <div className="mt-2 text-sm text-slate-500">Buat rute pertama untuk mulai mengatur pengiriman driver</div>
            <Button
              onClick={() => navigate('/routes/builder')}
              className="mt-6 gap-2 rounded-2xl bg-teal px-5 py-3 hover:bg-teal-dark"
            >
              <Plus size={16} />
              Buat Rute Sekarang
            </Button>
          </div>
        ) : view === 'cards' ? (
          /* CARDS VIEW — grouped by date */
          <div className="space-y-8">
            {groupedByDate.map(([date, routes]) => (
              <section key={date}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                    {formatDeliveryDate(date)}
                    {isToday(date) && (
                      <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-white">HARI INI</span>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {routes.map((route) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      users={users}
                      zones={zones}
                      deliveryRouteItems={deliveryRouteItems}
                      onEdit={() => navigate(`/routes/builder?routeId=${route.id}`)}
                      onPrint={() => navigate(`/routes/print?date=${route.deliveryDate}&route=${route.id}`)}
                      onFinalize={() => handleFinalize(route)}
                      onComplete={() => handleMarkCompleted(route)}
                      onDelete={() => handleDelete(route)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <Card className="overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {['Label Rute', 'Driver', 'Zona', 'Tanggal', 'Customer', 'Status', 'Aksi'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route) => {
                    const driver = users.find((u) => u.id === route.driverId)
                    const zone = zones.find((z) => z.id === route.zoneId)
                    const items = deliveryRouteItems.filter((i) => i.routeId === route.id)
                    const statusCfg = STATUS_CONFIG[route.status] || STATUS_CONFIG.draft
                    return (
                      <tr key={route.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{route.routeLabel}</td>
                        <td className="px-4 py-3 text-slate-700">{driver?.name || route.driverName || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{zone?.name || route.zoneName || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDeliveryDate(route.deliveryDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{route.routePointCount || items.length} customer</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/routes/builder?routeId=${route.id}`)}
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/routes/print?date=${route.deliveryDate}&route=${route.id}`)}
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Printer size={12} /> Cetak
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(route)}
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 size={12} /> Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Route Card ──────────────────────────────────────────────────────────────

function RouteCard({ route, users, zones, deliveryRouteItems, onEdit, onPrint, onFinalize, onComplete, onDelete }) {
  const driver = users.find((u) => u.id === route.driverId)
  const zone = zones.find((z) => z.id === route.zoneId)
  const items = deliveryRouteItems
    .filter((i) => i.routeId === route.id)
    .sort((a, b) => String(a.sequenceNumber || '').localeCompare(String(b.sequenceNumber || ''), undefined, { numeric: true }))

  const statusCfg = STATUS_CONFIG[route.status] || STATUS_CONFIG.draft
  const customerCount = route.routePointCount || items.length
  const previewItems = items.slice(0, 3)
  const remaining = customerCount - previewItems.length

  return (
    <div className="flex flex-col rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <span className="font-bold text-slate-900">{route.routeLabel}</span>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusCfg.cls}`}>
          ● {statusCfg.label}
        </span>
      </div>

      {/* Card body */}
      <div className="flex-1 space-y-2 px-5 py-4 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <span>🚚</span>
          <span>Driver: <strong>{driver?.name || route.driverName || 'Belum ditentukan'}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-slate-400" />
          <span>Zona: {zone?.name || route.zoneName || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{formatDeliveryDate(route.deliveryDate)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-slate-100 px-5 py-3 text-sm">
        <span className="font-semibold text-slate-900">👥 {customerCount} customer</span>
        <span className="mx-2 text-slate-300">|</span>
        <span className="text-slate-500">POINT {route.routePointCount || customerCount}</span>
      </div>

      {/* Preview items */}
      {previewItems.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview customer</div>
          <ul className="space-y-1 text-xs text-slate-600">
            {previewItems.map((item) => (
              <li key={item.id} className="truncate">
                • {item.sequenceNumber} {item.customerName || 'Customer'}{item.programLabel ? ` — ${item.programLabel}` : ''}
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-slate-400">...dan {remaining} customer lainnya</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          🖨️ Cetak
        </button>
        {route.status === 'draft' && (
          <button
            type="button"
            onClick={onFinalize}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            ✅ Finalize
          </button>
        )}
        {route.status === 'in_progress' && (
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal/20 bg-teal/5 px-3 py-1.5 text-xs font-medium text-teal-dark transition hover:bg-teal/10"
          >
            🏁 Selesai
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
        >
          🗑️ Hapus
        </button>
      </div>
    </div>
  )
}
