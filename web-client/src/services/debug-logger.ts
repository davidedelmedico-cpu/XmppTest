/**
 * Debug Logger Service
 * Intercetta tutti i console.log e li raccoglie per la visualizzazione nel debug popup
 */

export interface LogEntry {
  timestamp: Date
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  message: string
  args: any[]
}

class DebugLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // Limite massimo di log da tenere in memoria
  private listeners: Set<(logs: LogEntry[]) => void> = new Set()
  private originalConsole: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
    debug: typeof console.debug
  }

  constructor() {
    // Salva i metodi originali di console
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    }
  }

  /**
   * Inizializza l'intercettazione dei console log
   */
  initialize() {
    this.interceptConsole('log')
    this.interceptConsole('info')
    this.interceptConsole('warn')
    this.interceptConsole('error')
    this.interceptConsole('debug')
  }

  /**
   * Intercetta un metodo specifico di console
   */
  private interceptConsole(level: 'log' | 'info' | 'warn' | 'error' | 'debug') {
    const original = this.originalConsole[level]
    
    console[level] = (...args: any[]) => {
      // Chiama il console originale
      original(...args)
      
      // Aggiungi il log alla collezione
      this.addLog(level, args)
    }
  }

  /**
   * Aggiunge un log entry alla collezione
   */
  private addLog(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: any[]) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: this.formatMessage(args),
      args
    }

    this.logs.push(entry)

    // Mantieni solo gli ultimi maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Notifica i listener
    this.notifyListeners()
  }

  /**
   * Formatta il messaggio dai parametri
   */
  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
  }

  /**
   * Ottiene tutti i log raccolti
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Pulisce tutti i log
   */
  clearLogs() {
    this.logs = []
    this.notifyListeners()
  }

  /**
   * Aggiungi un listener per i cambiamenti nei log
   */
  addListener(callback: (logs: LogEntry[]) => void) {
    this.listeners.add(callback)
  }

  /**
   * Rimuove un listener
   */
  removeListener(callback: (logs: LogEntry[]) => void) {
    this.listeners.delete(callback)
  }

  /**
   * Notifica tutti i listener
   */
  private notifyListeners() {
    const logs = this.getLogs()
    this.listeners.forEach(listener => listener(logs))
  }

  /**
   * Esporta i log come testo
   */
  exportLogsAsText(): string {
    return this.logs.map(log => {
      const time = log.timestamp.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      })
      return `[${time}] [${log.level.toUpperCase()}] ${log.message}`
    }).join('\n')
  }

  /**
   * Esporta i log come JSON
   */
  exportLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// Crea l'istanza singleton
export const debugLogger = new DebugLogger()
