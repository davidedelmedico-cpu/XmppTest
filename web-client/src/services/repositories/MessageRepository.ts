import { getDB } from '../conversations-db'
import type { Message, MessageStatus } from '../conversations-db'

/**
 * Repository per operazioni CRUD sui messaggi
 * Garantisce transazioni atomiche e de-duplicazione
 */
export class MessageRepository {
  /**
   * Salva multipli messaggi con de-duplicazione automatica
   * Transazione atomica: tutto o niente
   */
  async saveAll(messages: Message[]): Promise<void> {
    if (messages.length === 0) return

    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')

    try {
      for (const message of messages) {
        // Verifica se esiste già (de-duplicazione per messageId)
        const existing = await tx.store.get(message.messageId)
        
        if (!existing) {
          // Nuovo messaggio - inserisci
          await tx.store.put(message)
        } else {
          // Messaggio esiste - aggiorna solo se necessario
          const shouldUpdate = this.shouldUpdateExisting(existing, message)
          
          if (shouldUpdate.update) {
            await tx.store.put(shouldUpdate.updated)
          }
        }
      }
      await tx.done
    } catch (error) {
      console.error('Errore nel salvataggio messaggi:', error)
      throw new Error('Impossibile salvare i messaggi')
    }
  }

  /**
   * Logica per determinare se un messaggio esistente va aggiornato
   */
  private shouldUpdateExisting(existing: Message, newMsg: Message): { update: boolean; updated: Message } {
    let shouldUpdate = false
    const updated = { ...existing }

    // Aggiorna status se migliora (pending → sent)
    if (existing.status === 'pending' && newMsg.status === 'sent') {
      updated.status = 'sent'
      shouldUpdate = true
    }

    // Aggiorna timestamp se quello nuovo è più accurato
    const now = new Date()
    const existingIsRecent = Math.abs(existing.timestamp.getTime() - now.getTime()) < 5000
    const newIsNotRecent = Math.abs(newMsg.timestamp.getTime() - now.getTime()) > 5000
    
    if (existingIsRecent && newIsNotRecent) {
      updated.timestamp = newMsg.timestamp
      shouldUpdate = true
    }

    return { update: shouldUpdate, updated }
  }

  /**
   * Recupera messaggi per una conversazione con paginazione
   */
  async getForConversation(
    conversationJid: string,
    options?: {
      limit?: number
      before?: Date
    }
  ): Promise<Message[]> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readonly')
    const index = tx.store.index('by-conversation-timestamp')

    // Query range
    let range: IDBKeyRange
    if (options?.before) {
      range = IDBKeyRange.bound(
        [conversationJid, new Date(0)],
        [conversationJid, options.before],
        false,
        true // exclude upper bound
      )
    } else {
      range = IDBKeyRange.bound(
        [conversationJid, new Date(0)],
        [conversationJid, new Date(Date.now() + 86400000)],
        false,
        false
      )
    }

    let messages = await index.getAll(range)
    await tx.done

    // Ordina per timestamp (più vecchi prima)
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Applica limit (prendi ultimi N)
    if (options?.limit && messages.length > options.limit) {
      messages = messages.slice(-options.limit)
    }

    return messages
  }

  /**
   * Conta messaggi per una conversazione
   */
  async countForConversation(conversationJid: string): Promise<number> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readonly')
    const index = tx.store.index('by-conversationJid')
    const count = await index.count(conversationJid)
    await tx.done
    return count
  }

  /**
   * Aggiorna status di un messaggio
   */
  async updateStatus(messageId: string, status: MessageStatus): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')
    
    try {
      const existing = await tx.store.get(messageId)
      if (existing) {
        await tx.store.put({ ...existing, status })
      }
      await tx.done
    } catch (error) {
      console.error('Errore nell\'aggiornamento status messaggio:', error)
      throw new Error('Impossibile aggiornare lo status del messaggio')
    }
  }

  /**
   * Aggiorna messageId da temporaneo a server ID
   */
  async updateMessageId(tempId: string, newMessageId: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')

    try {
      const index = tx.store.index('by-tempId')
      const message = await index.get(tempId)

      if (message) {
        // Rimuovi vecchio record
        await tx.store.delete(message.messageId)
        
        // Inserisci con nuovo ID
        await tx.store.put({
          ...message,
          messageId: newMessageId,
          tempId: tempId,
          status: 'sent',
        })
      }
      await tx.done
    } catch (error) {
      console.error('Errore nell\'aggiornamento ID messaggio:', error)
      throw new Error('Impossibile aggiornare l\'ID del messaggio')
    }
  }

  /**
   * Trova messaggio per tempId
   */
  async getByTempId(tempId: string): Promise<Message | null> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readonly')
    const index = tx.store.index('by-tempId')
    const message = await index.get(tempId)
    await tx.done
    return message || null
  }

  /**
   * Elimina un messaggio
   */
  async delete(messageId: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')
    
    try {
      await tx.store.delete(messageId)
      await tx.done
    } catch (error) {
      console.error('Errore nell\'eliminazione messaggio:', error)
      throw new Error('Impossibile eliminare il messaggio')
    }
  }

  /**
   * Sostituisce TUTTI i messaggi di una conversazione in transazione atomica
   * Operazione critica: scarica → svuota → salva tutto insieme
   */
  async replaceAllForConversation(conversationJid: string, messages: Message[]): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')

    try {
      // 1. Elimina tutti i messaggi esistenti per questa conversazione
      const index = tx.store.index('by-conversationJid')
      let cursor = await index.openCursor(conversationJid)
      
      while (cursor) {
        await cursor.delete()
        cursor = await cursor.continue()
      }

      // 2. Inserisci tutti i nuovi messaggi
      for (const message of messages) {
        await tx.store.put(message)
      }

      await tx.done
    } catch (error) {
      console.error('Errore nella sostituzione messaggi:', error)
      throw new Error('Impossibile sostituire i messaggi della conversazione')
    }
  }

  /**
   * Svuota tutti i messaggi di una conversazione
   */
  async clearForConversation(conversationJid: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')
    
    try {
      const index = tx.store.index('by-conversationJid')
      let cursor = await index.openCursor(conversationJid)
      
      while (cursor) {
        await cursor.delete()
        cursor = await cursor.continue()
      }
      
      await tx.done
    } catch (error) {
      console.error('Errore nella cancellazione messaggi:', error)
      throw new Error('Impossibile cancellare i messaggi della conversazione')
    }
  }

  /**
   * Svuota tutti i messaggi
   */
  async clear(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('messages', 'readwrite')
    
    try {
      await tx.store.clear()
      await tx.done
    } catch (error) {
      console.error('Errore nella cancellazione messaggi:', error)
      throw new Error('Impossibile cancellare i messaggi')
    }
  }
}
