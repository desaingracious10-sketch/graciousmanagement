import { FALLBACK_PROGRAMS, FALLBACK_ZONES } from '../lib/fallbackCatalog.js'

const INDONESIAN_MONTHS = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
}

const PROGRAM_RULES = [
  { programId: 'p7', keywords: ['weight loss', 'weighloss', 'diet'] },
  { programId: 'p2', keywords: ['busui'] },
  { programId: 'p3', keywords: ['bumil', 'hamil'] },
  { programId: 'p4', keywords: ['bulking', 'muscle'] },
  { programId: 'p5', keywords: ['ivf'] },
  { programId: 'p6', keywords: ['promil', 'pcos'] },
  { programId: 'p1', keywords: ['healthy life', 'sehat'] },
]

const MEAL_RULES = [
  { mealType: 'lunch_dinner', keywords: ['lunch + dinner', 'lunch dan dinner', 'lunch & dinner', '2x'] },
  { mealType: 'lunch_only', keywords: ['lunch only', 'lunch aja', 'makan siang'] },
  { mealType: 'dinner_only', keywords: ['dinner only', 'dinner aja', 'makan malam'] },
]

const DURATION_RULES = [
  { durationType: 'monthly_40', keywords: ['40 hari'] },
  { durationType: 'monthly_36', keywords: ['36 hari'] },
  { durationType: 'monthly_20', keywords: ['20 hari', 'monthly', 'sebulan', '1 bulan'] },
  { durationType: 'weekly_5', keywords: ['5 hari', 'weekly', 'seminggu', '1 minggu'] },
]

const DURATION_LABELS = {
  weekly_5: 'Weekly 5 Hari',
  monthly_20: 'Monthly 20 Hari',
  monthly_36: 'Monthly 36 Hari',
  monthly_40: 'Monthly 40 Hari',
}

const DURATION_DAY_SPANS = {
  weekly_5: 6,
  monthly_20: 27,
  monthly_36: 49,
  monthly_40: 55,
}

const MEAL_LABELS = {
  lunch_only: 'Lunch Only',
  dinner_only: 'Dinner Only',
  lunch_dinner: 'Lunch + Dinner',
}

const SPECIAL_NOTE_KEYWORDS = [
  'cuti',
  'titip',
  'jam',
  'lobby',
  'kantor',
  'rumah',
  'senin',
  'selasa',
  'rabu',
  'kamis',
  'jumat',
  'sabtu',
  'minggu',
  'office',
  'mailing room',
  'security',
  'reception',
  'resepsionis',
  'lift',
]

const DIETARY_NOTE_KEYWORDS = [
  'no ',
  'tanpa',
  'pedas',
  'ikan',
  'bawang',
  'santan',
  'mayonaise',
  'makanan mentah',
  'makanan dibakar',
  'seafood',
  'msg',
  'gluten',
  'lactose',
  'daging',
  'ayam',
  'nasi',
  'garam',
  'gula',
  'alergi',
  'pantangan',
]

const EXTENDED_ZONE_KEYWORDS = {
  z1: ['jaksel', 'jakarta selatan', 'kebayoran', 'cilandak', 'pasar minggu', 'pancoran', 'tebet', 'mampang', 'setiabudi', 'kuningan', 'gatot subroto', 'tb simatupang', 'lebak bulus'],
  z2: ['jakbar', 'jakarta barat', 'grogol', 'kebon jeruk', 'cengkareng', 'kalideres', 'taman sari', 'tomang', 'jelambar', 'daan mogot'],
  z3: ['jaktim', 'jakarta timur', 'cakung', 'duren sawit', 'pulogadung', 'kramat jati', 'jatinegara', 'pondok bambu', 'rawamangun'],
  z4: ['jakut', 'jakarta utara', 'kelapa gading', 'tanjung priok', 'penjaringan', 'koja', 'pademangan', 'pluit', 'sunter', 'ancol'],
  z5: ['jakpus', 'jakarta pusat', 'sudirman', 'menteng', 'gambir', 'senen', 'tanah abang', 'cikini', 'salemba', 'bendungan hilir'],
  z6: ['bekasi', 'jatiasih', 'jatisampurna', 'pondok gede', 'tambun', 'cibubur', 'citragran'],
  z7: ['tangsel', 'bsd', 'bintaro', 'serpong', 'ciputat', 'pamulang', 'sawangan', 'alam sutera'],
  z8: ['tangerang', 'karawaci', 'cipondoh', 'pinang', 'modernland', 'summarecon'],
}

