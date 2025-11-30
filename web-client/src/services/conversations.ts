import type { Agent } from 'stanza'
import type { MAMResult, ReceivedMessage } from 'stanza/protocol'
import { saveConversations, updateConversation, saveMetadata, getConversations, type Conversation } from './conversations-db'
import { normalizeJid } from '../utils/jid'
import { PAGINATION } from '../config/constants'

// Re-export per comodità
export type { Conversation } from './conversations-db'
export { getConversations } from './conversations-db'

/**
 * Estrae il JID del contatto da un messaggio MAM
 */
function extractContactJid(msg: MAMResult, myJid: string): string {
  const myBareJid = normalizeJid(myJid)
  const from = msg.item.message?.from || ''
  const to = msg.item.message?.to || ''

  // Se il messaggio è da me, il contatto è il destinatario
  if (from.startsWith(myBareJid)) {
    return normalizeJid(to)
  }
  // Se il messaggio è a me, il contatto è il mittente
  return normalizeJid(from)
}

/**
 * Estrae il corpo del messaggio
 */
function extractMessageBody(msg: MAMResult): string {
  return msg.item.message?.body || ''
}

/**
 * Estrae il timestamp del messaggio
 */
function extractTimestamp(msg: MAMResult): Date {
  const delay = msg.item.message?.delay
  if (delay && typeof delay === 'object' && 'stamp' in delay) {
    const stamp = (delay as { stamp?: string }).stamp
    if (stamp) {
      return new Date(stamp)
    }
  }
  // Fallback: usa data corrente se non disponibile
  return new Date()
}

/**
 * Raggruppa messaggi per contatto e estrae l'ultimo messaggio per ogni contatto
 */
function groupMessagesByContact(messages: MAMResult[], myJid: string): Map<string, MAMResult> {
  const groups = new Map<string, MAMResult[]>()

  // Filtra solo messaggi di tipo chat (non groupchat) e con body
  const chatMessages = messages.filter((msg) => {
    const type = msg.item.message?.type
    const body = msg.item.message?.body
    return (!type || type === 'chat') && body && body.trim().length > 0
  })

// Raggruppa per contatto
for (const msg of chatMessages) {
  const contactJid = extractContactJid(msg, myJid)
  if (!contactJid) {
    continue // Skip messaggi senza contatto valido
  }

  if (!groups.has(contactJid)) {
    groups.set(contactJid, [])
  }
  groups.get(contactJid)!.push(msg)
}

  // Per ogni gruppo, prendi il messaggio più recente
  const lastMessages = new Map<string, MAMResult>()
  for (const [contactJid, msgs] of groups.entries()) {
    // Ordina per timestamp (più recente prima)
    const sorted = msgs.sort((a, b) => {
      const timeA = extractTimestamp(a).getTime()
      const timeB = extractTimestamp(b).getTime()
      return timeB - timeA
    })
    lastMessages.set(contactJid, sorted[0])
  }

  return lastMessages
}


/**
 * Carica conversazioni dal server usando MAM
 */
/**
 * Carica conversazioni dal server usando MAM (Message Archive Management)
 * 
 * @param client - Il client XMPP connesso
 * @param options - Opzioni di query
 * @param options.startDate - Data di inizio per il range di ricerca
 * @param options.endDate - Data di fine per il range di ricerca
 * @param options.maxResults - Numero massimo di risultati per pagina
 * @param options.afterToken - Token RSM per paginazione
 * @returns Promise con le conversazioni trovate, token per paginazione e flag di completezza
 */
