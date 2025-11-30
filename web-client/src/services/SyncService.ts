import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { normalizeJid } from '../utils/jid'
import { ConversationRepository, MessageRepository, MetadataRepository } from './repositories'
import { reloadAllMessagesFromServer } from './messages'

/**
 * SyncService - gestione sincronizzazione con Dependency Injection
 * NON più singleton, ma iniettabile per testabilità
 */
export class SyncService {
  private conversationRepo: ConversationRepository
  private metadataRepo: MetadataRepository

  constructor(
    conversationRepo?: ConversationRepository,
    _messageRepo?: MessageRepository,
    metadataRepo?: MetadataRepository
  ) {
    this.conversationRepo = conversationRepo || new ConversationRepository()
    this.metadataRepo = metadataRepo || new MetadataRepository()
  }

  /**
   * Sincronizza una singola conversazione dal server
   * Operazione atomica: svuota → scarica → salva
   */
  async syncSingleConversation(client: Agent, contactJid: string): Promise<{
    success: boolean
    error?: string
    messageCount?: number
  }> {
    const normalizedJid = normalizeJid(contactJid)

    try {
      // Usa repository per operazione atomica
      const messages = await reloadAllMessagesFromServer(client, normalizedJid)
      
      // Aggiorna conversazione con ultimo messaggio
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await this.conversationRepo.update(normalizedJid, {
          jid: normalizedJid,
          lastMessage: {
            body: lastMessage.body,
            timestamp: lastMessage.timestamp,
            from: lastMessage.from,
            messageId: lastMessage.messageId,
          },
          updatedAt: lastMessage.timestamp,
        })
      }

      return {
        success: true,
        messageCount: messages.length,
      }
    } catch (error) {
      console.error('Errore sincronizzazione conversazione:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }

  /**
   * Sincronizza conversazione completa (messaggi + vCard)
   */
  async syncSingleConversationComplete(client: Agent, contactJid: string): Promise<{
    success: boolean
    error?: string
    messageCount?: number
  }> {
    const normalizedJid = normalizeJid(contactJid)

    try {
      // 1. Sincronizza messaggi
      const messages = await reloadAllMessagesFromServer(client, normalizedJid)
      
      // 2. Aggiorna conversazione
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await this.conversationRepo.update(normalizedJid, {
          jid: normalizedJid,
          lastMessage: {
            body: lastMessage.body,
            timestamp: lastMessage.timestamp,
            from: lastMessage.from,
            messageId: lastMessage.messageId,
          },
          updatedAt: lastMessage.timestamp,
        })
      }
      
      // 3. Scarica vCard
      const { getVCard, getDisplayName } = await import('./vcard')
      const vcard = await getVCard(client, normalizedJid, true)
      
      // 4. Aggiorna conversazione con vCard
      if (vcard) {
        const displayName = getDisplayName(normalizedJid, undefined, vcard)
        
        await this.conversationRepo.update(normalizedJid, {
          displayName,
          avatarData: vcard.photoData,
          avatarType: vcard.photoType,
        })
      }
      
      return {
        success: true,
        messageCount: messages.length,
      }
    } catch (error) {
      console.error('Errore sincronizzazione completa conversazione:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sincronizzazione completa',
      }
    }
  }

  /**
   * Sincronizza tutte le conversazioni
   */
  async syncAllConversationsComplete(client: Agent): Promise<{
    success: boolean
    error?: string
    conversationCount?: number
  }> {
    try {
      // 1. Scarica conversazioni + messaggi
      const { downloadAllConversations } = await import('./conversations')
      const { conversations, lastToken } = await downloadAllConversations(client, true)
      
      // 2. Salva conversazioni
      await this.conversationRepo.saveAll(conversations)
      
      // 3. Aggiorna metadata
      await this.metadataRepo.save({
        lastSync: new Date(),
        lastRSMToken: lastToken,
      })
      
      // 4. Scarica vCard in batch
      const { getVCardsForJids } = await import('./vcard')
      const jids = conversations.map(conv => conv.jid)
      
      if (jids.length > 0) {
        await getVCardsForJids(client, jids, true)
        
        // 5. Arricchisci conversazioni con vCard
        const { enrichWithRoster } = await import('./conversations')
        const enriched = await enrichWithRoster(client, conversations, true)
        
        // 6. Salva conversazioni arricchite
        await this.conversationRepo.saveAll(enriched)
      }
      
      return {
        success: true,
        conversationCount: conversations.length,
      }
    } catch (error) {
      console.error('Errore sincronizzazione completa conversazioni:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sincronizzazione completa',
      }
    }
  }

  /**
   * Gestisce messaggio in arrivo e sincronizza
   */
  async handleIncomingMessage(client: Agent, message: ReceivedMessage, myJid: string): Promise<{
    success: boolean
    error?: string
  }> {
    if (!message.body) {
      return { success: false, error: 'Messaggio vuoto' }
    }

    try {
      // Determina JID del contatto
      const myBareJid = normalizeJid(myJid)
      const from = message.from || ''
      const to = message.to || ''
      const contactJid = from.startsWith(myBareJid) 
        ? normalizeJid(to) 
        : normalizeJid(from)

      if (!contactJid) {
        return { success: false, error: 'JID contatto non valido' }
      }

      // Sincronizza conversazione completa
      return await this.syncSingleConversation(client, contactJid)
    } catch (error) {
      console.error('Errore gestione messaggio in arrivo:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }
}

// Factory function per creare istanza con dipendenze custom (testing)
export function createSyncService(
  conversationRepo?: ConversationRepository,
  messageRepo?: MessageRepository,
  metadataRepo?: MetadataRepository
): SyncService {
  return new SyncService(conversationRepo, messageRepo, metadataRepo)
}

// Istanza di default per uso normale (non singleton, ma convenienza)
export const defaultSyncService = new SyncService()