const ADDRESS_HINTS = ['jl.', 'jalan', 'no.', 'blok', 'rt', 'gedung', 'apartemen', 'tower', 'lt', 'lantai', 'kav', 'komplek', 'cluster', 'wisma']
const IGNORED_NAME_PREFIXES = ['alamat', 'paket', 'program', 'mulai', 'start', 'catatan', 'note', 'no hp', 'hp', 'telepon', 'wa', 'whatsapp']

export function parseOrderText(rawText, options = {}) {
  const programs = options.programs?.length ? options.programs : FALLBACK_PROGRAMS
  const zones = options.zones?.length ? options.zones : FALLBACK_ZONES
  const normalizedRaw = String(rawText || '').replace(/\r\n/g, '\n').trim()
  const lines = normalizedRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const warnings = []
  const result = {
    name: null,
    phone: null,
    addressPrimary: null,
    addressAlternate: null,
    addressNotes: null,
    suggestedZoneId: null,
    suggestedZoneName: null,
    zoneConfidence: 0,
    programId: null,
    programName: null,
    mealType: null,
    mealTypeLabel: null,
    durationType: null,
    durationLabel: null,
    startDate: null,
    endDate: null,
    dietaryNotes: '',
    specialNotes: '',
    priceNormal: null,
    pricePromo: null,
    rawText: normalizedRaw,
    parseConfidence: 0,
    parseWarnings: warnings,
    parsedAt: formatLocalDateTime(new Date()),
  }

  const name = parseName(lines)
  const phone = parsePhone(normalizedRaw, lines)
  const address = parseAddresses(lines)
  const packageInfo = parsePackageInfo(lines, programs)
  const dates = parseDates(normalizedRaw, lines, packageInfo.durationType)
  const notes = parseNotes(lines, address.notes)
  const zone = detectZone(address.addressPrimary, zones)
  const pricing = getPricing(packageInfo.programId, packageInfo.mealType, packageInfo.durationType, programs)

  result.name = name
  result.phone = phone
  result.addressPrimary = address.addressPrimary
  result.addressAlternate = address.addressAlternate
  result.addressNotes = compactJoin(address.notes)
  result.programId = packageInfo.programId
  result.programName = packageInfo.programName
  result.mealType = packageInfo.mealType
  result.mealTypeLabel = packageInfo.mealType ? MEAL_LABELS[packageInfo.mealType] || null : null
  result.durationType = packageInfo.durationType
  result.durationLabel = packageInfo.durationType ? DURATION_LABELS[packageInfo.durationType] || null : null
  result.startDate = dates.startDate
  result.endDate = dates.endDate
  result.dietaryNotes = compactJoin(notes.dietary)
  result.specialNotes = compactJoin(notes.special)
  result.suggestedZoneId = zone.zoneId
  result.suggestedZoneName = zone.zoneName
  result.zoneConfidence = zone.confidence
  result.priceNormal = pricing.priceNormal
  result.pricePromo = pricing.pricePromo

  let confidence = 0
  if (result.name) confidence += 0.2
  if (result.phone) confidence += 0.2
  if (result.addressPrimary) confidence += 0.15
  if (result.programId) confidence += 0.15
  if (result.startDate) confidence += 0.15
  if (result.mealType) confidence += 0.15
  result.parseConfidence = Math.min(1, Number(confidence.toFixed(2)))

  if (!result.name) warnings.push('Nama tidak ditemukan, mohon isi manual')
  if (!result.phone) warnings.push('Nomor HP tidak ditemukan atau format tidak valid')
  if (!result.addressPrimary) warnings.push('Alamat tidak ditemukan')
  if (!result.programId) warnings.push('Paket/program tidak terdeteksi, mohon pilih manual')
  if (!result.startDate) warnings.push('Tanggal tidak ditemukan, mohon isi manual')
  if (!result.suggestedZoneId) warnings.push('Zona tidak dapat dideteksi otomatis')

  return result
}

