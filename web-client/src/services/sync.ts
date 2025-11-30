import type { Agent } from 'stanza'
import type { ReceivedMessage } from 'stanza/protocol'
import { normalizeJid } from '../utils/jid'
import { reloadAllMessagesFromServer } from './messages'
import { loadAllConversations } from './conversations'
import { clearMessagesForConversation } from './conversations-db'
import { updateConversation } from './conversations-db'

/**
 * Tipo per le azioni che possono essere sincronizzate
 */
export type SyncAction = 
  | { type: 'sendMessage'; toJid: string; body: string }
  | { type: 'syncConversation'; conversationJid: string }
  | { type: 'syncAllConversations' }

/**
 * Risultato di una sincronizzazione
 */
export interface SyncResult {
  success: boolean
  error?: string
  syncedData?: {
    conversationJid?: string
    messageCount?: number
    conversationCount?: number
  }
}

/**
 * Callback per la conferma di un'azione dal server
 */
type ConfirmationCallback = (confirmed: boolean) => void

/**
 * Sistema di sincronizzazione unificato
 * 
 * Il principio è: invia azione -> aspetta conferma -> sincronizza tutto dal server
 */
class SyncManager {
  private client: Agent | null = null
  private pendingConfirmations = new Map<string, ConfirmationCallback>()
  private messageIdToTempId = new Map<string, string>()

  /**
   * Inizializza il manager con il client XMPP
   */
  setClient(client: Agent | null) {
    this.client = client
    
    if (client) {
      this.setupMessageHandlers(client)
    }
  }

  /**
   * Configura gli handler per i messaggi dal server
   * Questi gestiscono le conferme delle azioni inviate
   */
  private setupMessageHandlers(client: Agent) {
    // Handler per messaggi ricevuti che potrebbero essere conferme
    // In XMPP, quando un messaggio viene salvato nel MAM del server,
    // possiamo considerarlo confermato
    client.on('message', (message: ReceivedMessage) => {
      // Se il messaggio ha un ID che corrisponde a uno che abbiamo inviato,
      // consideralo confermato
      if (message.id) {
        const tempId = this.messageIdToTempId.get(message.id)
        if (tempId) {
          this.confirmAction(tempId, true)
          this.messageIdToTempId.delete(message.id)
        }
      }
    })
  }

  /**
   * Conferma un'azione pendente
   */
  private confirmAction(actionId: string, confirmed: boolean) {
    const callback = this.pendingConfirmations.get(actionId)
    if (callback) {
      callback(confirmed)
      this.pendingConfirmations.delete(actionId)
    }
  }

