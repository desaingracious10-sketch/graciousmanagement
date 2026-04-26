import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOrderText } from './smartParser.js'

test('parses WhatsApp format with labels, note, and date range', () => {
  const result = parseOrderText(`
74. Nama : Wegi Randol
Alamat : PT Pertamina Patra Niaga, Wisma Tugu 2, Lantai 3, Ruang IT, Jl. HR Rasuna Said Kav. C7-9, Setiabudi, Jakarta Selatan.
No hp : +62 812-2887-838
paket : Diet Lunch 5 hari
-Note rabu cuti
Mulai 23 - 30 April 2026
  `)

  assert.equal(result.name, 'Wegi Randol')
  assert.equal(result.phone, '08122887838')
  assert.equal(result.programId, 'p7')
  assert.equal(result.mealType, 'lunch_only')
  assert.equal(result.durationType, 'weekly_5')
  assert.equal(result.startDate, '2026-04-23')
  assert.equal(result.endDate, '2026-04-30')
  assert.equal(result.specialNotes, 'rabu cuti')
  assert.equal(result.suggestedZoneId, 'z1')
})

test('parses dual office and home addresses and splits notes', () => {
  const result = parseOrderText(`
Nama: Bu Sinta
Alamat Kantor: Gedung AIA Central Lt 15, Jl Jend Sudirman Kav 58A (Titip Mailing Room)
Alamat Rumah: Komplek Cipulir Permai Blok N No 4, Kebayoran Lama, Jakarta Selatan
HP: 081234567890
Paket: Bumil Lunch + Dinner 20 hari
Catatan: No makanan mentah, no mayonaise, no makanan dibakar
Mulai: 1 Mei 2026
  `)

  assert.equal(result.name, 'Bu Sinta')
  assert.equal(result.addressPrimary, 'Komplek Cipulir Permai Blok N No 4, Kebayoran Lama, Jakarta Selatan')
  assert.equal(result.addressAlternate, 'Gedung AIA Central Lt 15, Jl Jend Sudirman Kav 58A')
  assert.equal(result.addressNotes, 'Titip Mailing Room')
  assert.equal(result.dietaryNotes, 'No makanan mentah, no mayonaise, no makanan dibakar')
  assert.equal(result.programId, 'p3')
  assert.equal(result.mealType, 'lunch_dinner')
  assert.equal(result.durationType, 'monthly_20')
  assert.equal(result.endDate, '2026-05-28')
})

test('parses unlabeled compact format', () => {
  const result = parseOrderText(`
Nanda Arsyinta
Premium Bumil Lunch + Dinner 5 Hari
No Nasi Putih, No Pedas, No Makanan Mentah, No Mayonaise, No Makanan Dibakar
082117896940
The Icon Cosmo BSD Blok F1 No.30, Banten 15345 (Rumah Yang Ada Patung Kuda)
23-30 April 2026
  `)

  assert.equal(result.name, 'Nanda Arsyinta')
  assert.equal(result.phone, '082117896940')
  assert.equal(result.addressPrimary, 'The Icon Cosmo BSD Blok F1 No.30, Banten 15345')
  assert.equal(result.addressNotes, 'Rumah Yang Ada Patung Kuda')
  assert.equal(result.programId, 'p3')
  assert.equal(result.mealType, 'lunch_dinner')
  assert.equal(result.durationType, 'weekly_5')
  assert.equal(result.suggestedZoneId, 'z7')
})

test('normalizes phone numbers with +62 and spaces', () => {
  const result = parseOrderText(`
Nama: Lala
WA: +62 811 2222 333
Alamat: Jl. Tebet Raya No 88, Jakarta Selatan
Paket: Healthy Life Lunch 5 Hari
Mulai 12 Mei 2026
  `)

  assert.equal(result.phone, '08112222333')
})

test('detects dinner only meal type', () => {
  const result = parseOrderText(`
Nama: Rafi
Alamat: Apartemen Mediterania Garden Tower B Lt 18, Grogol
HP: 081998887776
Program: Healthy Life Dinner Only 5 hari
Mulai: 03 Juni 2026
  `)

  assert.equal(result.mealType, 'dinner_only')
  assert.equal(result.priceNormal, null)
})

test('parses slash date and infers end date from duration', () => {
  const result = parseOrderText(`
Nama: Tika
Alamat: Jl. Pamulang Permai 2 Blok C5/15, Pamulang
HP: 081111222233
Paket: Diet Lunch 20 hari
Mulai: 23/04/2026
  `)

  assert.equal(result.startDate, '2026-04-23')
  assert.equal(result.endDate, '2026-05-20')
})

test('detects program from promil pcos keywords', () => {
  const result = parseOrderText(`
Nama: Dini
Alamat: Jl. Bintaro Sektor 9 Blok A3 No 22, Bintaro
No. HP: 081200000999
Program: Promil PCOS lunch only 5 hari
Mulai 10 Juni 2026
  `)

  assert.equal(result.programId, 'p6')
  assert.equal(result.suggestedZoneId, 'z7')
})

test('detects bulking program from muscle keyword', () => {
  const result = parseOrderText(`
Nama: Arga
Alamat: Jl. Pondok Gede Raya No 88, Bekasi
HP: 081333444555
Muscle up lunch + dinner 20 hari
Mulai 15 Juni 2026
  `)

  assert.equal(result.programId, 'p4')
  assert.equal(result.mealType, 'lunch_dinner')
  assert.equal(result.suggestedZoneId, 'z6')
})

test('returns warnings when fields are missing', () => {
  const result = parseOrderText(`
Paket: Diet Lunch 5 hari
Mulai 12 Juni 2026
  `)

  assert.ok(result.parseWarnings.includes('Nama tidak ditemukan, mohon isi manual'))
  assert.ok(result.parseWarnings.includes('Nomor HP tidak ditemukan atau format tidak valid'))
  assert.ok(result.parseWarnings.includes('Alamat tidak ditemukan'))
})

test('computes confidence based on detected fields', () => {
  const result = parseOrderText(`
Nama: Sari
Alamat: Jl. Cilandak KKO No 88, Cilandak Timur
HP: 081777666555
Paket: Healthy Life Lunch 5 hari
Mulai 1 Juli 2026
  `)

  assert.equal(result.parseConfidence, 1)
})

test('separates dietary and delivery notes in mixed note line', () => {
  const result = parseOrderText(`
Nama: Andi
Alamat: Gedung Sucofindo Lt 10, Jl. Pasar Minggu Kav 34
HP: 081888999000
Paket: Diet Lunch 5 hari
Catatan: No pedas, titip security lobby
Mulai 4 Juli 2026
  `)

  assert.equal(result.dietaryNotes, 'No pedas')
  assert.equal(result.specialNotes, 'titip security lobby')
})
