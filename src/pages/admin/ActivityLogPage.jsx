import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Download, Filter, RefreshCcw } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { getActivityLogs } from '../../lib/db.js'
import { Button, Card, Field, Input, Select, formatDateTime } from '../../components/ui.jsx'

const ACTION_LABEL = {
  CREATE_ORDER: '➕ Buat Pesanan',
  VERIFY_ORDER: '✅ Verifikasi Pesanan',
  REJECT_ORDER: '❌ Tolak Pesanan',
  UPDATE_ORDER: '✏️ Edit Pesanan',
  DELETE_ORDER: '🗑️ Hapus Pesanan',
  CREATE_CUSTOMER: '👤 Tambah Customer',
  UPDATE_CUSTOMER: '✏️ Edit Customer',
  UPDATE_ADDRESS: '📍 Update Alamat',
  DELETE_CUSTOMER: '🗑️ Hapus Customer',
  CREATE_ROUTE: '🗺️ Buat Rute',
  FINALIZE_ROUTE: '✅ Finalize Rute',
  UPDATE_ROUTE: '✏️ Edit Rute',
  CREATE_USER: '👤 Tambah User',
  UPDATE_USER: '✏️ Edit User',
  DELETE_USER: '🗑️ Hapus User',
  CREATE_DRIVER: '🚚 Tambah Driver',
  UPDATE_DRIVER: '✏️ Edit Driver',
  DELETE_DRIVER: '🗑️ Hapus Driver',
  LOGIN: '🔐 Login',
  LOGOUT: '🚪 Logout',
  UPLOAD_MENU: '🍽️ Upload Menu',
  PUBLISH_MENU: '📢 Publish Menu',
}

const ACTION_TONE = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-sky-100 text-sky-700',
  DELETE: 'bg-rose-100 text-rose-700',
  VERIFY: 'bg-teal/10 text-teal-dark',
  REJECT: 'bg-orange-100 text-orange-700',
  LOGIN: 'bg-slate-100 text-slate-600',
  LOGOUT: 'bg-slate-100 text-slate-600',
  UPLOAD: 'bg-purple-100 text-purple-700',
  PUBLISH: 'bg-purple-100 text-purple-700',
  FINALIZE: 'bg-teal/10 text-teal-dark',
}

const ENTITY_LABEL = {
  order: 'Pesanan',
  customer: 'Customer',
  route: 'Rute',
  user: 'User',
  driver: 'Driver',
  menu: 'Menu',
}

function actionToneFor(action) {
  if (!action) return 'bg-slate-100 text-slate-600'
  const prefix = action.split('_')[0]
  return ACTION_TONE[prefix] || 'bg-slate-100 text-slate-600'
}

function actionLabel(action) {
  return ACTION_LABEL[action] || action
}

export default function ActivityLogPage() {
  const { users, drivers, showToast } = useApp()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const allUserOptions = useMemo(() => {
    const userOpts = users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))
    const driverOpts = drivers.map((d) => ({ value: d.id, label: `${d.name} (driver)` }))
    return [...userOpts, ...driverOpts]
  }, [users, drivers])

  async function load() {
    setLoading(true)
    try {
      const data = await getActivityLogs(500)
      setLogs(data)
    } catch (error) {
      console.error('[Gracious] activity logs load failed:', error)
      showToast({ tone: 'error', message: 'Gagal memuat activity logs.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getActivityLogs(500)
      .then((data) => {
        if (!cancelled) setLogs(data)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[Gracious] activity logs load failed:', error)
        showToast({ tone: 'error', message: 'Gagal memuat activity logs.' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterUser && log.userId !== filterUser) return false
      if (filterAction && log.action !== filterAction) return false
      if (filterEntity && log.entityType !== filterEntity) return false
      if (filterFrom && log.createdAt && log.createdAt < filterFrom) return false
      if (filterTo && log.createdAt && log.createdAt > `${filterTo}T23:59:59.999Z`) return false
      return true
    })
  }, [logs, filterUser, filterAction, filterEntity, filterFrom, filterTo])

  function resetFilters() {
    setFilterUser('')
    setFilterAction('')
    setFilterEntity('')
    setFilterFrom('')
    setFilterTo('')
  }

  function exportCsv() {
    if (filtered.length === 0) {
      showToast({ tone: 'warning', message: 'Tidak ada data untuk diekspor.' })
      return
    }
    const header = ['Waktu', 'Nama User', 'Role', 'Aksi', 'Tipe Entitas', 'Entity ID', 'Detail']
    const rows = filtered.map((log) => [
      log.createdAt || '',
      log.userName || '',
      log.userRole || '',
      log.action || '',
      log.entityType || '',
      log.entityId || '',
      log.details ? JSON.stringify(log.details) : '',
    ])
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const distinctActions = useMemo(() => {
    const set = new Set()
    logs.forEach((log) => log.action && set.add(log.action))
    return Array.from(set).sort()
  }, [logs])

  const distinctEntities = useMemo(() => {
    const set = new Set()
    logs.forEach((log) => log.entityType && set.add(log.entityType))
    return Array.from(set).sort()
  }, [logs])

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Log Aktivitas</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">📋 Log Aktivitas Sistem</h1>
            <p className="mt-2 text-sm text-slate-500">
              Audit trail seluruh aksi kritis: pesanan, customer, rute, user, dan driver.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()} className="gap-2 rounded-2xl px-4 py-3">
              <RefreshCcw size={15} />
              Refresh
            </Button>
            <Button onClick={exportCsv} className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Download size={15} />
              Export CSV
            </Button>
          </div>
        </header>

        <Card className="rounded-[28px] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter size={15} />
            Filter
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="User">
              <Select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                <option value="">Semua user</option>
                {allUserOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Aksi">
              <Select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                <option value="">Semua aksi</option>
                {distinctActions.map((action) => (
                  <option key={action} value={action}>
                    {actionLabel(action)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipe Entitas">
              <Select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
                <option value="">Semua entitas</option>
                {distinctEntities.map((entity) => (
                  <option key={entity} value={entity}>
                    {ENTITY_LABEL[entity] || entity}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dari Tanggal">
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </Field>
            <Field label="Sampai Tanggal">
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={resetFilters} className="rounded-2xl px-3 py-2 text-sm">
              Reset Filter
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
            Menampilkan <span className="font-semibold text-slate-900">{filtered.length}</span> dari{' '}
            {logs.length} log
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b border-slate-200">
                  {['Waktu', 'User', 'Role', 'Aksi', 'Entitas', 'Detail'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-semibold text-slate-700">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Memuat log aktivitas...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      Tidak ada log dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{log.userName || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{log.userRole || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionToneFor(log.action)}`}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {log.entityType ? (
                          <div>
                            <div className="font-medium">{ENTITY_LABEL[log.entityType] || log.entityType}</div>
                            <div className="text-xs text-slate-400">{log.entityId || ''}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <code className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                            {JSON.stringify(log.details)}
                          </code>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
