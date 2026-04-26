import imageCompression from 'browser-image-compression'
import { supabase } from './supabase.js'

export async function compressImage(file, maxSizeMB = 0.5) {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  }
  try {
    return await imageCompression(file, options)
  } catch (error) {
    console.error('[Gracious] Compress failed, uploading original:', error)
    return file
  }
}

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
}

export async function uploadTransferProof(file, orderId) {
  ensureSupabase()
  const compressed = await compressImage(file, 0.5)
  const filePath = `orders/${orderId}_${Date.now()}.webp`

  const { error } = await supabase.storage
    .from('transfer-proofs')
    .upload(filePath, compressed, { contentType: 'image/webp', upsert: false })

  if (error) throw error
  return { path: filePath, bucket: 'transfer-proofs' }
}

export async function getTransferProofUrl(filePath) {
  ensureSupabase()
  const { data, error } = await supabase.storage
    .from('transfer-proofs')
    .createSignedUrl(filePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function uploadMenuImage(file, weekLabel, dayName) {
  ensureSupabase()
  const compressed = await compressImage(file, 0.3)
  const filePath = `weekly/${weekLabel}_${dayName}_${Date.now()}.webp`

  const { error } = await supabase.storage
    .from('menu-images')
    .upload(filePath, compressed, { contentType: 'image/webp', upsert: true })

  if (error) throw error

  const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(filePath)
  return { path: filePath, publicUrl: urlData.publicUrl }
}

export async function uploadDeliveryPhoto(file, routeItemId) {
  ensureSupabase()
  const compressed = await compressImage(file, 0.4)
  const filePath = `items/${routeItemId}_${Date.now()}.webp`

  const { error } = await supabase.storage
    .from('delivery-photos')
    .upload(filePath, compressed, { contentType: 'image/webp', upsert: false })

  if (error) throw error
  return { path: filePath, bucket: 'delivery-photos' }
}

export async function getDeliveryPhotoUrl(filePath) {
  ensureSupabase()
  const { data, error } = await supabase.storage
    .from('delivery-photos')
    .createSignedUrl(filePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function deleteImage(bucket, filePath) {
  ensureSupabase()
  const { error } = await supabase.storage.from(bucket).remove([filePath])
  if (error) throw error
  return true
}

export async function listFiles(bucket, folder = '') {
  ensureSupabase()
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error
  return data || []
}

export async function getStorageUsage() {
  ensureSupabase()
  const [transferFiles, menuFiles, deliveryFiles] = await Promise.all([
    listFiles('transfer-proofs', 'orders').catch(() => []),
    listFiles('menu-images', 'weekly').catch(() => []),
    listFiles('delivery-photos', 'items').catch(() => []),
  ])

  const sumSize = (files) => files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
  const transferSize = sumSize(transferFiles)
  const menuSize = sumSize(menuFiles)
  const deliverySize = sumSize(deliveryFiles)
  const totalBytes = transferSize + menuSize + deliverySize
  const totalMB = totalBytes / 1024 / 1024

  return {
    transferProofs: { count: transferFiles.length, sizeMB: (transferSize / 1024 / 1024).toFixed(2) },
    menuImages: { count: menuFiles.length, sizeMB: (menuSize / 1024 / 1024).toFixed(2) },
    deliveryPhotos: { count: deliveryFiles.length, sizeMB: (deliverySize / 1024 / 1024).toFixed(2) },
    totalMB: totalMB.toFixed(2),
    usagePercent: ((totalMB / 1024) * 100).toFixed(1),
  }
}
