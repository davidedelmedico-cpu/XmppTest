/**
 * Servizio per gestire la persistenza delle credenziali durante la sessione del browser.
 * Usa sessionStorage per salvare temporaneamente JID e password.
 * Le credenziali vengono cancellate quando si chiude la tab/browser.
 */

const STORAGE_KEY_JID = 'xmpp_jid'
const STORAGE_KEY_PASSWORD = 'xmpp_password'

export interface SavedCredentials {
  jid: string
  password: string
}

/**
 * Salva le credenziali in sessionStorage
 */
export function saveCredentials(jid: string, password: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_JID, jid)
    sessionStorage.setItem(STORAGE_KEY_PASSWORD, password)
  } catch (error) {
    console.error('Errore nel salvataggio delle credenziali:', error)
  }
}

/**
 * Carica le credenziali salvate da sessionStorage
 */
export function loadCredentials(): SavedCredentials | null {
  try {
    const jid = sessionStorage.getItem(STORAGE_KEY_JID)
    const password = sessionStorage.getItem(STORAGE_KEY_PASSWORD)
    
    if (jid && password) {
      return { jid, password }
    }
    return null
  } catch (error) {
    console.error('Errore nel caricamento delle credenziali:', error)
    return null
  }
}

/**
 * Cancella le credenziali salvate
 */
export function clearCredentials(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_JID)
    sessionStorage.removeItem(STORAGE_KEY_PASSWORD)
  } catch (error) {
    console.error('Errore nella cancellazione delle credenziali:', error)
  }
}

/**
 * Verifica se ci sono credenziali salvate
 */
export function hasSavedCredentials(): boolean {
  try {
    const jid = sessionStorage.getItem(STORAGE_KEY_JID)
    const password = sessionStorage.getItem(STORAGE_KEY_PASSWORD)
    return !!(jid && password)
  } catch (error) {
    console.error('Errore nella verifica delle credenziali:', error)
    return false
  }
}
