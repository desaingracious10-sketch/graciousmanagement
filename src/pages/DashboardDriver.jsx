import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Phone, Truck, Upload, X, XCircle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Button, Input, Textarea } from '../components/ui.jsx'

const TODAY_ISO = '2026-04-26'
const STORAGE_ROUTE_ITEMS_KEY = 'gracious_route_items_extra'

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Belum' },
  { id: 'done', label: 'Selesai' },
  { id: 'failed', label: 'Gagal' },
]

const FAILED_REASONS = ['Tidak ada orang', 'Alamat tidak ditemukan', 'Customer minta reschedule', 'Lainnya']

export default function DashboardDriver() {
  const { rawDb, deliveryRoutes, customers, orders, programs } = useApp()
  const currentUser = getStoredUser()
  const [filter, setFilter] = useState('all')
  const [routeItemExtras, setRouteItemExtras] = useState(() => readStorageArray(STORAGE_ROUTE_ITEMS_KEY))
  const [sheetState, setSheetState] = useState(null)
  const [toast, setToast] = useState(null)

  const deliveryRouteItems = useMemo(
    () => mergeRecords(rawDb.deliveryRouteItems || [], routeItemExtras),
    [rawDb.deliveryRouteItems, routeItemExtras],
  )

  const todaysRoute = useMemo(
    () =>
      deliveryRoutes.find(
        (route) => route.deliveryDate === TODAY_ISO && route.driverId === currentUser?.id,
      ) || null,
    [deliveryRoutes, currentUser],
  )

  const deliveryCards = useMemo(() => {
    if (!todaysRoute) return []

    return deliveryRouteItems
      .filter((item) => item.routeId === todaysRoute.id)
      .map((item) => {
        const customer = customers.find((entry) => entry.id === item.customerId)
        const order = orders.find((entry) => entry.id === item.orderId)
        const program = programs.find((entry) => entry.id === order?.programId)
        const localStatus = item.status || 'pending'
        const statusTone =
          localStatus === 'delivered'
            ? 'success'
            : localStatus === 'failed'
              ? 'failed'
              : 'pending'

        return {
          id: item.id,
          rawItem: item,
          sequenceNumber: item.sequenceNumber,
          status: localStatus,
          statusTone,
          customerName: customer?.name || item.customerId,
          packageName: shortProgramLabel(program?.name || order?.programId || '-'),
          deliveryAddress: item.deliveryAddress,
          deliveryNotes: item.deliveryNotes || '',
          dietaryNotes: item.dietaryNotes || order?.dietaryNotes || '',
          phone: customer?.phone || '-',
          untilDate: item.untilDate || order?.endDate || TODAY_ISO,
          metaBadge: computeMetaBadge(customer, order, item),
          proofOfDelivery: item.proofOfDelivery || null,
          failedReason: item.failedReason || '',
          completionNote: item.completionNote || '',
        }
      })
      .sort((a, b) => sortSequence(a.sequenceNumber, b.sequenceNumber))
  }, [todaysRoute, deliveryRouteItems, customers, orders, programs])

  const filteredCards = useMemo(() => {
    if (filter === 'pending') return deliveryCards.filter((item) => item.status === 'pending')
    if (filter === 'done') return deliveryCards.filter((item) => item.status === 'delivered')
    if (filter === 'failed') return deliveryCards.filter((item) => item.status === 'failed')
    return deliveryCards
  }, [deliveryCards, filter])

  const completedCount = deliveryCards.filter((item) => item.status === 'delivered').length
  const failedCount = deliveryCards.filter((item) => item.status === 'failed').length
  const pendingCount = deliveryCards.filter((item) => item.status === 'pending').length
  const progressPercent = deliveryCards.length
    ? ((completedCount + failedCount) / deliveryCards.length) * 100
    : 0
  const allFinished = deliveryCards.length > 0 && pendingCount === 0

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function persistRouteItems(nextItems) {
    setRouteItemExtras(nextItems)
    localStorage.setItem(STORAGE_ROUTE_ITEMS_KEY, JSON.stringify(nextItems))
  }

  function saveRouteItemPatch(nextItem) {
    persistRouteItems(upsertRecord(routeItemExtras, nextItem))
  }

  function openDeliveredSheet(item) {
    setSheetState({
      mode: 'delivered',
      item,
      note: '',
      proof: null,
      proofPreview: '',
      otherReason: '',
      reason: FAILED_REASONS[0],
    })
  }

  function openFailedSheet(item) {
    setSheetState({
      mode: 'failed',
      item,
      note: '',
      proof: null,
      proofPreview: '',
      otherReason: '',
      reason: FAILED_REASONS[0],
    })
  }

  function patchSheet(field, value) {
    setSheetState((current) => (current ? { ...current, [field]: value } : current))
  }

  function handleProofUpload(event) {
    const file = event.target.files?.[0]
    if (!file || !sheetState) return

    const reader = new FileReader()
    reader.onload = () => {
      setSheetState((current) =>
        current
          ? {
              ...current,
              proof: {
                name: file.name,
                size: file.size,
                type: file.type,
                preview: typeof reader.result === 'string' ? reader.result : '',
              },
              proofPreview: typeof reader.result === 'string' ? reader.result : '',
            }
          : current,
      )
    }
    reader.readAsDataURL(file)
  }

  function submitDelivered() {
    if (!sheetState?.item) return
    const nextItem = {
      ...sheetState.item.rawItem,
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      completionNote: sheetState.note.trim(),
      deliveryNotes: sheetState.note.trim() || sheetState.item.rawItem.deliveryNotes || '',
      proofOfDelivery: sheetState.proof
        ? {
            name: sheetState.proof.name,
            type: sheetState.proof.type,
            size: sheetState.proof.size,
            preview: sheetState.proof.preview,
          }
        : sheetState.item.rawItem.proofOfDelivery || null,
    }
    saveRouteItemPatch(nextItem)
    setSheetState(null)
    setToast({ tone: 'success', message: `✅ ${sheetState.item.customerName} — Terkirim!` })
  }

  function submitFailed() {
    if (!sheetState?.item) return
    if (sheetState.reason === 'Lainnya' && !sheetState.otherReason.trim()) return

    const reasonText =
      sheetState.reason === 'Lainnya' ? sheetState.otherReason.trim() : sheetState.reason

    const nextItem = {
      ...sheetState.item.rawItem,
      status: 'failed',
      failedAt: new Date().toISOString(),
      failedReason: reasonText,
      deliveryNotes: reasonText,
    }
    saveRouteItemPatch(nextItem)
    setSheetState(null)
    setToast({ tone: 'failed', message: `❌ ${sheetState.item.customerName} — Gagal, dicatat.` })
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-28">
      {toast ? <ToastBanner toast={toast} /> : null}

      {todaysRoute ? (
        <>
          <section className="bg-teal px-4 pb-6 pt-6 text-white shadow-[0_16px_30px_rgba(13,148,136,0.25)]">
            <div className="mx-auto max-w-2xl">
              <div className="text-2xl font-semibold tracking-tight">
                🚚 RUTE {todaysRoute.routeLabel.replace('RUTE ', '')} -{' '}
                {(currentUser?.name || 'Driver').toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-white/90">
                Minggu, 26 April 2026 | {deliveryCards.length} titik pengiriman
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {completedCount + failedCount} dari {deliveryCards.length} selesai
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-2xl px-4 py-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
                    filter === chip.id
                      ? 'bg-teal text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-2xl space-y-4 px-4">
            {filteredCards.map((item) => (
              <article
                key={item.id}
                className={`rounded-[28px] border p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition ${
                  item.statusTone === 'success'
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : item.statusTone === 'failed'
                      ? 'border-rose-200 bg-rose-50/80'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <span>{item.sequenceNumber}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{item.customerName}</h2>
                      {item.status === 'delivered' ? <CheckCircle2 size={22} className="text-emerald-600" /> : null}
                    </div>
                    <div className="mt-1 text-sm font-medium text-teal-dark">{item.packageName}</div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="mb-1 font-semibold text-slate-900">📍 Alamat pengiriman</div>
                    <div className="leading-6">{item.deliveryAddress}</div>
                  </div>

                  {item.deliveryNotes ? (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">
                      <div className="font-semibold">⚠️ Catatan pengiriman</div>
                      <div className="mt-1">{item.deliveryNotes}</div>
                    </div>
                  ) : null}

                  {item.dietaryNotes ? (
                    <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-900">
                      <div className="font-semibold">🚫 Pantangan makan</div>
                      <div className="mt-1">{item.dietaryNotes}</div>
                    </div>
                  ) : null}

                  {item.status === 'failed' && item.failedReason ? (
                    <div className="rounded-2xl bg-rose-100 px-4 py-3 text-rose-900">
                      <div className="font-semibold">Alasan gagal</div>
                      <div className="mt-1">{item.failedReason}</div>
                    </div>
                  ) : null}

                  {item.status === 'delivered' && item.completionNote ? (
                    <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-emerald-900">
                      <div className="font-semibold">Catatan diterima</div>
                      <div className="mt-1">{item.completionNote}</div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col gap-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-800">📞 No HP: {item.phone}</div>
                      <div className="text-slate-500">UNTIL: {formatLongDate(item.untilDate)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.metaBadge ? <MetaBadge badge={item.metaBadge} /> : null}
                      <a
                        href={`tel:${item.phone}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        <Phone size={15} />
                        Call / WA
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => openDeliveredSheet(item)}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-base font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={18} />
                      TERKIRIM
                    </button>
                    <button
                      type="button"
                      onClick={() => openFailedSheet(item)}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-base font-semibold text-white transition hover:bg-rose-700"
                    >
                      <XCircle size={18} />
                      GAGAL / TIDAK ADA
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Progress: {completedCount + failedCount}/{deliveryCards.length} titik selesai
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {allFinished
                      ? '🎉 Semua pengiriman selesai! Hari ini sudah tuntas.'
                      : `${pendingCount} belum, ${failedCount} gagal / tidak ada`}
                  </div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal-dark">
                  <Truck size={20} />
                </div>
              </div>
            </div>
          </section>

          {allFinished ? (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 px-4">
              <div className="w-full max-w-md rounded-[32px] border border-emerald-200 bg-white p-6 text-center shadow-2xl">
                <div className="text-3xl">🎉</div>
                <h3 className="mt-3 text-2xl font-semibold text-slate-900">Semua Pengiriman Hari Ini Selesai!</h3>
                <p className="mt-3 text-sm text-slate-600">
                  {completedCount} Terkirim | {failedCount} Gagal
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Terima kasih, {currentUser?.name || 'Driver'}! Kerja keras hari ini sudah tuntas.
                </p>
              </div>
            </div>
          ) : null}

          {sheetState ? (
            <BottomSheet onClose={() => setSheetState(null)}>
              {sheetState.mode === 'delivered' ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Konfirmasi Pengiriman</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Paket untuk <span className="font-medium text-slate-700">{sheetState.item.customerName}</span> sudah diterima?
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Catatan opsional</label>
                    <Textarea
                      rows={3}
                      value={sheetState.note}
                      onChange={(event) => patchSheet('note', event.target.value)}
                      placeholder="Contoh: Dititip satpam, diterima resepsionis, dan sebagainya"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Upload foto bukti - opsional</label>
                    <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-600">
                      <Upload size={16} />
                      Pilih foto bukti
                      <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                    </label>
                    {sheetState.proofPreview ? (
                      <img src={sheetState.proofPreview} alt="Preview bukti" className="mt-3 h-32 w-full rounded-2xl object-cover" />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setSheetState(null)} className="rounded-2xl px-4 py-3">
                      Batal
                    </Button>
                    <Button onClick={submitDelivered} className="rounded-2xl bg-emerald-600 px-4 py-3 hover:bg-emerald-700">
                      Ya, Tandai Terkirim
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Alasan gagal</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Pilih alasan untuk <span className="font-medium text-slate-700">{sheetState.item.customerName}</span>.
                    </div>
                  </div>

                  <div className="space-y-2">
                    {FAILED_REASONS.map((reason) => (
                      <label key={reason} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="failedReason"
                          value={reason}
                          checked={sheetState.reason === reason}
                          onChange={(event) => patchSheet('reason', event.target.value)}
                        />
                        {reason}
                      </label>
                    ))}
                  </div>

                  {sheetState.reason === 'Lainnya' ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Keterangan wajib</label>
                      <Input
                        value={sheetState.otherReason}
                        onChange={(event) => patchSheet('otherReason', event.target.value)}
                        placeholder="Jelaskan alasan gagal pengiriman"
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setSheetState(null)} className="rounded-2xl px-4 py-3">
                      Batal
                    </Button>
                    <Button onClick={submitFailed} variant="danger" className="rounded-2xl px-4 py-3">
                      Tandai Gagal
                    </Button>
                  </div>
                </div>
              )}
            </BottomSheet>
          ) : null}
        </>
      ) : (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle size={20} />
              <div className="text-lg font-semibold">Belum ada rute untuk driver ini hari ini.</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Dashboard driver hanya menampilkan rute aktif milik driver yang login. Pastikan driver sudah di-assign ke rute untuk tanggal {TODAY_ISO}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function BottomSheet({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/35">
      <button type="button" aria-label="Tutup" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-[32px] bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="h-1.5 w-16 rounded-full bg-slate-200" />
        </div>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ToastBanner({ toast }) {
  const cls =
    toast.tone === 'failed'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return (
    <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${cls}`}>
      {toast.message}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending: 'bg-slate-100 text-slate-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  }

  const label = {
    pending: 'Belum',
    delivered: 'Selesai',
    failed: 'Gagal',
  }[status] || status

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || map.pending}`}>{label}</span>
}

function MetaBadge({ badge }) {
  const styles = {
    habis: 'bg-slate-200 text-slate-700',
    pindah_alamat: 'bg-rose-100 text-rose-700',
    baru: 'bg-sky-100 text-sky-700',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${styles[badge.type] || styles.baru}`}>
      {badge.label}
    </span>
  )
}

function computeMetaBadge(customer, order, item) {
  if (item.statusLabel === 'pindah_alamat' || (customer?.addressNotes || '').toLowerCase().includes('pindah')) {
    return { type: 'pindah_alamat', label: 'Pindah Alamat' }
  }
  if (order?.endDate === TODAY_ISO || order?.endDate === '2026-04-25') {
    return { type: 'habis', label: 'Habis' }
  }
  if (order?.createdAt?.startsWith(TODAY_ISO)) {
    return { type: 'baru', label: 'Baru' }
  }
  return null
}

function shortProgramLabel(name) {
  return String(name)
    .replace('Program', '')
    .replace('Diet', '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatLongDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function sortSequence(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
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
