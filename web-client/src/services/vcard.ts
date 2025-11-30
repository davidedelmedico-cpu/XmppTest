import type { Agent } from 'stanza'
import type { VCardTemp, VCardTempRecord } from 'stanza/protocol'
import { normalizeJid } from '../utils/jid'
import { saveVCard, getVCard as getCachedVCardFromDB, type VCardCache } from './conversations-db'

/**
 * Helper per trovare un record di un certo tipo nel vCard
 */
function findRecord<T extends VCardTempRecord>(records: VCardTempRecord[] | undefined, type: T['type']): T | undefined {
  return records?.find(r => r.type === type) as T | undefined
}

/**
 * Helper per trovare tutti i record di un certo tipo
 */
function findRecords<T extends VCardTempRecord>(records: VCardTempRecord[] | undefined, type: T['type']): T[] {
  return (records?.filter(r => r.type === type) as T[]) || []
}

/**
 * Converte Buffer a stringa base64
 */
function bufferToBase64(buffer: Buffer | Uint8Array | undefined): string | undefined {
  if (!buffer) return undefined
  
  // Se è già un Buffer di Node.js
  if (Buffer.isBuffer(buffer)) {
    return buffer.toString('base64')
  }
  
  // Se è un Uint8Array (browser)
  if (buffer instanceof Uint8Array) {
    // Converti Uint8Array a stringa binaria
    let binary = ''
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i])
    }
    return btoa(binary)
  }
  
  return undefined
}

/**
 * Converte stringa base64 a Buffer/Uint8Array
 */
function base64ToBuffer(base64: string | undefined): Uint8Array | undefined {
  if (!base64) return undefined
  
  try {
    // In ambiente browser, usa atob per decodificare base64
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch (error) {
    console.error('Errore nella conversione base64 a buffer:', error)
    return undefined
  }
}

/**
 * Recupera un vCard dal server XMPP
 */
export async function fetchVCardFromServer(client: Agent, jid: string): Promise<VCardCache | null> {
  try {
    const normalizedJid = normalizeJid(jid)
    
    // Recupera vCard dal server
    const vcard: VCardTemp = await client.getVCard(normalizedJid)
    
    if (!vcard) {
      return null
    }

    // Estrai i campi dai records
    const nicknameRecord = findRecord<{ type: 'nickname'; value: string }>(vcard.records, 'nickname')
    const photoRecord = findRecord<{ type: 'photo'; data?: Buffer; mediaType?: string; url?: string }>(vcard.records, 'photo')
    const emailRecords = findRecords<{ type: 'email'; value?: string }>(vcard.records, 'email')
    const descriptionRecord = findRecord<{ type: 'description'; value: string }>(vcard.records, 'description')

    // Converti in VCardCache
    const vcardCache: VCardCache = {
      jid: normalizedJid,
      fullName: vcard.fullName,
      nickname: nicknameRecord?.value,
      photoData: bufferToBase64(photoRecord?.data as Buffer | Uint8Array | undefined),
      photoType: photoRecord?.mediaType,
      email: emailRecords[0]?.value,
      description: descriptionRecord?.value,
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
 * Recupera un vCard dalla cache locale o dal server se non presente
 * La cache è permanente e viene aggiornata solo su richiesta esplicita (forceRefresh)
 */
export async function getVCard(client: Agent, jid: string, forceRefresh = false): Promise<VCardCache | null> {
  const normalizedJid = normalizeJid(jid)

  // Se non è forzato il refresh, usa sempre la cache se presente
  if (!forceRefresh) {
    const cached = await getCachedVCardFromDB(normalizedJid)
    if (cached) {
      return cached
    }
  }

  // Cache non presente o refresh forzato, scarica dal server
  return await fetchVCardFromServer(client, normalizedJid)
}

/**
 * Recupera vCard per multipli JID in batch
 * Ottimizzato per caricare solo quelli non in cache
 * 
 * @param client - Client XMPP
 * @param jids - Lista di JID da processare
 * @param forceRefresh - Se true, ricarica tutti i vCard dal server ignorando la cache
 */
export async function getVCardsForJids(
  client: Agent, 
  jids: string[], 
  forceRefresh = false
): Promise<Map<string, VCardCache>> {
  const vcardMap = new Map<string, VCardCache>()
  const jidsToFetch: string[] = []

  if (forceRefresh) {
    // Refresh forzato: scarica tutti
    jidsToFetch.push(...jids.map(jid => normalizeJid(jid)))
  } else {
    // Prima controlla la cache per tutti i JID
    for (const jid of jids) {
      const normalizedJid = normalizeJid(jid)
      const cached = await getCachedVCardFromDB(normalizedJid)

      if (cached) {
        // Cache presente, usala
        vcardMap.set(normalizedJid, cached)
      } else {
        // Cache non presente, scarica dal server
        jidsToFetch.push(normalizedJid)
      }
    }
  }

  // Scarica i vCard mancanti/da aggiornare dal server (in parallelo ma con limite)
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
    // Costruisci l'array di records
    const records: VCardTempRecord[] = []

    // Aggiungi nickname se presente
    if (vcard.nickname) {
      records.push({
        type: 'nickname',
        value: vcard.nickname
      })
    }

    // Aggiungi foto se presente
    if (vcard.photoData && vcard.photoType) {
      const photoBuffer = base64ToBuffer(vcard.photoData)
      if (photoBuffer) {
        records.push({
          type: 'photo',
          data: photoBuffer as Buffer,
          mediaType: vcard.photoType
        })
      }
    }

    // Aggiungi email se presente
    if (vcard.email) {
      records.push({
        type: 'email',
        value: vcard.email
      })
    }

    // Aggiungi description se presente
    if (vcard.description) {
      records.push({
        type: 'description',
        value: vcard.description
      })
    }

    // Aggiungi birthday se presente
    if (vcard.birthday) {
      records.push({
        type: 'birthday',
        value: vcard.birthday
      })
    }

    // Aggiungi telephone se presente
    if (vcard.telephone) {
      records.push({
        type: 'tel',
        value: vcard.telephone
      })
    }

    // Aggiungi url se presente
    if (vcard.url) {
      records.push({
        type: 'url',
        value: vcard.url
      })
    }

    // Converti nel formato stanza
    const vcardForStanza: VCardTemp = {
      fullName: vcard.fullName,
      records: records.length > 0 ? records : undefined
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
