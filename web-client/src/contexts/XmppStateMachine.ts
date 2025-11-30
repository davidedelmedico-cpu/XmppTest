/**
 * State Machine per gestione stati XMPP
 * Elimina race conditions e garantisce transizioni valide
 */

export type XmppState = 
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error'
  | 'reconnecting'

export type XmppEvent = 
  | 'CONNECT'
  | 'AUTH_SUCCESS'
  | 'DISCONNECT'
  | 'ERROR'
  | 'RECONNECT'
  | 'AUTH_FAILED'

export interface StateTransition {
  from: XmppState
  to: XmppState
  event: XmppEvent
}

/**
 * Definizione delle transizioni valide
 * Una transizione è valida se esiste in questa mappa
 */
const VALID_TRANSITIONS: Record<XmppState, Partial<Record<XmppEvent, XmppState>>> = {
  disconnected: {
    CONNECT: 'connecting',
  },
  connecting: {
    AUTH_SUCCESS: 'authenticating',
    ERROR: 'error',
    DISCONNECT: 'disconnected',
  },
  authenticating: {
    AUTH_SUCCESS: 'connected',
    AUTH_FAILED: 'error',
    ERROR: 'error',
    DISCONNECT: 'disconnected',
  },
  connected: {
    DISCONNECT: 'disconnected',
    ERROR: 'error',
    RECONNECT: 'reconnecting',
  },
  error: {
    CONNECT: 'connecting',
    RECONNECT: 'reconnecting',
    DISCONNECT: 'disconnected',
  },
  reconnecting: {
    AUTH_SUCCESS: 'connected',
    ERROR: 'error',
    DISCONNECT: 'disconnected',
  },
}

/**
 * State Machine per XMPP
 * Garantisce transizioni valide e previene race conditions
 */
export class XmppStateMachine {
  private currentState: XmppState = 'disconnected'
  private listeners: Array<(state: XmppState, event: XmppEvent) => void> = []
  private transitionLog: StateTransition[] = []

  constructor(initialState: XmppState = 'disconnected') {
    this.currentState = initialState
  }

  /**
   * Ritorna lo stato corrente
   */
  getState(): XmppState {
    return this.currentState
  }

  /**
   * Verifica se una transizione è valida
   */
  canTransition(event: XmppEvent): boolean {
    const possibleTransitions = VALID_TRANSITIONS[this.currentState]
    return possibleTransitions[event] !== undefined
  }

  /**
   * Esegue una transizione di stato
   * Ritorna true se la transizione è valida, false altrimenti
   */
  transition(event: XmppEvent): boolean {
    const possibleTransitions = VALID_TRANSITIONS[this.currentState]
    const nextState = possibleTransitions[event]

    if (!nextState) {
      console.warn(
        `[XmppStateMachine] Transizione non valida: ${this.currentState} -> ${event}`
      )
      return false
    }

    const prevState = this.currentState
    this.currentState = nextState

    // Log transizione
    this.transitionLog.push({
      from: prevState,
      to: nextState,
      event,
    })

    // Mantieni solo ultime 50 transizioni
    if (this.transitionLog.length > 50) {
      this.transitionLog.shift()
    }

    console.debug(
      `[XmppStateMachine] ${prevState} -> ${nextState} (${event})`
    )

    // Notifica listeners
    this.listeners.forEach((listener) => listener(nextState, event))

    return true
  }

  /**
   * Registra un listener per cambiamenti di stato
   */
  onStateChange(listener: (state: XmppState, event: XmppEvent) => void): () => void {
    this.listeners.push(listener)

    // Ritorna funzione per unsubscribe
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Ritorna il log delle transizioni
   */
  getTransitionLog(): StateTransition[] {
    return [...this.transitionLog]
  }

  /**
   * Reset della state machine
   */
  reset(): void {
    this.currentState = 'disconnected'
    this.transitionLog = []
  }

  /**
   * Helper: verifica se è connesso
   */
  isConnected(): boolean {
    return this.currentState === 'connected'
  }

  /**
   * Helper: verifica se sta connettendo
   */
  isConnecting(): boolean {
    return this.currentState === 'connecting' || this.currentState === 'authenticating'
  }

  /**
   * Helper: verifica se è in errore
   */
  isError(): boolean {
    return this.currentState === 'error'
  }

  /**
   * Helper: verifica se è disconnesso
   */
  isDisconnected(): boolean {
    return this.currentState === 'disconnected'
  }
}
