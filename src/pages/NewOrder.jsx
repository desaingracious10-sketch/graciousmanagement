import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardPen,
  CreditCard,
  Database,
  Edit3,
  ImagePlus,
  Loader2,
  Search,
  Sparkles,
  Upload,
  UserPlus,
  WandSparkles,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStoredUser } from '../hooks/useAuth.js'
import { FALLBACK_PROGRAMS, FALLBACK_ZONES } from '../lib/fallbackCatalog.js'
import { getTransferProofUrl, uploadTransferProof } from '../lib/imageUpload.js'
import { parseOrderText } from '../utils/smartParser.js'
import { Badge, Card, Field, Input, Select, Textarea, formatDate, formatIDR, todayISO } from '../components/ui.jsx'

const PROGRAM_OPTIONS = FALLBACK_PROGRAMS
const ZONE_OPTIONS = FALLBACK_ZONES
const PAYMENT_METHOD_OPTIONS = [
  { value: 'Transfer BCA', label: 'Transfer BCA' },
  { value: 'Transfer BRI', label: 'Transfer BRI' },
  { value: 'Transfer Mandiri', label: 'Transfer Mandiri' },
  { value: 'Transfer BNI', label: 'Transfer BNI' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'Shopee Pay', label: 'Shopee Pay' },
  { value: 'Tokopedia Pay', label: 'Tokopedia Pay' },
]
const ORDER_SOURCE_OPTIONS = ['Manual WA', 'Shopee', 'Tokopedia']

const MODE_OPTIONS = [
  { id: 'smart', label: 'Smart Paste', icon: Sparkles },
  { id: 'manual', label: 'Form Manual', icon: ClipboardPen },
]

const EDITABLE_FIELDS = [
  'name',
  'phone',
  'addressPrimary',
  'addressAlternate',
  'programId',
  'mealType',
  'durationType',
  'startDate',
  'endDate',
  'dietaryNotes',
  'specialNotes',
]

const REQUIRED_FIELDS = ['name', 'phone', 'addressPrimary', 'programId', 'startDate']
const EXAMPLE_TEXT = `74. Nama : Wegi Randol
Alamat : Jl. HR Rasuna Said Kav. C7-9, Setiabudi, Jakarta Selatan
No hp : +62 812-2887-838
paket : Diet Lunch 5 hari
-Note rabu cuti
Mulai 23 - 30 April 2026`
const WHATSAPP_HINT = `Format input dari WhatsApp:
74. Nama : Wegi Randol
Alamat : PT Pertamina Patra Niaga, Wisma Tugu 2, Lantai 3, Ruang IT, Jl. HR Rasuna Said Kav. C7-9, Setiabudi, Jakarta Selatan.
No hp : +62 812-2887-838
paket : Diet Lunch 5 hari
-Note rabu cuti
Mulai 23 - 30 April 2026`

function createPaymentState() {
  return {
    amount: '',
    method: 'Transfer BCA',
    source: 'Manual WA',
    proofFile: null,
    proofName: '',
    proofPreview: '',
    proofMeta: null,
    proofError: '',
  }
}

function createManualForm() {
  return {
    customerMode: 'new',
    existingCustomerId: '',
    name: '',
    phone: '',
    addressPrimary: '',
    addressAlternate: '',
    addressNotes: '',
    zoneId: '',
    programId: '',
    mealType: '',
    durationType: '',
    startDate: todayISO(),
    endDate: '',
    dietaryNotes: '',
    specialNotes: '',
  }
}

function createPreviewState() {
  return {
    name: '',
    phone: '',
    addressPrimary: '',
    addressAlternate: '',
    addressNotes: '',
    suggestedZoneId: '',
    suggestedZoneName: '',
    zoneConfidence: 0,
    programId: '',
    programName: '',
    mealType: '',
    mealTypeLabel: '',
    durationType: '',
    durationLabel: '',
    startDate: '',
    endDate: '',
    dietaryNotes: '',
    specialNotes: '',
    priceNormal: null,
    pricePromo: null,
    parseConfidence: 0,
    parseWarnings: [],
    rawText: '',
  }
}

