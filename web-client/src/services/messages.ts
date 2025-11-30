import type { Agent } from 'stanza'
import type { MAMResult, ReceivedMessage } from 'stanza/protocol'
import {
  saveMessages,
  getMessagesForConversation,
  clearMessagesForConversation,
  type Message,
} from './conversations-db'
import { normalizeJid } from '../utils/jid'
import { generateTempId } from '../utils/message'
import { PAGINATION } from '../config/constants'
import { sincronizza } from './sync'

// Re-export per comodità
export type { Message, MessageStatus } from './conversations-db'

/**
 * Estrae timestamp da un messaggio MAM
 * Il timestamp è già un oggetto Date fornito dalla libreria stanza
 */
function extractTimestamp(msg: MAMResult): Date {
  // 1. Prova con il delay del wrapper Forward (MAM standard)
  if (msg.item?.delay?.timestamp) {
    return msg.item.delay.timestamp
  }

  // 2. Prova con il delay del messaggio interno (per messaggi offline)
  if (msg.item?.message?.delay?.timestamp) {
    return msg.item.message.delay.timestamp
  }
  
  // 3. Fallback: timestamp attuale (per messaggi senza delay)
  console.warn('Nessun timestamp trovato nel messaggio MAM, uso timestamp corrente', msg)
  return new Date()
}

/**
 * Converte un MAMResult in Message
 * Nota: per self-chat la direzione viene determinata dopo dalla funzione applySelfChatLogic
 */
function mamResultToMessage(msg: MAMResult, conversationJid: string, myJid: string): Message {
  const myBareJid = normalizeJid(myJid)
  const from = msg.item.message?.from || ''
  const fromMe = from.startsWith(myBareJid)

  return {
    messageId: msg.id || `mam_${Date.now()}`,
    conversationJid: normalizeJid(conversationJid),
    body: msg.item.message?.body || '',
    timestamp: extractTimestamp(msg),
    // La direzione base (sovrascritta da applySelfChatLogic per self-chat)
    from: fromMe ? 'me' : 'them',
    status: 'sent', // Messaggi MAM sono già inviati
  }
}

/**
 * Applica la logica di alternanza per messaggi self-chat
 * In self-chat ogni messaggio appare DUE volte nell'archivio MAM:
 * - Prima occorrenza = messaggio inviato ('me')
 * - Seconda occorrenza = messaggio ricevuto ('them')
 * 
 * Identifica i duplicati basandosi su body + timestamp simile
 * DEVE essere applicata sull'array completo e ordinato, non su singoli batch
 */
export function applySelfChatLogic(messages: Message[], isSelfChat: boolean): Message[] {
  if (!isSelfChat || messages.length === 0) {
    return messages
  }

  // Mappa per tracciare messaggi già visti: chiave = body+timestamp (arrotondato al secondo)
  const seenMessages = new Map<string, number>()
  
  return messages.map((msg) => {
    // Crea chiave univoca basata su body + timestamp (arrotondato al secondo)
    const timestampKey = Math.floor(msg.timestamp.getTime() / 1000)
    const key = `${msg.body}:${timestampKey}`
    
    const occurrenceCount = seenMessages.get(key) || 0
    seenMessages.set(key, occurrenceCount + 1)
    
    // Prima occorrenza = sent ('me'), seconda occorrenza = received ('them')
    return {
      ...msg,
      from: occurrenceCount === 0 ? 'me' : 'them',
    }
  })
}

/**
 * Carica messaggi per un contatto specifico dal server usando MAM (Message Archive Management)
 * Con supporto per paginazione usando RSM (Result Set Management) tokens
 * 
 * @param client - Il client XMPP connesso
 * @param contactJid - Il JID del contatto per cui caricare i messaggi
 * @param options - Opzioni di paginazione
 * @param options.maxResults - Numero massimo di messaggi da caricare (default: 50)
 * @param options.afterToken - Token RSM per caricare messaggi DOPO questo punto (più recenti)
 * @param options.beforeToken - Token RSM per caricare messaggi PRIMA di questo punto (più vecchi)
 * @returns Promise con i messaggi caricati, token RSM e flag di completezza
 * 
 * @example
 * ```ts
 * // Carica i primi 50 messaggi
 * const result = await loadMessagesForContact(client, 'user@example.com')
 * 
 * // Carica messaggi più vecchi usando il token
 * const older = await loadMessagesForContact(client, 'user@example.com', {
 *   beforeToken: result.firstToken
 * })
 * ```
 */
