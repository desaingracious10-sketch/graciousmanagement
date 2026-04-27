import { FALLBACK_ZONES } from '../lib/fallbackCatalog.js'

const EXTRA_KEYWORDS = {
  z1: ['setiabudi', 'kuningan', 'gatot subroto', 'tb simatupang', 'lebak bulus'],
  z2: ['tomang', 'jelambar', 'daan mogot'],
  z3: ['pondok bambu', 'rawamangun'],
  z4: ['pluit', 'sunter', 'ancol'],
  z5: ['cikini', 'salemba', 'bendungan hilir'],
  z6: ['cibubur', 'citragran'],
  z7: ['sawangan', 'alam sutera'],
  z8: ['modernland', 'summarecon'],
}

export function detectZone(address) {
  if (!address) return emptyResult()

  const haystack = String(address).toLowerCase()
  let bestMatch = null
  const zones = readZones()

  for (const zone of zones) {
    const matches = zone.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()))
    if (!matches.length) continue

    const confidence = Math.min(0.96, 0.52 + matches.length * 0.11)
    if (!bestMatch || matches.length > bestMatch.matchCount) {
      bestMatch = {
        zoneId: zone.id,
        zoneName: zone.name,
        confidence,
        colorCode: zone.colorCode,
        matchCount: matches.length,
      }
    }
  }

  return bestMatch || emptyResult()
}

function emptyResult() {
  return {
    zoneId: '',
    zoneName: '',
    confidence: 0,
    colorCode: '',
  }
}

function readZones() {
  return decorateZones(FALLBACK_ZONES)
}

function decorateZones(zones) {
  return zones.map((zone) => ({
    ...zone,
    keywords: [...(zone.keywords || []), ...(EXTRA_KEYWORDS[zone.id] || [])],
  }))
}
