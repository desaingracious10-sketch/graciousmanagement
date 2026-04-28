import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'

const GRACIOUS_WA = import.meta.env.VITE_GRACIOUS_WA || '6281228870838'

const DAY_LABELS = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Minggu',
  Senin: 'Senin',
  Selasa: 'Selasa',
  Rabu: 'Rabu',
  Kamis: 'Kamis',
  Jumat: 'Jumat',
}
const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
const EN_TO_ID_DAY = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
}

const HEALTHY_MOMS_CATEGORIES = new Set(['busui', 'bumil', 'ivf', 'promil_pcos'])

function pickVariantForProgram(program) {
  if (!program) return 'healthy_catering'
  return HEALTHY_MOMS_CATEGORIES.has(program.category) ? 'healthy_moms' : 'healthy_catering'
}

const MEAL_LABEL = {
  lunch_only: 'Lunch Only',
  dinner_only: 'Dinner Only',
  lunch_dinner: 'Lunch + Dinner',
}

const DURATION_LABEL = {
  weekly_5: 'Weekly 5 Hari',
  monthly_20: 'Monthly 20 Hari',
}

function formatID(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function diffDays(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function getMondayOf(d) {
  const day = new Date(d)
  const dow = day.getDay() // 0 = Sun
  const diff = (dow + 6) % 7 // back to Monday
  day.setDate(day.getDate() - diff)
  return startOfDay(day)
}

function pickActiveOrder(orders, customerId, today) {
  const mine = orders.filter((o) => o.customerId === customerId)
  if (!mine.length) return { active: null, history: [] }
  const todayMs = startOfDay(today).getTime()

  const active = mine
    .filter((o) => o.startDate && o.endDate && o.paymentStatus !== 'rejected')
    .find((o) => {
      const s = startOfDay(o.startDate).getTime()
      const e = startOfDay(o.endDate).getTime()
      return s <= todayMs && todayMs <= e
    })

  let chosen = active
  if (!chosen) {
    chosen = mine
      .filter((o) => o.startDate && o.endDate)
      .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0]
  }

  const history = mine
    .filter((o) => o.id !== chosen?.id)
    .sort((a, b) => new Date(b.endDate || b.createdAt || 0) - new Date(a.endDate || a.createdAt || 0))

  return { active: chosen || null, history }
}

export default function CustomerPortal() {
  const { token } = useParams()
  const { customers, orders, programs, weeklyMenus, isLoading } = useApp()

  const today = new Date()
  const customer = useMemo(
    () => customers.find((c) => c.portalToken && c.portalToken === token) || null,
    [customers, token],
  )

  if (isLoading) return <PortalLoading />
  if (!customer) return <PortalNotFound />

  const { active: activeOrder, history } = pickActiveOrder(orders, customer.id, today)
  const program = programs.find((p) => p.id === activeOrder?.programId) || null

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[480px] bg-slate-50 pb-16 shadow-2xl">
        <Header customerName={customer.name} />

        <main className="space-y-6 px-4 pt-6">
          <SubscriptionCard order={activeOrder} program={program} today={today} customer={customer} />
          <DeliveryCard customer={customer} order={activeOrder} />
          <MenuSection weeklyMenus={weeklyMenus} today={today} program={program} />
          <HistorySection history={history} programs={programs} />
        </main>

        <Footer />
      </div>
    </div>
  )
}

function Header({ customerName }) {
  return (
    <header className="bg-[#0d9488] px-5 pb-7 pt-6 text-white">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-xl">🍱</div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-50/90">Gracious</div>
      </div>
      <h1 className="mt-5 text-2xl font-bold leading-tight">Halo, {customerName} 👋</h1>
      <p className="mt-1 text-sm text-teal-50/85">Portal Langganan Sehat Kamu</p>
    </header>
  )
}

