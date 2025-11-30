import { getDB } from '../conversations-db'
import type { VCardCache } from '../conversations-db'

/**
 * Repository per operazioni CRUD su vCard cache
 * Gestisce cache locale dei profili utente
 */
export class VCardRepository {
  /**
   * Salva un singolo vCard nella cache
   */
  async save(vcard: VCardCache): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('vcards', 'readwrite')
    
    try {
      await tx.store.put(vcard)
      await tx.done
    } catch (error) {
      console.error('Errore nel salvataggio vCard:', error)
      throw new Error('Impossibile salvare il vCard')
    }
  }

  /**
   * Salva multipli vCard in transazione atomica
   */
  async saveAll(vcards: VCardCache[]): Promise<void> {
    if (vcards.length === 0) return

    const db = await getDB()
    const tx = db.transaction('vcards', 'readwrite')
    
    try {
      for (const vcard of vcards) {
        await tx.store.put(vcard)
      }
      await tx.done
    } catch (error) {
      console.error('Errore nel salvataggio vCards:', error)
      throw new Error('Impossibile salvare i vCards')
    }
  }

  /**
   * Recupera un vCard dalla cache
   */
  async getByJid(jid: string): Promise<VCardCache | null> {
    const db = await getDB()
    const tx = db.transaction('vcards', 'readonly')
    const vcard = await tx.store.get(jid)
    await tx.done
    
    if (!vcard) return null
    
    // Normalizza Date
    return {
      ...vcard,
      lastUpdated: vcard.lastUpdated instanceof Date 
        ? vcard.lastUpdated 
        : new Date(vcard.lastUpdated)
    }
  }

  /**
   * Recupera multipli vCard per JIDs
   */
  async getManyByJids(jids: string[]): Promise<Map<string, VCardCache>> {
    if (jids.length === 0) return new Map()

    const db = await getDB()
    const tx = db.transaction('vcards', 'readonly')
    
    const vcardMap = new Map<string, VCardCache>()
    
    for (const jid of jids) {
      const vcard = await tx.store.get(jid)
      if (vcard) {
        vcardMap.set(jid, {
          ...vcard,
          lastUpdated: vcard.lastUpdated instanceof Date 
            ? vcard.lastUpdated 
            : new Date(vcard.lastUpdated)
        })
      }
    }
    
    await tx.done
    return vcardMap
  }

  /**
   * Recupera tutti i vCard dalla cache
   */
  async getAll(): Promise<VCardCache[]> {
    const db = await getDB()
    const tx = db.transaction('vcards', 'readonly')
    const vcards = await tx.store.getAll()
    await tx.done
    
    // Normalizza Date
    return vcards.map(vcard => ({
      ...vcard,
      lastUpdated: vcard.lastUpdated instanceof Date 
        ? vcard.lastUpdated 
        : new Date(vcard.lastUpdated)
    }))
  }

  /**
   * Elimina un vCard dalla cache
   */
  async delete(jid: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('vcards', 'readwrite')
    
    try {
      await tx.store.delete(jid)
      await tx.done
    } catch (error) {
      console.error('Errore nell\'eliminazione vCard:', error)
      throw new Error('Impossibile eliminare il vCard')
    }
  }

  /**
   * Svuota tutta la cache vCard
   */
  async clear(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('vcards', 'readwrite')
    
    try {
      await tx.store.clear()
      await tx.done
    } catch (error) {
      console.error('Errore nella cancellazione vCards:', error)
      throw new Error('Impossibile cancellare i vCards')
    }
  }

  /**
   * Verifica se un vCard è nella cache ed è recente
   */
  async isCached(jid: string, maxAgeMs: number = 3600000): Promise<boolean> {
    const vcard = await this.getByJid(jid)
    if (!vcard) return false

    const age = Date.now() - vcard.lastUpdated.getTime()
    return age < maxAgeMs
  }
}