export async function loadConversationsFromServer(
  client: Agent,
  options: {
    startDate?: Date
    endDate?: Date
    maxResults?: number
    afterToken?: string
  } = {}
): Promise<{ conversations: Conversation[]; nextToken?: string; complete: boolean }> {
  const { startDate, endDate, maxResults = PAGINATION.DEFAULT_CONVERSATION_LIMIT, afterToken } = options

  // Query MAM
  const result = await client.searchHistory({
    start: startDate,
    end: endDate,
    paging: {
      max: maxResults,
      after: afterToken,
    },
  })

  if (!result.results || result.results.length === 0) {
    return {
      conversations: [],
      nextToken: result.paging?.last,
      complete: result.complete ?? true,
    }
  }

  // Raggruppa per contatto
  const lastMessages = groupMessagesByContact(result.results, client.jid || '')

  // Converti in conversazioni
  const conversations: Conversation[] = []
  for (const [contactJid, msg] of lastMessages.entries()) {
    // Correggo extractSender per usare myJid corretto
    const myBareJid = normalizeJid(client.jid || '')
    const from = msg.item.message?.from || ''
    const sender: 'me' | 'them' = from.startsWith(myBareJid) ? 'me' : 'them'

    conversations.push({
      jid: contactJid,
      lastMessage: {
        body: extractMessageBody(msg),
        timestamp: extractTimestamp(msg),
        from: sender,
        messageId: msg.id,
      },
      unreadCount: 0,
      updatedAt: new Date(),
    })
  }

  // Ordina per timestamp (più recenti prima)
  conversations.sort(
    (a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
  )

  return {
    conversations,
    nextToken: result.paging?.last,
    complete: result.complete ?? true,
  }
}

/**
 * Scarica TUTTE le conversazioni dal server senza salvare nel database
 * Utile per refresh completo dove si vuole scaricare prima, poi svuotare e salvare
 */
export async function downloadAllConversations(client: Agent): Promise<{ conversations: Conversation[]; lastToken?: string }> {
  let allConversations: Conversation[] = []
  let hasMore = true
  let lastToken: string | undefined

  // Carica tutte le pagine fino a quando non ci sono più risultati
  while (hasMore) {
    const result = await loadConversationsFromServer(client, {
      maxResults: PAGINATION.DEFAULT_CONVERSATION_LIMIT,
      afterToken: lastToken,
    })

    // Raggruppa e aggiungi alle conversazioni totali
    allConversations = [...allConversations, ...result.conversations]

    // Controlla se ci sono altre pagine
    hasMore = !result.complete && !!result.nextToken
    lastToken = result.nextToken
  }

  // Ordina tutte le conversazioni per timestamp (più recenti prima)
  allConversations.sort(
    (a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
  )

  // Rimuovi duplicati (se ci sono) mantenendo quella con timestamp più recente
  const conversationMap = new Map<string, Conversation>()
  for (const conv of allConversations) {
    const existing = conversationMap.get(conv.jid)
    if (!existing || conv.lastMessage.timestamp.getTime() > existing.lastMessage.timestamp.getTime()) {
      conversationMap.set(conv.jid, conv)
    }
  }

  const uniqueConversations = Array.from(conversationMap.values())

  return {
    conversations: uniqueConversations,
    lastToken,
  }
}

/**
 * Carica TUTTE le conversazioni dal server usando MAM
 * Ricarica storico completo, elabora tutto e aggiorna database locale
 */
export async function loadAllConversations(client: Agent): Promise<Conversation[]> {
  // Scarica tutte le conversazioni dal server
  const { conversations: uniqueConversations, lastToken } = await downloadAllConversations(client)

  // Carica conversazioni esistenti dal database per mantenere unreadCount
  const existingConversations = await getConversations()
  const existingMap = new Map(existingConversations.map((c) => [c.jid, c]))

  // Merge: mantieni unreadCount dalle conversazioni esistenti
  const mergedConversations = uniqueConversations.map((conv) => {
    const existing = existingMap.get(conv.jid)
    return {
      ...conv,
      unreadCount: existing?.unreadCount ?? 0, // Mantieni unreadCount esistente o 0
    }
  })

  // Salva TUTTE le conversazioni nel database locale
  await saveConversations(mergedConversations)

  // Aggiorna metadata
  await saveMetadata({
    lastSync: new Date(),
    lastRSMToken: lastToken,
  })

  return mergedConversations
}


/**
 * Arricchisce conversazioni con dati dal roster (nomi contatti)
 */
export async function enrichWithRoster(
  client: Agent,
  conversations: Conversation[]
): Promise<Conversation[]> {
  try {
    const rosterResult = await client.getRoster()
    // RosterResult ha una proprietà 'roster' che contiene gli items
    const rosterData = rosterResult as unknown as { roster?: { items?: Array<{ jid: string; name?: string }> } }
    const rosterItems = rosterData.roster?.items || []
    const rosterMap = new Map(
      rosterItems.map((item) => [normalizeJid(item.jid), item])
    )

    return conversations.map((conv) => {
      const rosterItem = rosterMap.get(conv.jid)
      return {
        ...conv,
        displayName: rosterItem?.name || conv.displayName,
      }
    })
  } catch (error) {
    console.error('Errore nel recupero roster:', error)
    return conversations
  }
}

/**
 * Aggiorna una conversazione quando arriva un nuovo messaggio
 */
export async function updateConversationOnNewMessage(
  message: ReceivedMessage,
  myJid: string
): Promise<void> {
  const myBareJid = normalizeJid(myJid)
  const from = message.from || ''
  const to = message.to || ''

// Determina il JID del contatto
const contactJid = from.startsWith(myBareJid) ? normalizeJid(to) : normalizeJid(from)

if (!contactJid) {
  return // Skip messaggi senza contatto valido
}

  // Estrai timestamp
  const delay = message.delay
  let timestamp = new Date()
  if (delay && typeof delay === 'object' && 'stamp' in delay) {
    const stamp = (delay as { stamp?: string }).stamp
    if (stamp) {
      timestamp = new Date(stamp)
    }
  }

  // Aggiorna conversazione
  await updateConversation(contactJid, {
    jid: contactJid,
    lastMessage: {
      body: message.body || '',
      timestamp,
      from: from.startsWith(myBareJid) ? 'me' : 'them',
      messageId: message.id || `${Date.now()}`,
    },
    unreadCount: from.startsWith(myBareJid) ? 0 : 1, // Incrementa se è un messaggio ricevuto
  })
}