export default function NewOrder() {
  const navigate = useNavigate()
  const resultRef = useRef(null)
  const [mode, setMode] = useState('smart')
  const [rawText, setRawText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [preview, setPreview] = useState(createPreviewState)
  const [hasParsed, setHasParsed] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitAction, setSubmitAction] = useState('submit')
  const [payment, setPayment] = useState(createPaymentState)
  const [manualForm, setManualForm] = useState(createManualForm)
  const [customerChoice, setCustomerChoice] = useState('new')
  const { customers: appCustomers, orders: appOrders, programs: appPrograms, zones: appZones, addCustomer, addOrder, addSystemNotification } = useApp()
  const programOptions = appPrograms.length ? appPrograms : PROGRAM_OPTIONS
  const zoneOptions = appZones.length ? appZones : ZONE_OPTIONS

  const currentUser = getStoredUser()
  const allCustomers = useMemo(() => appCustomers, [appCustomers])
  const allOrders = useMemo(() => appOrders, [appOrders])

  const existingCustomerMatch = useMemo(() => findExistingCustomer(preview, allCustomers, allOrders), [preview, allCustomers, allOrders])
  const selectedManualCustomer = useMemo(
    () => allCustomers.find((customer) => customer.id === manualForm.existingCustomerId) || null,
    [allCustomers, manualForm.existingCustomerId],
  )

  const manualPricing = useMemo(
    () => getProgramPricing(manualForm.programId, manualForm.mealType, manualForm.durationType),
    [manualForm.programId, manualForm.mealType, manualForm.durationType],
  )
  const manualZone = useMemo(() => detectZoneByIdOrAddress(manualForm.zoneId, manualForm.addressPrimary), [manualForm.zoneId, manualForm.addressPrimary])

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('gracious_pending_smart_paste')
      if (pending) {
        sessionStorage.removeItem('gracious_pending_smart_paste')
        setMode('smart')
        setRawText(pending)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!selectedManualCustomer || manualForm.customerMode !== 'existing') return
    setManualForm((current) => ({
      ...current,
      name: selectedManualCustomer.name || '',
      phone: selectedManualCustomer.phone || '',
      addressPrimary: selectedManualCustomer.addressPrimary || '',
      addressAlternate: selectedManualCustomer.addressAlternate || '',
      addressNotes: selectedManualCustomer.addressNotes || '',
      zoneId: selectedManualCustomer.zoneId || '',
    }))
  }, [selectedManualCustomer, manualForm.customerMode])

  async function handleParse() {
    if (!rawText.trim()) {
      setToast({ tone: 'warning', message: 'Paste pesan WhatsApp dulu sebelum parse.' })
      return
    }

    setIsParsing(true)
    setValidationErrors({})
    await wait(800)

    const parsed = parseOrderText(rawText, { programs: programOptions, zones: zoneOptions })
    setPreview(parsed)
    setHasParsed(true)
    setEditingField(null)
    setCustomerChoice(parsed.phone || parsed.name ? 'new' : 'new')
    setPayment((current) => ({
      ...current,
      amount: parsed.pricePromo ? formatNumberInput(parsed.pricePromo) : current.amount,
    }))
    setIsParsing(false)

    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function handleClearRawText() {
    setRawText('')
    setHasParsed(false)
    setPreview(createPreviewState())
    setEditingField(null)
    setValidationErrors({})
  }

  function handlePreviewChange(field, value) {
    setPreview((current) => {
      const next = { ...current, [field]: value }

      if (field === 'programId' || field === 'mealType' || field === 'durationType') {
        const pricing = getProgramPricing(
          field === 'programId' ? value : next.programId,
          field === 'mealType' ? value : next.mealType,
          field === 'durationType' ? value : next.durationType,
        )
        const program = programOptions.find((item) => item.id === (field === 'programId' ? value : next.programId))
        next.programName = program?.name || ''
        next.mealTypeLabel = next.mealType ? mealTypeLabel(next.mealType) : ''
        next.durationLabel = next.durationType ? durationLabel(next.durationType) : ''
        next.priceNormal = pricing.priceNormal
        next.pricePromo = pricing.pricePromo
      }

      if (field === 'addressPrimary' || field === 'suggestedZoneId') {
        const zone = detectZoneByIdOrAddress(field === 'suggestedZoneId' ? value : next.suggestedZoneId, field === 'addressPrimary' ? value : next.addressPrimary)
        next.suggestedZoneId = zone.zoneId || ''
        next.suggestedZoneName = zone.zoneName || ''
        next.zoneConfidence = zone.confidence || 0
      }

      if (field === 'startDate' && next.startDate && !next.endDate && next.durationType) {
        next.endDate = inferEndDate(next.startDate, next.durationType) || ''
      }

      return next
    })
  }

  function handlePaymentChange(field, value) {
    setPayment((current) => ({ ...current, [field]: value }))
  }

  function handleAmountChange(value) {
    const digits = value.replace(/\D/g, '')
    handlePaymentChange('amount', digits)
  }

  function handleProofUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setPayment((current) => ({
        ...current,
        proofError: 'Format file harus JPG, PNG, atau PDF.',
      }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPayment((current) => ({
        ...current,
        proofError: 'Ukuran file maksimal 5MB.',
      }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPayment((current) => ({
        ...current,
        proofFile: file,
        proofName: file.name,
        proofPreview: file.type === 'application/pdf' ? '' : typeof reader.result === 'string' ? reader.result : '',
        proofMeta: { name: file.name, size: file.size, type: file.type },
        proofError: '',
      }))
    }

    if (file.type === 'application/pdf') {
      setPayment((current) => ({
        ...current,
        proofFile: file,
        proofName: file.name,
        proofPreview: '',
        proofMeta: { name: file.name, size: file.size, type: file.type },
        proofError: '',
      }))
      return
    }

    reader.readAsDataURL(file)
  }

  async function handleSubmit(kind) {
    setSubmitAction(kind)

    const source = mode === 'smart' ? preview : buildManualPreview(manualForm, manualPricing, manualZone)
    const errors = validateDraft(source, payment, kind)
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      const firstField = Object.keys(errors)[0]
      document.querySelector(`[data-field="${firstField}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setToast({ tone: 'error', message: 'Masih ada field wajib yang belum lengkap.' })
      return
    }

    setIsSubmitting(true)
    await wait(500)

    let customer = customerChoice === 'existing' && existingCustomerMatch ? existingCustomerMatch.customer : null
    if (mode === 'manual' && manualForm.customerMode === 'existing' && selectedManualCustomer) {
      customer = selectedManualCustomer
    }

    if (!customer) {
      customer = {
        id: `c${Date.now()}`,
        name: source.name,
        phone: source.phone,
        addressPrimary: source.addressPrimary,
        addressAlternate: source.addressAlternate || null,
        addressNotes: source.addressNotes || '',
        zoneId: source.suggestedZoneId || '',
        dietaryNotes: source.dietaryNotes || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        pendingRouteAssignment: true,
      }
      await addCustomer(customer, null)
    }

    const orderId = `o${Date.now()}`
    const orderNumber = generateOrderNumber(allOrders.length + 1)

    try {
      let uploadedProof = payment.proofMeta
      if (payment.proofFile) {
        const storedProof = await uploadTransferProof(payment.proofFile, orderId)
        const previewUrl = await getTransferProofUrl(storedProof.path)
        uploadedProof = {
          name: payment.proofFile.name,
          type: payment.proofFile.type,
          size: payment.proofFile.size,
          bucket: storedProof.bucket,
          path: storedProof.path,
          preview: previewUrl,
          uploadedAt: new Date().toISOString(),
        }
      }

      const newOrder = {
        id: orderId,
        orderNumber,
        customerId: customer.id,
        programId: source.programId,
        mealType: source.mealType,
        durationType: source.durationType,
        startDate: source.startDate,
        endDate: source.endDate,
        dietaryNotes: source.dietaryNotes || '',
        specialNotes: source.specialNotes || '',
        status: 'draft',
        paymentStatus: 'pending',
        paymentAmount: Number(payment.amount || 0),
        paymentMethod: normalizePaymentMethod(payment.method),
        orderSource: normalizeOrderSource(payment.source),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || 'u2',
        paymentProof: uploadedProof,
        priceNormal: source.priceNormal,
        pricePromo: source.pricePromo,
        zoneId: source.suggestedZoneId || customer.zoneId || null,
        adminNotification: `${allOrders.length + 1} pesanan menunggu verifikasi`,
        routeAssignmentStatus: 'pending_assign',
      }

      await addOrder(newOrder, null)
      addSystemNotification({
        id: `notif-${Date.now()}`,
        type: 'pending_order_verification',
        message: `${allOrders.length + 1} pesanan menunggu verifikasi`,
        orderId: newOrder.id,
        customerId: newOrder.customerId,
        createdAt: new Date().toISOString(),
        scope: 'orders',
        tone: 'warning',
        isCritical: true,
      })

      setIsSubmitting(false)
      setToast({ tone: 'success', message: `Pesanan ${source.name} berhasil disimpan!` })

      navigate(`/orders/${orderId}`, {
        replace: true,
        state: {
          order: newOrder,
          customer,
        },
      })
    } catch (error) {
      console.error('[Gracious] submit order failed:', error)
      setIsSubmitting(false)
      setToast({ tone: 'error', message: error?.message || 'Pesanan gagal disimpan. Coba lagi.' })
    }
  }

  const confidenceTone = preview.parseConfidence >= 0.8 ? 'success' : preview.parseConfidence >= 0.5 ? 'warning' : 'error'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.08),_transparent_36%),linear-gradient(180deg,#fffef8_0%,#fef9ee_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard Sales</span>
              <ChevronRight size={14} />
              <span className="font-medium text-slate-700">Input Pesanan Baru</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gracious-navy">Input Pesanan Baru</h1>
          </div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = mode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-teal text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              )
            })}
          </div>
        </header>

        {toast ? <ToastBanner toast={toast} /> : null}

        {mode === 'smart' ? (
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[28px] border-teal/20 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <div className="border-b border-teal/10 bg-white px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-dark">
                      <Sparkles size={14} />
                      Smart Paste dari WhatsApp
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-slate-900">Paste chat customer, sistem yang bantu baca</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      Copy pesan dari WhatsApp customer, paste di sini. Sistem akan otomatis mengisi semua data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-6 py-6">
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Textarea WhatsApp</label>
                  {rawText ? (
                    <button
                      type="button"
                      onClick={handleClearRawText}
                      className="absolute right-4 top-11 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700"
                      aria-label="Clear text"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                  <textarea
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    placeholder={`Paste teks WhatsApp customer di sini...\n\nContoh:\n${EXAMPLE_TEXT}`}
                    className="min-h-[220px] w-full rounded-[24px] border-2 border-dashed border-teal bg-cream px-5 py-5 font-mono text-sm leading-7 text-slate-700 outline-none transition focus:border-teal-dark focus:ring-4 focus:ring-teal/10"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal px-5 py-4 text-base font-semibold text-white shadow-[0_20px_40px_rgba(13,148,136,0.24)] transition hover:-translate-y-0.5 hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {isParsing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Sedang membaca data...
                    </>
                  ) : (
                    <>
                      <WandSparkles size={18} />
                      Parse Otomatis
                    </>
                  )}
                </button>
              </div>
            </Card>

            {hasParsed ? (
              <section ref={resultRef} className="space-y-6">
                <ConfidenceBanner tone={confidenceTone} confidence={preview.parseConfidence} />

                {preview.parseWarnings?.length ? <WarningsBox warnings={preview.parseWarnings} /> : null}

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <SmartCustomerCard
                    draft={preview}
                    editingField={editingField}
                    validationErrors={validationErrors}
                    onEdit={setEditingField}
                    onChange={handlePreviewChange}
                    existingCustomerMatch={existingCustomerMatch}
                    customerChoice={customerChoice}
                    onCustomerChoice={setCustomerChoice}
                  />
                  <SmartOrderCard
                    draft={preview}
                    editingField={editingField}
                    validationErrors={validationErrors}
                    onEdit={setEditingField}
                    onChange={handlePreviewChange}
                    programOptions={programOptions}
                  />
                </div>

                <PaymentSection payment={payment} onChange={handlePaymentChange} onAmountChange={handleAmountChange} onProofUpload={handleProofUpload} />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleSubmit('draft')}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                  >
                    {isSubmitting && submitAction === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit('submit')}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal px-5 py-3 font-medium text-white shadow-[0_18px_38px_rgba(13,148,136,0.22)] transition hover:bg-teal-dark disabled:opacity-70"
                  >
                    {isSubmitting && submitAction === 'submit' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Submit Pesanan
                    <ChevronRight size={16} />
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <ManualMode
            form={manualForm}
            onChange={setManualForm}
            customers={allCustomers}
            orders={allOrders}
            pricing={manualPricing}
            zone={manualZone}
            payment={payment}
            validationErrors={validationErrors}
            onPaymentChange={handlePaymentChange}
            onAmountChange={handleAmountChange}
            onProofUpload={handleProofUpload}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitAction={submitAction}
          />
        )}
      </div>
    </div>
  )
}

function ManualMode({
  form,
  onChange,
  customers,
  orders,
  pricing,
  zone,
  payment,
  validationErrors,
  onPaymentChange,
  onAmountChange,
  onProofUpload,
  onSubmit,
  isSubmitting,
  submitAction,
}) {
  const [customerSearch, setCustomerSearch] = useState('')

  function patch(field, value) {
    onChange((current) => {
      const next = { ...current, [field]: value }
      if (field === 'startDate' && next.startDate && !next.endDate && next.durationType) {
        next.endDate = inferEndDate(next.startDate, next.durationType) || ''
      }
      if (field === 'durationType' && next.startDate && !next.endDate) {
        next.endDate = inferEndDate(next.startDate, value) || ''
      }
      return next
    })
  }

  const preview = buildManualPreview(form, pricing, zone)
  const filteredCustomers = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase()
    if (!keyword) return customers.slice(0, 8)
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(keyword) ||
          customer.phone.toLowerCase().includes(keyword),
      )
      .slice(0, 8)
  }, [customerSearch, customers])

  const selectedExistingCustomer =
    customers.find((customer) => customer.id === form.existingCustomerId) || null
  const customerHistory = selectedExistingCustomer
    ? orders
        .filter((order) => order.customerId === selectedExistingCustomer.id)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 3)
    : []

  function detectZoneNow() {
    const detected = detectZoneByIdOrAddress('', form.addressPrimary)
    patch('zoneId', detected.zoneId || '')
  }

  function selectExistingCustomer(customerId) {
    patch('existingCustomerId', customerId)
    setCustomerSearch('')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_380px]">
      <div className="space-y-6">
        <Card className="rounded-[28px] border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fef9ee_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="text-sm font-medium uppercase tracking-[0.16em] text-teal-dark">Form Order Manual</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gracious-navy">Input Pesanan Baru</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Masukkan data pesanan yang diterima via WhatsApp. Kalau format chat rapi, kamu bisa gunakan mode Smart Paste untuk isi lebih cepat.
          </p>
          <details className="mt-4 rounded-2xl border border-teal/15 bg-white/75 px-4 py-3 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-teal-dark">Lihat contoh format chat WhatsApp</summary>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-600">{WHATSAPP_HINT}</pre>
          </details>
        </Card>

        <FormSection
          icon={Search}
          title="Data Customer"
          subtitle="Pilih customer lama atau buat customer baru beserta informasi alamat pengirimannya."
        >
          <div className="mb-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => patch('customerMode', 'existing')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${form.customerMode === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Customer Lama
            </button>
            <button
              type="button"
              onClick={() => patch('customerMode', 'new')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${form.customerMode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Customer Baru
            </button>
          </div>

          {form.customerMode === 'existing' ? (
            <div className="space-y-4">
              <Field label="Search customer">
                <Input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Cari nama atau nomor HP customer"
                />
              </Field>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {filteredCustomers.length ? (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectExistingCustomer(customer.id)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 ${
                        form.existingCustomerId === customer.id ? 'bg-teal/5' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-900">{customer.name}</div>
                        <div className="text-sm text-slate-500">{customer.phone}</div>
                      </div>
                      <div className="text-xs text-slate-400">{customer.zoneId || 'Zona belum ada'}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-4 text-sm text-slate-500">Customer tidak ditemukan.</div>
                )}
              </div>

              {selectedExistingCustomer ? (
                <div className="rounded-[24px] border border-teal/15 bg-teal/5 p-4">
                  <div className="text-sm font-semibold text-slate-900">Customer terpilih</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div><span className="font-medium text-slate-800">Nama:</span> {selectedExistingCustomer.name}</div>
                    <div><span className="font-medium text-slate-800">HP:</span> {selectedExistingCustomer.phone}</div>
                    <div><span className="font-medium text-slate-800">Alamat:</span> {selectedExistingCustomer.addressPrimary}</div>
                    <div>
                      <span className="font-medium text-slate-800">Zona:</span>{' '}
                      {zoneOptions.find((zoneOption) => zoneOption.id === selectedExistingCustomer.zoneId)?.name ||
                        selectedExistingCustomer.zoneId ||
                        'Belum dipilih'}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Riwayat order singkat</div>
                    <div className="mt-2 space-y-2 text-sm text-slate-600">
                      {customerHistory.length ? (
                        customerHistory.map((order) => (
                          <div key={order.id} className="flex items-center justify-between gap-3">
                            <span>{order.orderNumber}</span>
                            <span className="text-slate-500">{formatDate(order.startDate)}</span>
                          </div>
                        ))
                      ) : (
                        <div>Belum ada order sebelumnya.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ManualInput dataField="name" label="Nama Lengkap" value={form.name} error={validationErrors.name} onChange={(value) => patch('name', value)} />
              <ManualInput dataField="phone" label="No. HP / WhatsApp" value={form.phone} error={validationErrors.phone} onChange={(value) => patch('phone', normalizeWhatsappInput(value))} placeholder="+62xxx" />
              <ManualTextarea dataField="addressPrimary" label="Alamat Pengiriman Utama" value={form.addressPrimary} error={validationErrors.addressPrimary} onChange={(value) => patch('addressPrimary', value)} className="md:col-span-2" />
              <ManualTextarea dataField="addressAlternate" label="Alamat Alternatif" value={form.addressAlternate} onChange={(value) => patch('addressAlternate', value)} className="md:col-span-2" />
              <ManualTextarea dataField="addressNotes" label="Catatan Alamat" value={form.addressNotes} onChange={(value) => patch('addressNotes', value)} className="md:col-span-2" />
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={detectZoneNow}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal/20 bg-teal/5 px-4 py-2.5 text-sm font-medium text-teal-dark transition hover:bg-teal/10"
                >
                  <WandSparkles size={15} />
                  Detect Zona Otomatis
                </button>
                {zone.zoneName ? (
                  <div className="mt-2 text-sm text-slate-500">
                    Saran zona: <span className="font-medium text-slate-700">{zone.zoneName}</span>
                  </div>
                ) : null}
              </div>
              <div data-field="suggestedZoneId">
                <Field label="Zona">
                  <Select value={form.zoneId} onChange={(event) => patch('zoneId', event.target.value)}>
                    <option value="">Pilih zona</option>
                    {zoneOptions.map((zoneOption) => (
                      <option key={zoneOption.id} value={zoneOption.id}>
                        {zoneOption.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection icon={ClipboardPen} title="Detail Paket" subtitle="Pilih program, jenis meal, durasi, dan periode paket customer.">
          <div className="grid gap-4 md:grid-cols-2">
            <div data-field="programId">
              <Field label="Program" required>
                <Select value={form.programId} onChange={(event) => patch('programId', event.target.value)}>
                  <option value="">Pilih program</option>
                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div data-field="mealType">
              <Field label="Jenis Meal">
                <Select value={form.mealType} onChange={(event) => patch('mealType', event.target.value)}>
                  <option value="">Pilih meal type</option>
                  <option value="lunch_only">Lunch Only</option>
                  <option value="dinner_only">Dinner Only</option>
                  <option value="lunch_dinner">Lunch & Dinner</option>
                </Select>
              </Field>
            </div>
            <div data-field="durationType">
              <Field label="Durasi">
                <Select value={form.durationType} onChange={(event) => patch('durationType', event.target.value)}>
                  <option value="">Pilih durasi</option>
                  <option value="weekly_5">Weekly 5 Hari</option>
                  <option value="monthly_20">Monthly 20 Hari</option>
                  <option value="monthly_36">Monthly 36 Hari</option>
                  <option value="monthly_40">Monthly 40 Hari</option>
                </Select>
              </Field>
            </div>
            <ManualInput dataField="startDate" label="Tanggal mulai" type="date" value={form.startDate} error={validationErrors.startDate} onChange={(value) => patch('startDate', value)} />
            <ManualInput dataField="endDate" label="Tanggal selesai" type="date" value={form.endDate} onChange={(value) => patch('endDate', value)} />
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Harga otomatis</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-slate-400 line-through">{pricing.priceNormal ? formatIDR(pricing.priceNormal) : 'Belum tersedia'}</span>
              <span className="text-xl font-semibold text-teal-dark">{pricing.pricePromo ? formatIDR(pricing.pricePromo) : 'Isi program dulu'}</span>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {form.startDate && form.endDate
                ? `Durasi: ${durationText(form.durationType)} (${formatDate(form.startDate)} - ${formatDate(form.endDate)})`
                : 'Tanggal selesai akan dihitung otomatis dari durasi, lalu tetap bisa diedit manual.'}
            </div>
          </div>
        </FormSection>

        <FormSection icon={Edit3} title="Catatan Khusus" subtitle="Isi pantangan makanan, catatan pengiriman, dan sumber order customer.">
          <div className="grid gap-4">
            <ManualTextarea dataField="dietaryNotes" label="Catatan Diet / Pantangan Makanan" value={form.dietaryNotes} onChange={(value) => patch('dietaryNotes', value)} placeholder="Contoh: No Ikan, No Bawang Putih, No Pedas" />
            <ManualTextarea dataField="specialNotes" label="Catatan Khusus Pengiriman" value={form.specialNotes} onChange={(value) => patch('specialNotes', value)} placeholder="Contoh: Rabu cuti, Titip di Security Lobby, Jam 11 harus sampai" />
            <div data-field="orderSource">
              <Field label="Sumber Order">
                <Select value={payment.source} onChange={(event) => onPaymentChange('source', event.target.value)}>
                  {ORDER_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </FormSection>

        <PaymentSection payment={payment} onChange={onPaymentChange} onAmountChange={onAmountChange} onProofUpload={onProofUpload} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onSubmit('draft')}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
          >
            {isSubmitting && submitAction === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            Simpan Draft
          </button>
          <button
            type="button"
            onClick={() => onSubmit('submit')}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal px-5 py-3 font-medium text-white shadow-[0_18px_38px_rgba(13,148,136,0.22)] transition hover:bg-teal-dark disabled:opacity-70"
          >
            {isSubmitting && submitAction === 'submit' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Submit Pesanan
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <PreviewSidebar preview={preview} payment={payment} />
      </div>
    </div>
  )
}

function SmartCustomerCard({
  draft,
  editingField,
  validationErrors,
  onEdit,
  onChange,
  existingCustomerMatch,
  customerChoice,
  onCustomerChoice,
}) {
  return (
    <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Data Customer</div>
          <div className="text-sm text-slate-500">Ringkasan hasil pembacaan informasi customer.</div>
        </div>
        <UserPlus className="text-teal" size={20} />
      </div>

      <div className="space-y-4">
        <EditableField title="Nama" field="name" value={draft.name} editingField={editingField} error={validationErrors.name} onEdit={onEdit} onChange={onChange} />
        <EditableField title="HP" field="phone" value={draft.phone} editingField={editingField} error={validationErrors.phone} onEdit={onEdit} onChange={onChange} />

        <div data-field="suggestedZoneId" className={`rounded-2xl border px-4 py-3 ${fieldShellClass(!draft.suggestedZoneId, validationErrors.suggestedZoneId)}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zona</div>
            {draft.suggestedZoneName ? <Badge status="delivered">{draft.suggestedZoneName}</Badge> : null}
          </div>
          <Select value={draft.suggestedZoneId || ''} onChange={(event) => onChange('suggestedZoneId', event.target.value)}>
            <option value="">Pilih atau koreksi zona</option>
            {zoneOptions.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <div className="mt-2 text-xs text-slate-500">
            Confidence: {Math.round((draft.zoneConfidence || 0) * 100)}%
          </div>
        </div>

        <EditableField
          title="Alamat Pengiriman"
          field="addressPrimary"
          value={draft.addressPrimary}
          editingField={editingField}
          error={validationErrors.addressPrimary}
          multiline
          onEdit={onEdit}
          onChange={onChange}
        />
        <EditableField
          title="Alamat Alternatif"
          field="addressAlternate"
          value={draft.addressAlternate}
          editingField={editingField}
          multiline
          emptyActionLabel="+Add"
          onEdit={onEdit}
          onChange={onChange}
        />
        <EditableField
          title="Catatan Alamat"
          field="addressNotes"
          value={draft.addressNotes}
          editingField={editingField}
          multiline
          emptyActionLabel="+Add"
          onEdit={onEdit}
          onChange={onChange}
        />
      </div>

      <div className="mt-6">
        {existingCustomerMatch ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle size={16} />
              Customer ini sudah terdaftar
            </div>
            <div className="mt-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">{existingCustomerMatch.customer.name}</div>
              <div>{existingCustomerMatch.customer.phone}</div>
              <div className="mt-2 text-xs text-slate-500">
                Order terakhir:{' '}
                {existingCustomerMatch.lastOrder
                  ? `${existingCustomerMatch.lastOrder.orderNumber} • ${formatDate(existingCustomerMatch.lastOrder.createdAt)}`
                  : 'Belum ada'}
              </div>
            </div>
            <div className="mt-3 inline-flex rounded-2xl border border-amber-200 bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => onCustomerChoice('existing')}
                className={`rounded-xl px-3 py-2 ${customerChoice === 'existing' ? 'bg-amber-100 text-amber-900' : 'text-slate-600'}`}
              >
                Gunakan Data Lama
              </button>
              <button
                type="button"
                onClick={() => onCustomerChoice('new')}
                className={`rounded-xl px-3 py-2 ${customerChoice === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Buat Sebagai Customer Baru
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Customer baru akan dibuat otomatis
          </div>
        )}
      </div>
    </Card>
  )
}

function SmartOrderCard({ draft, editingField, validationErrors, onEdit, onChange, programOptions }) {
  return (
    <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Detail Pesanan</div>
          <div className="text-sm text-slate-500">Program, periode, harga, dan catatan pengiriman.</div>
        </div>
        <ClipboardPen className="text-teal" size={20} />
      </div>

      <div className="space-y-4">
        <EditableField
          title="Program"
          field="programId"
          value={draft.programName}
          editingField={editingField}
          error={validationErrors.programId}
          type="select"
          selectValue={draft.programId}
          options={programOptions.map((program) => ({ value: program.id, label: program.name }))}
          onEdit={onEdit}
          onChange={onChange}
        />
        <EditableField
          title="Meal"
          field="mealType"
          value={draft.mealTypeLabel}
          editingField={editingField}
          error={validationErrors.mealType}
          type="select"
          selectValue={draft.mealType}
          options={[
            { value: 'lunch_only', label: 'Lunch Only' },
            { value: 'dinner_only', label: 'Dinner Only' },
            { value: 'lunch_dinner', label: 'Lunch + Dinner' },
          ]}
          onEdit={onEdit}
          onChange={onChange}
        />
        <EditableField
          title="Durasi"
          field="durationType"
          value={draft.durationLabel}
          editingField={editingField}
          type="select"
          selectValue={draft.durationType}
          options={[
            { value: 'weekly_5', label: 'Weekly 5 Hari' },
            { value: 'monthly_20', label: 'Monthly 20 Hari' },
            { value: 'monthly_36', label: 'Monthly 36 Hari' },
            { value: 'monthly_40', label: 'Monthly 40 Hari' },
          ]}
          onEdit={onEdit}
          onChange={onChange}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <EditableField
            title="Mulai"
            field="startDate"
            value={draft.startDate ? formatDate(draft.startDate) : ''}
            editingField={editingField}
            error={validationErrors.startDate}
            type="date"
            rawValue={draft.startDate}
            onEdit={onEdit}
            onChange={onChange}
          />
          <EditableField
            title="Selesai"
            field="endDate"
            value={draft.endDate ? formatDate(draft.endDate) : ''}
            editingField={editingField}
            type="date"
            rawValue={draft.endDate}
            onEdit={onEdit}
            onChange={onChange}
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Harga</div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-slate-400 line-through">{draft.priceNormal ? formatIDR(draft.priceNormal) : '—'}</div>
            <div className="text-2xl font-semibold text-teal-dark">{draft.pricePromo ? formatIDR(draft.pricePromo) : 'Belum terhitung'}</div>
          </div>
        </div>
        <EditableField
          title="Catatan Diet"
          field="dietaryNotes"
          value={draft.dietaryNotes}
          editingField={editingField}
          multiline
          emptyLabel="(kosong)"
          onEdit={onEdit}
          onChange={onChange}
        />
        <EditableField
          title="Catatan Khusus"
          field="specialNotes"
          value={draft.specialNotes}
          editingField={editingField}
          multiline
          emptyLabel="(kosong)"
          onEdit={onEdit}
          onChange={onChange}
        />
      </div>
    </Card>
  )
}

function PaymentSection({ payment, onChange, onAmountChange, onProofUpload }) {
  return (
    <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Form Pembayaran</div>
          <div className="text-sm text-slate-500">Nominal transfer, metode, bukti, dan sumber order.</div>
        </div>
        <CreditCard className="text-teal" size={20} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div data-field="paymentAmount">
          <Field label="Nominal transfer" required>
            <Input
              value={formatCurrencyInput(payment.amount)}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="Rp 0"
            />
          </Field>
        </div>
        <Field label="Metode pembayaran">
          <Select value={payment.method} onChange={(event) => onChange('method', event.target.value)}>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="md:col-span-2">
          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">Upload bukti transfer</div>
            <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <div>
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700 sm:justify-start">
                  <Upload size={16} />
                  Drag & drop atau klik upload
                </div>
                <div className="mt-1 text-xs text-slate-500">Bukti transfer hanya bisa dilihat Admin Utama</div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                <ImagePlus size={16} />
                Pilih file
                <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="hidden" onChange={onProofUpload} />
              </label>
            </div>
          </label>
          <div className="mt-2 text-xs text-slate-500">
            Bukti transfer akan disimpan dan hanya bisa dilihat oleh Admin Utama. Format JPG, PNG, PDF maksimal 5MB.
          </div>
          {payment.proofError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {payment.proofError}
            </div>
          ) : null}
          {payment.proofPreview ? (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <img src={payment.proofPreview} alt="Preview bukti transfer" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <div className="text-sm font-medium text-slate-800">{payment.proofName}</div>
                <div className="text-xs text-slate-500">Preview siap dikirim ke Admin Utama untuk verifikasi</div>
              </div>
            </div>
          ) : payment.proofName ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-medium text-slate-800">{payment.proofName}</div>
              <div className="text-xs text-slate-500">File PDF siap disimpan untuk verifikasi Admin Utama.</div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function PreviewSidebar({ preview, payment }) {
  const addressShort =
    preview.addressPrimary && preview.addressPrimary.length > 96
      ? `${preview.addressPrimary.slice(0, 96)}...`
      : preview.addressPrimary || 'Belum diisi'

  return (
    <Card className="rounded-[28px] border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Preview Pesanan</div>
          <div className="mt-1 text-sm text-slate-500">Ringkasan order yang akan dikirim ke sistem.</div>
        </div>
        <Badge status="pending">Menunggu Verifikasi</Badge>
      </div>
      <div className="space-y-4 text-sm text-slate-600">
        <PreviewRow label="👤 Customer" value={preview.name || 'Belum diisi'} />
        <PreviewRow label="📞 No HP" value={preview.phone || 'Belum diisi'} />
        <PreviewRow label="📍 Alamat" value={addressShort} />
        <PreviewRow label="🍱 Program" value={preview.programName || 'Belum dipilih'} />
        <PreviewRow label="🍽️ Meal Type" value={preview.mealTypeLabel || 'Belum dipilih'} />
        <PreviewRow label="📅 Periode" value={preview.startDate ? `${formatDate(preview.startDate)} - ${preview.endDate ? formatDate(preview.endDate) : 'Belum ada'}` : 'Belum dipilih'} />
        <PreviewRow label="🚫 Pantangan" value={preview.dietaryNotes || 'Belum ada'} />
        <PreviewRow label="📝 Catatan" value={preview.specialNotes || 'Belum ada'} />
        <PreviewRow label="💰 Nominal" value={payment.amount ? formatIDR(Number(payment.amount)) : 'Belum diisi'} />
        <PreviewRow label="🏦 Via" value={payment.method || 'Belum dipilih'} />
        <PreviewRow label="📎 Bukti" value={payment.proofName ? 'Sudah ada' : 'Belum ada'} />
      </div>
    </Card>
  )
}

function EditableField({
  title,
  field,
  value,
  editingField,
  error,
  multiline = false,
  emptyLabel = '(belum terdeteksi)',
  emptyActionLabel = 'Edit',
  type = 'text',
  rawValue,
  selectValue,
  options = [],
  onEdit,
  onChange,
}) {
  const isEditing = editingField === field
  const empty = !value

  return (
    <div data-field={field} className={`rounded-2xl border px-4 py-3 ${fieldShellClass(empty, error)}`}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <button type="button" onClick={() => onEdit(isEditing ? null : field)} className="inline-flex items-center gap-1 text-xs font-medium text-teal-dark hover:text-teal">
          <Edit3 size={12} />
          {empty && !isEditing ? emptyActionLabel : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        type === 'select' ? (
          <Select value={selectValue || ''} onChange={(event) => onChange(field, event.target.value)}>
            <option value="">Pilih opsi</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : type === 'date' ? (
          <Input type="date" value={rawValue || ''} onChange={(event) => onChange(field, event.target.value)} />
        ) : multiline ? (
          <Textarea value={value || ''} rows={4} onChange={(event) => onChange(field, event.target.value)} />
        ) : (
          <Input value={value || ''} onChange={(event) => onChange(field, event.target.value)} />
        )
      ) : (
        <div className={`${empty ? 'text-amber-700' : 'text-slate-700'} whitespace-pre-line`}>
          {value || emptyLabel}
        </div>
      )}
    </div>
  )
}

function ConfidenceBanner({ tone, confidence }) {
  const toneMap = {
    success: {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: CheckCircle2,
      text: 'Data berhasil dibaca dengan baik',
    },
    warning: {
      cls: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: AlertTriangle,
      text: 'Sebagian data berhasil dibaca, cek field kuning',
    },
    error: {
      cls: 'border-rose-200 bg-rose-50 text-rose-800',
      icon: AlertTriangle,
      text: 'Banyak data tidak terbaca, isi manual',
    },
  }

  const config = toneMap[tone]
  const Icon = config.icon

  return (
    <div className={`rounded-2xl border px-5 py-4 ${config.cls}`}>
      <div className="flex items-center gap-3">
        <Icon size={18} />
        <div className="flex-1">
          <div className="font-semibold">{config.text}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
            <div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.max(confidence * 100, 8)}%` }} />
          </div>
        </div>
        <div className="text-sm font-semibold">{Math.round(confidence * 100)}%</div>
      </div>
    </div>
  )
}

function WarningsBox({ warnings }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <div className="font-semibold">Field berikut tidak terdeteksi otomatis:</div>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning) => (
          <li key={warning}>• {warning}</li>
        ))}
      </ul>
    </div>
  )
}

