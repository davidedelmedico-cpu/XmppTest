import type { Agent } from 'stanza'
import { normalizeJid } from '../utils/jid'
import { saveVCard, getVCard as getCachedVCardFromDB, type VCardCache } from './conversations-db'

/**
 * Tempo di cache per i vCard (24 ore)
 */
const VCARD_CACHE_TIME = 24 * 60 * 60 * 1000

/**
 * Interfaccia per vCard da stanza.js
 */
interface VCardFromStanza {
  fullName?: string
  nickname?: string
  photo?: {
    type?: string
    data?: string
    url?: string
  }
  email?: string | string[]
  description?: string
  birthday?: string
  telephone?: string | string[]
  url?: string | string[]
  address?: {
    street?: string
    locality?: string
    region?: string
    postalCode?: string
    country?: string
  }
  organization?: {
    name?: string
    unit?: string
  }
}

/**
 * Recupera un vCard dal server XMPP
 */
export async function fetchVCardFromServer(client: Agent, jid: string): Promise<VCardCache | null> {
  try {
    const normalizedJid = normalizeJid(jid)
    
    // Recupera vCard dal server
    const vcard = await client.getVCard(normalizedJid) as VCardFromStanza | undefined
    
    if (!vcard) {
      return null
    }

    // Converti in VCardCache
    const vcardCache: VCardCache = {
      jid: normalizedJid,
      fullName: vcard.fullName,
      nickname: vcard.nickname,
      photoData: vcard.photo?.data,
      photoType: vcard.photo?.type,
      email: Array.isArray(vcard.email) ? vcard.email[0] : vcard.email,
      description: vcard.description,
      lastUpdated: new Date()
    }

    // Salva nella cache locale
    await saveVCard(vcardCache)

    return vcardCache
  } catch (error) {
    console.error(`Errore nel recupero vCard per ${jid}:`, error)
    return null
  }
}

/**
 * Recupera un vCard dalla cache locale o dal server se non presente/scaduto
 */
export async function getVCard(client: Agent, jid: string, forceRefresh = false): Promise<VCardCache | null> {
  const normalizedJid = normalizeJid(jid)

  // Se non è forzato il refresh, prova a recuperare dalla cache
  if (!forceRefresh) {
    const cached = await getCachedVCardFromDB(normalizedJid)
    
    if (cached) {
      // Verifica se la cache è ancora valida
      const now = new Date()
      const cacheAge = now.getTime() - cached.lastUpdated.getTime()
      
      if (cacheAge < VCARD_CACHE_TIME) {
        return cached
      }
    }
  }

  // Cache non presente o scaduta, scarica dal server
  return await fetchVCardFromServer(client, normalizedJid)
}

/**
 * Recupera vCard per multipli JID in batch
 * Ottimizzato per caricare solo quelli non in cache o scaduti
 */
export async function getVCardsForJids(client: Agent, jids: string[]): Promise<Map<string, VCardCache>> {
  const vcardMap = new Map<string, VCardCache>()
  const jidsToFetch: string[] = []

  // Prima controlla la cache per tutti i JID
  for (const jid of jids) {
    const normalizedJid = normalizeJid(jid)
    const cached = await getCachedVCardFromDB(normalizedJid)

    if (cached) {
      const now = new Date()
      const cacheAge = now.getTime() - cached.lastUpdated.getTime()

      if (cacheAge < VCARD_CACHE_TIME) {
        // Cache valida
        vcardMap.set(normalizedJid, cached)
        continue
      }
    }

    // Cache non presente o scaduta
    jidsToFetch.push(normalizedJid)
  }

  // Scarica i vCard mancanti dal server (in parallelo ma con limite)
  if (jidsToFetch.length > 0) {
    // Limita a 5 richieste parallele per evitare di sovraccaricare il server
    const batchSize = 5
    for (let i = 0; i < jidsToFetch.length; i += batchSize) {
      const batch = jidsToFetch.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(jid => fetchVCardFromServer(client, jid))
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          vcardMap.set(batch[index], result.value)
        }
      })
    }
  }

  return vcardMap
}

/**
 * Pubblica/aggiorna il proprio vCard sul server
 */
export async function publishVCard(
  client: Agent,
  vcard: {
    fullName?: string
    nickname?: string
    photoData?: string // Base64 image data
    photoType?: string // MIME type
    email?: string
    description?: string
    birthday?: string
    telephone?: string
    url?: string
  }
): Promise<boolean> {
  try {
    // Converti nel formato stanza
    const vcardForStanza: VCardFromStanza = {
      fullName: vcard.fullName,
      nickname: vcard.nickname,
      email: vcard.email,
      description: vcard.description,
      birthday: vcard.birthday,
      telephone: vcard.telephone,
      url: vcard.url,
    }

    // Aggiungi foto se presente
    if (vcard.photoData && vcard.photoType) {
      vcardForStanza.photo = {
        type: vcard.photoType,
        data: vcard.photoData,
      }
    }

    // Pubblica sul server
    await client.publishVCard(vcardForStanza)

    // Aggiorna la cache locale con il proprio vCard
    const myJid = normalizeJid(client.jid || '')
    await saveVCard({
      jid: myJid,
      fullName: vcard.fullName,
      nickname: vcard.nickname,
      photoData: vcard.photoData,
      photoType: vcard.photoType,
      email: vcard.email,
      description: vcard.description,
      lastUpdated: new Date()
    })

    return true
  } catch (error) {
    console.error('Errore nella pubblicazione del vCard:', error)
    return false
  }
}

/**
 * Recupera il nome da visualizzare per un contatto
 * Priorità: roster name > vCard fullName > vCard nickname > JID
 */
export function getDisplayName(
  jid: string,
  rosterName?: string,
  vcard?: VCardCache | null
): string {
  // 1. Nome dal roster (priorità massima - è personalizzato dall'utente)
  if (rosterName) {
    return rosterName
  }

  // 2. Nome completo dal vCard
  if (vcard?.fullName) {
    return vcard.fullName
  }

  // 3. Nickname dal vCard
  if (vcard?.nickname) {
    return vcard.nickname
  }

  // 4. Fallback al JID (parte locale)
  return jid.split('@')[0] || jid
}
