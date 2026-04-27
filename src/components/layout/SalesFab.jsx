import { Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const HIDE_ON = ['/orders/new', '/menu-manager']

export default function SalesFab() {
  const location = useLocation()
  if (HIDE_ON.some((path) => location.pathname.startsWith(path))) return null

  return (
    <Link
      to="/orders/new"
      aria-label="Input pesanan baru"
      className="fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-teal text-white shadow-[0_18px_36px_rgba(13,148,136,0.45)] transition active:scale-95 hover:bg-teal-dark lg:hidden"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <Plus size={26} />
    </Link>
  )
}
