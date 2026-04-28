import { supabase, SUPABASE_CONFIGURED } from './supabase.js'
import { generatePortalToken } from '../utils/generateToken.js'

// ============ FIELD-NAME TRANSFORM ============
// Supabase columns are snake_case. The rest of the app expects camelCase.
// Convert recursively on read (in) and write (out).

function snakeToCamelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase())
}

function camelToSnakeKey(key) {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
}

export function fromDb(value) {
  if (Array.isArray(value)) return value.map(fromDb)
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      out[snakeToCamelKey(key)] = fromDb(val)
    }
    return out
  }
  return value
}

export function toDb(value) {
  if (Array.isArray(value)) return value.map(toDb)
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      out[camelToSnakeKey(key)] = toDb(val)
    }
    return out
  }
  return value
}

function ensureClient() {
  if (!SUPABASE_CONFIGURED || !supabase) {
    throw new Error('Supabase belum dikonfigurasi. Cek VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.')
  }
}

// ============ AUTH ============
export async function loginUser(username, password) {
  ensureClient()
  const normalized = String(username).trim().toLowerCase()

  // 1. Cek di tabel users (admin utama, sales, address admin)
  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('id, name, username, role, phone, is_active, password')
    .eq('username', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (userErr) {
    return { ok: false, error: 'Tidak bisa terhubung ke server.' }
  }
  if (userData && userData.password === password) {
    const { password: _pw, ...rest } = userData
    return { ok: true, user: fromDb(rest) }
  }

  // 2. Kalau bukan user, cek di tabel drivers
  const { data: driverData, error: driverErr } = await supabase
    .from('drivers')
    .select('id, name, username, phone, primary_zone_id, is_active, password')
    .eq('username', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (driverErr) {
    return { ok: false, error: 'Tidak bisa terhubung ke server.' }
  }
  if (driverData && driverData.password === password) {
    const { password: _pw, ...rest } = driverData
    return { ok: true, user: { ...fromDb(rest), role: 'driver' } }
  }

  return { ok: false, error: 'Username atau password salah. Silakan coba lagi.' }
}

// ============ USERS ============
export async function getUsers() {
  ensureClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, username, role, phone, is_active, created_at, created_by')
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

export async function createUser(userData) {
  ensureClient()
  const payload = toDb(userData)
  const { data, error } = await supabase.from('users').insert(payload).select().single()
  if (error) throw error
  return fromDb(data)
}

export async function updateUser(id, updates) {
  ensureClient()
  const payload = toDb(updates)
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function deactivateUser(id) {
  return updateUser(id, { isActive: false })
}

export async function hardDeleteUser(userId, currentUserId) {
  ensureClient()
  if (userId === currentUserId) {
    throw new Error('Tidak bisa menghapus akun yang sedang aktif digunakan.')
  }
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .eq('status', 'active')

  if (orderCount && orderCount > 0) {
    throw new Error(
      `User ini masih memiliki ${orderCount} pesanan aktif. Nonaktifkan dulu, jangan dihapus.`,
    )
  }

  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw error
  await addActivityLog(currentUserId, 'DELETE_USER', 'user', userId, {})
}

// ============ ZONES ============
export async function getZones() {
  ensureClient()
  const { data, error } = await supabase.from('zones').select('*').order('name')
  if (error) throw error
  return fromDb(data || [])
}

export async function createZone(zoneData) {
  ensureClient()
  const { data, error } = await supabase.from('zones').insert(toDb(zoneData)).select().single()
  if (error) throw error
  return fromDb(data)
}

export async function updateZone(id, updates) {
  ensureClient()
  const { data, error } = await supabase
    .from('zones')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

// ============ PROGRAMS ============
export async function getPrograms() {
  ensureClient()
  const { data, error } = await supabase.from('programs').select('*').eq('is_active', true)
  if (error) throw error
  return fromDb(data || [])
}

// ============ CUSTOMERS ============
export async function getCustomers() {
  ensureClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

export async function softDeleteCustomer(customerId, currentUserId) {
  ensureClient()
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'active')

  if (count && count > 0) {
    throw new Error(
      'Customer ini masih punya pesanan aktif. Selesaikan pesanannya dulu sebelum dihapus.',
    )
  }

  const { error } = await supabase
    .from('customers')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', customerId)
  if (error) throw error
  await addActivityLog(currentUserId, 'DELETE_CUSTOMER', 'customer', customerId, {})
}

export async function createCustomer(customerData) {
  ensureClient()
  const portalToken =
    customerData.portalToken || generatePortalToken(customerData.id || customerData.name || 'cust')

  const payload = toDb({ ...customerData, portalToken })
  const { data, error } = await supabase.from('customers').insert(payload).select().single()
  if (error) throw error
  return fromDb(data)
}

export async function updateCustomer(id, updates) {
  ensureClient()
  const { data, error } = await supabase
    .from('customers')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function getCustomerByToken(token) {
  ensureClient()
  if (!token) return null
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      zone:zones(id, name, color_code),
      orders(
        id, order_number, program_id, meal_type, duration_type,
        start_date, end_date, status, payment_status,
        dietary_notes, special_notes,
        program:programs(id, name, category)
      )
    `)
    .eq('portal_token', token)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .maybeSingle()
  if (error) {
    console.warn('[getCustomerByToken]', error.message)
    return null
  }
  return data ? fromDb(data) : null
}

export async function getUpcomingBirthdays(limit = 50) {
  if (!SUPABASE_CONFIGURED || !supabase) return []
  const { data, error } = await supabase
    .from('upcoming_birthdays')
    .select('*')
    .limit(limit)
  if (error) {
    console.warn('[getUpcomingBirthdays]', error.message)
    return []
  }
  return fromDb(data || [])
}

export async function regenerateCustomerPortalToken(customerId) {
  ensureClient()
  const portalToken = generatePortalToken(customerId)
  const { data, error } = await supabase
    .from('customers')
    .update({ portal_token: portalToken })
    .eq('id', customerId)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function updateCustomerAddress(customerId, newAddress, reason, changedBy) {
  ensureClient()
  const { data: existing } = await supabase
    .from('customers')
    .select('address_primary')
    .eq('id', customerId)
    .single()

  const { data, error } = await supabase
    .from('customers')
    .update({ address_primary: newAddress })
    .eq('id', customerId)
    .select()
    .single()
  if (error) throw error

  await supabase.from('address_change_logs').insert({
    customer_id: customerId,
    old_address: existing?.address_primary || '',
    new_address: newAddress,
    change_reason: reason,
    changed_by: changedBy,
  })

  return fromDb(data)
}

export async function getAddressChangeLogs() {
  ensureClient()
  const { data, error } = await supabase
    .from('address_change_logs')
    .select('*')
    .order('changed_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

// ============ ORDERS ============
export async function getOrders() {
  ensureClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

export async function getOrderById(id) {
  ensureClient()
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
  if (error) throw error
  return fromDb(data)
}

async function generateOrderNumber() {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
  const seq = String((count || 0) + 1).padStart(3, '0')
  return `GHC-${dd}${mm}-${seq}`
}

export async function createOrder(orderData) {
  ensureClient()
  // CEK DUPLIKASI: customer dengan order aktif yang belum berakhir
  if (orderData.customerId) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from('orders')
      .select('id, order_number, end_date')
      .eq('customer_id', orderData.customerId)
      .eq('status', 'active')
      .gte('end_date', today)
      .neq('payment_status', 'rejected')

    if (existing && existing.length > 0) {
      const existingNo = existing[0].order_number || existing[0].id
      throw new Error(
        `Customer ini masih memiliki pesanan aktif (${existingNo}). Tunggu pesanan lama selesai sebelum membuat pesanan perpanjangan baru.`,
      )
    }
  }

  const payload = toDb(orderData)
  if (!payload.order_number) {
    payload.order_number = await generateOrderNumber()
  }
  const { data, error } = await supabase.from('orders').insert(payload).select().single()
  if (error) throw error

  // Notifikasi: superadmin perlu verifikasi pesanan baru
  await supabase.from('notifications').insert({
    role: 'superadmin',
    type: 'urgent',
    category: 'order',
    title: 'Pesanan Baru Menunggu Verifikasi',
    message: `${orderData.customerName || 'Customer'} — ${data.order_number} perlu diverifikasi`,
    link: `/orders/${data.id}`,
    link_label: 'Lihat & Verifikasi',
    entity_ids: [data.id],
    is_read: false,
  })

  if (orderData.createdBy) {
    await addActivityLog(orderData.createdBy, 'CREATE_ORDER', 'order', data.id, {
      orderNumber: data.order_number,
      customer: orderData.customerName,
    })
  }
  return fromDb(data)
}

export async function updateOrder(id, updates) {
  ensureClient()
  const { data, error } = await supabase
    .from('orders')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function deleteOrder(id) {
  ensureClient()
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
}

export async function verifyOrder(id, verifiedBy, verifierName) {
  ensureClient()
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'verified',
      status: 'active',
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      customer:customers(id, name, phone, address_primary, zone_id),
      program:programs(id, name)
    `)
    .single()
  if (error) throw error

  // Notifikasi ke address_admin
  await supabase.from('notifications').insert({
    role: 'address_admin',
    type: 'info',
    category: 'order',
    title: 'Customer Baru Siap Di-assign ke Rute',
    message: `${data.customer?.name || 'Customer'} (${data.program?.name || ''}) sudah verified, siap masuk batch berikutnya`,
    link: '/routes/builder',
    link_label: 'Atur Rute',
    entity_ids: [id],
    is_read: false,
  })

  // Notifikasi ke sales yang input
  if (data.created_by) {
    await supabase.from('notifications').insert({
      user_id: data.created_by,
      type: 'success',
      category: 'order',
      title: 'Pesanan Disetujui!',
      message: `${data.order_number} sudah diverifikasi oleh ${verifierName || 'Admin'}. Pesanan aktif.`,
      link: `/orders/${id}`,
      link_label: 'Lihat Detail',
      entity_ids: [id],
      is_read: false,
    })
  }

  await addActivityLog(verifiedBy, 'VERIFY_ORDER', 'order', id, {
    orderNumber: data.order_number,
    customer: data.customer?.name,
  })
  return fromDb(data)
}

export async function rejectOrder(id, rejectedBy, reason) {
  ensureClient()
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  if (data.created_by) {
    await supabase.from('notifications').insert({
      user_id: data.created_by,
      type: 'urgent',
      category: 'order',
      title: 'Pesanan Ditolak',
      message: `${data.order_number} ditolak. Alasan: ${reason}. Upload ulang bukti transfer yang benar.`,
      link: `/orders/${id}`,
      link_label: 'Upload Ulang',
      entity_ids: [id],
      is_read: false,
    })
  }

  await addActivityLog(rejectedBy, 'REJECT_ORDER', 'order', id, { reason })
  return fromDb(data)
}

// ============ DELIVERY ROUTES ============
export async function getDeliveryRoutes() {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_routes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

export async function createDeliveryRoute(routeData) {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_routes')
    .insert(toDb(routeData))
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function updateDeliveryRoute(id, updates) {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_routes')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function finalizeRoute(id, currentUserId, extraUpdates = {}) {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_routes')
    .update({ ...toDb(extraUpdates || {}), status: 'finalized' })
    .eq('id', id)
    .select('*, driver:drivers(id, name)')
    .single()
  if (error) throw error

  // Notifikasi ke driver bila ditugaskan
  if (data.driver_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.driver_id,
        type: 'info',
        category: 'route',
        title: 'Rute Kamu Sudah Siap!',
        message: `${data.route_label || 'Rute'} sudah difinalize. Siap untuk pengiriman.`,
        link: '/dashboard/driver',
        link_label: 'Lihat Rute',
        entity_ids: [id],
        is_read: false,
      })
    } catch (e) {
      console.warn('[finalizeRoute] notify failed:', e?.message)
    }
  }

  await addActivityLog(currentUserId, 'FINALIZE_ROUTE', 'route', id, {
    label: data.route_label,
  })
  return fromDb(data)
}

// ============ DELIVERY ROUTE ITEMS ============
export async function getDeliveryRouteItems() {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_route_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

async function recountRoutePoints(routeId) {
  if (!routeId) return
  const { count } = await supabase
    .from('delivery_route_items')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', routeId)
  await supabase
    .from('delivery_routes')
    .update({ route_point_count: count || 0 })
    .eq('id', routeId)
}

export async function createRouteItem(itemData) {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_route_items')
    .insert(toDb(itemData))
    .select()
    .single()
  if (error) throw error
  await recountRoutePoints(data.route_id)
  return fromDb(data)
}

export async function updateRouteItem(id, updates) {
  ensureClient()
  const { data, error } = await supabase
    .from('delivery_route_items')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function removeRouteItem(id) {
  ensureClient()
  const { data: item } = await supabase
    .from('delivery_route_items')
    .select('route_id')
    .eq('id', id)
    .single()
  const { error } = await supabase.from('delivery_route_items').delete().eq('id', id)
  if (error) throw error
  if (item?.route_id) await recountRoutePoints(item.route_id)
}

// ============ NOTIFICATIONS ============
export async function getNotifications(userId, role) {
  ensureClient()
  if (!userId && !role) return []
  const orFilter = [userId ? `user_id.eq.${userId}` : null, role ? `role.eq.${role}` : null]
    .filter(Boolean)
    .join(',')
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return fromDb(data || [])
}

export async function markNotificationRead(id) {
  ensureClient()
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId, role) {
  ensureClient()
  const orFilter = [userId ? `user_id.eq.${userId}` : null, role ? `role.eq.${role}` : null]
    .filter(Boolean)
    .join(',')
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .or(orFilter)
  if (error) throw error
}

export async function createNotification(notif) {
  ensureClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert(toDb(notif))
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

// ============ ACTIVITY LOGS ============
export async function getActivityLogs(limit = 30) {
  ensureClient()
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return fromDb(data || [])
}

export async function addActivityLog(userId, action, entityType, entityId, details) {
  if (!SUPABASE_CONFIGURED || !supabase) return
  let userName = null
  let userRole = null
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('gracious_user') : null
    if (raw) {
      const u = JSON.parse(raw)
      userName = u?.name || null
      userRole = u?.role || null
    }
  } catch {
    // ignore
  }
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    })
  } catch (error) {
    // Activity log tidak boleh crash app
    console.error('[Gracious] activity log failed:', error)
  }
}

// ============ WEEKLY MENUS ============
export async function getWeeklyMenus() {
  ensureClient()
  const { data, error } = await supabase
    .from('weekly_menus')
    .select('*')
    .order('week_start', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

function stripManagedTimestamps(obj) {
  // updated_at di-handle oleh trigger Postgres; jangan kirim dari client
  if (!obj || typeof obj !== 'object') return obj
  const { updatedAt, updated_at, ...rest } = obj
  return rest
}

export async function findWeeklyMenuByLabel(weekLabel, variant) {
  ensureClient()
  if (!weekLabel) return null
  const { data, error } = await supabase
    .from('weekly_menus')
    .select('id, week_label, variant')
    .eq('week_label', weekLabel)
    .eq('variant', variant || 'healthy_catering')
    .maybeSingle()
  if (error) return null
  return data ? fromDb(data) : null
}

export async function createWeeklyMenu(menuData) {
  ensureClient()
  const cleaned = stripManagedTimestamps(menuData)
  const { data, error } = await supabase
    .from('weekly_menus')
    .insert(toDb(cleaned))
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function updateWeeklyMenu(id, updates) {
  ensureClient()
  const cleaned = stripManagedTimestamps(updates)
  const { data, error } = await supabase
    .from('weekly_menus')
    .update(toDb(cleaned))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromDb(data)
}

export async function publishWeeklyMenu(id, currentUserId) {
  ensureClient()
  // Ambil variant dari menu target
  const { data: target, error: getErr } = await supabase
    .from('weekly_menus')
    .select('variant, week_label')
    .eq('id', id)
    .single()
  if (getErr) throw getErr

  // Nonaktifkan menu lain dengan variant sama
  if (target?.variant) {
    await supabase
      .from('weekly_menus')
      .update({ is_active: false })
      .eq('variant', target.variant)
      .neq('id', id)
  }

  // Aktifkan target
  const { data, error } = await supabase
    .from('weekly_menus')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await addActivityLog(currentUserId, 'PUBLISH_MENU', 'weekly_menu', id, {
    label: target?.week_label,
  })
  return fromDb(data)
}

// ============ DRIVERS ============
export async function getDrivers() {
  ensureClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name')
  if (error) throw error
  return fromDb(data || [])
}

export async function createDriver(driverData, currentUserId) {
  ensureClient()
  const payload = toDb(stripManagedTimestamps(driverData))
  if (currentUserId) payload.created_by = currentUserId

  // Cek username unik lintas tabel drivers + users (login pakai dua tabel ini)
  if (payload.username) {
    const uname = String(payload.username).toLowerCase()
    payload.username = uname
    const [{ data: existDriver }, { data: existUser }] = await Promise.all([
      supabase.from('drivers').select('id').eq('username', uname).maybeSingle(),
      supabase.from('users').select('id').eq('username', uname).maybeSingle(),
    ])
    if (existDriver) throw new Error('Username driver sudah dipakai. Pilih username lain.')
    if (existUser) throw new Error('Username sudah dipakai oleh user lain.')
  }

  const { data, error } = await supabase.from('drivers').insert(payload).select().single()
  if (error) throw error
  await addActivityLog(currentUserId, 'CREATE_DRIVER', 'driver', data.id, { name: data.name })
  return fromDb(data)
}

export async function updateDriver(id, updates, currentUserId) {
  ensureClient()
  const cleaned = stripManagedTimestamps(updates)
  const { data, error } = await supabase
    .from('drivers')
    .update(toDb(cleaned))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await addActivityLog(currentUserId, 'UPDATE_DRIVER', 'driver', id, {})
  return fromDb(data)
}

export async function deleteDriver(id, currentUserId) {
  ensureClient()
  // Soft delete: nonaktifkan saja, supaya FK delivery_routes tidak rusak
  const { error } = await supabase
    .from('drivers')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
  await addActivityLog(currentUserId, 'DELETE_DRIVER', 'driver', id, {})
}

// ============ REALTIME ============
export function subscribeToTable(table, callback) {
  if (!supabase) return null
  return supabase
    .channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe()
}

export function unsubscribe(channel) {
  if (channel && supabase) supabase.removeChannel(channel)
}