  /**
   * Attende la conferma di un'azione dal server
   * 
   * @param actionId - ID univoco dell'azione
   * @param timeout - Timeout in millisecondi (default: 5000)
   * @returns Promise che si risolve quando l'azione è confermata o scade il timeout
   */
  private waitForConfirmation(actionId: string, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      // Timeout di sicurezza
      const timeoutId = setTimeout(() => {
        this.pendingConfirmations.delete(actionId)
        resolve(false)
      }, timeout)

      // Callback che viene chiamato quando arriva la conferma
      this.pendingConfirmations.set(actionId, (confirmed: boolean) => {
        clearTimeout(timeoutId)
        resolve(confirmed)
      })
    })
  }

  /**
   * Invia un messaggio e attende la conferma, poi sincronizza
   * 
   * @param toJid - JID del destinatario
   * @param body - Corpo del messaggio
   * @returns Risultato della sincronizzazione
   */
  async sendMessageAndSync(toJid: string, body: string): Promise<SyncResult> {
    if (!this.client) {
      return { success: false, error: 'Client XMPP non disponibile' }
    }

    const normalizedJid = normalizeJid(toJid)
    const actionId = `send_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    try {
      // 1. Invia il messaggio al server
      const sentMessage = await this.client.sendMessage({
        to: normalizedJid,
        body,
        type: 'chat',
      })

      // 2. Estrai l'ID del messaggio dal server
      const serverMessageId = typeof sentMessage === 'string' ? sentMessage : actionId
      
      // 3. Mappa l'ID del server all'ID temporaneo per la conferma
      if (serverMessageId !== actionId) {
        this.messageIdToTempId.set(serverMessageId, actionId)
      }

      // 4. Attendi conferma (con timeout di sicurezza)
      // In XMPP, consideriamo il messaggio confermato quando viene salvato nel MAM
      // Per semplicità, aspettiamo un breve delay per permettere al server di processare
      // In produzione, si potrebbe usare XEP-0184 (Message Delivery Receipts)
      const confirmed = await Promise.race([
        this.waitForConfirmation(actionId, 3000),
        new Promise<boolean>((resolve) => {
          // Fallback: dopo 1 secondo consideriamo confermato se non ci sono errori
          setTimeout(() => resolve(true), 1000)
        })
      ])

      if (!confirmed) {
        console.warn('Conferma non ricevuta per il messaggio, procedo comunque con la sincronizzazione')
      }

      // 5. Sincronizza tutto dal server per questa conversazione
      const syncResult = await this.syncConversation(normalizedJid)

      return {
        success: true,
        syncedData: {
          conversationJid: normalizedJid,
          messageCount: syncResult.syncedData?.messageCount,
        },
      }
    } catch (error) {
      console.error('Errore nell\'invio e sincronizzazione del messaggio:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }

  /**
   * Sincronizza una conversazione specifica dal server
   * Scarica tutti i messaggi e sostituisce il database locale
   * Aggiorna anche la lista conversazioni con l'ultimo messaggio
   * 
   * @param conversationJid - JID della conversazione da sincronizzare
   * @returns Risultato della sincronizzazione
   */
  async syncConversation(conversationJid: string): Promise<SyncResult> {
    if (!this.client) {
      return { success: false, error: 'Client XMPP non disponibile' }
    }

    const normalizedJid = normalizeJid(conversationJid)

    try {
      // 1. Svuota i messaggi locali per questa conversazione
      await clearMessagesForConversation(normalizedJid)

      // 2. Scarica tutti i messaggi dal server e salvali nel database
      const messages = await reloadAllMessagesFromServer(this.client, normalizedJid)

      // 3. Aggiorna la conversazione con l'ultimo messaggio
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await updateConversation(normalizedJid, {
          jid: normalizedJid,
          lastMessage: {
            body: lastMessage.body,
            timestamp: lastMessage.timestamp,
            from: lastMessage.from,
            messageId: lastMessage.messageId,
          },
          updatedAt: lastMessage.timestamp,
        })
      }

      return {
        success: true,
        syncedData: {
          conversationJid: normalizedJid,
          messageCount: messages.length,
        },
      }
    } catch (error) {
      console.error('Errore nella sincronizzazione della conversazione:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }

  /**
   * Sincronizza tutte le conversazioni dal server
   * 
   * @returns Risultato della sincronizzazione
   */
  async syncAllConversations(): Promise<SyncResult> {
    if (!this.client) {
      return { success: false, error: 'Client XMPP non disponibile' }
    }

    try {
      // Carica tutte le conversazioni dal server
      const conversations = await loadAllConversations(this.client)

      return {
        success: true,
        syncedData: {
          conversationCount: conversations.length,
        },
      }
    } catch (error) {
      console.error('Errore nella sincronizzazione di tutte le conversazioni:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }
    }
  }

  /**
   * Gestisce un messaggio ricevuto in real-time
   * Dopo averlo ricevuto, sincronizza la conversazione completa
   * 
   * @param message - Messaggio ricevuto
   * @param myJid - JID dell'utente corrente
   * @returns Promise che si risolve quando la sincronizzazione è completa
   */
  async handleIncomingMessage(message: ReceivedMessage, myJid: string): Promise<SyncResult> {
    if (!this.client || !message.body) {
      return { success: false, error: 'Messaggio o client non valido' }
    }

  // Determina il JID del contatto
  const myBareJid = normalizeJid(myJid)
  const from = message.from || ''
  const to = message.to || ''
  const contactJid = from.startsWith(myBareJid) 
    ? normalizeJid(to) 
    : normalizeJid(from)

  if (!contactJid) {
    return { success: false, error: 'JID contatto non valido' }
  }

    // Sincronizza la conversazione completa dal server
    // Questo garantisce che abbiamo tutti i messaggi aggiornati
    return await this.syncConversation(contactJid)
  }
}

// Istanza singleton del manager di sincronizzazione (legacy)
export const syncManager = new SyncManager()

/**
 * Funzione principale di sincronizzazione (legacy - usa SyncService invece)
 * Gestisce tutte le azioni che richiedono sincronizzazione con il server
 * 
 * @param client - Client XMPP
 * @param action - Azione da sincronizzare
 * @returns Risultato della sincronizzazione
 * @deprecated Usa SyncService invece per testabilità
 */
export async function sincronizza(
  client: Agent,
  action: SyncAction
): Promise<SyncResult> {
  // Assicurati che il manager abbia il client aggiornato
  syncManager.setClient(client)

  switch (action.type) {
    case 'sendMessage':
      return await syncManager.sendMessageAndSync(action.toJid, action.body)
    
    case 'syncConversation':
      return await syncManager.syncConversation(action.conversationJid)
    
    case 'syncAllConversations':
      return await syncManager.syncAllConversations()
    
    default:
      return { success: false, error: 'Tipo di azione non supportato' }
  }
}

/**
 * Gestisce un messaggio in arrivo e sincronizza la conversazione
 * 
 * @param client - Client XMPP
 * @param message - Messaggio ricevuto
 * @param myJid - JID dell'utente corrente
 * @returns Risultato della sincronizzazione
 */
export async function handleIncomingMessageAndSync(
  client: Agent,
  message: ReceivedMessage,
  myJid: string
): Promise<SyncResult> {
  syncManager.setClient(client)
  return await syncManager.handleIncomingMessage(message, myJid)
}

// ============================================================================
// NUOVE FUNZIONI DI SINCRONIZZAZIONE COMPLETA
// ============================================================================

/**
 * Sincronizza TUTTE le conversazioni in modo completo:
 * - Scarica tutti i messaggi di tutte le conversazioni dal server
 * - Salva tutti i messaggi nel database locale
 * - Scarica tutti i vCard in batch
 * - Aggiorna le conversazioni con i dati vCard
 * 
 * Usato nel pull-to-refresh della LISTA conversazioni
 * Ora usa SyncService per atomicità
 * 
 * @param client - Client XMPP connesso
 * @returns Risultato della sincronizzazione con statistiche
 */
export async function syncAllConversationsComplete(client: Agent): Promise<SyncResult> {
  const { defaultSyncService } = await import('./SyncService')
  return await defaultSyncService.syncAllConversationsComplete(client)
}


/**
 * Sincronizza UNA SOLA conversazione in modo completo:
 * - Scarica tutti i messaggi di quella conversazione
 * - Salva nel database locale
 * - Scarica il vCard del contatto
 * - Aggiorna la conversazione con i dati vCard
 * 
 * Usato nel pull-to-refresh di una CHAT specifica
 * Ora usa SyncService per atomicità
 * 
 * @param client - Client XMPP connesso
 * @param contactJid - JID del contatto da sincronizzare
 * @returns Risultato della sincronizzazione
 */
export async function syncSingleConversationComplete(
  client: Agent,
  contactJid: string
): Promise<SyncResult> {
  const { defaultSyncService } = await import('./SyncService')
  return await defaultSyncService.syncSingleConversationComplete(client, contactJid)
}

