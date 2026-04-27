import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronRight, HardDrive, KeyRound, Pencil, Plus, Trash2, UserX } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { deleteFilesOlderThan, getStorageUsage } from '../lib/imageUpload.js'
import { Badge, Button, Card, Field, Input, Select, formatDate } from '../components/ui.jsx'

const ROLE_OPTIONS = [
  { value: 'sales', label: 'Admin Sales' },
  { value: 'address_admin', label: 'Admin Alamat' },
  { value: 'driver', label: 'Driver' },
]

const TABS = [
  { id: 'users', label: 'Data User', icon: BarChart3 },
  { id: 'storage', label: 'Storage Manager', icon: HardDrive },
]

export default function UserManager() {
  const { users, orders, deliveryRoutes, addUser, updateUser, deleteUser, showToast } = useApp()
  const [activeTab, setActiveTab] = useState('users')
  const [modal, setModal] = useState(null)
  const [storage, setStorage] = useState(null)
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)
  const [isCleaningStorage, setIsCleaningStorage] = useState(false)

  const hasSuperadmin = users.some((user) => user.role === 'superadmin' && user.isActive !== false)

  useEffect(() => {
    if (activeTab !== 'storage') return
    void refreshStorage()
  }, [activeTab])

  async function refreshStorage() {
    setIsLoadingStorage(true)
    try {
      setStorage(await getStorageUsage())
    } catch (error) {
      console.error('[Gracious] load storage usage failed:', error)
      showToast({ tone: 'error', message: error?.message || 'Gagal membaca usage storage.' })
    } finally {
      setIsLoadingStorage(false)
    }
  }

  async function handleSave(form) {
    const usernameExists = users.some(
      (user) => (user.username || '').toLowerCase() === form.username.trim().toLowerCase() && user.id !== form.id,
    )
    if (usernameExists) {
      showToast({ tone: 'error', message: 'Username sudah dipakai user lain.' })
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

    if (form.id) await updateUser(payload)
    else await addUser(payload)
    setModal(null)
  }

  async function handleDeactivate(user) {
    await deleteUser(user.id)
  }

  async function handleDeleteOldFiles() {
    setIsCleaningStorage(true)
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const [transfer, menu, delivery] = await Promise.all([
        deleteFilesOlderThan({ bucket: 'transfer-proofs', folder: 'orders', cutoffDate }),
        deleteFilesOlderThan({ bucket: 'menu-images', folder: 'weekly', cutoffDate }),
        deleteFilesOlderThan({ bucket: 'delivery-photos', folder: 'items', cutoffDate }),
      ])
      await refreshStorage()
      showToast({
        tone: 'success',
        message: `${transfer.deletedCount + menu.deletedCount + delivery.deletedCount} file lebih dari 3 bulan berhasil dihapus.`,
      })
    } catch (error) {
      console.error('[Gracious] cleanup storage failed:', error)
      showToast({ tone: 'error', message: error?.message || 'Gagal membersihkan file lama.' })
    } finally {
      setIsCleaningStorage(false)
    }
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
            <p className="mt-2 text-sm text-slate-500">Kelola akun tim dan pantau penggunaan storage operasional.</p>
          </div>
          {activeTab === 'users' ? (
            <Button onClick={() => setModal({ type: 'create' })} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Plus size={16} />
              Tambah User
            </Button>
          ) : (
            <Button onClick={() => void refreshStorage()} variant="secondary" className="rounded-2xl px-4 py-3">
              Refresh Storage
            </Button>
          )}
        </header>

        <Card className="rounded-[28px] p-2 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-teal text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </Card>

        {activeTab === 'users' ? (
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
                          <InlineAction icon={UserX} label="Nonaktifkan" onClick={() => void handleDeactivate(user)} danger />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <StorageManagerCard storage={storage} isLoading={isLoadingStorage} isCleaning={isCleaningStorage} onCleanup={handleDeleteOldFiles} />
        )}
      </div>

      {modal?.type === 'create' || modal?.type === 'edit' ? (
        <UserFormModal
          user={modal.user || null}
          hasSuperadmin={hasSuperadmin}
          orders={orders}
          deliveryRoutes={deliveryRoutes}
          onClose={() => setModal(null)}
          onSave={(form) => void handleSave(form)}
        />
      ) : null}

      {modal?.type === 'password' ? (
        <PasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={(password) => {
            void updateUser({ ...modal.user, password })
            setModal(null)
          }}
        />
      ) : null}
    </div>
  )
}

function StorageManagerCard({ storage, isLoading, isCleaning, onCleanup }) {
  const usageItems = storage
    ? [
        { label: 'Transfer Proofs', value: storage.transferProofs },
        { label: 'Weekly Menu Images', value: storage.menuImages },
        { label: 'Delivery Photos', value: storage.deliveryPhotos },
      ]
    : []

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Ringkasan Storage</div>
            <div className="mt-1 text-sm text-slate-500">Pantau bucket file operasional dan jaga storage tetap ringan.</div>
          </div>
          <HardDrive className="text-teal" size={20} />
        </div>

        {isLoading ? (
          <div className="mt-6 text-sm text-slate-500">Membaca storage...</div>
        ) : storage ? (
          <>
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500">Total penggunaan</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{storage.totalMB.toFixed(2)} MB</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Estimasi kuota 1 GB</div>
                  <div className="mt-2 text-xl font-semibold text-teal-dark">{storage.usagePercent.toFixed(1)}%</div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(storage.usagePercent, 100)}%` }} />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {usageItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-slate-900">{item.label}</div>
                    <div className="text-sm text-slate-500">{item.value.count} file</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.value.sizeMB.toFixed(2)} MB</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Card>

      <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="text-sm font-semibold text-slate-900">Maintenance</div>
        <div className="mt-1 text-sm text-slate-500">Bersihkan file bukti dan menu yang sudah lewat 3 bulan.</div>

        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          File yang dihapus: `transfer-proofs/orders`, `menu-images/weekly`, dan `delivery-photos/items` yang lebih tua dari 90 hari.
        </div>

        <button
          type="button"
          onClick={() => void onCleanup()}
          disabled={isCleaning}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isCleaning ? 'Menghapus file lama...' : 'Hapus File > 3 Bulan'}
        </button>
      </Card>
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
              <option key={option.value} value={option.value} disabled={option.value === 'superadmin' || !hasSuperadmin && option.value === 'superadmin'}>
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