export async function loadMessagesForContact(
  client: Agent,
  contactJid: string,
  options?: {
    maxResults?: number
    afterToken?: string  // Token per caricare messaggi DOPO questo punto (più recenti)
    beforeToken?: string // Token per caricare messaggi PRIMA di questo punto (più vecchi)
  }
): Promise<{ 
  messages: Message[]
  firstToken?: string  // Token del primo messaggio (per paginare indietro)
  lastToken?: string   // Token dell'ultimo messaggio (per paginare avanti)
  complete: boolean 
}> {
  const { maxResults = PAGINATION.DEFAULT_MESSAGE_LIMIT, afterToken, beforeToken } = options || {}

  try {
    // Query MAM filtrata per contatto specifico
    const result = await client.searchHistory({
      with: normalizeJid(contactJid),
      paging: {
        max: maxResults,
        after: afterToken,
        before: beforeToken,
      },
    })

    if (!result.results || result.results.length === 0) {
      return {
        messages: [],
        firstToken: result.paging?.first,
        lastToken: result.paging?.last,
        complete: result.complete ?? true,
      }
    }

    // Converti TUTTI i messaggi MAMResult in Message (inclusi ping, token, visualizzazioni, ecc.)
    const myJid = client.jid || ''

    const allMessages = result.results.map((msg) =>
      mamResultToMessage(msg, contactJid, myJid)
    )

    // Salva TUTTI i messaggi nel database (dati raw, senza alternanza self-chat)
    await saveMessages(allMessages)

    // Filtra solo messaggi di chat validi (con body) per la visualizzazione nella UI
    const validMessages = allMessages.filter(msg => msg.body && msg.body.trim().length > 0)

    // NON applicare alternanza qui - sarà applicata nella UI sull'array completo
    return {
      messages: validMessages,
      firstToken: result.paging?.first,  // Token per paginare verso messaggi più vecchi
      lastToken: result.paging?.last,    // Token per paginare verso messaggi più recenti
      complete: result.complete ?? true,
    }
  } catch (error) {
    console.error('Errore nel caricamento messaggi MAM:', error)
    throw new Error('Impossibile caricare i messaggi dal server')
  }
}

/**
 * Carica tutti i messaggi disponibili per un contatto
 * (utile per prima apertura della chat)
 */
export async function loadAllMessagesForContact(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  const allMessages: Message[] = []
  let hasMore = true
  let afterToken: string | undefined

  while (hasMore) {
    const result = await loadMessagesForContact(client, contactJid, {
      maxResults: PAGINATION.DEFAULT_CONVERSATION_LIMIT,
      afterToken,
    })

    allMessages.push(...result.messages)

    hasMore = !result.complete && !!result.lastToken
    afterToken = result.lastToken
  }

  return allMessages
}

/**
 * Scarica tutti i messaggi dal server senza salvarli nel DB
 * Utile per refresh completo dove si vuole scaricare prima, poi svuotare e salvare
 */
export async function downloadAllMessagesFromServer(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  const normalizedJid = normalizeJid(contactJid)
  const messagesMap = new Map<string, Message>() // Usa Map per de-duplicazione automatica
  let hasMore = true
  let afterToken: string | undefined
  const myJid = client.jid || ''

  while (hasMore) {
    try {
      // Query MAM senza salvare nel DB
      const result = await client.searchHistory({
        with: normalizedJid,
        paging: {
          max: PAGINATION.DEFAULT_CONVERSATION_LIMIT,
          after: afterToken,
        },
      })

      if (!result.results || result.results.length === 0) {
        break
      }

      // Converti TUTTI i messaggi in Message (inclusi ping, token, visualizzazioni, ecc.)
      // NON filtrare qui - salviamo tutto nel database
      const messages = result.results.map((msg) =>
        mamResultToMessage(msg, contactJid, myJid)
      )
      
      // Aggiungi alla Map per de-duplicazione automatica per messageId
      messages.forEach(msg => messagesMap.set(msg.messageId, msg))

      hasMore = !result.complete && !!result.paging?.last
      afterToken = result.paging?.last
    } catch (error) {
      console.error('Errore nel caricamento batch messaggi:', error)
      break
    }
  }

  // Converti Map in array ordinato per timestamp
  const allMessages = Array.from(messagesMap.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )

  // NON applicare alternanza qui - sarà applicata nella UI sull'array completo
  return allMessages
}

