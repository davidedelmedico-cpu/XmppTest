import type { Agent } from 'stanza'
import type { MAMResult, ReceivedMessage } from 'stanza/protocol'
import {
  saveMessages,
  addMessage,
  getMessagesForConversation,
  updateMessageStatus,
  updateMessageId,
  type Message,
} from './conversations-db'

// Re-export per comodità
export type { Message, MessageStatus } from './conversations-db'

/**
 * Normalizza un JID rimuovendo la resource
 */
function normalizeJid(jid: string): string {
  return jid.split('/')[0].toLowerCase()
}

/**
 * Genera un ID temporaneo univoco per messaggi ottimistici
 */
function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Estrae timestamp da un messaggio MAM
 */
function extractTimestamp(msg: MAMResult): Date {
  // Prova con il delay del messaggio interno
  const message = msg.item.message
  if (message?.delay) {
    const delay = message.delay
    if (typeof delay === 'object' && delay !== null) {
      // Prova diversi formati di delay
      const stamp = (delay as any).stamp || (delay as any).timestamp
      if (stamp) {
        const date = new Date(stamp)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }
  }
  
  // Fallback: timestamp attuale (per messaggi in tempo reale)
  return new Date()
}

/**
 * Converte un MAMResult in Message
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
    from: fromMe ? 'me' : 'them',
    status: 'sent', // Messaggi MAM sono già inviati
  }
}

/**
 * Carica messaggi per un contatto specifico dal server (MAM)
 * Con supporto per paginazione usando RSM tokens
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
  const { maxResults = 50, afterToken, beforeToken } = options || {}

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

    // Converti MAMResult in Message
    const myJid = client.jid || ''
    const messages = result.results.map((msg) =>
      mamResultToMessage(msg, contactJid, myJid)
    )

    // Salva nel database locale
    await saveMessages(messages)

    return {
      messages,
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
      maxResults: 100,
      afterToken,
    })

    allMessages.push(...result.messages)

    hasMore = !result.complete && !!result.lastToken
    afterToken = result.lastToken
  }

  return allMessages
}

/**
 * Carica tutti i messaggi dal server senza salvarli nel DB
 * (utile per reload completo dove poi sostituiamo tutto)
 */
async function loadAllMessagesFromServerOnly(
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
          max: 100,
          after: afterToken,
        },
      })

      if (!result.results || result.results.length === 0) {
        break
      }

      // Converti in Message ma NON salvare
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

  return allMessages
}

/**
 * Ricarica completamente tutto lo storico messaggi dal server
 * Cancella i messaggi locali e li sostituisce con quelli dal server
 * Previene duplicati caricando prima senza salvare, poi cancellando e salvando tutto insieme
 */
export async function reloadAllMessagesFromServer(
  client: Agent,
  contactJid: string
): Promise<Message[]> {
  const normalizedJid = normalizeJid(contactJid)
  
  try {
    // 1. Carica tutto lo storico dal server SENZA salvare nel DB
    //    (per evitare duplicati durante il processo)
    const serverMessages = await loadAllMessagesFromServerOnly(client, normalizedJid)
    
    // 2. Cancella tutti i messaggi locali per questa conversazione
    const { clearMessagesForConversation } = await import('./conversations-db')
    await clearMessagesForConversation(normalizedJid)
    
    // 3. Ora salva i nuovi messaggi dal server in un'unica operazione
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
 * Invia un messaggio con optimistic update
 */
export async function sendMessage(
  client: Agent,
  toJid: string,
  body: string
): Promise<{ tempId: string; success: boolean; error?: string }> {
  const tempId = generateTempId()
  const timestamp = new Date()
  const normalizedJid = normalizeJid(toJid)

  // 1. Optimistic update: aggiungi messaggio subito al database con stato 'pending'
  const optimisticMessage: Message = {
    messageId: tempId,
    conversationJid: normalizedJid,
    body,
    timestamp,
    from: 'me',
    status: 'pending',
    tempId,
  }

  try {
    await addMessage(optimisticMessage)

    // 2. Invia il messaggio al server
    const sentMessage = await client.sendMessage({
      to: normalizedJid,
      body,
      type: 'chat',
    })

    // 3. Aggiorna con l'ID del server (stanza restituisce una stringa)
    const serverId = typeof sentMessage === 'string' ? sentMessage : tempId
    if (serverId !== tempId) {
      await updateMessageId(tempId, serverId)
    } else {
      // Se non c'è ID server, aggiorna solo lo status
      await updateMessageStatus(tempId, 'sent')
    }

    return { tempId, success: true }
  } catch (error) {
    console.error('Errore nell\'invio del messaggio:', error)

    // Aggiorna lo status a 'failed'
    await updateMessageStatus(tempId, 'failed')

    return {
      tempId,
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

/**
 * Riprova a inviare un messaggio fallito
 */
export async function retryMessage(
  client: Agent,
  message: Message
): Promise<{ success: boolean; error?: string }> {
  if (message.status !== 'failed') {
    return { success: false, error: 'Il messaggio non è in stato failed' }
  }

  // Aggiorna lo status a pending prima dell'invio
  await updateMessageStatus(message.messageId, 'pending')

  try {
    // Invia il messaggio
    const sentMessage = await client.sendMessage({
      to: message.conversationJid,
      body: message.body,
      type: 'chat',
    })

    // Se l'invio ha successo, aggiorna il messaggio esistente invece di crearne uno nuovo
    const serverId = typeof sentMessage === 'string' ? sentMessage : message.messageId
    
    if (serverId !== message.messageId) {
      // Il server ha dato un nuovo ID, aggiorna
      await updateMessageId(message.messageId, serverId)
    } else {
      // Aggiorna solo lo status
      await updateMessageStatus(message.messageId, 'sent')
    }

    return { success: true }
  } catch (error) {
    console.error('Errore nel retry del messaggio:', error)
    
    // Ripristina status a 'failed'
    await updateMessageStatus(message.messageId, 'failed')
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

/**
 * Carica messaggi dal database locale (più veloce, per UI)
 */
export async function getLocalMessages(
  conversationJid: string,
  options?: {
    limit?: number
    before?: Date
  }
): Promise<Message[]> {
  return getMessagesForConversation(normalizeJid(conversationJid), options)
}

/**
 * Gestisce un messaggio ricevuto in real-time
 */
export async function handleIncomingMessage(
  message: ReceivedMessage,
  myJid: string,
  contactJid: string
): Promise<Message> {
  const myBareJid = normalizeJid(myJid)
  const from = message.from || ''
  const fromMe = from.startsWith(myBareJid)

  // Estrai timestamp con fallback migliore
  let timestamp = new Date()
  
  // 1. Prova con delay.stamp (per messaggi storici/offline)
  const delay = message.delay
  if (delay && typeof delay === 'object' && 'stamp' in delay) {
    const stamp = (delay as { stamp?: string }).stamp
    if (stamp) {
      timestamp = new Date(stamp)
    }
  }
  
  // 2. Se non c'è delay, usa il timestamp attuale (messaggi in tempo reale)
  // Il timestamp è comunque accurato perché il messaggio è appena arrivato

  const incomingMessage: Message = {
    messageId: message.id || `incoming_${Date.now()}`,
    conversationJid: normalizeJid(contactJid),
    body: message.body || '',
    timestamp,
    from: fromMe ? 'me' : 'them',
    status: 'sent',
  }

  // Salva nel database (de-duplicazione automatica)
  await addMessage(incomingMessage)
  
  // Ritorna il messaggio per permettere update ottimistici
  return incomingMessage
}
