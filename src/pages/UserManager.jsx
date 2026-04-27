import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle, ChevronRight, ClipboardCopy, HardDrive, KeyRound, Pencil, Plus, UserX } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { deleteFilesOlderThan, getStorageUsage } from '../lib/imageUpload.js'
import { Badge, Button, Card, Field, Input, Select, formatDate } from '../components/ui.jsx'

const ROLE_OPTIONS = [
  { value: 'sales', label: 'Admin Sales' },
  { value: 'address_admin', label: 'Admin Alamat' },
  { value: 'driver', label: 'Driver' },
]

const ROLE_LABEL = {
  superadmin: 'Admin Utama',
  sales: 'Admin Sales',
  address_admin: 'Admin Alamat',
  driver: 'Driver',
}

const TABS = [
  { id: 'users', label: 'Data User', icon: BarChart3 },
  { id: 'storage', label: 'Storage Manager', icon: HardDrive },
]

export default function UserManager() {
  const { users, orders, deliveryRoutes, addUser, updateUser, deleteUser, showToast } = useApp()
  const [activeTab, setActiveTab] = useState('users')
  const [modal, setModal] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)
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
    // Validasi username unik
    const usernameExists = users.some(
      (user) =>
        (user.username || '').toLowerCase() === form.username.trim().toLowerCase() &&
        user.id !== form.id,
    )
    if (usernameExists) {
      showToast({ tone: 'error', message: 'Username sudah dipakai user lain.' })
      return
    }

    const isNew = !form.id

    // For new users: don't send id (let Supabase generate UUID)
    // For existing users: include id for update
    const payload = isNew
      ? {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
          isActive: true,
        }
      : {
          id: form.id,
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
          isActive: form.isActive,
          createdAt: form.createdAt,
        }

    if (!isNew) {
      await updateUser(payload)
      showToast({ tone: 'success', message: `User ${payload.name} berhasil diperbarui.` })
      setModal(null)
    } else {
      await addUser(payload)
      setModal(null)
      // Show success modal with credentials
      setSuccessInfo({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      })
    }
  }

  async function handleDeactivate(user) {
    await deleteUser(user.id)
    showToast({ tone: 'success', message: `User ${user.name} berhasil dinonaktifkan.` })
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
            <Button
              onClick={() => setModal({ type: 'create' })}
              className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark"
            >
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
                          <InlineAction
                            icon={Pencil}
                            label="Edit"
                            onClick={() => setModal({ type: 'edit', user })}
                          />
                          <InlineAction
                            icon={KeyRound}
                            label="Reset Password"
                            onClick={() => setModal({ type: 'password', user })}
                          />
                          <InlineAction
                            icon={UserX}
                            label="Nonaktifkan"
                            onClick={() => void handleDeactivate(user)}
                            danger
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <StorageManagerCard
            storage={storage}
            isLoading={isLoadingStorage}
            isCleaning={isCleaningStorage}
            onCleanup={handleDeleteOldFiles}
          />
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
            showToast({ tone: 'success', message: `Password ${modal.user.name} berhasil diperbarui.` })
            setModal(null)
          }}
        />
      ) : null}

      {successInfo ? (
        <SuccessModal
          info={successInfo}
          roleLabel={ROLE_LABEL[successInfo.role] || successInfo.role}
          onClose={() => setSuccessInfo(null)}
        />
      ) : null}
    </div>
  )
}

// ─── Success Modal ───────────────────────────────────────────────────────────

