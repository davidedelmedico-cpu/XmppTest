import { getDB } from '../conversations-db'

export interface SyncMetadata {
  lastSync: Date
  lastRSMToken?: string
  conversationTokens?: Record<string, string>
}

/**
 * Repository per metadata di sincronizzazione
 * Mantiene stato della sync con il server
 */
export class MetadataRepository {
  private readonly SYNC_KEY = 'sync'

  /**
   * Salva metadata di sincronizzazione
   */
  async save(metadata: SyncMetadata): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('metadata', 'readwrite')
    
    try {
      await tx.store.put(metadata, this.SYNC_KEY)
      await tx.done
    } catch (error) {
      console.error('Errore nel salvataggio metadata:', error)
      throw new Error('Impossibile salvare i metadata')
    }
  }

  /**
   * Recupera metadata di sincronizzazione
   */
  async get(): Promise<SyncMetadata | null> {
    const db = await getDB()
    const tx = db.transaction('metadata', 'readonly')
    const metadata = await tx.store.get(this.SYNC_KEY)
    await tx.done

    if (!metadata) return null

    // Normalizza Date
    return {
      ...metadata,
      lastSync: metadata.lastSync instanceof Date 
        ? metadata.lastSync 
        : new Date(metadata.lastSync)
    }
  }

  /**
   * Aggiorna solo lastSync timestamp
   */
  async updateLastSync(): Promise<void> {
    const existing = await this.get()
    await this.save({
      ...existing,
      lastSync: new Date()
    } as SyncMetadata)
  }

  /**
   * Aggiorna solo RSM token
   */
  async updateRSMToken(token: string): Promise<void> {
    const existing = await this.get()
    await this.save({
      ...existing,
      lastSync: existing?.lastSync || new Date(),
      lastRSMToken: token
    })
  }

  /**
   * Svuota metadata
   */
  async clear(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('metadata', 'readwrite')
    
    try {
      await tx.store.delete(this.SYNC_KEY)
      await tx.done
    } catch (error) {
      console.error('Errore nella cancellazione metadata:', error)
      throw new Error('Impossibile cancellare i metadata')
    }
  }
}
