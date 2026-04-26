import { supabase, SUPABASE_CONFIGURED } from './supabase.js'

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
  const { data, error } = await supabase
    .from('users')
    .select('id, name, username, role, phone, is_active, password')
    .eq('username', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return { ok: false, error: 'Tidak bisa terhubung ke server.' }
  }
  if (!data || data.password !== password) {
    return { ok: false, error: 'Username atau password salah. Silakan coba lagi.' }
  }
  // Strip password before returning
  const { password: _pw, ...rest } = data
  return { ok: true, user: fromDb(rest) }
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
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return fromDb(data || [])
}

export async function createCustomer(customerData) {
  ensureClient()
  const portalToken =
    customerData.portalToken ||
    Math.random().toString(36).slice(2, 8) + Date.now().toString(36)

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
  const payload = toDb(orderData)
  if (!payload.order_number) {
    payload.order_number = await generateOrderNumber()
  }
  const { data, error } = await supabase.from('orders').insert(payload).select().single()
  if (error) throw error
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

export async function verifyOrder(id, verifiedBy) {
  return updateOrder(id, {
    paymentStatus: 'verified',
    status: 'active',
    verifiedBy,
    verifiedAt: new Date().toISOString(),
  })
}

export async function rejectOrder(id, reason) {
  return updateOrder(id, { paymentStatus: 'rejected', rejectionReason: reason })
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

export async function finalizeRoute(id) {
  return updateDeliveryRoute(id, { status: 'finalized' })
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
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  })
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