function ToastBanner({ toast }) {
  const config = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
  }

  return (
    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${config[toast.tone] || config.success}`}>
      {toast.message}
    </div>
  )
}

function FormSection({ icon: Icon, title, subtitle, children }) {
  return (
    <Card className="rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500">{subtitle}</div>
        </div>
        <Icon className="text-teal" size={20} />
      </div>
      {children}
    </Card>
  )
}

function ManualInput({ dataField, label, value, onChange, error, type = 'text' }) {
  return (
    <div data-field={dataField}>
      <Field label={label} required={dataField === 'name' || dataField === 'phone' || dataField === 'startDate'}>
        <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={error ? 'border-rose-300 ring-2 ring-rose-100' : ''} />
      </Field>
    </div>
  )
}

function ManualTextarea({ dataField, label, value, onChange, error, className = '' }) {
  return (
    <div data-field={dataField} className={className}>
      <Field label={label}>
        <Textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className={error ? 'border-rose-300 ring-2 ring-rose-100' : ''} />
      </Field>
    </div>
  )
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="text-slate-500">{label}</div>
      <div className="max-w-[58%] text-right font-medium text-slate-700">{value}</div>
    </div>
  )
}

function buildManualPreview(form, pricing, zone) {
  const program = PROGRAM_OPTIONS.find((item) => item.id === form.programId)
  return {
    ...form,
    suggestedZoneId: zone.zoneId || form.zoneId || '',
    suggestedZoneName: zone.zoneName || '',
    zoneConfidence: zone.confidence || 0,
    programName: program?.name || '',
    mealTypeLabel: mealTypeLabel(form.mealType),
    durationLabel: durationLabel(form.durationType),
    priceNormal: pricing.priceNormal,
    pricePromo: pricing.pricePromo,
  }
}

function findExistingCustomer(preview, customers, orders) {
  if (!preview.phone && !preview.name) return null

  const customer = customers.find((item) => {
    const samePhone = preview.phone && item.phone === preview.phone
    const sameName = preview.name && item.name.toLowerCase() === preview.name.toLowerCase()
    return samePhone || (sameName && preview.phone && item.phone === preview.phone)
  })

  if (!customer) return null

  const customerOrders = orders
    .filter((order) => order.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  return {
    customer,
    lastOrder: customerOrders[0] || null,
  }
}

function validateDraft(source, payment, kind) {
  const errors = {}

  for (const field of REQUIRED_FIELDS) {
    if (!source[field]) errors[field] = true
  }

  if (!payment.amount) errors.paymentAmount = true
  if (kind === 'submit' && !source.endDate && source.durationType) errors.endDate = true

  return errors
}

function generateOrderNumber(sequence) {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const orderSeq = String(sequence).padStart(3, '0')
  return `GHC-${year}${month}-${orderSeq}`
}

function normalizePaymentMethod(method) {
  return method.toLowerCase().replace(/\s+/g, '_')
}

function normalizeOrderSource(source) {
  const map = {
    'Manual WA': 'manual',
    Shopee: 'shopee',
    Tokopedia: 'tokopedia',
  }
  return map[source] || 'manual'
}

function getProgramPricing(programId, mealType, durationType) {
  const program = PROGRAM_OPTIONS.find((item) => item.id === programId)
  if (!program || !mealType || !durationType) return { priceNormal: null, pricePromo: null }

  const key =
    mealType === 'lunch_dinner'
      ? `${durationType}_lunch_dinner`
      : mealType === 'dinner_only'
        ? `${durationType}_dinner`
        : `${durationType}_lunch`

  const priceNormal = program.prices?.[key] ?? null
  return { priceNormal, pricePromo: priceNormal }
}

function detectZoneByIdOrAddress(zoneId, address) {
  if (zoneId) {
    const zone = ZONE_OPTIONS.find((item) => item.id === zoneId)
    return { zoneId: zone?.id || '', zoneName: zone?.name || '', confidence: zone ? 1 : 0 }
  }

  if (!address) return { zoneId: '', zoneName: '', confidence: 0 }

  const lower = address.toLowerCase()
  let best = null

  for (const zone of ZONE_OPTIONS) {
    const matches = (zone.keywords || []).filter((keyword) => lower.includes(keyword.toLowerCase()))
    if (!matches.length) continue
    if (!best || matches.length > best.matches) {
      best = { zoneId: zone.id, zoneName: zone.name, confidence: Math.min(0.95, 0.55 + matches.length * 0.1), matches: matches.length }
    }
  }

  return best || { zoneId: '', zoneName: '', confidence: 0 }
}

function fieldShellClass(empty, error) {
  if (error) return 'border-rose-200 bg-rose-50'
  if (empty) return 'border-amber-200 bg-amber-50'
  return 'border-slate-200 bg-white'
}

function mealTypeLabel(mealType) {
  return (
    {
      lunch_only: 'Lunch Only',
      dinner_only: 'Dinner Only',
      lunch_dinner: 'Lunch + Dinner',
    }[mealType] || ''
  )
}

function durationLabel(durationType) {
  return (
    {
      weekly_5: 'Weekly 5 Hari',
      monthly_20: 'Monthly 20 Hari',
      monthly_36: 'Monthly 36 Hari',
      monthly_40: 'Monthly 40 Hari',
    }[durationType] || ''
  )
}

function inferEndDate(startDate, durationType) {
  if (!startDate || !durationType) return ''
  const spans = {
    weekly_5: 6,
    monthly_20: 27,
    monthly_36: 49,
    monthly_40: 55,
  }

  const days = spans[durationType]
  if (!days) return ''
  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function normalizeWhatsappInput(value) {
  // Keep digits, +, spaces, dashes — strip everything else
  return String(value || '').replace(/[^\d+\s\-]/g, '').trim()
}

function durationText(durationType) {
  return (
    {
      weekly_5: 'Weekly 5 Hari',
      monthly_20: 'Monthly 20 Hari',
      monthly_36: 'Monthly 36 Hari',
      monthly_40: 'Monthly 40 Hari',
    }[durationType] || durationType || ''
  )
}

function formatCurrencyInput(value) {
  if (!value) return ''
  return `Rp ${Number(value).toLocaleString('id-ID')}`
}

function formatNumberInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