function SubscriptionCard({ order, program, today, customer }) {
  if (!order) {
    return (
      <Card>
        <div className="text-base font-semibold text-slate-900">🍱 Belum Ada Langganan Aktif</div>
        <p className="mt-2 text-sm text-slate-500">
          Belum ada catatan langganan aktif. Silakan hubungi tim Gracious untuk mulai program sehatmu.
        </p>
        <WaButton
          message={`Halo, saya ${customer.name} ingin mulai langganan Gracious 🙏`}
          label="💬 Chat WhatsApp"
          className="mt-4"
        />
      </Card>
    )
  }

  const start = order.startDate ? new Date(order.startDate) : null
  const end = order.endDate ? new Date(order.endDate) : null
  const totalDays = start && end ? Math.max(diffDays(start, end), 1) : 0
  const remaining = end ? diffDays(today, end) : 0
  const elapsed = start ? Math.max(diffDays(start, today), 0) : 0
  const progress = totalDays > 0 ? Math.min(Math.round((elapsed / totalDays) * 100), 100) : 0

  const expired = remaining < 0 || order.status === 'completed'
  const tone = expired
    ? 'expired'
    : remaining <= 3
      ? 'critical'
      : remaining <= 7
        ? 'warning'
        : 'ok'

  const toneClass = {
    ok: 'text-emerald-700',
    warning: 'text-amber-600',
    critical: 'text-rose-600 animate-pulse',
    expired: 'text-slate-500',
  }[tone]

  const barClass = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-rose-500',
    expired: 'bg-slate-400',
  }[tone]

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">🍱 Langganan Aktif</div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0d9488]">
            {order.paymentStatus === 'verified' ? 'Aktif' : order.paymentStatus || '-'}
          </span>
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
          <Row label="Program" value={program?.name || order.programId || '-'} />
          <Row
            label="Paket"
            value={`${MEAL_LABEL[order.mealType] || order.mealType || '-'} · ${
              DURATION_LABEL[order.durationType] || order.durationType || '-'
            }`}
          />
          <Row label="Mulai" value={formatID(order.startDate)} />
          <Row label="Berakhir" value={formatID(order.endDate)} />
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className={`text-base font-semibold ${toneClass}`}>
            {expired
              ? '✅ Langganan sudah berakhir'
              : remaining === 0
                ? '⏳ Hari terakhir langganan'
                : `⏳ Sisa: ${remaining} hari lagi`}
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${barClass} transition-all`} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{progress}% berjalan</div>
        </div>
      </Card>

      {!expired && remaining <= 5 ? (
        <ReminderBanner remaining={remaining} customer={customer} />
      ) : null}
    </>
  )
}

function ReminderBanner({ remaining, customer }) {
  return (
    <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-sm animate-pulse-slow">
      <div className="text-base font-bold">
        ⚠️ Langganan kamu akan berakhir dalam {Math.max(remaining, 0)} hari!
      </div>
      <p className="mt-1 text-orange-800/90">Perpanjang sekarang agar tidak terputus 🙏</p>
      <WaButton
        message={`Halo, saya ingin perpanjang langganan ${customer.name} 🙏`}
        label="💬 Chat WhatsApp untuk Perpanjang"
        className="mt-4 w-full"
      />
    </div>
  )
}

function DeliveryCard({ customer, order }) {
  const meal = MEAL_LABEL[order?.mealType] || 'Lunch'
  return (
    <Card>
      <div className="text-base font-semibold text-slate-900">📦 Detail Pengiriman</div>
      <div className="mt-3 space-y-3 text-sm text-slate-700">
        <div className="flex gap-2">
          <span>📍</span>
          <div>
            <div className="font-medium text-slate-800">Alamat pengiriman</div>
            <div className="text-slate-600">{customer.addressPrimary || '-'}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <span>🕐</span>
          <div>
            <div className="font-medium text-slate-800">Jadwal</div>
            <div className="text-slate-600">{meal} setiap hari kerja</div>
          </div>
        </div>
        {(order?.specialNotes || order?.dietaryNotes || customer.addressNotes) ? (
          <div className="flex gap-2">
            <span>📝</span>
            <div>
              <div className="font-medium text-slate-800">Catatan</div>
              <div className="text-slate-600">
                {[order?.specialNotes, order?.dietaryNotes, customer.addressNotes].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function MenuSection({ weeklyMenus, today, program }) {
  const variant = pickVariantForProgram(program)
  const todayMs = startOfDay(today).getTime()

  const activeMenu = useMemo(() => {
    const candidates = weeklyMenus
      .filter((m) => Array.isArray(m.days) && m.days.length > 0)
      .filter((m) => m.variant === variant)
      .filter((m) => m.isActive !== false)
      .filter((m) => {
        if (!m.weekStart || !m.weekEnd) return false
        const s = startOfDay(m.weekStart).getTime()
        const e = startOfDay(m.weekEnd).getTime()
        return s <= todayMs && todayMs <= e
      })
      .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))
    return candidates[0] || null
  }, [weeklyMenus, variant, todayMs])

  const defaultDay = useMemo(() => {
    const dow = today.getDay()
    const idx = (dow + 6) % 7
    return WEEKDAYS[Math.min(idx, 4)]
  }, [today])

  const [activeDay, setActiveDay] = useState(defaultDay)

  if (!activeMenu) {
    const weekStart = getMondayOf(today)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 4)
    return (
      <Card>
        <div className="text-base font-semibold text-slate-900">🍽️ Menu Minggu Ini</div>
        <p className="mt-1 text-xs text-slate-500">
          {formatID(weekStart)} — {formatID(weekEnd)}
        </p>
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <div className="text-4xl">🍱</div>
          <div className="mt-2 text-sm font-medium text-slate-600">Menu minggu ini sedang disiapkan</div>
          <p className="mt-1 text-xs text-slate-500">Pantau terus ya! 🙏</p>
        </div>
      </Card>
    )
  }

  const dayEntry =
    activeMenu.days.find((d) => d.day === activeDay) ||
    activeMenu.days.find((d) => EN_TO_ID_DAY[d.day] === activeDay) ||
    null

  // Jika menu mingguan tidak memiliki foto sama sekali, gunakan tampilan tabel
  // yang lebih ringkas — semua hari terlihat sekaligus.
  const hasAnyPhoto = activeMenu.days.some((d) => d.menuImageUrl)

  return (
    <Card>
      <div className="text-base font-semibold text-slate-900">🍽️ Menu Minggu Ini</div>
      <p className="mt-1 text-xs text-slate-500">
        {formatID(activeMenu.weekStart)} — {formatID(activeMenu.weekEnd)} · {activeMenu.weekLabel || ''}
      </p>

      {hasAnyPhoto ? (
        <>
          <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {WEEKDAYS.map((day) => {
              const isActive = day === activeDay
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#0d9488] text-white shadow-[0_8px_18px_rgba(13,148,136,0.25)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {DAY_LABELS[day].toUpperCase()}
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            {dayEntry ? (
              <MenuCard day={dayEntry} />
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <div className="text-4xl">🍱</div>
                <div className="mt-2 text-sm font-medium text-slate-600">Menu hari {DAY_LABELS[activeDay]} belum tersedia</div>
                <p className="mt-1 text-xs text-slate-500">Pantau terus, admin akan segera update.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <WeeklyMenuTable menu={activeMenu} />
      )}
    </Card>
  )
}

function WeeklyMenuTable({ menu }) {
  const days = menu.days || []
  const hasDinner = days.some((d) => d?.dinner?.name)
  const hasNotes = days.some((d) => d?.notes)

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-teal/10">
            <th className="px-3 py-2 text-left font-semibold text-teal-dark">Hari</th>
            <th className="px-3 py-2 text-left font-semibold text-teal-dark">Tanggal</th>
            <th className="px-3 py-2 text-left font-semibold text-teal-dark">Makan Siang</th>
            <th className="px-3 py-2 text-right font-semibold text-teal-dark">Kalori</th>
            {hasDinner ? (
              <>
                <th className="px-3 py-2 text-left font-semibold text-teal-dark">Makan Malam</th>
                <th className="px-3 py-2 text-right font-semibold text-teal-dark">Kalori</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {days.map((day, idx) => (
            <tr key={day.day || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-3 py-3 font-medium text-slate-800">
                {DAY_LABELS[day.day] || day.day || '—'}
              </td>
              <td className="px-3 py-3 text-slate-600">{day.date ? formatID(day.date) : '—'}</td>
              <td className="px-3 py-3 text-slate-700">{day.lunch?.name || '—'}</td>
              <td className="px-3 py-3 text-right font-medium text-teal-dark">
                {day.lunch?.calories ? `${day.lunch.calories} kkal` : '—'}
              </td>
              {hasDinner ? (
                <>
                  <td className="px-3 py-3 text-slate-700">{day.dinner?.name || '—'}</td>
                  <td className="px-3 py-3 text-right font-medium text-teal-dark">
                    {day.dinner?.calories ? `${day.dinner.calories} kkal` : '—'}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {hasNotes ? (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          📝 Beberapa hari memiliki catatan tambahan — buka detail hari pada batch berikutnya.
        </div>
      ) : null}
    </div>
  )
}

function MenuCard({ day }) {
  const lunch = day.lunch
  const dinner = day.dinner

  return (
    <div className="overflow-hidden rounded-3xl bg-[#0f3a36] text-white shadow-[0_18px_40px_rgba(15,58,54,0.25)]">
      {day.menuImageUrl ? (
        <img
          src={day.menuImageUrl}
          alt={`Menu ${day.day}`}
          loading="lazy"
          className="h-56 w-full object-cover"
        />
      ) : (
        <div className="grid h-56 place-items-center bg-[#0f3a36] text-6xl">🍱</div>
      )}

      <div className="space-y-4 p-5">
        {lunch?.name ? (
          <MealBlock icon="☀️" title="LUNCH" meal={lunch} />
        ) : null}
        {dinner?.name ? (
          <div className="border-t border-white/10 pt-4">
            <MealBlock icon="🌙" title="DINNER" meal={dinner} />
          </div>
        ) : null}
        {day.notes ? (
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-teal-50/90">📝 {day.notes}</div>
        ) : null}
        {!lunch?.name && !dinner?.name ? (
          <div className="text-center text-sm text-teal-50/85">Menu untuk {DAY_LABELS[day.day] || day.day}</div>
        ) : null}
      </div>
    </div>
  )
}

function MealBlock({ icon, title, meal }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em]">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-3 text-lg font-semibold leading-snug">{meal.name || meal.title || '-'}</div>
      {meal.calories ? (
        <div className="mt-1 font-serif text-3xl italic text-teal-50/95">{meal.calories} Kcal</div>
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

function HistorySection({ history, programs }) {
  const [open, setOpen] = useState(false)
  if (!history.length) return null

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-base font-semibold text-slate-900"
      >
        <span>📚 Lihat Riwayat Langganan Sebelumnya</span>
        <span className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          {history.slice(0, 8).map((order) => {
            const program = programs.find((p) => p.id === order.programId)
            return (
              <div key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-800">{program?.name || order.programId}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {DURATION_LABEL[order.durationType] || order.durationType || '-'} ·{' '}
                  {formatID(order.startDate)} - {formatID(order.endDate)}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#0d9488]">
                  {order.paymentStatus || order.status || '-'}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </Card>
  )
}

function Footer() {
  return (
    <footer className="mt-10 px-5 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#0d9488] text-2xl text-white">🍱</div>
      <div className="mt-3 text-sm font-semibold text-slate-800">Gracious Healthy Catering</div>
      <div className="text-xs text-slate-500">Halal • MSG Free • Organic Food</div>
      <div className="mt-3 text-xs text-slate-500">Pertanyaan?</div>
      <WaButton message="Halo Gracious, saya ada pertanyaan 🙏" label="💬 Chat Kami" className="mt-2 w-full" />
    </footer>
  )
}

function Card({ children }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      {children}
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function WaButton({ message, label, className = '' }) {
  const url = `https://wa.me/${GRACIOUS_WA}?text=${encodeURIComponent(message)}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,211,102,0.3)] transition hover:bg-[#1ebe57] ${className}`}
    >
      {label}
    </a>
  )
}

function PortalLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-6">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-teal-200 border-t-[#0d9488]" />
        <div className="mt-4 text-sm text-slate-500">Memuat portal...</div>
      </div>
    </div>
  )
}

function PortalNotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-3xl">🔒</div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Link tidak valid</h1>
        <p className="mt-2 text-sm text-slate-500">
          Link portal tidak ditemukan atau sudah kadaluarsa. Hubungi tim Gracious untuk mendapatkan link terbaru.
        </p>
        <a
          href={`https://wa.me/${GRACIOUS_WA}?text=${encodeURIComponent('Halo, link portal saya tidak bisa dibuka 🙏')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[#25d366] px-4 py-3 text-sm font-semibold text-white"
        >
          💬 Chat WhatsApp
        </a>
      </div>
    </div>
  )
}
