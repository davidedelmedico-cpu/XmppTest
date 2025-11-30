# Architettura Database Locale

## Scelta di Design

**Il database locale è SOLO una sincronizzazione dal server XMPP.**

Questa è una scelta architetturale fondamentale dell'applicazione Alfred.

## Principi Fondamentali

1. **Il database locale NON è la fonte di verità**
   - Il server XMPP è l'unica fonte di verità
   - Il database locale è solo una cache/sincronizzazione per performance

2. **Direzione della sincronizzazione**
   - Il database locale si sincronizza **DAL server**, NON il contrario
   - Tutte le modifiche devono essere fatte tramite il server XMPP
   - Il database locale viene aggiornato solo quando arrivano dati dal server

3. **NON modificare mai direttamente il database locale**
   - Non aggiungere dati senza sincronizzarli dal server
   - Non rimuovere dati senza rimuoverli dal server
   - Non modificare dati senza modificare prima il server

## Cosa Fare ✅

- ✅ Leggere dal database locale (per performance)
- ✅ Sincronizzare dal server al database locale
- ✅ Aggiornare il database locale quando arrivano dati dal server
- ✅ Modificare i dati tramite il server XMPP, poi sincronizzare

## Cosa NON Fare ❌

- ❌ Modificare direttamente il database locale
- ❌ Rimuovere dati dal database locale senza rimuoverli dal server
- ❌ Aggiungere dati al database locale senza sincronizzarli dal server
- ❌ Considerare il database locale come fonte di verità

## Esempi

### ❌ Esempio Sbagliato

```typescript
// SBAGLIATO - Non fare mai così
await removeConversation(jid) // Rimuove solo dal DB locale
```

### ✅ Esempio Corretto

```typescript
// CORRETTO - Modificare tramite server, poi sincronizzare
await client.removeFromServer(jid) // Rimuove dal server
await syncFromServer() // Sincronizza il DB locale dal server
```

## Motivazione

Questa scelta architetturale garantisce:

1. **Coerenza dei dati**: Il server XMPP è l'unica fonte di verità
2. **Sincronizzazione multi-device**: Tutti i dispositivi sincronizzano dallo stesso server
3. **Affidabilità**: I dati locali possono essere ricostruiti sempre dal server
4. **Performance**: Il database locale permette accesso veloce ai dati senza query al server

## Vedere Anche

- [Sistema di Sincronizzazione Completo](../implementation/sync-system-complete.md) - Implementazione dettagliata
- [Architettura](../architecture/README.md) - Altri documenti architetturali
