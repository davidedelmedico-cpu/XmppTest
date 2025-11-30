import { useState, useRef, useCallback } from 'react'
import { PULL_TO_REFRESH } from '../config/constants'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  enabled?: boolean
  threshold?: number
  maxDistance?: number
}

interface UsePullToRefreshReturn {
  isRefreshing: boolean
  pullDistance: number
  pullIndicatorRef: React.RefObject<HTMLDivElement | null>
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: () => void
}

/**
 * Custom hook per gestire pull-to-refresh
 * Supporta sia pull verso il basso (top) che verso l'alto (bottom)
 * 
 * @param options - Opzioni di configurazione
 * @param options.onRefresh - Funzione chiamata quando il refresh viene attivato
 * @param options.enabled - Abilita/disabilita pull-to-refresh (default: true)
 * @param options.threshold - Distanza minima per attivare refresh (default: da constants)
 * @param options.maxDistance - Distanza massima di pull (default: da constants)
 * @returns Oggetto con stato e handlers per pull-to-refresh
 * 
 * @example
 * ```tsx
 * const { isRefreshing, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await reloadData()
 *   }
 * })
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = PULL_TO_REFRESH.THRESHOLD,
  maxDistance = PULL_TO_REFRESH.MAX_DISTANCE,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  
  const pullIndicatorRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const pullCurrentY = useRef(0)
  const isPulling = useRef(false)
  const containerRef = useRef<HTMLElement | null>(null)

  // Handler per iniziare il pull
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing) return

      const target = e.currentTarget as HTMLElement
      containerRef.current = target

      // Controlla se siamo in posizione per iniziare il pull
      const { scrollTop, scrollHeight, clientHeight } = target
      const isAtTop = scrollTop === 0
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10

      if (isAtTop || isAtBottom) {
        isPulling.current = true
        pullStartY.current = e.touches[0].clientY
        pullCurrentY.current = pullStartY.current
      }
    },
    [enabled, isRefreshing]
  )

  // Handler per il movimento durante il pull
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || !containerRef.current || !pullIndicatorRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isAtTop = scrollTop === 0
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10

      pullCurrentY.current = e.touches[0].clientY
      const rawDistance = pullCurrentY.current - pullStartY.current

      // Determina direzione del pull
      const isPullingDown = isAtTop && rawDistance > 0
      const isPullingUp = isAtBottom && rawDistance < 0

      if (isPullingDown || isPullingUp) {
        // Previeni lo scroll nativo per mostrare l'indicatore
        e.preventDefault()

        // Calcola distanza con effetto "gomma"
        const pullDist = Math.min(Math.abs(rawDistance), maxDistance)
        const opacity = Math.min(pullDist / threshold, 1)
        const translateY = Math.min(pullDist * 0.5, maxDistance)

        setPullDistance(pullDist)

        // Aggiorna indicatore visivo
        if (pullIndicatorRef.current) {
          pullIndicatorRef.current.style.opacity = opacity.toString()
          pullIndicatorRef.current.style.transform = `translateY(${isPullingUp ? '-' : ''}${translateY}px)`
        }
      } else if (Math.abs(rawDistance) <= 0) {
        // Reset se si torna indietro
        isPulling.current = false
        setPullDistance(0)
      }
    },
    [threshold, maxDistance]
  )

  // Handler per il rilascio del pull
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || !pullIndicatorRef.current) return

    const finalDistance = Math.abs(pullStartY.current - pullCurrentY.current)

    // Reset indicatore con transizione
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transition = `opacity ${PULL_TO_REFRESH.ANIMATION_DURATION}ms ease, transform ${PULL_TO_REFRESH.ANIMATION_DURATION}ms ease`
      pullIndicatorRef.current.style.opacity = '0'
      pullIndicatorRef.current.style.transform = 'translateY(0)'

      setTimeout(() => {
        if (pullIndicatorRef.current) {
          pullIndicatorRef.current.style.transition = 'none'
        }
      }, PULL_TO_REFRESH.ANIMATION_DURATION)
    }

    // Se superato il threshold, attiva il refresh
    if (finalDistance > threshold) {
      setIsRefreshing(true)
      setPullDistance(0)

      try {
        await onRefresh()
      } catch (error) {
        console.error('Errore durante pull-to-refresh:', error)
      } finally {
        setIsRefreshing(false)
      }
    } else {
      setPullDistance(0)
    }

    // Reset stato
    isPulling.current = false
    pullStartY.current = 0
    pullCurrentY.current = 0
    containerRef.current = null
  }, [threshold, onRefresh])

  return {
    isRefreshing,
    pullDistance,
    pullIndicatorRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
