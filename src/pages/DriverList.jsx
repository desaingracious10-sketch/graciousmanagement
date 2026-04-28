import { useMemo, useState } from 'react'
import { ChevronRight, KeyRound, MessageCircle, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { Badge, Button, Card, Field, Input, Select } from '../components/ui.jsx'

const VEHICLE_OPTIONS = [
  { value: '', label: '— Pilih kendaraan —' },
  { value: 'motor', label: 'Motor' },
  { value: 'mobil', label: 'Mobil' },
  { value: 'pickup', label: 'Pickup' },
]

const VEHICLE_LABEL = {
  motor: 'Motor',
  mobil: 'Mobil',
  pickup: 'Pickup',
}

function randomPassword() {
  return `drv${Math.random().toString(36).slice(2, 8)}`
}

export default function DriverList() {
  const currentUser = getStoredUser()
  const { drivers, zones, deliveryRoutes, deliveryRouteItems, addDriver, updateDriver, deleteDriver, confirmAction, showToast } =
    useApp()
  const [modal, setModal] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)

  const isSuperadmin = currentUser?.role === 'superadmin'
  const today = new Date().toISOString().slice(0, 10)
  const todayRoutes = useMemo(
    () => deliveryRoutes.filter((route) => route.deliveryDate === today),
    [deliveryRoutes, today],
  )

  const visibleDrivers = useMemo(() => drivers.filter((d) => d.isActive !== false), [drivers])

  async function handleSave(form) {
    const usernameTaken = drivers.some(
      (d) => (d.username || '').toLowerCase() === form.username.trim().toLowerCase() && d.id !== form.id,
    )
    if (usernameTaken) {
      showToast({ tone: 'error', message: 'Username sudah dipakai driver lain.' })
      return
    }

    const isNew = !form.id

    if (isNew) {
      const payload = {
        // Schema drivers.id bertipe TEXT (sama seperti users/customers/dst).
        // Generate sendiri di client supaya tidak bergantung default DB.
        id: `drv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        primaryZoneId: form.primaryZoneId || null,
        vehicleType: form.vehicleType || null,
        vehicleNumber: form.vehicleNumber.trim() || null,
        notes: form.notes.trim() || null,
        isActive: true,
      }
      try {
        await addDriver(payload)
        setModal(null)
        setSuccessInfo({
          name: payload.name,
          username: payload.username,
          password: form.password,
        })
      } catch {
        // toast handled
      }
    } else {
      const updates = {
        id: form.id,
        name: form.name.trim(),
        // Username TIDAK boleh diubah supaya login tidak rusak
        phone: form.phone.trim(),
        primaryZoneId: form.primaryZoneId || null,
        vehicleType: form.vehicleType || null,
        vehicleNumber: form.vehicleNumber.trim() || null,
        notes: form.notes.trim() || null,
        ...(form.password ? { password: form.password } : {}),
      }
      try {
        await updateDriver(updates, `Driver ${updates.name} berhasil diperbarui.`)
        setModal(null)
      } catch {
        // toast handled
      }
    }
  }

  async function handleDelete(driver) {
    const ok = await confirmAction({
      title: `Hapus driver ${driver.name}?`,
      description: 'Driver akan dinonaktifkan dan tidak bisa login lagi. Riwayat rute tetap tersimpan.',
      confirmLabel: 'Ya, Hapus',
      danger: true,
    })
    if (!ok) return
    await deleteDriver(driver.id, `Driver ${driver.name} berhasil dihapus.`)
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Manajemen Driver</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Manajemen Driver</h1>
            <p className="mt-2 text-sm text-slate-500">
              Kelola akun driver, kendaraan, dan zona operasi. Driver login pakai username yang dibuat di sini.
            </p>
          </div>
          {isSuperadmin ? (
            <Button onClick={() => setModal({ type: 'create' })} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Plus size={16} />
              Tambah Driver
            </Button>
          ) : null}
        </header>

        {visibleDrivers.length === 0 ? (
          <Card className="rounded-[28px] p-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/10 text-3xl">🚚</div>
            <div className="mt-4 text-lg font-semibold text-slate-900">Belum ada driver aktif</div>
            <p className="mt-1 text-sm text-slate-500">
              {isSuperadmin
                ? 'Klik "Tambah Driver" untuk membuat akun driver pertama.'
                : 'Hanya Admin Utama yang bisa menambah driver.'}
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleDrivers.map((driver) => {
              const mainZone = zones.find((zone) => zone.id === driver.primaryZoneId)
              const routeToday = todayRoutes.find((route) => route.driverId === driver.id) || null
              const assignedPoints = routeToday
                ? deliveryRouteItems.filter((item) => item.routeId === routeToday.id).length
                : 0
              const status = routeToday
                ? { label: 'Bertugas', tone: 'in_progress' }
                : driver.isActive === false
                  ? { label: 'Nonaktif', tone: 'cancelled' }
                  : { label: 'Tersedia', tone: 'delivered' }

              return (
                <Card key={driver.id} className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-teal/10 text-xl font-semibold text-teal-dark">
                        {driver.name?.[0]?.toUpperCase() || 'D'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{driver.name}</div>
                        <div className="text-xs text-slate-500">@{driver.username}</div>
                      </div>
                    </div>
                    <Badge status={status.tone}>{status.label}</Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div>📍 Zona: {mainZone?.name || 'Belum diatur'}</div>
                    <div>
                      🚗 {VEHICLE_LABEL[driver.vehicleType] || 'Belum ada'}
                      {driver.vehicleNumber ? ` — ${driver.vehicleNumber}` : ''}
                    </div>
                    <div>📦 Titik hari ini: {assignedPoints}</div>
                    {driver.phone ? (
                      <a
                        href={`https://wa.me/62${String(driver.phone).replace(/^0/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-teal-dark hover:underline"
                      >
                        <MessageCircle size={15} />
                        {driver.phone}
                      </a>
                    ) : (
                      <div className="text-slate-400">Belum ada nomor HP</div>
                    )}
                    {driver.notes ? (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">📝 {driver.notes}</div>
                    ) : null}
                  </div>

                  {isSuperadmin ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setModal({ type: 'edit', driver })}
                        className="gap-2 rounded-2xl px-3 py-2"
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setModal({ type: 'password', driver })}
                        className="gap-2 rounded-2xl px-3 py-2"
                      >
                        <KeyRound size={14} />
                        Reset PW
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleDelete(driver)}
                        className="gap-2 rounded-2xl px-3 py-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                        Hapus
                      </Button>
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {modal?.type === 'create' || modal?.type === 'edit' ? (
        <DriverFormModal
          driver={modal.driver || null}
          zones={zones}
          onClose={() => setModal(null)}
          onSave={(form) => void handleSave(form)}
        />
      ) : null}

      {modal?.type === 'password' ? (
        <PasswordModal
          driver={modal.driver}
          onClose={() => setModal(null)}
          onSave={async (password) => {
            await updateDriver(
              { id: modal.driver.id, password },
              `Password driver ${modal.driver.name} berhasil direset.`,
            )
            setModal(null)
          }}
        />
      ) : null}

      {successInfo ? <SuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} /> : null}
    </div>
  )
}

