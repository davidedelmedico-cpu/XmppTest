/**
 * Repository Pattern per VCards
 * Responsabilità: CRUD puro su IndexedDB per vCard cache
 * NO business logic, NO chiamate XMPP, solo data access
 */

import {
  type VCardCache,
  saveVCard as dbSaveVCard,
  saveVCards as dbSaveVCards,
  getVCard as dbGetVCard,
  getAllVCards as dbGetAllVCards,
  deleteVCard as dbDeleteVCard,
  clearVCards as dbClearVCards,
} from '../services/conversations-db'

export class VCardRepository {
  /**
   * Salva un vCard nella cache
   */
  async save(vcard: VCardCache): Promise<void> {
    return dbSaveVCard(vcard)
  }

  /**
   * Salva multipli vCard nella cache
   */
  async saveAll(vcards: VCardCache[]): Promise<void> {
    return dbSaveVCards(vcards)
  }

  /**
   * Recupera un vCard dalla cache
   */
  async getByJid(jid: string): Promise<VCardCache | null> {
    return dbGetVCard(jid)
  }

  /**
   * Recupera tutti i vCard dalla cache
   */
  async getAll(): Promise<VCardCache[]> {
    return dbGetAllVCards()
  }

  /**
   * Elimina un vCard dalla cache
   */
  async delete(jid: string): Promise<void> {
    return dbDeleteVCard(jid)
  }

  /**
   * Svuota tutta la cache vCard
   */
  async clear(): Promise<void> {
    return dbClearVCards()
  }

  /**
   * Controlla se un vCard è in cache
   */
  async exists(jid: string): Promise<boolean> {
    const vcard = await this.getByJid(jid)
    return vcard !== null
  }

  /**
   * Controlla se un vCard è obsoleto (più vecchio di maxAge)
   */
  async isStale(jid: string, maxAge: number = 86400000): Promise<boolean> {
    const vcard = await this.getByJid(jid)
    if (!vcard) return true

    const now = new Date().getTime()
    const lastUpdated = vcard.lastUpdated.getTime()
    return now - lastUpdated > maxAge
  }

  /**
   * Recupera vCard per multipli JID
   */
  async getManyByJids(jids: string[]): Promise<Map<string, VCardCache>> {
    const vcardMap = new Map<string, VCardCache>()

    for (const jid of jids) {
      const vcard = await this.getByJid(jid)
      if (vcard) {
        vcardMap.set(jid, vcard)
      }
    }

    return vcardMap
  }

  /**
   * Conta i vCard in cache
   */
  async count(): Promise<number> {
    const vcards = await this.getAll()
    return vcards.length
  }

  /**
   * Recupera vCard obsoleti
   */
  async getStale(maxAge: number = 86400000): Promise<VCardCache[]> {
    const allVCards = await this.getAll()
    const now = new Date().getTime()

    return allVCards.filter((vcard) => {
      const lastUpdated = vcard.lastUpdated.getTime()
      return now - lastUpdated > maxAge
    })
  }
}

// Esporta singleton per comodità
export const vcardRepository = new VCardRepository()
