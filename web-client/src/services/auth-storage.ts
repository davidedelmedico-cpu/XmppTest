/**
 * Servizio per gestire la persistenza delle credenziali durante la sessione del browser.
 * Usa sessionStorage per salvare temporaneamente JID e password.
 * Le credenziali vengono cancellate quando si chiude la tab/browser.
 * 
 * NOTA SICUREZZA: Le credenziali sono salvate in sessionStorage, che viene cancellato
 * alla chiusura della tab/browser. Questo è un compromesso tra sicurezza e UX.
 * Per maggiore sicurezza, considerare l'uso di un sistema di autenticazione più robusto.
 */

import { STORAGE_KEYS } from '../config/constants'

const STORAGE_KEY_JID = STORAGE_KEYS.JID
const STORAGE_KEY_PASSWORD = STORAGE_KEYS.PASSWORD

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