function DriverFormModal({ driver, zones, onClose, onSave }) {
  const isEdit = !!driver
  const [form, setForm] = useState({
    id: driver?.id || '',
    name: driver?.name || '',
    username: driver?.username || '',
    password: isEdit ? '' : randomPassword(),
    confirmPassword: isEdit ? '' : '',
    phone: driver?.phone || '',
    primaryZoneId: driver?.primaryZoneId || '',
    vehicleType: driver?.vehicleType || '',
    vehicleNumber: driver?.vehicleNumber || '',
    notes: driver?.notes || '',
  })
  const [errors, setErrors] = useState({})

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Nama wajib diisi'
    if (!form.username.trim()) next.username = 'Username wajib diisi'
    else if (form.username.trim().length < 4) next.username = 'Minimal 4 karakter'
    else if (/\s/.test(form.username)) next.username = 'Tidak boleh ada spasi'

    if (!isEdit) {
      if (!form.password) next.password = 'Password wajib diisi'
      else if (form.password.length < 6) next.password = 'Minimal 6 karakter'
      if (!form.confirmPassword) next.confirmPassword = 'Konfirmasi password wajib diisi'
      else if (form.password !== form.confirmPassword) next.confirmPassword = 'Konfirmasi tidak cocok'
    } else if (form.password) {
      if (form.password.length < 6) next.password = 'Minimal 6 karakter'
      if (form.password !== form.confirmPassword) next.confirmPassword = 'Konfirmasi tidak cocok'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave(form)
  }

  return (
    <ModalShell title={isEdit ? 'Edit Driver' : 'Tambah Driver'} onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nama Lengkap" required>
          <Input value={form.name} onChange={(e) => patch('name', e.target.value)} className={errors.name ? 'border-rose-400' : ''} />
          {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name}</p> : null}
        </Field>
        <Field label="Username (untuk login)" required>
          <Input
            value={form.username}
            onChange={(e) => patch('username', e.target.value)}
            disabled={isEdit}
            className={errors.username ? 'border-rose-400' : ''}
            placeholder="contoh: budi.driver"
          />
          {errors.username ? (
            <p className="mt-1 text-xs text-rose-600">{errors.username}</p>
          ) : isEdit ? (
            <p className="mt-1 text-xs text-slate-400">Username tidak bisa diubah.</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Lowercase, tanpa spasi.</p>
          )}
        </Field>
        <Field label="No HP">
          <Input value={form.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
        </Field>
        <Field label="Zona Utama">
          <Select value={form.primaryZoneId} onChange={(e) => patch('primaryZoneId', e.target.value)}>
            <option value="">— Pilih zona —</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis Kendaraan">
          <Select value={form.vehicleType} onChange={(e) => patch('vehicleType', e.target.value)}>
            {VEHICLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nomor Kendaraan">
          <Input value={form.vehicleNumber} onChange={(e) => patch('vehicleNumber', e.target.value)} placeholder="B 1234 XX" />
        </Field>
        <Field label={isEdit ? 'Password Baru (kosongkan = tidak ganti)' : 'Password Awal *'} required={!isEdit}>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => patch('password', e.target.value)}
            placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'}
            className={errors.password ? 'border-rose-400' : ''}
          />
          {errors.password ? <p className="mt-1 text-xs text-rose-600">{errors.password}</p> : null}
        </Field>
        <Field label="Konfirmasi Password" required={!isEdit || !!form.password}>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => patch('confirmPassword', e.target.value)}
            disabled={isEdit && !form.password}
            className={errors.confirmPassword ? 'border-rose-400' : ''}
          />
          {errors.confirmPassword ? <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword}</p> : null}
        </Field>
        <div className="md:col-span-2">
          <Field label="Catatan">
            <Input
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
              placeholder="Catatan opsional (jam kerja, dll)"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button onClick={handleSubmit} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          <Truck size={16} className="mr-2" />
          {isEdit ? 'Simpan Perubahan' : 'Simpan Driver'}
        </Button>
      </div>
    </ModalShell>
  )
}

