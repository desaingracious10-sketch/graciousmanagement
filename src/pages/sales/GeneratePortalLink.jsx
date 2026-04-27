import { useMemo, useState } from 'react'
import { Copy, Link2, RefreshCw, Search, Send, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { Button, Card, Input, PageHeader } from '../../components/ui.jsx'

const PORTAL_BASE = (import.meta.env.VITE_PORTAL_BASE_URL || `${window.location.origin}`).replace(/\/$/, '')

const DURATION_LABEL = {
  weekly_5: 'Weekly 5 Hari',
  monthly_20: 'Monthly 20 Hari',
}
const MEAL_LABEL = {
  lunch_only: 'Lunch Only',
  dinner_only: 'Dinner Only',
  lunch_dinner: 'Lunch + Dinner',
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function diffDays(from, to) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (1000 * 60 * 60 * 24))
}
function formatID(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function buildPortalUrl(token) {
  return `${PORTAL_BASE}/portal/${token}`
}

export default function GeneratePortalLink() {
  const {
    customers,
    orders,
    programs,
    regeneratePortalToken,
    showToast,
  } = useApp()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const today = new Date()

  const enriched = useMemo(
    () =>
      customers.map((c) => {
        const customerOrders = orders.filter((o) => o.customerId === c.id)
        const active = customerOrders
          .filter((o) => o.startDate && o.endDate && o.paymentStatus !== 'rejected')
          .find((o) => {
            const s = startOfDay(o.startDate).getTime()
            const e = startOfDay(o.endDate).getTime()
            const t = startOfDay(today).getTime()
            return s <= t && t <= e
          })
        const program = active ? programs.find((p) => p.id === active.programId) : null
        const remaining = active?.endDate ? diffDays(today, active.endDate) : null
        return { customer: c, activeOrder: active, program, remaining }
      }),
    [customers, orders, programs, today],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enriched
    return enriched.filter(({ customer }) =>
      [customer.name, customer.phone, customer.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [enriched, search])

  const tokenedCustomers = useMemo(
    () => enriched.filter(({ customer }) => Boolean(customer.portalToken)),
    [enriched],
  )

  const selected = enriched.find(({ customer }) => customer.id === selectedId) || null

  async function handleCopy(token, customerName) {
    if (!token) {
      showToast({ tone: 'warning', message: 'Customer belum punya token. Generate dulu.' })
      return
    }
    const url = buildPortalUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      showToast({ tone: 'success', message: `Link ${customerName} berhasil dicopy!` })
    } catch {
      showToast({ tone: 'error', message: 'Gagal copy link. Salin manual: ' + url })
    }
  }

  function handleSendWA(customer, token) {
    if (!token) {
      showToast({ tone: 'warning', message: 'Customer belum punya token.' })
      return
    }
    const url = buildPortalUrl(token)
    const message = `Halo ${customer.name} 👋

Berikut link portal langganan sehat kamu di Gracious:
🔗 ${url}

Di sana kamu bisa lihat:
✅ Status & sisa masa langganan
🍽️ Menu minggu ini
📅 Jadwal pengiriman

Selamat menikmati program sehatnya! 💚
— Tim Gracious Healthy Catering`

    const phone = String(customer.phone || '').replace(/\D/g, '').replace(/^0/, '62')
    const target = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  async function handleRegenerate(customerId) {
    await regeneratePortalToken(customerId)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="🔗 Link Customer"
          subtitle="Buat & kirim link portal langganan ke customer dalam beberapa ketukan."
        />

        <Card className="rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Search size={16} className="text-teal" /> Step 1 — Cari Customer
          </div>
          <div className="mt-3">
            <Input
              placeholder="Cari nama, no HP, atau ID customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-2xl text-base"
            />
          </div>

          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Customer tidak ditemukan.
              </div>
            ) : (
              filtered.slice(0, 50).map(({ customer, activeOrder, program, remaining }) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900">{customer.name}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {program?.name || (activeOrder ? activeOrder.programId : 'Belum ada langganan aktif')}
                      </div>
                    </div>
                    {remaining !== null ? (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          remaining <= 3
                            ? 'bg-rose-100 text-rose-700'
                            : remaining <= 7
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        Sisa {remaining} hari
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-teal/10 px-4 text-sm font-semibold text-teal-dark transition active:scale-[0.98] hover:bg-teal/15"
                  >
                    <Link2 size={15} /> {customer.portalToken ? 'Generate & Share' : 'Generate Link'}
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="mt-6 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">📋 Semua Link Aktif</div>
              <p className="text-xs text-slate-500">
                Customer yang sudah punya link portal — kamu bisa reset kapan saja.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            {tokenedCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Belum ada link aktif. Pilih customer di atas untuk membuat.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Nama</th>
                    <th className="pb-2 pr-3 font-medium">Program</th>
                    <th className="pb-2 pr-3 font-medium">Link</th>
                    <th className="pb-2 pr-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tokenedCustomers.map(({ customer, program }) => {
                    const url = buildPortalUrl(customer.portalToken)
                    return (
                      <tr key={customer.id} className="align-top">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">{customer.name}</div>
                          <div className="text-xs text-slate-500">{customer.phone || '-'}</div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{program?.name || '-'}</td>
                        <td className="py-3 pr-3">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-xs font-medium text-teal hover:underline"
                          >
                            /portal/{customer.portalToken}
                          </a>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(customer.portalToken, customer.name)}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Copy size={13} /> Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerate(customer.id)}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <RefreshCw size={13} /> Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId('')}>
        {selected ? (
          <SelectedCustomerSheet
            entry={selected}
            onClose={() => setSelectedId('')}
            onCopy={() => handleCopy(selected.customer.portalToken, selected.customer.name)}
            onWa={() => handleSendWA(selected.customer, selected.customer.portalToken)}
            onRegenerate={() => handleRegenerate(selected.customer.id)}
          />
        ) : null}
      </BottomSheet>
    </div>
  )
}

function BottomSheet({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-md animate-slide-up rounded-t-[28px] bg-white shadow-[0_-24px_60px_rgba(15,23,42,0.25)] sm:rounded-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        {children}
      </div>
    </div>
  )
}

function SelectedCustomerSheet({ entry, onClose, onCopy, onWa, onRegenerate }) {
  const { customer, activeOrder, program } = entry
  const url = customer.portalToken ? buildPortalUrl(customer.portalToken) : ''

  async function handleUrlTap() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
    onCopy()
  }

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-teal">Link Portal</div>
          <div className="mt-1 text-lg font-bold text-slate-900">{customer.name}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {program?.name || activeOrder?.programId || 'Belum ada langganan aktif'}
            {activeOrder?.mealType ? ` · ${MEAL_LABEL[activeOrder.mealType] || activeOrder.mealType}` : ''}
          </div>
          {activeOrder ? (
            <div className="mt-0.5 text-xs text-slate-500">
              Berlaku: {formatID(activeOrder.startDate)} - {formatID(activeOrder.endDate)}
              {activeOrder.durationType ? ` · ${DURATION_LABEL[activeOrder.durationType]}` : ''}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={handleUrlTap}
        disabled={!url}
        className="mt-4 w-full break-all rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition active:scale-[0.99] disabled:opacity-60"
      >
        {url || (
          <span className="text-slate-400">Belum ada token. Klik &quot;Generate Link Baru&quot; untuk membuat.</span>
        )}
      </button>

      {url ? (
        <div className="mt-4 flex justify-center">
          <QrPreview url={url} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={!url}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-base font-semibold text-slate-800 transition active:scale-[0.98] disabled:opacity-60"
        >
          <Copy size={18} /> Copy Link
        </button>
        <button
          type="button"
          onClick={onWa}
          disabled={!url}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 text-base font-semibold text-white shadow-[0_10px_24px_rgba(37,211,102,0.3)] transition active:scale-[0.98] disabled:opacity-60"
        >
          <Send size={18} /> Kirim via WhatsApp
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition active:scale-[0.98]"
        >
          <RefreshCw size={16} /> Generate Link Baru
        </button>
      </div>
    </div>
  )
}

function QrPreview({ url }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`
  return <img src={src} alt="QR Portal" width={180} height={180} className="rounded-xl" />
}
