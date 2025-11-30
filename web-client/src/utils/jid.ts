/**
 * Utility functions per la gestione e normalizzazione dei JID (Jabber Identifiers)
 * 
 * Un JID ha il formato: [local@]domain[/resource]
 * Esempio: user@example.com/resource
 */

/**
 * Normalizza un JID rimuovendo la resource e convertendo in lowercase
 * 
 * @param jid - Il JID da normalizzare
 * @returns Il JID normalizzato (bare JID)
 * 
 * @example
 * ```ts
 * normalizeJid('User@Example.com/Resource') // 'user@example.com'
 * normalizeJid('user@example.com') // 'user@example.com'
 * ```
 */
export function normalizeJid(jid: string): string {
  return jid.split('/')[0].toLowerCase()
}

/**
 * Estrae le componenti di un JID
 * 
 * @param jid - Il JID da parsare
 * @returns Oggetto con username, domain e resource opzionale
 * 
 * @example
 * ```ts
 * parseJid('user@example.com/resource')
 * // { username: 'user', domain: 'example.com', resource: 'resource' }
 * ```
 */
export function parseJid(jid: string): {
  username: string
  domain: string
  resource?: string
} {
  const trimmed = jid.trim()
  
  // Rimuovi resource se presente
  const [jidWithoutResource, resource] = trimmed.split('/')
  
  // Separa local part e domain
  const parts = jidWithoutResource.split('@')
  
  if (parts.length === 1) {
    // Solo domain (senza local part)
    return { username: '', domain: parts[0].toLowerCase(), resource }
  }
  
  const [username, domain] = parts
  return {
    username: username || '',
    domain: domain.toLowerCase(),
    resource: resource || undefined,
  }
}

/**
 * Verifica se un JID è valido
 * 
 * @param jid - Il JID da validare
 * @returns true se il JID è valido, false altrimenti
 */
export function isValidJid(jid: string): boolean {
  if (!jid || typeof jid !== 'string') {
    return false
  }
  
  const trimmed = jid.trim()
  if (!trimmed) {
    return false
  }
  
  // Deve contenere almeno un @ per essere valido (o essere solo un domain)
  const parts = trimmed.split('@')
  if (parts.length > 2) {
    return false // Troppi @
  }
  
  if (parts.length === 2) {
    const [local, domainPart] = parts
    if (!local || local.length === 0) {
      return false
    }
    if (local.length > 1023) {
      return false // Troppo lungo
    }
    
    const [domain] = domainPart.split('/')
    if (!domain || domain.length === 0) {
      return false
    }
    if (domain.length > 1023) {
      return false // Troppo lungo
    }
  }
  
  return true
}

/**
 * Estrae il bare JID (senza resource) da un JID completo
 * 
 * @param jid - Il JID completo
 * @returns Il bare JID
 */
export function getBareJid(jid: string): string {
  return normalizeJid(jid)
}

/**
 * Estrae la resource da un JID completo
 * 
 * @param jid - Il JID completo
 * @returns La resource o undefined se non presente
 */
export function getResource(jid: string): string | undefined {
  const parts = jid.split('/')
  return parts.length > 1 ? parts[1] : undefined
}
