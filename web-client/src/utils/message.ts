/**
 * Utility functions per la gestione dei messaggi
 */

import type { Message } from '../services/conversations-db'

/**
 * Genera un ID temporaneo univoco per messaggi ottimistici
 * 
 * @returns ID temporaneo nel formato: temp_{timestamp}_{random}
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Merge due array di messaggi eliminando duplicati
 * Mantiene lo status più aggiornato quando ci sono duplicati
 * 
 * @param existing - Array di messaggi esistenti
 * @param newMessages - Array di nuovi messaggi da mergere
 * @returns Array di messaggi mergiati e ordinati per timestamp
 */
export function mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
  const messageMap = new Map<string, Message>()
  
  // Aggiungi messaggi esistenti
  existing.forEach(msg => messageMap.set(msg.messageId, msg))
  
  // Merge/sovrascrivi con nuovi messaggi (più recenti hanno priorità)
  newMessages.forEach(msg => {
    const existingMsg = messageMap.get(msg.messageId)
    
    // Se esiste già, mantieni lo status più aggiornato
    if (existingMsg) {
      // Se il nuovo messaggio ha status 'sent' e quello esistente era 'pending', aggiorna
      if (msg.status === 'sent' && existingMsg.status === 'pending') {
        messageMap.set(msg.messageId, msg)
      }
      // Altrimenti mantieni quello esistente (evita downgrade di status)
    } else {
      messageMap.set(msg.messageId, msg)
    }
  })
  
  // Converti in array e ordina per timestamp
  return Array.from(messageMap.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )
}

/**
 * Tronca il testo di un messaggio per l'anteprima
 * 
 * @param body - Il testo del messaggio
 * @param maxLength - Lunghezza massima (default: 50)
 * @returns Testo troncato con "..." se necessario
 */
export function truncateMessage(body: string, maxLength: number = 50): string {
  if (body.length <= maxLength) {
    return body
  }
  return body.substring(0, maxLength).trim() + '...'
}

/**
 * Estrae le iniziali da un JID o display name per l'avatar
 * 
 * @param jid - Il JID del contatto
 * @param displayName - Nome visualizzato opzionale
 * @returns Stringa con le iniziali (max 2 caratteri)
 */
export function getInitials(jid: string, displayName?: string): string {
  if (displayName) {
    const parts = displayName.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return displayName[0]?.toUpperCase() || '?'
  }
  return jid.split('@')[0][0]?.toUpperCase() || '?'
}
