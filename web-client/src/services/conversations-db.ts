import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

export interface Conversation {
  jid: string
  displayName?: string
  lastMessage: {
    body: string
    timestamp: Date
    from: 'me' | 'them'
    messageId: string
  }
  unreadCount: number
  updatedAt: Date
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface Message {
  messageId: string // ID dal server o ID temporaneo
  conversationJid: string // JID bare del contatto
  body: string
  timestamp: Date
  from: 'me' | 'them'
  status: MessageStatus
  tempId?: string // ID temporaneo per optimistic updates (prima della conferma server)
}

interface ConversationsDB extends DBSchema {
  conversations: {
    key: string // jid
    value: Conversation
    indexes: { 'by-updatedAt': Date }
  }
  messages: {
    key: string // messageId
    value: Message
    indexes: { 
      'by-conversationJid': string
      'by-timestamp': Date
      'by-conversation-timestamp': [string, Date] // Compound index per query efficienti
      'by-tempId': string // Index per lookup veloce di messaggi temporanei
    }
  }
  metadata: {
    key: string
    value: {
      lastSync: Date
      lastRSMToken?: string
      conversationTokens?: Record<string, string> // RSM token per ogni conversazione
    }
  }
}

let dbInstance: IDBPDatabase<ConversationsDB> | null = null

export async function getDB(): Promise<IDBPDatabase<ConversationsDB>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<ConversationsDB>('conversations-db', 2, {
    upgrade(db, oldVersion) {
      // Versione 1: Store originali
      if (oldVersion < 1) {
        // Store per conversazioni
        const conversationStore = db.createObjectStore('conversations', {
          keyPath: 'jid',
        })
        conversationStore.createIndex('by-updatedAt', 'updatedAt')

        // Store per metadata
        db.createObjectStore('metadata')
      }

      // Versione 2: Aggiungi store messaggi
      if (oldVersion < 2) {
        const messagesStore = db.createObjectStore('messages', {
          keyPath: 'messageId',
        })
        messagesStore.createIndex('by-conversationJid', 'conversationJid')
        messagesStore.createIndex('by-timestamp', 'timestamp')
        messagesStore.createIndex('by-conversation-timestamp', ['conversationJid', 'timestamp'])
        messagesStore.createIndex('by-tempId', 'tempId', { unique: false })
      }
    },
  })

  return dbInstance
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('conversations', 'readwrite')

  for (const conv of conversations) {
    // Merge con conversazione esistente se presente
    const existing = await tx.store.get(conv.jid)
    if (existing) {
      // Mantieni unreadCount se non viene resettato
      conv.unreadCount = existing.unreadCount
    }
    await tx.store.put(conv)
  }

  await tx.done
}

export async function getConversations(): Promise<Conversation[]> {
  const db = await getDB()
  const tx = db.transaction('conversations', 'readonly')
  const conversations = await tx.store.getAll()
  await tx.done

  // Ordina per data ultimo messaggio (più recenti prima)
  return conversations.sort(
    (a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
  )
}

export async function updateConversation(jid: string, updates: Partial<Conversation>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('conversations', 'readwrite')
  const existing = await tx.store.get(jid)

  if (existing) {
    await tx.store.put({ ...existing, ...updates, updatedAt: new Date() })
  } else if (updates.jid) {
    // Crea nuova conversazione
    await tx.store.put({
      jid: updates.jid,
      lastMessage: updates.lastMessage!,
      unreadCount: updates.unreadCount ?? 0,
      displayName: updates.displayName,
      updatedAt: new Date(),
    })
  }

  await tx.done
}

export async function getMetadata(): Promise<{ lastSync: Date; lastRSMToken?: string } | null> {
  const db = await getDB()
  const tx = db.transaction('metadata', 'readonly')
  const metadata = await tx.store.get('sync')
  await tx.done
  return metadata || null
}

export async function saveMetadata(metadata: { lastSync: Date; lastRSMToken?: string }): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('metadata', 'readwrite')
  await tx.store.put(metadata, 'sync')
  await tx.done
}

export async function removeConversation(jid: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('conversations', 'readwrite')
  await tx.store.delete(jid)
  await tx.done
}

