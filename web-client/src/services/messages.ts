import type { Agent } from 'stanza'
import type { MAMResult } from 'stanza/protocol'
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
  const delay = msg.item.message?.delay
  if (delay && typeof delay === 'object' && 'stamp' in delay) {
    const stamp = (delay as { stamp?: string }).stamp
    if (stamp) {
      return new Date(stamp)
    }
  }
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
 * Con supporto per paginazione
 */
export async function loadMessagesForContact(
  client: Agent,
  contactJid: string,
  options?: {
    maxResults?: number
    afterToken?: string
    beforeToken?: string
  }
): Promise<{ messages: Message[]; nextToken?: string; complete: boolean }> {
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
        nextToken: result.paging?.last,
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
      nextToken: result.paging?.last,
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
  let lastToken: string | undefined

  while (hasMore) {
    const result = await loadMessagesForContact(client, contactJid, {
      maxResults: 100,
      afterToken: lastToken,
    })

    allMessages.push(...result.messages)

    hasMore = !result.complete && !!result.nextToken
    lastToken = result.nextToken
  }

  return allMessages
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

  // Aggiorna lo status a pending
  await updateMessageStatus(message.messageId, 'pending')

  // Riprova l'invio
  const result = await sendMessage(client, message.conversationJid, message.body)

  // Se il nuovo invio ha successo, rimuovi il vecchio messaggio e usa il nuovo
  if (result.success && result.tempId !== message.messageId) {
    // Il sendMessage ha creato un nuovo messaggio, eliminiamo quello vecchio
    // (in realtà manteniamoli entrambi per ora, il nuovo avrà successo)
  }

  return { success: result.success, error: result.error }
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
  message: any,
  myJid: string,
  contactJid: string
): Promise<void> {
  const myBareJid = normalizeJid(myJid)
  const from = message.from || ''
  const fromMe = from.startsWith(myBareJid)

  // Estrai timestamp
  const delay = message.delay
  let timestamp = new Date()
  if (delay && typeof delay === 'object' && 'stamp' in delay) {
    const stamp = (delay as { stamp?: string }).stamp
    if (stamp) {
      timestamp = new Date(stamp)
    }
  }

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
}
