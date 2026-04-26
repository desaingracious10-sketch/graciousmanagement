import { useMemo, useState } from 'react'
import { ChevronRight, MessageCircle, Pencil, Plus, Route } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Button, Card, Field, Input, Select } from '../components/ui.jsx'

const STORAGE_USERS_KEY = 'gracious_users_extra'

export default function DriverList() {
  const currentUser = getStoredUser()
  const { users, zones, deliveryRoutes, deliveryRouteItems } = useApp()
  const [userExtras, setUserExtras] = useState(() => readStorageArray(STORAGE_USERS_KEY))
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const allUsers = useMemo(() => mergeRecords(users, userExtras), [users, userExtras])
  const drivers = allUsers.filter((user) => user.role === 'driver' && !user._deleted)
  const todayRoutes = deliveryRoutes.filter((route) => route.deliveryDate === '2026-04-26')

  function persistUsers(next) {
    setUserExtras(next)
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(next))
  }

  function saveDriverPatch(nextDriver) {
    persistUsers(upsertRecord(userExtras, nextDriver))
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Daftar Driver</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Daftar Driver</h1>
          </div>
          {currentUser?.role === 'superadmin' ? (
            <Button onClick={() => setModal({ type: 'create' })} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Plus size={16} />
              Tambah Driver
            </Button>
          ) : null}
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {drivers.map((driver) => {
            const mainZone = zones.find((zone) => zone.id === driver.primaryZoneId)
            const routeToday = todayRoutes.find((route) => route.driverId === driver.id) || null
            const assignedPoints = routeToday ? deliveryRouteItems.filter((item) => item.routeId === routeToday.id).length : 0
            const status = routeToday ? 'Bertugas' : driver.isActive === false ? 'Libur' : 'Tersedia'

            return (
              <Card key={driver.id} className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-teal/10 text-xl font-semibold text-teal-dark">
                      {driver.name?.[0] || 'D'}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{driver.name}</div>
                      <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Driver
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>Zona utama: {mainZone?.name || 'Belum diatur'}</div>
                  <div>Status hari ini: {status}</div>
                  <div>Jumlah titik hari ini: {assignedPoints}</div>
                  <a href={`https://wa.me/62${String(driver.phone || '').replace(/^0/, '')}`} className="inline-flex items-center gap-2 text-teal-dark hover:underline">
                    <MessageCircle size={15} />
                    {driver.phone || 'Belum ada nomor'}
                  </a>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setModal({ type: 'edit', driver })} className="gap-2 rounded-2xl px-4 py-3">
                    <Pencil size={15} />
                    Edit
                  </Button>
                  <Button variant="secondary" className="gap-2 rounded-2xl px-4 py-3">
                    <Route size={15} />
                    Lihat Rute Hari Ini
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {modal ? (
        <DriverModal
          driver={modal.driver || null}
          zones={zones}
          onClose={() => setModal(null)}
          onSave={(form) => {
            saveDriverPatch({
              id: form.id || `u-driver-${Date.now()}`,
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              password: form.password,
              role: 'driver',
              phone: form.phone.trim(),
              isActive: true,
              createdAt: form.createdAt || new Date().toISOString(),
              primaryZoneId: form.primaryZoneId,
              vehicleType: form.vehicleType,
              vehicleNumber: form.vehicleNumber,
            })
            setModal(null)
            setToast({ tone: 'success', message: `Driver ${form.name} berhasil disimpan.` })
          }}
        />
      ) : null}
    </div>
  )
}

function DriverModal({ driver, zones, onClose, onSave }) {
  const [form, setForm] = useState({
    id: driver?.id || '',
    name: driver?.name || '',
    email: driver?.email || '',
    phone: driver?.phone || '',
    password: driver?.password || `driver${Math.random().toString(36).slice(2, 7)}`,
    createdAt: driver?.createdAt || '',
    primaryZoneId: driver?.primaryZoneId || '',
    vehicleType: driver?.vehicleType || '',
    vehicleNumber: driver?.vehicleNumber || '',
  })

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <div className="text-xl font-semibold text-slate-900">{driver ? 'Edit Driver' : 'Tambah Driver'}</div>
          <div className="mt-1 text-sm text-slate-500">Lengkapi akun driver dan data operasional kendaraannya.</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nama Lengkap" required>
            <Input value={form.name} onChange={(event) => patch('name', event.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input value={form.email} onChange={(event) => patch('email', event.target.value)} />
          </Field>
          <Field label="No HP">
            <Input value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
          </Field>
          <Field label="Password Awal">
            <Input value={form.password} onChange={(event) => patch('password', event.target.value)} />
          </Field>
          <Field label="Zona Utama">
            <Select value={form.primaryZoneId} onChange={(event) => patch('primaryZoneId', event.target.value)}>
              <option value="">Pilih zona</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jenis Kendaraan">
            <Input value={form.vehicleType} onChange={(event) => patch('vehicleType', event.target.value)} />
          </Field>
          <Field label="Nomor Kendaraan">
            <Input value={form.vehicleNumber} onChange={(event) => patch('vehicleNumber', event.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
            Batal
          </Button>
          <Button onClick={() => onSave(form)} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
            Simpan Driver
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
