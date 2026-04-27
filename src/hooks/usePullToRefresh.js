import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 80
const MAX_PULL = 140

export default function usePullToRefresh(onRefresh, enabled = true) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    function onTouchStart(e) {
      if (window.scrollY > 0 || refreshing) return
      startYRef.current = e.touches[0].pageY
      pullingRef.current = true
    }

    function onTouchMove(e) {
      if (!pullingRef.current || refreshing) return
      const dy = e.touches[0].pageY - startYRef.current
      if (dy <= 0) {
        setPull(0)
        return
      }
      if (window.scrollY > 0) {
        pullingRef.current = false
        setPull(0)
        return
      }
      const damped = Math.min(dy * 0.5, MAX_PULL)
      setPull(damped)
    }

    async function onTouchEnd() {
      if (!pullingRef.current) return
      pullingRef.current = false
      const distance = pull
      setPull(0)
      if (distance >= THRESHOLD && !refreshing) {
        try {
          setRefreshing(true)
          await onRefresh?.()
        } finally {
          setRefreshing(false)
        }
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, onRefresh, pull, refreshing])

  return { pull, refreshing, threshold: THRESHOLD }
}
