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

interface ConversationsDB extends DBSchema {
  conversations: {
    key: string // jid
    value: Conversation
    indexes: { 'by-updatedAt': Date }
  }
  metadata: {
    key: string
    value: {
      lastSync: Date
      lastRSMToken?: string
    }
  }
}

let dbInstance: IDBPDatabase<ConversationsDB> | null = null

export async function getDB(): Promise<IDBPDatabase<ConversationsDB>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<ConversationsDB>('conversations-db', 1, {
    upgrade(db) {
      // Store per conversazioni
      const conversationStore = db.createObjectStore('conversations', {
        keyPath: 'jid',
      })
      conversationStore.createIndex('by-updatedAt', 'updatedAt')

      // Store per metadata
      db.createObjectStore('metadata')
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
  const tx = db.transaction(['conversations', 'metadata'], 'readwrite')
  await tx.objectStore('conversations').clear()
  await tx.objectStore('metadata').clear()
  await tx.done
}
