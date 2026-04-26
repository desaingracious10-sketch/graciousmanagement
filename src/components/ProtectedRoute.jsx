import { Navigate } from 'react-router-dom'
import { getRoleHome, useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ roles, children }) {
  const { currentUser: user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }
  return children
}