function parseName(lines) {
  for (const line of lines) {
    const match = line.match(/^.*?\bnama\b\s*[:\-]\s*(.+)$/i)
    if (match) return cleanName(match[1])
  }

  for (const line of lines) {
    const cleaned = cleanLeadingNumber(line)
    const lower = cleaned.toLowerCase()
    if (!/[a-z]/i.test(cleaned)) continue
    if (IGNORED_NAME_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue
    if (isLikelyPhoneLine(lower) || isLikelyAddressLine(lower) || isLikelyDateLine(lower)) continue
    if (getProgramId(lower)) continue
    return cleanName(cleaned)
  }

  return null
}

function cleanName(value) {
  const cleaned = cleanLeadingNumber(value).replace(/^[:\-\s]+/, '').trim()
  return cleaned || null
}

function parsePhone(rawText, lines) {
  for (const line of lines) {
    if (!isLikelyPhoneLine(line.toLowerCase())) continue
    const found = line.match(/(\+62|08)[0-9\-\s]{8,13}/)
    if (found) return normalizePhone(found[0])
  }

  const fallback = rawText.match(/(\+62|08)[0-9\-\s]{8,13}/)
  return fallback ? normalizePhone(fallback[0]) : null
}

function normalizePhone(value) {
  const normalized = value.replace(/[^\d+]/g, '').replace(/^\+62/, '0')
  if (!/^0\d{9,14}$/.test(normalized)) return null
  return normalized
}

function parseAddresses(lines) {
  const labeled = []
  const unlabeled = []
  const notes = []

  for (const line of lines) {
    const lower = line.toLowerCase()
    const labeledMatch = line.match(/^alamat(?:\s+(kantor|rumah))?\s*[:\-]\s*(.+)$/i)

    if (labeledMatch) {
      const kind = labeledMatch[1]?.toLowerCase() || 'general'
      const extracted = extractAddressAndNotes(labeledMatch[2])
      labeled.push({ kind, address: extracted.address })
      notes.push(...extracted.notes)
      continue
    }

    if (isLikelyAddressLine(lower)) {
      const extracted = extractAddressAndNotes(cleanLeadingNumber(line))
      unlabeled.push(extracted.address)
      notes.push(...extracted.notes)
    }
  }

  let addressPrimary = null
  let addressAlternate = null

  const rumah = labeled.find((item) => item.kind === 'rumah')
  const kantor = labeled.find((item) => item.kind === 'kantor')

  if (rumah || kantor) {
    addressPrimary = rumah?.address || kantor?.address || null
    addressAlternate = rumah && kantor ? kantor.address : labeled.find((item) => item.address !== addressPrimary)?.address || null
  } else if (labeled.length > 0) {
    addressPrimary = labeled[0].address
    addressAlternate = labeled[1]?.address || null
  } else if (unlabeled.length > 0) {
    addressPrimary = unlabeled[0]
    addressAlternate = unlabeled[1] || null
  }

  return {
    addressPrimary: addressPrimary || null,
    addressAlternate: addressAlternate || null,
    notes: uniqueNonEmpty(notes),
  }
}

function extractAddressAndNotes(value) {
  const notes = []
  const address = value.replace(/\(([^)]+)\)/g, (_, note) => {
    notes.push(cleanText(note))
    return ''
  })

  return {
    address: cleanText(address),
    notes,
  }
}