export async function removeConversations(jids: string[]): Promise<void> {
  if (jids.length === 0) return
  
  const db = await getDB()
  const tx = db.transaction('conversations', 'readwrite')
  
  for (const jid of jids) {
    await tx.store.delete(jid)
  }
  
  await tx.done
}

export async function clearDatabase(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['conversations', 'metadata', 'messages'], 'readwrite')
  await tx.objectStore('conversations').clear()
  await tx.objectStore('metadata').clear()
  await tx.objectStore('messages').clear()
  await tx.done
}

// ============================================================================
// MESSAGES CRUD OPERATIONS
// ============================================================================

/**
 * Salva multipli messaggi nel database (con de-duplicazione per messageId)
 */
export async function saveMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return

  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')

  for (const message of messages) {
    // Verifica se esiste già (de-duplicazione)
    const existing = await tx.store.get(message.messageId)
    if (!existing) {
      await tx.store.put(message)
    } else {
      // Se esiste, aggiorna solo lo status se diverso da 'sent'
      if (existing.status !== 'sent' && message.status === 'sent') {
        await tx.store.put({ ...existing, status: 'sent', tempId: message.tempId })
      }
    }
  }

  await tx.done
}

/**
 * Aggiunge un singolo messaggio
 */
export async function addMessage(message: Message): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  
  // Usa put (upsert) invece di add per gestire duplicati
  await tx.store.put(message)
  await tx.done
}

/**
 * Recupera messaggi per una conversazione specifica
 * Ordinati per timestamp (più vecchi prima per il rendering)
 */
export async function getMessagesForConversation(
  conversationJid: string,
  options?: {
    limit?: number
    before?: Date // Carica messaggi prima di questa data (per paginazione)
  }
): Promise<Message[]> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readonly')
  const index = tx.store.index('by-conversation-timestamp')

  // Query range
  let range: IDBKeyRange
  if (options?.before) {
    // Messaggi della conversazione con timestamp < before
    range = IDBKeyRange.bound(
      [conversationJid, new Date(0)],
      [conversationJid, options.before],
      false,
      true // exclude upper bound
    )
  } else {
    // Tutti i messaggi della conversazione
    range = IDBKeyRange.bound(
      [conversationJid, new Date(0)],
      [conversationJid, new Date(Date.now() + 86400000)], // +1 giorno per sicurezza
      false,
      false
    )
  }

  let messages = await index.getAll(range)
  await tx.done

  // Ordina per timestamp (più vecchi prima)
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Applica limit se specificato (prendi gli ultimi N)
  if (options?.limit && messages.length > options.limit) {
    messages = messages.slice(-options.limit)
  }

  return messages
}

/**
 * Conta il numero di messaggi per una conversazione
 */
export async function countMessagesForConversation(conversationJid: string): Promise<number> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readonly')
  const index = tx.store.index('by-conversationJid')
  const count = await index.count(conversationJid)
  await tx.done
  return count
}

/**
 * Aggiorna lo status di un messaggio
 */
export async function updateMessageStatus(
  messageId: string,
  status: MessageStatus
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  const existing = await tx.store.get(messageId)

  if (existing) {
    await tx.store.put({ ...existing, status })
  }

  await tx.done
}

/**
 * Aggiorna l'ID di un messaggio da temporaneo a server ID
 */
export async function updateMessageId(
  tempId: string,
  newMessageId: string
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')

  // Usa index per trovare il messaggio invece di getAll()
  const index = tx.store.index('by-tempId')
  const message = await index.get(tempId)

  if (message) {
    // Rimuovi il vecchio record
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
}

/**
 * Trova un messaggio per ID temporaneo
 */
export async function getMessageByTempId(tempId: string): Promise<Message | null> {
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
export async function deleteMessage(messageId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  await tx.store.delete(messageId)
  await tx.done
}

/**
 * Pulisce tutti i messaggi di una conversazione
 */
export async function clearMessagesForConversation(conversationJid: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  const index = tx.store.index('by-conversationJid')
  
  let cursor = await index.openCursor(conversationJid)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}