function SuccessModal({ info, roleLabel, onClose }) {
  const [copied, setCopied] = useState(false)

  const accountText = `Nama: ${info.name}\nUsername: ${info.username}\nPassword: ${info.password}\nRole: ${roleLabel}`

  function handleCopy() {
    navigator.clipboard.writeText(accountText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <CheckCircle className="text-emerald-500" size={28} />
          <div>
            <div className="text-xl font-semibold text-slate-900">User Berhasil Dibuat!</div>
            <div className="mt-0.5 text-sm text-slate-500">Simpan informasi ini dan berikan ke yang bersangkutan.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Nama</span>
              <span className="font-semibold text-slate-900">{info.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Username</span>
              <span className="font-semibold text-slate-900">@{info.username}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Password</span>
              <span className="font-semibold text-teal-dark">{info.password}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Role</span>
              <span className="font-semibold text-slate-900">{roleLabel}</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-amber-700">
          ⚠️ Password hanya ditampilkan sekali ini. Pastikan sudah dicatat sebelum menutup.
        </p>

        <div className="mt-5 flex gap-3">
          <Button
            onClick={handleCopy}
            variant="secondary"
            className="flex-1 gap-2 rounded-2xl px-4 py-3"
          >
            <ClipboardCopy size={15} />
            {copied ? 'Tersalin!' : 'Salin Info Akun'}
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark"
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Storage Manager ────────────────────────────────────────────────────────

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
            <div className="mt-1 text-sm text-slate-500">
              Pantau bucket file operasional dan jaga storage tetap ringan.
            </div>
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
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {storage.totalMB.toFixed(2)} MB
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Estimasi kuota 1 GB</div>
                  <div className="mt-2 text-xl font-semibold text-teal-dark">
                    {storage.usagePercent.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${Math.min(storage.usagePercent, 100)}%` }}
                />
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
        <div className="mt-1 text-sm text-slate-500">
          Bersihkan file bukti dan menu yang sudah lewat 3 bulan.
        </div>

        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          File yang dihapus: <code>transfer-proofs/orders</code>, <code>menu-images/weekly</code>, dan{' '}
          <code>delivery-photos/items</code> yang lebih tua dari 90 hari.
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

// ─── Form Modal Tambah / Edit User ──────────────────────────────────────────

function UserFormModal({ user, hasSuperadmin, orders, deliveryRoutes, onClose, onSave }) {
  const isEdit = !!user

  const [form, setForm] = useState({
    id: user?.id || '',
    name: user?.name || '',
    username: user?.username || '',
    role: user?.role || 'sales',
    phone: user?.phone || '',
    password: '',
    confirmPassword: '',
    isActive: user?.isActive ?? true,
    createdAt: user?.createdAt || '',
  })

  const [errors, setErrors] = useState({})

  const hasActiveData = Boolean(
    user &&
      ((user.role === 'sales' && orders.some((order) => order.createdBy === user.id)) ||
        ((user.role === 'address_admin' || user.role === 'driver') &&
          deliveryRoutes.some(
            (route) => route.createdBy === user.id || route.driverId === user.id,
          ))),
  )

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }))
    }
  }

  function validate() {
    const newErrors = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nama lengkap wajib diisi'
    }

    if (!form.username.trim()) {
      newErrors.username = 'Username wajib diisi'
    } else if (form.username.trim().length < 4) {
      newErrors.username = 'Username minimal 4 karakter'
    } else if (/\s/.test(form.username)) {
      newErrors.username = 'Username tidak boleh mengandung spasi'
    }

    if (!isEdit) {
      if (!form.password) {
        newErrors.password = 'Password wajib diisi'
      } else if (form.password.length < 6) {
        newErrors.password = 'Password minimal 6 karakter'
      }
      if (!form.confirmPassword) {
        newErrors.confirmPassword = 'Konfirmasi password wajib diisi'
      } else if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Konfirmasi password tidak sama'
      }
    } else {
      if (form.password) {
        if (form.password.length < 6) {
          newErrors.password = 'Password minimal 6 karakter'
        }
        if (!form.confirmPassword) {
          newErrors.confirmPassword = 'Konfirmasi password wajib diisi jika ganti password'
        } else if (form.password !== form.confirmPassword) {
          newErrors.confirmPassword = 'Konfirmasi password tidak sama'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    const finalForm = {
      ...form,
      password: isEdit && !form.password ? user.password : form.password,
    }

    onSave(finalForm)
  }

  const isFormValid = Boolean(
    form.name.trim() &&
    form.username.trim().length >= 4 &&
    form.role &&
    (!isEdit
      ? form.password.length >= 6 && form.password === form.confirmPassword
      : true)
  )

  return (
    <ModalShell
      title={isEdit ? 'Edit User' : 'Tambah User'}
      subtitle="Lengkapi data akun untuk tim Gracious."
      onClose={onClose}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Nama Lengkap */}
        <Field label="Nama Lengkap" required>
          <Input
            value={form.name}
            onChange={(event) => patch('name', event.target.value)}
            className={errors.name ? 'border-rose-400 focus:ring-rose-300' : ''}
          />
          {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
        </Field>

        {/* Username */}
        <Field label="Username" required>
          <Input
            value={form.username}
            onChange={(event) => patch('username', event.target.value)}
            placeholder="contoh: sarah.sales"
            disabled={isEdit}
            className={errors.username ? 'border-rose-400 focus:ring-rose-300' : ''}
          />
          {errors.username
            ? <p className="mt-1 text-xs text-rose-600">{errors.username}</p>
            : isEdit
            ? <p className="mt-1 text-xs text-slate-400">Username tidak bisa diubah.</p>
            : <p className="mt-1 text-xs text-slate-400">Lowercase, tanpa spasi. Tidak bisa diubah setelah disimpan.</p>
          }
        </Field>

        {/* Role */}
        <Field label="Role" required>
          <Select
            value={form.role}
            onChange={(event) => patch('role', event.target.value)}
            disabled={isEdit && hasActiveData}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {isEdit && hasActiveData && (
            <p className="mt-1 text-xs text-amber-600">
              Role tidak bisa diubah karena user ini sudah memiliki data aktif.
            </p>
          )}
        </Field>

        {/* No HP */}
        <Field label="No HP">
          <Input
            value={form.phone}
            onChange={(event) => patch('phone', event.target.value)}
            placeholder="08xxxxxxxxxx"
          />
        </Field>

        {/* Password */}
        <Field label={isEdit ? 'Password Baru (opsional)' : 'Password Awal *'} required={!isEdit}>
          <Input
            type="password"
            value={form.password}
            onChange={(event) => patch('password', event.target.value)}
            placeholder={isEdit ? 'Kosongkan jika tidak ingin ganti' : 'Minimal 6 karakter'}
            className={errors.password ? 'border-rose-400 focus:ring-rose-300' : ''}
          />
          {errors.password
            ? <p className="mt-1 text-xs text-rose-600">{errors.password}</p>
            : !isEdit && <p className="mt-1 text-xs text-slate-400">Minimal 6 karakter.</p>
          }
        </Field>

        {/* Konfirmasi Password */}
        <Field
          label={isEdit ? 'Konfirmasi Password Baru' : 'Konfirmasi Password *'}
          required={!isEdit || !!form.password}
        >
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => patch('confirmPassword', event.target.value)}
            placeholder="Ulangi password"
            className={errors.confirmPassword ? 'border-rose-400 focus:ring-rose-300' : ''}
            disabled={isEdit && !form.password}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword}</p>
          )}
          {isEdit && !form.password && (
            <p className="mt-1 text-xs text-slate-400">Isi password baru terlebih dahulu.</p>
          )}
          {form.confirmPassword && form.password && !errors.confirmPassword && form.password === form.confirmPassword && (
            <p className="mt-1 text-xs text-emerald-600">✓ Password cocok</p>
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Simpan User
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Modal Reset Password ────────────────────────────────────────────────────

function PasswordModal({ user, onClose, onSave }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})

  function handleSave() {
    const newErrors = {}

    if (!password) {
      newErrors.password = 'Password baru wajib diisi'
    } else if (password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter'
    }

    if (!confirm) {
      newErrors.confirm = 'Konfirmasi password wajib diisi'
    } else if (password !== confirm) {
      newErrors.confirm = 'Konfirmasi password tidak sama'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    onSave(password)
  }

  return (
    <ModalShell
      title="Reset Password"
      subtitle={`Atur password baru untuk ${user.name}.`}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <Field label="Password Baru *" required>
          <Input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (errors.password) setErrors((e) => ({ ...e, password: '' }))
            }}
            placeholder="Minimal 6 karakter"
            className={errors.password ? 'border-rose-400' : ''}
          />
          {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
        </Field>

        <Field label="Konfirmasi Password *" required>
          <Input
            type="password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value)
              if (errors.confirm) setErrors((e) => ({ ...e, confirm: '' }))
            }}
            placeholder="Ulangi password baru"
            className={errors.confirm ? 'border-rose-400' : ''}
          />
          {errors.confirm && <p className="mt-1 text-xs text-rose-600">{errors.confirm}</p>}
          {confirm && password && !errors.confirm && password === confirm && (
            <p className="mt-1 text-xs text-emerald-600">✓ Password cocok</p>
          )}
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
          Batal
        </Button>
        <Button
          onClick={handleSave}
          className="rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark"
        >
          Simpan Password Baru
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Shared Components ───────────────────────────────────────────────────────

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
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10 h-full w-full"
        aria-label="Tutup modal"
      />
    </div>
  )
}

function InlineAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium ${
        danger ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
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
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${current.cls}`}>
      {current.label}
    </span>
  )
}
