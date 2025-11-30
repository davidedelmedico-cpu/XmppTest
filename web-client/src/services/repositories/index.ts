/**
 * Repository Layer
 * 
 * Separazione tra data access e business logic.
 * Ogni repository garantisce:
 * - Transazioni atomiche
 * - Gestione errori centralizzata
 * - De-duplicazione automatica
 * - Retry logic (futuro)
 */

export { ConversationRepository } from './ConversationRepository'
export { MessageRepository } from './MessageRepository'
export { VCardRepository } from './VCardRepository'
export { MetadataRepository } from './MetadataRepository'
export type { SyncMetadata } from './MetadataRepository'
