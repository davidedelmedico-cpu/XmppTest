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
 * Compatibile sia con Node.js che browser
 */
function bufferToBase64(buffer: Buffer | Uint8Array | ArrayBuffer | undefined): string | undefined {
  if (!buffer) return undefined
  
  try {
    // Se è un ArrayBuffer, convertilo a Uint8Array
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer)
    }
    
    // Verifica se Buffer è disponibile (Node.js o polyfill)
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(buffer)) {
      return buffer.toString('base64')
    }
    
    // Se è un Uint8Array o qualsiasi TypedArray
    if (buffer instanceof Uint8Array || ArrayBuffer.isView(buffer)) {
      // Converti a Uint8Array se non lo è già
      const uint8Array = buffer instanceof Uint8Array 
        ? buffer 
        : new Uint8Array((buffer as { buffer: ArrayBuffer }).buffer)
      
      // Usa btoa per browser
      let binary = ''
      const chunkSize = 8192 // Process in chunks to avoid stack overflow
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length))
        binary += String.fromCharCode.apply(null, Array.from(chunk))
      }
      return btoa(binary)
    }
    
    console.warn('Tipo di buffer non riconosciuto:', buffer)
    return undefined
  } catch (error) {
    console.error('Errore nella conversione buffer a base64:', error)
    return undefined
  }
}

// NOTA: La funzione base64ToBuffer è stata rimossa perché non più necessaria.
// Per SALVARE foto: usiamo direttamente la stringa base64 (causa timeout se convertiamo a Buffer)
// Per LEGGERE foto: il server restituisce già stringa base64, quindi nessuna conversione necessaria

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
    // Usa any per il photoRecord perché il tipo esatto dipende dall'ambiente (Node vs browser)
    const photoRecord = findRecord(vcard.records, 'photo') as { type: 'photo'; data?: unknown; mediaType?: string; url?: string } | undefined
    const emailRecords = findRecords<{ type: 'email'; value?: string }>(vcard.records, 'email')
    const descriptionRecord = findRecord<{ type: 'description'; value: string }>(vcard.records, 'description')

    // Gestisci la foto: può essere già una stringa base64 O un Buffer
    let photoData: string | undefined
    if (photoRecord?.data) {
      if (typeof photoRecord.data === 'string') {
        // È già base64, usala direttamente
        photoData = photoRecord.data
      } else {
        // È un Buffer/Uint8Array, converti
        photoData = bufferToBase64(photoRecord.data as Buffer | Uint8Array | ArrayBuffer)
      }
    }

    // Converti in VCardCache
    const vcardCache: VCardCache = {
      jid: normalizedJid,
      fullName: vcard.fullName,
      nickname: nicknameRecord?.value,
      photoData,
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
    // Verifica che il client sia connesso
    if (!client || !client.jid) {
      throw new Error('Client XMPP non connesso')
    }

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
      console.log('Aggiunta immagine profilo al vCard:', {
        photoType: vcard.photoType,
        photoDataLength: vcard.photoData.length,
        photoDataPreview: vcard.photoData.substring(0, 50) + '...'
      })
      
      // FIX: Passa la stringa base64 direttamente, NON convertire a Buffer!
      // Il server XMPP (e stanza.io) vogliono la stringa base64 come data.
      // La conversione a Buffer causava timeout del server.
      records.push({
        type: 'photo',
        data: vcard.photoData as any, // ✅ Stringa base64 diretta (cast necessario per tipo stanza)
        mediaType: vcard.photoType
      })
      
      console.log('Immagine aggiunta al vCard (base64 string)')
    } else if (vcard.photoData || vcard.photoType) {
      // Solo uno dei due è presente - questo è un errore
      console.warn('Dati immagine incompleti:', { 
        hasPhotoData: !!vcard.photoData, 
        hasPhotoType: !!vcard.photoType 
      })
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

    // Verifica che ci sia almeno un campo da salvare
    if (!vcard.fullName && records.length === 0) {
      console.warn('Tentativo di salvare vCard vuoto - non ci sono dati da salvare')
      throw new Error('Inserisci almeno un campo prima di salvare il profilo')
    }

    console.log('Pubblicazione vCard sul server:', {
      fullName: vcard.fullName,
      hasPhoto: !!vcard.photoData,
      recordsCount: records.length,
      jid: client.jid
    })

    // Pubblica sul server
    try {
      await client.publishVCard(vcardForStanza)
    } catch (publishError: any) {
      console.error('Errore nella chiamata publishVCard:', publishError)
      
      // Gestisci errori specifici del server XMPP
      if (publishError.error) {
        const errorType = publishError.error.condition || publishError.error.type
        console.error('Tipo errore XMPP:', errorType)
        
        if (errorType === 'not-authorized') {
          throw new Error('Non autorizzato a modificare il profilo')
        } else if (errorType === 'forbidden') {
          throw new Error('Operazione non consentita dal server')
        } else if (errorType === 'service-unavailable') {
          throw new Error('Servizio vCard non disponibile sul server')
        } else if (errorType === 'not-allowed') {
          throw new Error('Modifica profilo non consentita')
        }
      }
      
      // Se non è un errore XMPP specifico, rilancia l'errore originale
      throw publishError
    }

    console.log('vCard pubblicato con successo sul server')

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
    // Propaga l'errore invece di ritornare solo false
    throw error
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
