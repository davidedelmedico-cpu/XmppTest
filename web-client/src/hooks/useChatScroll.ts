import { useEffect, useRef, useCallback } from 'react'
import { PAGINATION } from '../config/constants'

interface UseChatScrollOptions {
  messages: unknown[] // Array di messaggi per triggerare scroll
  isLoadingMore: boolean
  hasMoreMessages: boolean
  onLoadMore?: () => void
  onScrollToBottom?: () => void
}

interface UseChatScrollReturn {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  isAtBottomRef: React.MutableRefObject<boolean>
  handleScroll: () => void
  scrollToBottom: (behavior?: ScrollBehavior) => void
  preserveScrollPosition: (previousScrollHeight: number) => void
}

/**
 * Custom hook per gestire lo scroll nella chat
 * Gestisce auto-scroll, load more trigger, e preservazione posizione scroll
 * 
 * @param options - Opzioni di configurazione
 * @param options.messages - Array di messaggi (usato per triggerare scroll)
 * @param options.isLoadingMore - Flag che indica se stiamo caricando più messaggi
 * @param options.hasMoreMessages - Flag che indica se ci sono più messaggi da caricare
 * @param options.onLoadMore - Callback chiamato quando si deve caricare più messaggi
 * @param options.onScrollToBottom - Callback chiamato quando si scrolla in fondo
 * @returns Oggetto con refs e funzioni per gestire lo scroll
 * 
 * @example
 * ```tsx
 * const { messagesContainerRef, messagesEndRef, handleScroll } = useChatScroll({
 *   messages,
 *   isLoadingMore,
 *   hasMoreMessages,
 *   onLoadMore: loadMoreMessages
 * })
 * ```
 */
export function useChatScroll({
  messages,
  isLoadingMore,
  hasMoreMessages,
  onLoadMore,
  onScrollToBottom,
}: UseChatScrollOptions): UseChatScrollReturn {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const lastScrollHeightRef = useRef(0)

  // Auto-scroll al bottom solo se già in fondo
  useEffect(() => {
    if (isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      onScrollToBottom?.()
    }
  }, [messages, onScrollToBottom])

  // Mantieni posizione scroll dopo loadMore
  useEffect(() => {
    if (messagesContainerRef.current && lastScrollHeightRef.current > 0) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight
      const heightDifference = newScrollHeight - lastScrollHeightRef.current
      messagesContainerRef.current.scrollTop = heightDifference
      lastScrollHeightRef.current = 0
    }
  }, [messages.length])

  // Gestisce lo scroll e triggera load more se necessario
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    // Considera "in fondo" se entro la soglia dal bottom
    isAtBottomRef.current = distanceFromBottom < PAGINATION.SCROLL_TO_BOTTOM_THRESHOLD

    // Trigger load more se vicino al top (ma non durante loading)
    if (
      scrollTop < PAGINATION.LOAD_MORE_THRESHOLD &&
      hasMoreMessages &&
      !isLoadingMore &&
      onLoadMore
    ) {
      const currentScrollHeight = scrollHeight
      lastScrollHeightRef.current = currentScrollHeight
      onLoadMore()
    }
  }, [hasMoreMessages, isLoadingMore, onLoadMore])

  // Scroll programmatico al bottom
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior })
        isAtBottomRef.current = true
        onScrollToBottom?.()
      }
    },
    [onScrollToBottom]
  )

  // Preserva posizione scroll dopo aggiunta messaggi sopra
  const preserveScrollPosition = useCallback((previousScrollHeight: number) => {
    if (messagesContainerRef.current) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight
      const heightDifference = newScrollHeight - previousScrollHeight
      messagesContainerRef.current.scrollTop = heightDifference
    }
  }, [])

  return {
    messagesContainerRef,
    messagesEndRef,
    isAtBottomRef,
    handleScroll,
    scrollToBottom,
    preserveScrollPosition,
  }
}
