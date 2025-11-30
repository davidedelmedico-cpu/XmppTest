/**
 * Strategy Pattern per sincronizzazione XMPP
 * Centralizza tutte le logiche di sincronizzazione
 */

import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { ConversationRepository, MetadataRepository } from '../repositories'

export interface SyncResult {
  success: boolean
  error?: string
  messageCount?: number
  conversationCount?: number
}

/**
 * Interfaccia base per tutte le strategie di sincronizzazione
 */
export interface ISyncStrategy {
  execute(client: Agent, ...args: unknown[]): Promise<SyncResult>
}

/**
 * Strategy per sincronizzazione di una singola conversazione
 */
export class SingleConversationSyncStrategy implements ISyncStrategy {
  private conversationRepo: ConversationRepository

  constructor(
    conversationRepo: ConversationRepository
  ) {
    this.conversationRepo = conversationRepo
  }

  async execute(client: Agent, contactJid: string): Promise<SyncResult> {
    try {
      const { reloadAllMessagesFromServer } = await import('../messages')
      const messages = await reloadAllMessagesFromServer(client, contactJid)

      // Aggiorna conversazione con ultimo messaggio
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await this.conversationRepo.update(contactJid, {
          jid: contactJid,
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
      console.error('[SingleConversationSync] Errore:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sincronizzazione',
      }
    }
  }
}

/**
 * Strategy per sincronizzazione completa (conversazione + vCard)
 */
export class CompleteConversationSyncStrategy implements ISyncStrategy {
  private conversationRepo: ConversationRepository

  constructor(
    conversationRepo: ConversationRepository
  ) {
    this.conversationRepo = conversationRepo
  }

  async execute(client: Agent, contactJid: string): Promise<SyncResult> {
    try {
      // 1. Sincronizza messaggi
      const { reloadAllMessagesFromServer } = await import('../messages')
      const messages = await reloadAllMessagesFromServer(client, contactJid)

      // 2. Aggiorna conversazione
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await this.conversationRepo.update(contactJid, {
          jid: contactJid,
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
      const { getVCard, getDisplayName } = await import('../vcard')
      const vcard = await getVCard(client, contactJid, true)

      // 4. Aggiorna conversazione con vCard
      if (vcard) {
        const displayName = getDisplayName(contactJid, undefined, vcard)

        await this.conversationRepo.update(contactJid, {
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
      console.error('[CompleteConversationSync] Errore:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sincronizzazione completa',
      }
    }
  }
}

/**
 * Strategy per sincronizzazione di tutte le conversazioni
 */
export class AllConversationsSyncStrategy implements ISyncStrategy {
  private conversationRepo: ConversationRepository
  private metadataRepo: MetadataRepository

  constructor(
    conversationRepo: ConversationRepository,
    metadataRepo: MetadataRepository
  ) {
    this.conversationRepo = conversationRepo
    this.metadataRepo = metadataRepo
  }

  async execute(client: Agent): Promise<SyncResult> {
    try {
      // 1. Scarica conversazioni + messaggi
      const { downloadAllConversations } = await import('../conversations')
      const { conversations, lastToken } = await downloadAllConversations(client, true)

      // 2. Salva conversazioni
      await this.conversationRepo.saveAll(conversations)

      // 3. Aggiorna metadata
      await this.metadataRepo.save({
        lastSync: new Date(),
        lastRSMToken: lastToken,
      })

      // 4. Scarica vCard in batch
      const { getVCardsForJids } = await import('../vcard')
      const jids = conversations.map((conv) => conv.jid)

      if (jids.length > 0) {
        await getVCardsForJids(client, jids, true)

        // 5. Arricchisci conversazioni con vCard
        const { enrichWithRoster } = await import('../conversations')
        const enriched = await enrichWithRoster(client, conversations, true)

        // 6. Salva conversazioni arricchite
        await this.conversationRepo.saveAll(enriched)
      }

      return {
        success: true,
        conversationCount: conversations.length,
      }
    } catch (error) {
      console.error('[AllConversationsSync] Errore:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sincronizzazione totale',
      }
    }
  }
}

/**
 * Strategy per gestione messaggio in arrivo
 */
export class IncomingMessageSyncStrategy implements ISyncStrategy {
  private conversationRepo: ConversationRepository

  constructor(
    conversationRepo: ConversationRepository
  ) {
    this.conversationRepo = conversationRepo
  }

  async execute(
    client: Agent,
    message: ReceivedMessage,
    myJid: string
  ): Promise<SyncResult> {
    if (!message.body) {
      return { success: false, error: 'Messaggio vuoto' }
    }

    try {
      const { normalizeJid } = await import('../../utils/jid')

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

      // Sincronizza conversazione
      const singleSync = new SingleConversationSyncStrategy(this.conversationRepo)
      return await singleSync.execute(client, contactJid)
    } catch (error) {
      console.error('[IncomingMessageSync] Errore:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore gestione messaggio',
      }
    }
  }
}

/**
 * Context per le strategie di sincronizzazione
 * Esegue la strategia selezionata
 */
export class SyncContext {
  private conversationRepo: ConversationRepository
  private metadataRepo: MetadataRepository

  constructor(
    conversationRepo?: ConversationRepository,
    metadataRepo?: MetadataRepository
  ) {
    this.conversationRepo = conversationRepo || new ConversationRepository()
    this.metadataRepo = metadataRepo || new MetadataRepository()
  }

  /**
   * Esegue una strategia di sincronizzazione
   */
  async executeStrategy(
    strategy: ISyncStrategy,
    client: Agent,
    ...args: unknown[]
  ): Promise<SyncResult> {
    return await strategy.execute(client, ...args)
  }

  /**
   * Factory method: crea strategia per singola conversazione
   */
  createSingleConversationSync(): ISyncStrategy {
    return new SingleConversationSyncStrategy(this.conversationRepo)
  }

  /**
   * Factory method: crea strategia per conversazione completa
   */
  createCompleteConversationSync(): ISyncStrategy {
    return new CompleteConversationSyncStrategy(this.conversationRepo)
  }

  /**
   * Factory method: crea strategia per tutte le conversazioni
   */
  createAllConversationsSync(): ISyncStrategy {
    return new AllConversationsSyncStrategy(this.conversationRepo, this.metadataRepo)
  }

  /**
   * Factory method: crea strategia per messaggio in arrivo
   */
  createIncomingMessageSync(): ISyncStrategy {
    return new IncomingMessageSyncStrategy(this.conversationRepo)
  }
}
