import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, MapPin, Save, Sparkles, X } from 'lucide-react'
import { detectZone } from '../../utils/zoneDetector.js'
import { Button, Field, Input, Select, Textarea, formatDate } from '../ui.jsx'

const CHANGE_REASON_OPTIONS = ['Pindah Rumah', 'Pindah Kantor', 'Salah Input', 'Lainnya']

export default function AddressEditModal({ customer, zones, open, onClose, onSave }) {
  const [form, setForm] = useState(createInitialState(customer))

  useEffect(() => {
    if (open) setForm(createInitialState(customer))
  }, [customer, open])

  const detectedZone = useMemo(() => detectZone(form.addressPrimary), [form.addressPrimary])

  if (!open || !customer) return null

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.addressPrimary.trim()) return
    onSave({
      addressPrimary: form.addressPrimary.trim(),
      addressAlternate: form.addressAlternate.trim(),
      addressNotes: form.addressNotes.trim(),
      zoneId: form.zoneId || detectedZone.zoneId,
      reason: form.reason,
      effectiveDate: form.effectiveDate,
      additionalNotes: form.additionalNotes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-slate-900">Edit Alamat Customer</div>
            <div className="mt-1 text-sm text-slate-500">
              Update alamat {customer.name} dan simpan log perubahan efektif mulai {formatDate(form.effectiveDate)}.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Alamat Baru" required>
                <Textarea
                  value={form.addressPrimary}
                  rows={4}
                  onChange={(event) => patch('addressPrimary', event.target.value)}
                  placeholder="Masukkan alamat utama baru customer"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Alamat Alternatif">
                <Textarea
                  value={form.addressAlternate}
                  rows={3}
                  onChange={(event) => patch('addressAlternate', event.target.value)}
                  placeholder="Alamat kantor, titik alternatif, atau alamat kedua"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Catatan Alamat">
                <Textarea
                  value={form.addressNotes}
                  rows={3}
                  onChange={(event) => patch('addressNotes', event.target.value)}
                  placeholder="Patokan, instruksi masuk, catatan security, dan sejenisnya"
                />
              </Field>
            </div>

            <div className="md:col-span-2 rounded-[24px] border border-teal/15 bg-teal/5 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-teal-dark">
                  <MapPin size={16} />
                  Auto-detect zona
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => patch('zoneId', detectedZone.zoneId)}
                  className="gap-2 rounded-2xl border-teal/20 bg-white px-4 py-2 hover:bg-teal/5"
                >
                  <Sparkles size={15} />
                  Pakai Saran Zona
                </Button>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Saran zona: <span className="font-medium text-slate-800">{detectedZone.zoneName || 'Belum terdeteksi'}</span>
                {detectedZone.zoneName ? ` (${Math.round((detectedZone.confidence || 0) * 100)}%)` : ''}
              </div>
            </div>

            <Field label="Zona">
              <Select value={form.zoneId} onChange={(event) => patch('zoneId', event.target.value)}>
                <option value="">Pilih zona</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Alasan Perubahan">
              <Select value={form.reason} onChange={(event) => patch('reason', event.target.value)}>
                {CHANGE_REASON_OPTIONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Mulai Efektif Tanggal">
              <div className="relative">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input type="date" value={form.effectiveDate} onChange={(event) => patch('effectiveDate', event.target.value)} className="pl-9" />
              </div>
            </Field>

            <Field label="Catatan Tambahan">
              <Input
                value={form.additionalNotes}
                onChange={(event) => patch('additionalNotes', event.target.value)}
                placeholder="Catatan admin tambahan untuk log perubahan"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} className="rounded-2xl px-4 py-3">
              Batal
            </Button>
            <Button type="submit" className="gap-2 rounded-2xl bg-teal px-4 py-3 hover:bg-teal-dark">
              <Save size={16} />
              Simpan Perubahan Alamat
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function createInitialState(customer) {
  return {
    addressPrimary: customer?.addressPrimary || '',
    addressAlternate: customer?.addressAlternate || '',
    addressNotes: customer?.addressNotes || '',
    zoneId: customer?.zoneId || '',
    reason: 'Pindah Rumah',
    effectiveDate: tomorrowISO(),
    additionalNotes: '',
  }
}

function tomorrowISO() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}
