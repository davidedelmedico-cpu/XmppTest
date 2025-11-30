/**
 * Barrel export per sincronizzazione
 * Centralizza tutte le funzioni di sync usando Strategy Pattern
 */

export { 
  SyncContext,
  SingleConversationSyncStrategy,
  CompleteConversationSyncStrategy,
  AllConversationsSyncStrategy,
  IncomingMessageSyncStrategy,
  type ISyncStrategy,
  type SyncResult,
} from './SyncStrategy'

// Istanza di default per uso conveniente
import { SyncContext } from './SyncStrategy'
export const defaultSyncContext = new SyncContext()

/**
 * Helper functions per compatibilità con codice esistente
 */
import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'

/**
 * Sincronizza singola conversazione (solo messaggi)
 */
export async function syncSingleConversation(client: Agent, contactJid: string) {
  const strategy = defaultSyncContext.createSingleConversationSync()
  return await defaultSyncContext.executeStrategy(strategy, client, contactJid)
}

/**
 * Sincronizza singola conversazione completa (messaggi + vCard)
 */
export async function syncSingleConversationComplete(client: Agent, contactJid: string) {
  const strategy = defaultSyncContext.createCompleteConversationSync()
  return await defaultSyncContext.executeStrategy(strategy, client, contactJid)
}

/**
 * Sincronizza tutte le conversazioni
 */
export async function syncAllConversationsComplete(client: Agent) {
  const strategy = defaultSyncContext.createAllConversationsSync()
  return await defaultSyncContext.executeStrategy(strategy, client)
}

/**
 * Gestisce messaggio in arrivo e sincronizza
 */
export async function handleIncomingMessageAndSync(
  client: Agent,
  message: ReceivedMessage,
  myJid: string
) {
  const strategy = defaultSyncContext.createIncomingMessageSync()
  return await defaultSyncContext.executeStrategy(strategy, client, message, myJid)
}