function parsePackageInfo(lines, programs = FALLBACK_PROGRAMS) {
  let candidate = null

  for (const line of lines) {
    const match = line.match(/^(paket|program)\s*[:\-]\s*(.+)$/i)
    if (match) {
      candidate = match[2]
      break
    }
  }

  if (!candidate) {
    candidate = lines.find((line) => {
      const lower = line.toLowerCase()
      return !!getProgramId(lower)
    }) || null
  }

  const lower = candidate?.toLowerCase() || ''
  const programId = getProgramId(lower)
  const mealType = getMealType(lower)
  const durationType = getDurationType(lower)
  const program = programs.find((item) => item.id === programId) || null

  return {
    programId,
    programName: program?.name || null,
    mealType,
    durationType,
  }
}

function parseDates(rawText, lines, durationType) {
  const joined = [rawText, ...lines].join('\n')

  const slashMatch = joined.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (slashMatch) {
    const startDate = toIsoDate(Number(slashMatch[3]), Number(slashMatch[2]), Number(slashMatch[1]))
    return { startDate, endDate: inferEndDate(startDate, durationType) }
  }

  const fullRangeMatch = joined.match(/\b(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i)
  if (fullRangeMatch) {
    return {
      startDate: buildDate(fullRangeMatch[1], fullRangeMatch[2], fullRangeMatch[5]),
      endDate: buildDate(fullRangeMatch[3], fullRangeMatch[4], fullRangeMatch[5]),
    }
  }

  const sharedMonthRangeMatch = joined.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i)
  if (sharedMonthRangeMatch) {
    const startDate = buildDate(sharedMonthRangeMatch[1], sharedMonthRangeMatch[3], sharedMonthRangeMatch[4])
    const endDate = buildDate(sharedMonthRangeMatch[2], sharedMonthRangeMatch[3], sharedMonthRangeMatch[4])
    return { startDate, endDate }
  }

  for (const line of lines) {
    const cleaned = cleanLeadingNumber(line)
    const match = cleaned.match(/(?:mulai|start|dari|tanggal mulai)?\s*[:\-]?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
    if (match) {
      const startDate = buildDate(match[1], match[2], match[3])
      return { startDate, endDate: inferEndDate(startDate, durationType) }
    }
  }

  return { startDate: null, endDate: null }
}

function parseNotes(lines, addressNotes = []) {
  const dietary = []
  const special = [...addressNotes]

  for (const line of lines) {
    const cleaned = cleanLeadingNumber(line)
      .replace(/^(catatan|note|pantangan|alergi)\s*[:\-]\s*/i, '')
      .replace(/^-+\s*note\s*/i, '')
      .replace(/^[*-]\s*/, '')
      .trim()

    if (!cleaned) continue

    const lower = cleaned.toLowerCase()
    if (isLikelyAddressLine(lower) || isLikelyPhoneLine(lower) || isLikelyDateLine(lower)) continue
    if (/^(nama|paket|program)\s*[:\-]/i.test(line)) continue

    if (looksLikeNoteLine(line, lower)) {
      classifyNote(cleaned, dietary, special)
    }
  }

  return {
    dietary: uniqueNonEmpty(dietary),
    special: uniqueNonEmpty(special),
  }
}

function looksLikeNoteLine(originalLine, lower) {
  return (
    /^[*-]/.test(originalLine.trim()) ||
    /^(catatan|note|pantangan|alergi)\s*[:\-]/i.test(originalLine) ||
    lower.includes('no ') ||
    lower.includes('tidak mau') ||
    lower.includes('jangan')
  )
}

function classifyNote(note, dietary, special) {
  const fragments = note
    .split(/\s*,\s*/)
    .map((item) => cleanText(item))
    .filter(Boolean)

  for (const fragment of fragments) {
    const lower = fragment.toLowerCase()
    const isDietary = DIETARY_NOTE_KEYWORDS.some((keyword) => lower.includes(keyword))
    const isSpecial = SPECIAL_NOTE_KEYWORDS.some((keyword) => lower.includes(keyword))

    if (isDietary && !isSpecial) dietary.push(fragment)
    else if (isSpecial && !isDietary) special.push(fragment)
    else if (isDietary) dietary.push(fragment)
    else special.push(fragment)
  }
}

function detectZone(address, zones = FALLBACK_ZONES) {
  if (!address) return { zoneId: null, zoneName: null, confidence: 0 }

  const lower = address.toLowerCase()
  let bestMatch = null

  for (const zone of zones) {
    const extraKeywords = EXTENDED_ZONE_KEYWORDS[zone.id] || []
    const keywords = uniqueNonEmpty([...(zone.keywords || []), ...extraKeywords])
    const matches = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()))

    if (!matches.length) continue

    const confidence = Math.min(0.99, 0.55 + matches.length * 0.1)
    if (!bestMatch || matches.length > bestMatch.matches.length) {
      bestMatch = { zone, matches, confidence: Number(confidence.toFixed(2)) }
    }
  }

  if (!bestMatch) return { zoneId: null, zoneName: null, confidence: 0 }

  return {
    zoneId: bestMatch.zone.id,
    zoneName: bestMatch.zone.name,
    confidence: bestMatch.confidence,
  }
}

