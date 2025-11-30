/**
 * Repository Pattern per Conversazioni
 * Responsabilità: CRUD puro su IndexedDB per conversazioni
 * NO business logic, NO chiamate XMPP, solo data access
 */

import {
  getDB,
  type Conversation,
  saveConversations as dbSaveConversations,
  getConversations as dbGetConversations,
  updateConversation as dbUpdateConversation,
  removeConversation as dbRemoveConversation,
  removeConversations as dbRemoveConversations,
  clearConversations as dbClearConversations,
} from '../services/conversations-db'

export class ConversationRepository {
  /**
   * Recupera tutte le conversazioni dal database locale
   * Ordinate per data ultimo messaggio (più recenti prima)
   */
  async getAll(): Promise<Conversation[]> {
    return dbGetConversations()
  }

  /**
   * Recupera una conversazione specifica per JID
   */
  async getByJid(jid: string): Promise<Conversation | null> {
    const db = await getDB()
    const tx = db.transaction('conversations', 'readonly')
    const conversation = await tx.store.get(jid)
    await tx.done

    if (!conversation) return null

    // Converti Date se serializzate
    return {
      ...conversation,
      lastMessage: {
        ...conversation.lastMessage,
        timestamp: conversation.lastMessage.timestamp instanceof Date
          ? conversation.lastMessage.timestamp
          : new Date(conversation.lastMessage.timestamp),
      },
      updatedAt:
        conversation.updatedAt instanceof Date
          ? conversation.updatedAt
          : new Date(conversation.updatedAt),
    }
  }

  /**
   * Salva multiple conversazioni (con merge intelligente)
   */
  async saveAll(conversations: Conversation[]): Promise<void> {
    return dbSaveConversations(conversations)
  }

  /**
   * Aggiorna una conversazione esistente o creane una nuova
   */
  async update(jid: string, updates: Partial<Conversation>): Promise<void> {
    return dbUpdateConversation(jid, updates)
  }

  /**
   * Elimina una conversazione
   */
  async delete(jid: string): Promise<void> {
    return dbRemoveConversation(jid)
  }

  /**
   * Elimina multiple conversazioni
   */
  async deleteMany(jids: string[]): Promise<void> {
    return dbRemoveConversations(jids)
  }

  /**
   * Svuota tutte le conversazioni
   */
  async clear(): Promise<void> {
    return dbClearConversations()
  }

  /**
   * Marca una conversazione come letta (azzera unreadCount)
   */
  async markAsRead(jid: string): Promise<void> {
    await this.update(jid, { unreadCount: 0 })
  }

  /**
   * Incrementa il contatore non letti di una conversazione
   */
  async incrementUnread(jid: string): Promise<void> {
    const conversation = await this.getByJid(jid)
    if (conversation) {
      await this.update(jid, {
        unreadCount: conversation.unreadCount + 1,
      })
    }
  }

  /**
   * Controlla se una conversazione esiste
   */
  async exists(jid: string): Promise<boolean> {
    const conversation = await this.getByJid(jid)
    return conversation !== null
  }

  /**
   * Conta il numero totale di conversazioni
   */
  async count(): Promise<number> {
    const conversations = await this.getAll()
    return conversations.length
  }

  /**
   * Conta il numero totale di messaggi non letti
   */
  async countTotalUnread(): Promise<number> {
    const conversations = await this.getAll()
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0)
  }
}

// Esporta singleton per comodità (può essere iniettato nei service)
export const conversationRepository = new ConversationRepository()
