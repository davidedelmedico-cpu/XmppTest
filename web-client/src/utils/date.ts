/**
 * Utility functions per la gestione e formattazione delle date
 */

/**
 * Verifica se due date sono nello stesso giorno
 * 
 * @param date1 - Prima data
 * @param date2 - Seconda data
 * @returns true se le date sono nello stesso giorno
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Formatta una data come separatore per i messaggi nella chat
 * Mostra "Oggi", "Ieri" o la data formattata
 * 
 * @param date - La data da formattare
 * @param locale - Locale per la formattazione (default: 'it-IT')
 * @returns Stringa formattata
 */
export function formatDateSeparator(date: Date, locale: string = 'it-IT'): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return 'Oggi'
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Ieri'
  } else {
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }
}

/**
 * Formatta un timestamp per i messaggi nella chat
 * 
 * @param date - La data da formattare
 * @param locale - Locale per la formattazione (default: 'it-IT')
 * @returns Stringa con ora e minuti (es: "14:30")
 */
export function formatMessageTime(date: Date, locale: string = 'it-IT'): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formatta un timestamp per la lista conversazioni
 * Mostra ora se oggi, "Ieri", "Nd fa" o data formattata
 * 
 * @param date - La data da formattare
 * @param locale - Locale per la formattazione (default: 'it-IT')
 * @returns Stringa formattata
 */
export function formatConversationTimestamp(date: Date, locale: string = 'it-IT'): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    // Oggi: mostra solo l'ora
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Ieri'
  } else if (days < 7) {
    return `${days}g fa`
  } else {
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  }
}