function getPricing(programId, mealType, durationType, programs = FALLBACK_PROGRAMS) {
  const program = programs.find((item) => item.id === programId)
  if (!program || !mealType || !durationType) {
    return { priceNormal: null, pricePromo: null }
  }

  const mealPriceKey = mealType === 'lunch_dinner' ? 'lunch_dinner' : mealType === 'dinner_only' ? 'dinner' : 'lunch'
  const lookupKey = `${durationType}_${mealPriceKey}`
  const priceNormal = program.prices?.[lookupKey] ?? null

  return {
    priceNormal,
    pricePromo: priceNormal,
  }
}

function getProgramId(text) {
  for (const rule of PROGRAM_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.programId
  }
  return null
}

function getMealType(text) {
  for (const rule of MEAL_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.mealType
  }

  if (text.includes('lunch') && text.includes('dinner')) return 'lunch_dinner'
  if (text.includes('lunch')) return 'lunch_only'
  if (text.includes('dinner')) return 'dinner_only'
  return null
}

function getDurationType(text) {
  for (const rule of DURATION_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.durationType
  }
  return null
}

function buildDate(day, monthName, year) {
  const month = INDONESIAN_MONTHS[monthName.toLowerCase()]
  if (!month) return null
  return toIsoDate(Number(year), month, Number(day))
}

function toIsoDate(year, month, day) {
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

function inferEndDate(startDate, durationType) {
  if (!startDate || !durationType || !(durationType in DURATION_DAY_SPANS)) return null
  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + DURATION_DAY_SPANS[durationType])
  return date.toISOString().slice(0, 10)
}

function formatLocalDateTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function cleanLeadingNumber(value) {
  return String(value).replace(/^\s*\d+[.)-]?\s*/, '').trim()
}

function cleanText(value) {
  return String(value).replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().replace(/[.,;:\-]+$/, '').trim()
}

function compactJoin(items) {
  const values = uniqueNonEmpty(items)
  return values.length ? values.join(', ') : null
}

function uniqueNonEmpty(items) {
  return [...new Set((items || []).map((item) => cleanText(item)).filter(Boolean))]
}

function isLikelyPhoneLine(lower) {
  return /(?:no\.?\s*hp|hp|telepon|wa|whatsapp)/i.test(lower)
}

function isLikelyAddressLine(lower) {
  if (/^alamat/i.test(lower)) return true
  return ADDRESS_HINTS.some((hint) => lower.includes(hint))
}

function isLikelyDateLine(lower) {
  return /(?:mulai|start|tanggal mulai|\d{1,2}\s*[-/]\s*\d{1,2}|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.test(lower)
}
