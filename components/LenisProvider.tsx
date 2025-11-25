"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export default function LenisProvider() {
  const lenisRef = useRef<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    let rafId = 0

    ;(async () => {
      try {
        const { default: Lenis } = await import('lenis')
        if (!mounted) return
        // Create Lenis with conservative defaults; include both smooth and smoothWheel options
        lenisRef.current = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smooth: true,
          smoothWheel: true,
          smoothTouch: true,
        })

        // expose for debugging
        try {
          ;(window as any).__lenis = lenisRef.current
        } catch (e) {
          /* ignore in non-browser env */
        }

        // log so you can confirm initialization in the browser console
        // eslint-disable-next-line no-console
        console.info('Lenis initialized', lenisRef.current)

        const raf = (time: number) => {
          if (lenisRef.current) lenisRef.current.raf(time)
          rafId = requestAnimationFrame(raf)
        }
        rafId = requestAnimationFrame(raf)
      } catch (err) {
        // Lenis not installed — don't break the app
        // eslint-disable-next-line no-console
        console.warn('Lenis not available. Run `npm i lenis` to enable smooth scrolling.', err)
      }
    })()

    return () => {
      mounted = false
      if (rafId) cancelAnimationFrame(rafId)
      if (lenisRef.current && typeof lenisRef.current.destroy === 'function') {
        lenisRef.current.destroy()
        lenisRef.current = null
      }
    }
  }, [])

  // Scroll to top on route change using Lenis if available
  useEffect(() => {
    if (lenisRef.current && typeof lenisRef.current.scrollTo === 'function') {
      lenisRef.current.scrollTo(0, { immediate: true })
    }
  }, [pathname])

  return null
}
