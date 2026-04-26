import { useMemo, useState } from 'react'
import { ChevronRight, MapPin, Pencil, Plus, Power } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button, Card, Field, Input, Textarea } from '../components/ui.jsx'

const STORAGE_ZONES_KEY = 'gracious_zones_extra'

export default function ZoneManager() {
  const { rawDb, customers, users, deliveryRoutes } = useApp()
  const [zoneExtras, setZoneExtras] = useState(() => readStorageArray(STORAGE_ZONES_KEY))
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const zones = useMemo(() => mergeRecords(rawDb.zones || [], zoneExtras), [rawDb.zones, zoneExtras])

  function persistZones(next) {
    setZoneExtras(next)
    localStorage.setItem(STORAGE_ZONES_KEY, JSON.stringify(next))
  }

  function saveZonePatch(nextZone) {
    persistZones(upsertRecord(zoneExtras, nextZone))
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Manajemen Zona Pengiriman</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Manajemen Zona Pengiriman</h1>
          </div>
          <Button onClick={() => setModal({ type: 'create' })} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
            <Plus size={16} />
            Tambah Zona
          </Button>
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => {
            const customerCount = customers.filter((customer) => customer.zoneId === zone.id && customer.isActive !== false).length
            const driverCount = users.filter((user) => user.role === 'driver' && user.primaryZoneId === zone.id).length
            const routeCount = deliveryRoutes.filter((route) => route.zoneId === zone.id).length

            return (
              <Card key={zone.id} className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: zone.colorCode }} />
                      <h2 className="text-lg font-semibold text-slate-900">{zone.name}</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{zone.description || 'Belum ada deskripsi zona.'}</p>
                  </div>
                  <MapPin className="text-teal" size={18} />
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600">
                  <div>{customerCount} customer aktif</div>
                  <div>{driverCount} driver biasa handle zona ini</div>
                  <div>{routeCount} riwayat rute tercatat</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(zone.keywords || []).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {keyword}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <Button variant="secondary" onClick={() => setModal({ type: 'edit', zone })} className="gap-2 rounded-2xl px-4 py-3">
                    <Pencil size={15} />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      saveZonePatch({ ...zone, isActive: false })
                      setToast({ tone: 'success', message: `${zone.name} dinonaktifkan.` })
                    }}
                    className="gap-2 rounded-2xl px-4 py-3"
                  >
                    <Power size={15} />
                    Nonaktifkan
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {modal ? (
        <ZoneModal
          zone={modal.zone || null}
          onClose={() => setModal(null)}
          onSave={(form) => {
            saveZonePatch({
              id: form.id || `z-${Date.now()}`,
              name: form.name.trim(),
              colorCode: form.colorCode,
              description: form.description.trim(),
              keywords: form.keywords,
              isActive: true,
            })
            setModal(null)
            setToast({ tone: 'success', message: `Zona ${form.name} berhasil disimpan.` })
          }}
        />
      ) : null}
    </div>
  )
}

function ZoneModal({ zone, onClose, onSave }) {
  const [name, setName] = useState(zone?.name || '')
  const [colorCode, setColorCode] = useState(zone?.colorCode || '#0d9488')
  const [description, setDescription] = useState(zone?.description || '')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState(zone?.keywords || [])

  function addKeyword() {
    const value = keywordInput.trim().toLowerCase()
    if (!value || keywords.includes(value)) return
    setKeywords((current) => [...current, value])
    setKeywordInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <div className="text-xl font-semibold text-slate-900">{zone ? 'Edit Zona' : 'Tambah Zona'}</div>
          <div className="mt-1 text-sm text-slate-500">Keyword di sini dipakai untuk auto-detect zona dari alamat.</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nama Zona" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Warna">
            <Input type="color" value={colorCode} onChange={(event) => setColorCode(event.target.value)} className="h-11" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Deskripsi">
              <Textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Keywords">
              <div className="flex gap-2">
                <Input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="Tambah keyword zona" />
                <Button onClick={addKeyword} className="rounded-2xl bg-teal px-4 py-2 hover:bg-teal-dark">
                  Tambah
                </Button>
              </div>
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button key={keyword} type="button" onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {keyword} ×
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
            Batal
          </Button>
          <Button onClick={() => onSave({ id: zone?.id || '', name, colorCode, description, keywords })} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
            Simpan Zona
          </Button>
        </div>
      </div>
      <button type="button" onClick={onClose} className="absolute inset-0 -z-10 h-full w-full" aria-label="Tutup modal" />
    </div>
  )
}

function mergeRecords(base, extras) {
  const map = new Map()
  for (const item of base) if (item?.id) map.set(item.id, item)
  for (const item of extras) {
    if (!item?.id) continue
    if (item._deleted) map.delete(item.id)
    else map.set(item.id, { ...(map.get(item.id) || {}), ...item })
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

function ToastBanner({ toast }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{toast.message}</div>
}
