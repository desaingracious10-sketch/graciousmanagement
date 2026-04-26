import { useApp, STORAGE_KEYS } from '../context/AppContext.jsx'

export const STORAGE_KEY = STORAGE_KEYS.currentUser
export const REMEMBER_KEY = 'gracious_remember_email'
export const ROLE_HOME = {
  superadmin: '/dashboard/admin',
  sales: '/dashboard/sales',
  address_admin: '/dashboard/alamat',
  driver: '/dashboard/driver',
}

export function useAuth() {
  const { currentUser, login, logout } = useApp()

  return {
    currentUser,
    isLoggedIn: !!currentUser,
    userRole: currentUser?.role || null,
    login,
    logout,
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/login'
}