/**
 * Ricarica completamente tutto lo storico messaggi dal server
 * Scarica prima, poi svuota il database, poi salva i nuovi messaggi
 */
export async function reloadAllMessagesFromServer(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  const normalizedJid = normalizeJid(contactJid)
  
  try {
    // 1. Prima scarica tutti i messaggi dal server (senza salvare)
    const serverMessages = await downloadAllMessagesFromServer(client, normalizedJid)
    
    // 2. Poi svuota il database dei messaggi per questa conversazione
    await clearMessagesForConversation(normalizedJid)
    
    // 3. Infine salva i messaggi scaricati nel database
    if (serverMessages.length > 0) {
      await saveMessages(serverMessages)
    }
    
    return serverMessages
  } catch (error) {
    console.error('Errore nel reload completo messaggi:', error)
    throw new Error('Impossibile ricaricare i messaggi dal server')
  }
}

/**
 * Invia un messaggio usando il sistema di sincronizzazione
 * NON scrive nel database immediatamente - aspetta conferma e sincronizza tutto dal server
 */
export async function sendMessage(
  client: Agent,
  toJid: string,
  body: string
): Promise<{ tempId: string; success: boolean; error?: string }> {
  const tempId = generateTempId()
  const normalizedJid = normalizeJid(toJid)

  try {
    // Usa il sistema di sincronizzazione unificato
    // Questo invia il messaggio, aspetta conferma e sincronizza tutto dal server
    const result = await sincronizza(client, {
      type: 'sendMessage',
      toJid: normalizedJid,
      body,
    })

    if (!result.success) {
      return {
        tempId,
        success: false,
        error: result.error || 'Errore nell\'invio del messaggio',
      }
    }

    return { tempId, success: true }
  } catch (error) {
    console.error('Errore nell\'invio del messaggio:', error)
    return {
      tempId,
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

/**
 * Riprova a inviare un messaggio fallito usando il sistema di sincronizzazione
 */
export async function retryMessage(
  client: Agent,
  message: Message
): Promise<{ success: boolean; error?: string }> {
  if (message.status !== 'failed') {
    return { success: false, error: 'Il messaggio non è in stato failed' }
  }

  try {
    // Usa il sistema di sincronizzazione per inviare il messaggio
    // Questo invia, aspetta conferma e sincronizza tutto dal server
    const result = await sincronizza(client, {
      type: 'sendMessage',
      toJid: message.conversationJid,
      body: message.body,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Errore nel retry del messaggio',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Errore nel retry del messaggio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

/**
 * Carica messaggi dal database locale (più veloce, per UI)
 * Filtra automaticamente messaggi vuoti (senza body)
 */
export async function getLocalMessages(
  conversationJid: string,
  options?: {
    limit?: number
    before?: Date
  }
): Promise<Message[]> {
  const messages = await getMessagesForConversation(normalizeJid(conversationJid), options)
  // Filtra messaggi vuoti (senza body) - possono essere ping, visualizzazioni, ecc.
  return messages.filter(msg => msg.body && msg.body.trim().length > 0)
}

/**
 * Gestisce un messaggio ricevuto in real-time usando il sistema di sincronizzazione
 * NON scrive direttamente nel database - sincronizza tutto dal server
 * 
 * @deprecated Usa handleIncomingMessageAndSync da './sync' invece
 * Questa funzione è mantenuta solo per compatibilità con codice esistente
 */
export async function handleIncomingMessage(
  message: ReceivedMessage,
  myJid: string,
  contactJid: string
): Promise<Message> {
  // Estrai timestamp per il messaggio di ritorno (per compatibilità)
  const timestamp = message.delay?.timestamp || new Date()
  const myBareJid = normalizeJid(myJid)
  const from = message.from || ''
  const fromMe = from.startsWith(myBareJid)

  // Ritorna un messaggio temporaneo per compatibilità
  // Il vero messaggio sarà caricato dalla sincronizzazione nel contesto XMPP
  return {
    messageId: message.id || `incoming_${Date.now()}`,
    conversationJid: normalizeJid(contactJid),
    body: message.body || '',
    timestamp,
    from: fromMe ? 'me' : 'them',
    status: 'sent',
  }
}
