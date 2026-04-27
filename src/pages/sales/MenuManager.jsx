import { useMemo, useRef, useState } from 'react'
import {
  Archive,
  ChevronLeft,
  Eye,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { uploadMenuImage } from '../../lib/imageUpload.js'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui.jsx'

const DAY_KEYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']

const VARIANT_LABEL = {
  healthy_catering: 'Healthy Catering',
  healthy_moms: 'Healthy Moms',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function getMondayOf(d) {
  const day = new Date(d)
  const dow = day.getDay()
  const diff = (dow + 6) % 7
  day.setDate(day.getDate() - diff)
  return startOfDay(day)
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function toIso(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function formatID(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatShort(date) {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function emptyMeal() {
  return { name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '' }
}

function emptyDay(dayLabel, date) {
  return {
    day: dayLabel,
    date: date ? toIso(date) : '',
    menuImageUrl: null,
    menuImagePath: null,
    notes: '',
    lunch: emptyMeal(),
    dinner: null,
  }
}

function buildEmptyDays(weekStartIso) {
  const start = weekStartIso ? new Date(weekStartIso) : getMondayOf(new Date())
  return DAY_KEYS.map((label, idx) => emptyDay(label, addDays(start, idx)))
}

function emptyForm() {
  const start = getMondayOf(new Date())
  return {
    id: null,
    weekLabel: '',
    weekStart: toIso(start),
    weekEnd: toIso(addDays(start, 4)),
    variant: 'healthy_catering',
    isActive: true,
    days: buildEmptyDays(toIso(start)),
  }
}

function normalizeMeal(meal) {
  if (!meal) return null
  const out = {
    name: meal.name || '',
    calories: meal.calories ?? '',
    protein: meal.protein ?? '',
    carbs: meal.carbs ?? '',
    fat: meal.fat ?? '',
    fiber: meal.fiber ?? '',
  }
  return out
}

function loadFormFromMenu(menu) {
  const weekStart = menu.weekStart ? toIso(menu.weekStart) : toIso(getMondayOf(new Date()))
  const start = new Date(weekStart)
  const incoming = Array.isArray(menu.days) ? menu.days : []
  const days = DAY_KEYS.map((label, idx) => {
    const match = incoming.find((d) => d.day === label) || {}
    return {
      day: label,
      date: match.date || toIso(addDays(start, idx)),
      menuImageUrl: match.menuImageUrl || null,
      menuImagePath: match.menuImagePath || null,
      notes: match.notes || '',
      lunch: normalizeMeal(match.lunch) || emptyMeal(),
      dinner: match.dinner ? normalizeMeal(match.dinner) : null,
    }
  })
  return {
    id: menu.id,
    weekLabel: menu.weekLabel || '',
    weekStart,
    weekEnd: menu.weekEnd ? toIso(menu.weekEnd) : toIso(addDays(start, 4)),
    variant: menu.variant || 'healthy_catering',
    isActive: menu.isActive !== false,
    days,
  }
}

function mealToPayload(meal) {
  if (!meal) return null
  const num = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    name: (meal.name || '').trim(),
    calories: num(meal.calories),
    protein: num(meal.protein),
    carbs: num(meal.carbs),
    fat: num(meal.fat),
    fiber: num(meal.fiber),
  }
}

export default function MenuManager() {
  const { weeklyMenus, addWeeklyMenu, updateWeeklyMenu, showToast, confirmAction } = useApp()
  const [view, setView] = useState('list') // 'list' | 'form' | 'preview'
  const [form, setForm] = useState(emptyForm)
  const [activeDayIdx, setActiveDayIdx] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingDay, setUploadingDay] = useState(null)
  const fileRefs = useRef({})

  const consolidated = useMemo(
    () => weeklyMenus.filter((m) => Array.isArray(m.days) && m.days.length > 0),
    [weeklyMenus],
  )

  const list = useMemo(
    () =>
      [...consolidated].sort(
        (a, b) => new Date(b.weekStart || 0) - new Date(a.weekStart || 0),
      ),
    [consolidated],
  )

  function startCreate() {
    setForm(emptyForm())
    setActiveDayIdx(0)
    setView('form')
  }

  function startEdit(menu) {
    setForm(loadFormFromMenu(menu))
    setActiveDayIdx(0)
    setView('form')
  }

  function backToList() {
    setView('list')
  }

  function patchForm(patch) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleWeekStartChange(value) {
    const start = startOfDay(value || todayIso())
    const monday = getMondayOf(start)
    const newStartIso = toIso(monday)
    const newEndIso = toIso(addDays(monday, 4))
    setForm((current) => {
      const days = current.days.map((d, idx) => ({
        ...d,
        date: toIso(addDays(monday, idx)),
      }))
      return { ...current, weekStart: newStartIso, weekEnd: newEndIso, days }
    })
  }

  function patchDay(idx, patch) {
    setForm((current) => ({
      ...current,
      days: current.days.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }))
  }

  function patchMeal(idx, mealKey, patch) {
    setForm((current) => ({
      ...current,
      days: current.days.map((d, i) => {
        if (i !== idx) return d
        const meal = d[mealKey] ? { ...d[mealKey], ...patch } : { ...emptyMeal(), ...patch }
        return { ...d, [mealKey]: meal }
      }),
    }))
  }

  function toggleDinner(idx) {
    setForm((current) => ({
      ...current,
      days: current.days.map((d, i) => (i === idx ? { ...d, dinner: d.dinner ? null : emptyMeal() } : d)),
    }))
  }

  async function handleFileChange(idx, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showToast({ tone: 'warning', message: 'Ukuran file maksimum 10MB.' })
      return
    }
    setUploadingDay(idx)
    try {
      const dayKey = form.days[idx].day
      const weekKey = form.weekLabel || form.weekStart || 'week'
      const uploaded = await uploadMenuImage(file, weekKey, dayKey)
      patchDay(idx, { menuImageUrl: uploaded.publicUrl, menuImagePath: uploaded.path })
      showToast({ tone: 'success', message: `Foto menu ${dayKey} berhasil diupload.` })
    } catch (error) {
      console.error('[Gracious] menu upload failed:', error)
      showToast({ tone: 'error', message: error?.message || 'Gagal mengupload foto.' })
    } finally {
      setUploadingDay(null)
    }
  }

  function removePhoto(idx) {
    patchDay(idx, { menuImageUrl: null, menuImagePath: null })
  }

  function buildPayload(isActiveOverride) {
    return {
      weekLabel: (form.weekLabel || '').trim(),
      weekStart: form.weekStart,
      weekEnd: form.weekEnd,
      variant: form.variant,
      isActive: isActiveOverride ?? form.isActive,
      days: form.days.map((d) => ({
        day: d.day,
        date: d.date,
        menuImageUrl: d.menuImageUrl || null,
        menuImagePath: d.menuImagePath || null,
        notes: (d.notes || '').trim(),
        lunch: mealToPayload(d.lunch),
        dinner: d.dinner ? mealToPayload(d.dinner) : null,
      })),
      updatedAt: new Date().toISOString(),
    }
  }

  function validate() {
    if (!form.weekLabel.trim()) return 'Label minggu wajib diisi.'
    if (!form.weekStart || !form.weekEnd) return 'Tanggal minggu wajib diisi.'
    const missing = form.days.find((d) => !d.lunch?.name?.trim())
    if (missing) return `Menu lunch untuk ${missing.day} wajib diisi.`
    return null
  }

  async function handleSave({ publish }) {
    const error = validate()
    if (error) {
      showToast({ tone: 'warning', message: error })
      return
    }
    setIsSaving(true)
    try {
      const payload = buildPayload(publish ? true : form.isActive)
      if (form.id) {
        await updateWeeklyMenu({ id: form.id, ...payload }, publish ? 'Menu mingguan dipublish.' : 'Menu mingguan disimpan.')
      } else {
        const created = await addWeeklyMenu(
          { ...payload, createdAt: new Date().toISOString() },
          publish ? 'Menu mingguan dipublish.' : 'Draft menu mingguan disimpan.',
        )
        if (created?.id) setForm((c) => ({ ...c, id: created.id, isActive: payload.isActive }))
      }
      if (publish) setView('preview')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleArchive(menu) {
    const ok = await confirmAction({
      title: 'Arsipkan menu?',
      description: `Menu "${menu.weekLabel}" akan dinonaktifkan dan tidak ditampilkan lagi di portal customer.`,
      confirmLabel: 'Arsipkan',
    })
    if (!ok) return
    await updateWeeklyMenu({ id: menu.id, isActive: false }, 'Menu mingguan diarsipkan.')
  }

  if (view === 'preview') {
    return <PreviewView form={form} onBack={() => setView('form')} onDone={() => setView('list')} />
  }

  if (view === 'form') {
    return (
      <FormView
        form={form}
        activeDayIdx={activeDayIdx}
        onActiveDayChange={setActiveDayIdx}
        onPatch={patchForm}
        onWeekStartChange={handleWeekStartChange}
        onPatchDay={patchDay}
        onPatchMeal={patchMeal}
        onToggleDinner={toggleDinner}
        onFileChange={handleFileChange}
        onRemovePhoto={removePhoto}
        uploadingDay={uploadingDay}
        fileRefs={fileRefs}
        onSaveDraft={() => handleSave({ publish: false })}
        onPublish={() => handleSave({ publish: true })}
        onPreview={() => setView('preview')}
        onBack={backToList}
        isSaving={isSaving}
      />
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="🍽️ Menu Mingguan"
          subtitle="Atur menu Senin–Jumat untuk Healthy Catering & Healthy Moms."
          actions={
            <Button onClick={startCreate} className="rounded-2xl px-4 py-2.5">
              <Plus size={16} className="mr-2" /> Input Menu Baru
            </Button>
          }
        />

        <div className="space-y-3">
          {list.length === 0 ? (
            <Card className="rounded-3xl p-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cream text-3xl">🍽️</div>
              <div className="mt-4 text-lg font-semibold text-slate-900">Belum ada menu mingguan</div>
              <p className="mt-1 text-sm text-slate-500">Klik &quot;Input Menu Baru&quot; untuk mulai mengisi menu minggu ini.</p>
            </Card>
          ) : (
            list.map((menu) => (
              <MenuListItem
                key={menu.id}
                menu={menu}
                onEdit={() => startEdit(menu)}
                onArchive={() => handleArchive(menu)}
                onPreview={() => {
                  setForm(loadFormFromMenu(menu))
                  setView('preview')
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MenuListItem({ menu, onEdit, onArchive, onPreview }) {
  return (
    <Card className="rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              menu.variant === 'healthy_moms'
                ? 'bg-pink-100 text-pink-700'
                : 'bg-teal/10 text-teal-dark'
            }`}>
              {VARIANT_LABEL[menu.variant] || menu.variant}
            </span>
            {menu.isActive ? (
              <Badge status="completed">Active</Badge>
            ) : (
              <Badge status="cancelled">Archive</Badge>
            )}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900">{menu.weekLabel || '(tanpa label)'}</div>
          <div className="text-xs text-slate-500">
            {formatShort(menu.weekStart)} – {formatShort(menu.weekEnd)}
            {menu.weekStart ? ` ${new Date(menu.weekStart).getFullYear()}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onEdit} variant="secondary" className="rounded-xl">
            <Pencil size={14} className="mr-1.5" /> Edit
          </Button>
          {menu.isActive ? (
            <Button onClick={onArchive} variant="secondary" className="rounded-xl">
              <Archive size={14} className="mr-1.5" /> Arsipkan
            </Button>
          ) : null}
          <Button onClick={onPreview} variant="secondary" className="rounded-xl">
            <Eye size={14} className="mr-1.5" /> Preview
          </Button>
        </div>
      </div>
    </Card>
  )
}

function FormView({
  form,
  activeDayIdx,
  onActiveDayChange,
  onPatch,
  onWeekStartChange,
  onPatchDay,
  onPatchMeal,
  onToggleDinner,
  onFileChange,
  onRemovePhoto,
  uploadingDay,
  fileRefs,
  onSaveDraft,
  onPublish,
  onPreview,
  onBack,
  isSaving,
}) {
  const day = form.days[activeDayIdx]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> Kembali ke daftar
        </button>

        <PageHeader
          title={form.id ? '✏️ Edit Menu Mingguan' : '➕ Input Menu Mingguan'}
          subtitle="Step 1 isi info minggu, Step 2 isi menu per hari."
        />

        <Card className="mb-5 rounded-3xl p-5">
          <div className="text-sm font-semibold text-slate-800">Step 1 — Info Minggu</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Label Minggu" required>
              <Input
                value={form.weekLabel}
                onChange={(e) => onPatch({ weekLabel: e.target.value })}
                placeholder="Contoh: April Week 1"
                className="h-12 rounded-2xl text-base"
              />
            </Field>
            <Field label="Varian">
              <Select
                value={form.variant}
                onChange={(e) => onPatch({ variant: e.target.value })}
                className="h-12 rounded-2xl text-base"
              >
                <option value="healthy_catering">Healthy Catering · Healthy Life / Bulking / Weight Loss</option>
                <option value="healthy_moms">Healthy Moms · Busui / Bumil / IVF / Promil-PCOS</option>
              </Select>
            </Field>
            <Field label="Tanggal Mulai (Senin)" required>
              <Input
                type="date"
                value={form.weekStart}
                onChange={(e) => onWeekStartChange(e.target.value)}
                className="h-12 rounded-2xl text-base"
              />
            </Field>
            <Field label="Tanggal Akhir (Jumat)">
              <Input
                type="date"
                value={form.weekEnd}
                readOnly
                className="h-12 cursor-not-allowed rounded-2xl bg-slate-50 text-base"
              />
            </Field>
          </div>

          <label className="mt-4 inline-flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onPatch({ isActive: e.target.checked })}
              className="h-5 w-5 rounded-md border-slate-300 text-teal focus:ring-teal/20"
            />
            <span className="font-medium text-slate-700">Jadikan aktif minggu ini</span>
          </label>
        </Card>

        <Card className="rounded-3xl p-5">
          <div className="text-sm font-semibold text-slate-800">Step 2 — Menu per Hari</div>

          <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {form.days.map((d, idx) => {
              const isActive = idx === activeDayIdx
              const filled = Boolean(d.lunch?.name)
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => onActiveDayChange(idx)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-teal text-white shadow-[0_8px_18px_rgba(13,148,136,0.25)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d.day.toUpperCase()}
                  {filled ? <span className="ml-2 text-emerald-300">●</span> : null}
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-5">
            <PhotoBlock
              day={day}
              idx={activeDayIdx}
              fileRefs={fileRefs}
              onFileChange={onFileChange}
              onRemovePhoto={onRemovePhoto}
              uploading={uploadingDay === activeDayIdx}
            />

            <MealBlock
              title="🍱 Menu Makan Siang (LUNCH)"
              required
              meal={day.lunch || {}}
              onPatch={(patch) => onPatchMeal(activeDayIdx, 'lunch', patch)}
              placeholder="Contoh: Champignon Fish Mozaru with Aromatic Brown Rice"
            />

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">🌙 Menu Makan Malam (DINNER)</span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(day.dinner)}
                    onChange={() => onToggleDinner(activeDayIdx)}
                    className="h-5 w-5 rounded-md border-slate-300 text-teal focus:ring-teal/20"
                  />
                  <span className="text-slate-600">{day.dinner ? 'Ada' : 'Tidak ada'}</span>
                </span>
              </label>
              {day.dinner ? (
                <div className="mt-4">
                  <MealBlock
                    meal={day.dinner}
                    onPatch={(patch) => onPatchMeal(activeDayIdx, 'dinner', patch)}
                    placeholder="Contoh: Braised Fish Black Bean Sauce with Wok Vermicelli"
                    flat
                  />
                </div>
              ) : null}
            </div>

            <Field label="Catatan Hari Ini (opsional)">
              <Textarea
                value={day.notes || ''}
                onChange={(e) => onPatchDay(activeDayIdx, { notes: e.target.value })}
                rows={2}
                placeholder="Contoh: FREE Joy Tea Sosro untuk pengantaran hari Rabu"
                className="rounded-2xl"
              />
            </Field>
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 mt-6 flex flex-col gap-2 rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-[0_-10px_25px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:justify-end">
          <Button onClick={onPreview} variant="secondary" className="min-h-[48px] rounded-2xl">
            <Eye size={16} className="mr-2" /> Preview
          </Button>
          <Button onClick={onSaveDraft} variant="secondary" disabled={isSaving} className="min-h-[48px] rounded-2xl">
            <Save size={16} className="mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
          </Button>
          <Button onClick={onPublish} disabled={isSaving} className="min-h-[48px] rounded-2xl">
            <Send size={16} className="mr-2" /> {isSaving ? 'Memproses...' : 'Publish Menu'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PhotoBlock({ day, idx, fileRefs, onFileChange, onRemovePhoto, uploading }) {
  function trigger() {
    fileRefs.current[idx]?.click()
  }
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-800">📷 Foto Menu untuk {day.day}</div>
      <p className="mt-1 text-xs text-slate-500">Foto dicompress otomatis. Max original 10MB.</p>

      {day.menuImageUrl ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src={day.menuImageUrl} alt={`Menu ${day.day}`} className="h-56 w-full object-cover" />
          <div className="flex flex-wrap gap-2 p-3">
            <Button onClick={trigger} variant="secondary" className="rounded-xl">
              <ImagePlus size={14} className="mr-1.5" /> Ganti Foto
            </Button>
            <Button onClick={() => onRemovePhoto(idx)} variant="secondary" className="rounded-xl text-rose-600">
              <Trash2 size={14} className="mr-1.5" /> Hapus Foto
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={trigger}
          disabled={uploading}
          className="mt-3 grid min-h-[160px] w-full place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center text-sm text-slate-500 transition hover:border-teal hover:text-teal"
        >
          {uploading ? (
            <div className="text-sm font-medium text-teal">Mengunggah...</div>
          ) : (
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal">
                <ImagePlus size={20} />
              </div>
              <div className="mt-3 text-sm font-medium text-slate-700">Upload foto menu untuk {day.day}</div>
              <div className="mt-1 text-xs text-slate-400">Klik untuk pilih file, atau drag & drop</div>
            </div>
          )}
        </button>
      )}

      <input
        ref={(el) => {
          fileRefs.current[idx] = el
        }}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileChange(idx, e)}
      />
    </div>
  )
}

function MealBlock({ title, required, meal, onPatch, placeholder, flat }) {
  return (
    <div className={flat ? '' : 'rounded-3xl border border-slate-100 bg-white p-4 shadow-sm'}>
      {title ? <div className="mb-3 text-sm font-semibold text-slate-800">{title}</div> : null}
      <Field label={`Nama Menu${required ? ' *' : ''}`}>
        <Textarea
          value={meal.name || ''}
          onChange={(e) => onPatch({ name: e.target.value })}
          rows={2}
          placeholder={placeholder}
          className="rounded-2xl"
        />
      </Field>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Kalori (Kcal)">
          <Input
            inputMode="numeric"
            value={meal.calories ?? ''}
            onChange={(e) => onPatch({ calories: e.target.value })}
            placeholder="442"
            className="h-12 rounded-2xl text-base"
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Protein (gr)">
          <Input
            inputMode="numeric"
            value={meal.protein ?? ''}
            onChange={(e) => onPatch({ protein: e.target.value })}
            className="h-12 rounded-2xl text-base"
          />
        </Field>
        <Field label="Carbs (gr)">
          <Input
            inputMode="numeric"
            value={meal.carbs ?? ''}
            onChange={(e) => onPatch({ carbs: e.target.value })}
            className="h-12 rounded-2xl text-base"
          />
        </Field>
        <Field label="Fat (gr)">
          <Input
            inputMode="numeric"
            value={meal.fat ?? ''}
            onChange={(e) => onPatch({ fat: e.target.value })}
            className="h-12 rounded-2xl text-base"
          />
        </Field>
        <Field label="Fiber (gr)">
          <Input
            inputMode="numeric"
            value={meal.fiber ?? ''}
            onChange={(e) => onPatch({ fiber: e.target.value })}
            className="h-12 rounded-2xl text-base"
          />
        </Field>
      </div>
    </div>
  )
}

function PreviewView({ form, onBack, onDone }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> Kembali ke form
        </button>

        <PageHeader
          title="👀 Preview Menu di Customer Portal"
          subtitle="Ini tampilan yang akan dilihat customer dari HP."
          actions={
            <Button onClick={onDone} variant="secondary" className="rounded-2xl">
              <X size={16} className="mr-2" /> Tutup
            </Button>
          }
        />

        <div className="mx-auto max-w-[480px] rounded-[32px] bg-slate-100 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="overflow-hidden rounded-[24px] bg-slate-50">
            <div className="bg-[#0d9488] px-5 pb-7 pt-6 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-50/90">Gracious</div>
              <div className="mt-3 text-xl font-bold">Menu Minggu Ini</div>
              <div className="text-xs text-teal-50/85">
                {formatID(form.weekStart)} — {formatID(form.weekEnd)} · {VARIANT_LABEL[form.variant]}
              </div>
            </div>

            <div className="space-y-5 px-4 py-5">
              {form.days.map((d) => (
                <PortalDayPreview key={d.day} day={d} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortalDayPreview({ day }) {
  const lunch = day.lunch
  const dinner = day.dinner
  return (
    <div className="overflow-hidden rounded-3xl bg-[#0f3a36] text-white shadow-[0_18px_40px_rgba(15,58,54,0.25)]">
      <div className="flex items-center justify-between bg-black/15 px-5 py-3 text-sm font-semibold tracking-wide">
        <span>{day.day.toUpperCase()}</span>
        <span className="text-xs font-normal text-teal-50/80">{formatID(day.date)}</span>
      </div>
      {day.menuImageUrl ? (
        <img src={day.menuImageUrl} alt={`Menu ${day.day}`} className="h-48 w-full object-cover" />
      ) : (
        <div className="grid h-48 place-items-center bg-[#0f3a36] text-5xl">🍱</div>
      )}
      <div className="space-y-4 p-5">
        {lunch?.name ? <PortalMealPreview icon="☀️" title="LUNCH" meal={lunch} /> : null}
        {dinner?.name ? (
          <div className="border-t border-white/10 pt-4">
            <PortalMealPreview icon="🌙" title="DINNER" meal={dinner} />
          </div>
        ) : null}
        {day.notes ? (
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-teal-50/90">📝 {day.notes}</div>
        ) : null}
      </div>
    </div>
  )
}

function PortalMealPreview({ icon, title, meal }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em]">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-3 text-base font-semibold leading-snug">{meal.name}</div>
      {meal.calories ? (
        <div className="mt-1 font-serif text-2xl italic text-teal-50/95">{meal.calories} Kcal</div>
      ) : null}
      {(meal.protein || meal.carbs || meal.fat || meal.fiber) ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-teal-50/85">
          {meal.protein ? <span>Protein: {meal.protein}gr</span> : null}
          {meal.carbs ? <span>Carbs: {meal.carbs}gr</span> : null}
          {meal.fat ? <span>Fat: {meal.fat}gr</span> : null}
          {meal.fiber ? <span>Fiber: {meal.fiber}gr</span> : null}
        </div>
      ) : null}
    </div>
  )
}
