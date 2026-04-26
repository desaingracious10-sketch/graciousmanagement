import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  )
}

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  scheduled: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  assigned: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  in_progress: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  on_the_way: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  draft: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
}

const STATUS_LABEL = {
  pending: 'Menunggu',
  scheduled: 'Terjadwal',
  assigned: 'Ditugaskan',
  in_progress: 'Berjalan',
  on_the_way: 'Dalam Perjalanan',
  delivered: 'Terkirim',
  completed: 'Selesai',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  draft: 'Draft',
}

export function Badge({ status, children }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children || STATUS_LABEL[status] || status}</span>
}

export function Button({ as: As = 'button', variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  const styles = {
    primary: 'bg-teal text-white hover:bg-teal-dark',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
  }
  return <As className={`${base} ${styles[variant]} ${className}`} {...props} />
}

export function Input(props) {
  return <input {...props} className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${props.className || ''}`} />
}

export function Textarea(props) {
  return <textarea {...props} className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${props.className || ''}`} />
}

export function Select({ children, ...props }) {
  return <select {...props} className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${props.className || ''}`}>{children}</select>
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </div>
      {children}
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </label>
  )
}

export function Table({ columns, rows, empty = 'Belum ada data', isLoading = false, skeletonRows = 5 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, index) => (
              <tr key={`skeleton-${index}`} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                <td colSpan={columns.length} className="px-4 py-3">
                  <Skeleton className="h-8 w-full rounded-lg" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id || i} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 align-top text-slate-700 dark:text-slate-200">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgba(226,232,240,0.85)_25%,rgba(241,245,249,1)_50%,rgba(226,232,240,0.85)_75%)] bg-[length:200%_100%] dark:bg-[linear-gradient(90deg,rgba(51,65,85,0.9)_25%,rgba(71,85,105,1)_50%,rgba(51,65,85,0.9)_75%)] ${className}`} />
}

export function DashboardSkeleton({ cards = 4, rows = 4 }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-28" />
            <Skeleton className="mt-3 h-3 w-full" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

export function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <Card className="rounded-xl p-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cream text-3xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      {actionLabel ? (
        actionTo ? (
          <Button as={Link} to={actionTo} className="mt-5">
            {actionLabel}
          </Button>
        ) : (
          <Button onClick={onAction} className="mt-5">
            {actionLabel}
          </Button>
        )
      ) : null}
    </Card>
  )
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Ya, lanjutkan', cancelLabel = 'Batal', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 sm:items-center">
      <button type="button" aria-label="Tutup dialog" className="absolute inset-0 h-full w-full cursor-default" onClick={onCancel} />
      <div className="animate-scale-in relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-2xl">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export function AnimatedCounter({ value, formatter = (next) => next.toLocaleString('id-ID'), duration = 600 }) {
  const numericValue = typeof value === 'number' ? value : Number(value) || 0
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let frameId = 0
    const startedAt = performance.now()

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration)
      const next = Math.round(numericValue * easeOutCubic(progress))
      setDisplayValue(next)
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [duration, numericValue])

  return formatter(displayValue)
}

export function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
}

export function formatDate(d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3)
}
