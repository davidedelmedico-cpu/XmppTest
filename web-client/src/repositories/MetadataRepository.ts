/**
 * Repository Pattern per Metadata
 * Responsabilità: CRUD puro su IndexedDB per metadata
 * NO business logic, solo data access
 */

import {
  getMetadata as dbGetMetadata,
  saveMetadata as dbSaveMetadata,
} from '../services/conversations-db'

export interface SyncMetadata {
  lastSync: Date
  lastRSMToken?: string
  conversationTokens?: Record<string, string>
}

export class MetadataRepository {
  /**
   * Recupera metadata di sincronizzazione
   */
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    return dbGetMetadata()
  }

  /**
   * Salva metadata di sincronizzazione
   */
  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    return dbSaveMetadata(metadata)
  }

  /**
   * Aggiorna l'ultimo token RSM globale
   */
  async updateLastRSMToken(token: string): Promise<void> {
    const existing = await this.getSyncMetadata()
    await this.saveSyncMetadata({
      lastSync: existing?.lastSync || new Date(),
      lastRSMToken: token,
      conversationTokens: existing?.conversationTokens,
    })
  }

  /**
   * Aggiorna la data di ultima sincronizzazione
   */
  async updateLastSync(): Promise<void> {
    const existing = await this.getSyncMetadata()
    await this.saveSyncMetadata({
      lastSync: new Date(),
      lastRSMToken: existing?.lastRSMToken,
      conversationTokens: existing?.conversationTokens,
    })
  }

  /**
   * Salva token RSM per una conversazione specifica
   */
  async saveConversationToken(jid: string, token: string): Promise<void> {
    const existing = await this.getSyncMetadata()
    const conversationTokens = existing?.conversationTokens || {}

    await this.saveSyncMetadata({
      lastSync: existing?.lastSync || new Date(),
      lastRSMToken: existing?.lastRSMToken,
      conversationTokens: {
        ...conversationTokens,
        [jid]: token,
      },
    })
  }

  /**
   * Recupera token RSM per una conversazione
   */
  async getConversationToken(jid: string): Promise<string | undefined> {
    const metadata = await this.getSyncMetadata()
    return metadata?.conversationTokens?.[jid]
  }
}

// Esporta singleton per comodità
export const metadataRepository = new MetadataRepository()