function PasswordModal({ driver, onClose, onSave }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})

  function handleSave() {
    const next = {}
    if (!password) next.password = 'Password wajib diisi'
    else if (password.length < 6) next.password = 'Minimal 6 karakter'
    if (!confirm) next.confirm = 'Konfirmasi wajib diisi'
    else if (password !== confirm) next.confirm = 'Tidak cocok'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(password)
  }

  return (
    <ModalShell title="Reset Password Driver" subtitle={`Atur password baru untuk ${driver.name}.`} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Password Baru" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((c) => ({ ...c, password: '' }))
            }}
            className={errors.password ? 'border-rose-400' : ''}
          />
          {errors.password ? <p className="mt-1 text-xs text-rose-600">{errors.password}</p> : null}
        </Field>
        <Field label="Konfirmasi Password" required>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              if (errors.confirm) setErrors((c) => ({ ...c, confirm: '' }))
            }}
            className={errors.confirm ? 'border-rose-400' : ''}
          />
          {errors.confirm ? <p className="mt-1 text-xs text-rose-600">{errors.confirm}</p> : null}
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button onClick={handleSave} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          Simpan Password Baru
        </Button>
      </div>
    </ModalShell>
  )
}

function SuccessModal({ info, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = `Nama: ${info.name}\nUsername: ${info.username}\nPassword: ${info.password}\nLogin: dashboard Gracious`

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <ModalShell title="Driver Berhasil Dibuat!" subtitle="Salin info ini dan kirim ke driver yang bersangkutan." onClose={onClose}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Nama</span>
          <span className="font-semibold text-slate-900">{info.name}</span>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span className="text-slate-500">Username</span>
          <span className="font-semibold text-slate-900">@{info.username}</span>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span className="text-slate-500">Password</span>
          <span className="font-semibold text-teal-dark">{info.password}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-amber-700">⚠️ Password hanya ditampilkan sekali. Pastikan sudah dicatat sebelum menutup.</p>
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" onClick={handleCopy} className="flex-1 rounded-2xl px-4 py-3">
          {copied ? 'Tersalin!' : 'Salin Info Akun'}
        </Button>
        <Button onClick={onClose} className="flex-1 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          Tutup
        </Button>
      </div>
    </ModalShell>
  )
}

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <div className="text-xl font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        {children}
      </div>
      <button type="button" onClick={onClose} className="absolute inset-0 -z-10 h-full w-full" aria-label="Tutup modal" />
    </div>
  )
}
