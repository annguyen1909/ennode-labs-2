import { useEffect, useState } from 'react'

export default function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setPrefersReduced(!!mq.matches)

    // Initialize
    handleChange()

    // Modern API
    if (mq.addEventListener) mq.addEventListener('change', handleChange)
    else mq.addListener(handleChange)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handleChange)
      else mq.removeListener(handleChange)
    }
  }, [])

  return prefersReduced
}
