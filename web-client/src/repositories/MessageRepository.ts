/**
 * Repository Pattern per Messaggi
 * Responsabilità: CRUD puro su IndexedDB per messaggi
 * NO business logic, NO chiamate XMPP, solo data access
 */

import {
  getDB,
  type Message,
  type MessageStatus,
  saveMessages as dbSaveMessages,
  addMessage as dbAddMessage,
  getMessagesForConversation as dbGetMessagesForConversation,
  countMessagesForConversation as dbCountMessagesForConversation,
  updateMessageStatus as dbUpdateMessageStatus,
  updateMessageId as dbUpdateMessageId,
  getMessageByTempId as dbGetMessageByTempId,
  deleteMessage as dbDeleteMessage,
  clearMessagesForConversation as dbClearMessagesForConversation,
} from '../services/conversations-db'

export class MessageRepository {
  /**
   * Salva multipli messaggi (con de-duplicazione)
   */
  async saveAll(messages: Message[]): Promise<void> {
    return dbSaveMessages(messages)
  }

  /**
   * Salva un singolo messaggio
   */
  async save(message: Message): Promise<void> {
    return dbAddMessage(message)
  }

  /**
   * Recupera messaggi per una conversazione
   */
  async getByConversationJid(
    conversationJid: string,
    options?: {
      limit?: number
      before?: Date
    }
  ): Promise<Message[]> {
    return dbGetMessagesForConversation(conversationJid, options)
  }

  /**
   * Recupera un messaggio specifico per ID
   */
  async getById(messageId: string): Promise<Message | null> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readonly')
    const message = await tx.store.get(messageId)
    await tx.done

    if (!message) return null

    // Converti Date se serializzata
    return {
      ...message,
      timestamp:
        message.timestamp instanceof Date
          ? message.timestamp
          : new Date(message.timestamp),
    }
  }

  /**
   * Recupera messaggio per ID temporaneo
   */
  async getByTempId(tempId: string): Promise<Message | null> {
    return dbGetMessageByTempId(tempId)
  }

  /**
   * Conta messaggi per una conversazione
   */
  async countByConversationJid(conversationJid: string): Promise<number> {
    return dbCountMessagesForConversation(conversationJid)
  }

  /**
   * Aggiorna lo status di un messaggio
   */
  async updateStatus(messageId: string, status: MessageStatus): Promise<void> {
    return dbUpdateMessageStatus(messageId, status)
  }

  /**
   * Aggiorna l'ID di un messaggio (da temp a server ID)
   */
  async updateId(tempId: string, newMessageId: string): Promise<void> {
    return dbUpdateMessageId(tempId, newMessageId)
  }

  /**
   * Elimina un messaggio
   */
  async delete(messageId: string): Promise<void> {
    return dbDeleteMessage(messageId)
  }

  /**
   * Elimina tutti i messaggi di una conversazione
   */
  async deleteByConversationJid(conversationJid: string): Promise<void> {
    return dbClearMessagesForConversation(conversationJid)
  }

  /**
   * Recupera l'ultimo messaggio di una conversazione
   */
  async getLastByConversationJid(
    conversationJid: string
  ): Promise<Message | null> {
    const messages = await this.getByConversationJid(conversationJid, {
      limit: 1,
    })
    return messages.length > 0 ? messages[messages.length - 1] : null
  }

  /**
   * Recupera messaggi con status specifico per una conversazione
   */
  async getByStatus(
    conversationJid: string,
    status: MessageStatus
  ): Promise<Message[]> {
    const allMessages = await this.getByConversationJid(conversationJid)
    return allMessages.filter((msg) => msg.status === status)
  }

  /**
   * Controlla se un messaggio esiste
   */
  async exists(messageId: string): Promise<boolean> {
    const message = await this.getById(messageId)
    return message !== null
  }

  /**
   * Recupera messaggi pendenti (non ancora inviati)
   */
  async getPending(conversationJid: string): Promise<Message[]> {
    return this.getByStatus(conversationJid, 'pending')
  }

  /**
   * Recupera messaggi falliti
   */
  async getFailed(conversationJid: string): Promise<Message[]> {
    return this.getByStatus(conversationJid, 'failed')
  }
}

// Esporta singleton per comodità
export const messageRepository = new MessageRepository()
