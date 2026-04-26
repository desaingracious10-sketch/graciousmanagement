import { useMemo, useState } from 'react'
import { ChevronRight, KeyRound, Pencil, Plus, Trash2, UserX } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Badge, Button, Card, Field, Input, Select, formatDate } from '../components/ui.jsx'

const STORAGE_USERS_KEY = 'gracious_users_extra'
const ROLE_OPTIONS = [
  { value: 'sales', label: 'Admin Sales' },
  { value: 'address_admin', label: 'Admin Alamat' },
  { value: 'driver', label: 'Driver' },
]

export default function UserManager() {
  const { rawDb, orders, deliveryRoutes } = useApp()
  const [userExtras, setUserExtras] = useState(() => readStorageArray(STORAGE_USERS_KEY))
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const users = useMemo(() => mergeRecords(rawDb.users || [], userExtras), [rawDb.users, userExtras])
  const hasSuperadmin = users.some((user) => user.role === 'superadmin' && user.isActive !== false)

  function persistUsers(next) {
    setUserExtras(next)
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(next))
  }

  function saveUserPatch(nextUser) {
    persistUsers(upsertRecord(userExtras, nextUser))
  }

  function handleSave(form) {
    const usernameExists = users.some(
      (user) => (user.username || '').toLowerCase() === form.username.trim().toLowerCase() && user.id !== form.id,
    )
    if (usernameExists) {
      setToast({ tone: 'error', message: 'Username sudah dipakai user lain.' })
      return
    }

    const payload = {
      id: form.id || `u-${Date.now()}`,
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      phone: form.phone.trim(),
      isActive: form.isActive,
      createdAt: form.createdAt || new Date().toISOString(),
      primaryZoneId: form.primaryZoneId || '',
      vehicleType: form.vehicleType || '',
      vehicleNumber: form.vehicleNumber || '',
    }

    saveUserPatch(payload)
    setModal(null)
    setToast({ tone: 'success', message: `User ${payload.name} berhasil disimpan.` })
  }

  function handleDeactivate(user) {
    saveUserPatch({ ...user, isActive: false })
    setToast({ tone: 'success', message: `${user.name} dinonaktifkan.` })
  }

  function handleDelete(user) {
    if (!window.confirm(`Hapus user ${user.name}?`)) return
    saveUserPatch({ id: user.id, _deleted: true })
    setToast({ tone: 'success', message: `${user.name} dihapus dari daftar.` })
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Manajemen User</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Manajemen User</h1>
            <p className="mt-2 text-sm text-slate-500">Buat dan kelola akun untuk tim Gracious.</p>
          </div>
          <Button onClick={() => setModal({ type: 'create' })} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
            <Plus size={16} />
            Tambah User
          </Button>
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        <Card className="overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['Nama', 'Username', 'Role', 'Status', 'Dibuat', 'Aksi'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-semibold text-slate-700">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="px-4 py-3 text-slate-700">@{user.username}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={user.isActive === false ? 'cancelled' : 'delivered'}>
                        {user.isActive === false ? 'Nonaktif' : 'Aktif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <InlineAction icon={Pencil} label="Edit" onClick={() => setModal({ type: 'edit', user })} />
                        <InlineAction icon={KeyRound} label="Reset Password" onClick={() => setModal({ type: 'password', user })} />
                        <InlineAction icon={UserX} label="Nonaktifkan" onClick={() => handleDeactivate(user)} danger />
                        <InlineAction icon={Trash2} label="Hapus" onClick={() => handleDelete(user)} danger />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modal?.type === 'create' || modal?.type === 'edit' ? (
        <UserFormModal
          user={modal.user || null}
          hasSuperadmin={hasSuperadmin}
          orders={orders}
          deliveryRoutes={deliveryRoutes}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      ) : null}

      {modal?.type === 'password' ? (
        <PasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={(password) => {
            saveUserPatch({ ...modal.user, password })
            setModal(null)
            setToast({ tone: 'success', message: `Password ${modal.user.name} berhasil direset.` })
          }}
        />
      ) : null}
    </div>
  )
}

function UserFormModal({ user, hasSuperadmin, orders, deliveryRoutes, onClose, onSave }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    id: user?.id || '',
    name: user?.name || '',
    username: user?.username || '',
    role: user?.role || 'sales',
    phone: user?.phone || '',
    password: user?.password || generatePassword(),
    sendInfo: false,
    isActive: user?.isActive ?? true,
    createdAt: user?.createdAt || '',
    primaryZoneId: user?.primaryZoneId || '',
    vehicleType: user?.vehicleType || '',
    vehicleNumber: user?.vehicleNumber || '',
  })

  const hasActiveData = Boolean(
    user &&
      ((user.role === 'sales' && orders.some((order) => order.createdBy === user.id)) ||
        ((user.role === 'address_admin' || user.role === 'driver') &&
          deliveryRoutes.some((route) => route.createdBy === user.id || route.driverId === user.id))),
  )

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <ModalShell title={isEdit ? 'Edit User' : 'Tambah User'} subtitle="Lengkapi data akun untuk tim Gracious." onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nama Lengkap" required>
          <Input value={form.name} onChange={(event) => patch('name', event.target.value)} />
        </Field>
        <Field label="Username" required>
          <Input value={form.username} onChange={(event) => patch('username', event.target.value)} />
        </Field>
        <Field label="Role" required>
          <Select value={form.role} onChange={(event) => patch('role', event.target.value)} disabled={hasActiveData}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={option.value === 'superadmin' || (option.value === 'sales' ? false : false)}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="No HP">
          <Input value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
        </Field>
        <Field label="Password Awal">
          <Input value={form.password} onChange={(event) => patch('password', event.target.value)} />
        </Field>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={form.sendInfo} onChange={(event) => patch('sendInfo', event.target.checked)} />
          Kirim info akun via manual copy
        </label>
      </div>

      {hasActiveData ? <div className="mt-4 text-sm text-amber-700">Role tidak bisa diubah karena user ini sudah memiliki data aktif.</div> : null}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button onClick={() => onSave(form)} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          Simpan User
        </Button>
      </div>
    </ModalShell>
  )
}

function PasswordModal({ user, onClose, onSave }) {
  const [password, setPassword] = useState(generatePassword())
  const [confirm, setConfirm] = useState(generatePassword())

  return (
    <ModalShell title="Reset Password" subtitle={`Atur password baru untuk ${user.name}.`} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Password Baru">
          <Input value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Field label="Konfirmasi Password">
          <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button onClick={() => password === confirm && onSave(password)} className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
          Simpan Password Baru
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
          <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
        </div>
        {children}
      </div>
      <button type="button" onClick={onClose} className="absolute inset-0 -z-10 h-full w-full" aria-label="Tutup modal" />
    </div>
  )
}

function InlineAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium ${danger ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'}`}>
      <Icon size={13} />
      {label}
    </button>
  )
}

function RoleBadge({ role }) {
  const map = {
    superadmin: { cls: 'bg-rose-100 text-rose-700', label: 'Admin Utama' },
    sales: { cls: 'bg-teal/10 text-teal-dark', label: 'Admin Sales' },
    address_admin: { cls: 'bg-sky-100 text-sky-700', label: 'Admin Alamat' },
    driver: { cls: 'bg-emerald-100 text-emerald-700', label: 'Driver' },
  }
  const current = map[role] || { cls: 'bg-slate-100 text-slate-600', label: role }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.cls}`}>{current.label}</span>
}

function generatePassword() {
  return `gracious${Math.random().toString(36).slice(2, 7)}`
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
  const cls = toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${cls}`}>{toast.message}</div>
}
