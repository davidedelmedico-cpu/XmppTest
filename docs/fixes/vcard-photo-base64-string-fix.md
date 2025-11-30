# Fix: vCard Photo deve essere BASE64 STRING, non Buffer

**Data:** 30 Novembre 2025  
**Tipo:** Bug Fix - Conversione dati errata  
**Gravità:** Alta  
**Status:** ✅ SOLUZIONE TROVATA E TESTATA

---

## 🎯 Executive Summary

**PROBLEMA IDENTIFICATO**: Il nostro client converte la stringa base64 dell'immagine in Buffer prima di inviarla al server XMPP, ma il server (o la libreria stanza) vuole la **stringa base64 direttamente**.

**SOLUZIONE**: Non convertire base64 a Buffer, passare la stringa base64 così com'è al campo `data` del photo record.

---

## 🔬 Analisi Test

### Test Eseguiti

#### ❌ Test 1: Buffer (FALLISCE)
```javascript
{
  type: 'photo',
  data: Buffer.from(base64, 'base64'), // ❌ TIMEOUT 10s+
  mediaType: 'image/png'
}
```
**Risultato**: Timeout dopo 10+ secondi

#### ❌ Test 2: Uint8Array (ERRORE)
```javascript
{
  type: 'photo',
  data: new Uint8Array(buffer), // ❌ Bad request
  mediaType: 'image/png'
}
```
**Risultato**: Errore XMPP "Bad value of cdata in tag <BINVAL/>"

#### ✅ Test 3: Base64 String (FUNZIONA!)
```javascript
{
  type: 'photo',
  data: base64String, // ✅ SUCCESSO in ~100ms
  mediaType: 'image/png'
}
```
**Risultato**: ✅ Salvato con successo in 103ms

### Conferma con Multipli Formati

| Formato | Tipo Data | Dimensione | Risultato | Tempo |
|---------|-----------|------------|-----------|-------|
| JPEG | Buffer | 162 bytes | ❌ Timeout | 10s+ |
| PNG | Buffer | 68 bytes | ❌ Timeout | 10s+ |
| GIF | Buffer | 43 bytes | ❌ Timeout | 10s+ |
| JPEG | base64 string | 216 chars | ✅ OK | 106ms |
| PNG | base64 string | 92 chars | ✅ OK | 103ms |

---

## 🐛 Causa del Bug

### Nel File: `web-client/src/services/vcard.ts`

```typescript:283:310:web-client/src/services/vcard.ts
// ❌ CODICE PROBLEMATICO (ATTUALE)
if (vcard.photoData && vcard.photoType) {
  console.log('Tentativo di conversione immagine profilo:', {
    photoType: vcard.photoType,
    photoDataLength: vcard.photoData.length,
    photoDataPreview: vcard.photoData.substring(0, 50) + '...'
  })
  
  // ❌ QUI È IL PROBLEMA: Convertiamo a Buffer
  const photoBuffer = base64ToBuffer(vcard.photoData)
  if (!photoBuffer) {
    console.error('Conversione base64 a buffer fallita per l\'immagine del profilo')
    throw new Error('Errore nella conversione dell\'immagine del profilo. Prova con un\'altra immagine.')
  }
  
  console.log('Immagine convertita con successo, dimensione:', photoBuffer.length, 'bytes')
  
  records.push({
    type: 'photo',
    data: photoBuffer as Buffer, // ❌ Buffer causa timeout!
    mediaType: vcard.photoType
  })
}
```

**Il problema**: La funzione `base64ToBuffer()` converte la stringa base64 in un Buffer, ma questo causa timeout quando inviato al server.

---

## ✅ Soluzione

### Fix nel File: `web-client/src/services/vcard.ts`

```typescript
// ✅ CODICE CORRETTO
if (vcard.photoData && vcard.photoType) {
  console.log('Aggiunta immagine profilo:', {
    photoType: vcard.photoType,
    photoDataLength: vcard.photoData.length,
    photoDataPreview: vcard.photoData.substring(0, 50) + '...'
  })
  
  // ✅ NESSUNA CONVERSIONE: Passa direttamente la stringa base64
  records.push({
    type: 'photo',
    data: vcard.photoData, // ✅ Stringa base64 diretta!
    mediaType: vcard.photoType
  })
}
```

**Cambio chiave**: 
- **PRIMA**: `data: photoBuffer as Buffer` → Timeout
- **DOPO**: `data: vcard.photoData` → Funziona!

### Rimozione Funzione Inutilizzata

La funzione `base64ToBuffer()` (righe 63-116) non serve più per il SALVATAGGIO delle foto. 

**ATTENZIONE**: Potrebbe ancora servire per la LETTURA delle foto se il server le restituisce come Buffer. Verificare prima di rimuovere completamente.

---

## 📊 Risultati Test Completi

### Test Script: `test-photo-formats.js`

```
🧪 TEST SISTEMATICO FORMATI FOTO
============================================================

TEST 1: JPEG buffer
   ❌ FALLITO dopo 10002ms - Timeout 10s

TEST 2: PNG buffer
   ❌ FALLITO dopo 10009ms - Timeout 10s

TEST 3: GIF buffer
   ❌ FALLITO dopo 10005ms - Timeout 10s

TEST 4: JPEG base64 string
   ✅ ✅ ✅ SUCCESSO in 106ms!

TEST 5: PNG Uint8Array
   ❌ FALLITO - Bad value of cdata in tag <BINVAL/>

SUCCESSI: 1/5
   ✅ JPEG base64 string (106ms)
```

### Test Script: `test-base64-string-solution.js`

```
TEST: PNG come BASE64 STRING
   ✅ ✅ ✅ SUCCESSO in 103ms!
   ✅ Foto presente nel vCard riletto
   MediaType: image/png
   Data type: string

TEST: JPEG come BASE64 STRING
   ✅ ✅ ✅ SUCCESSO in 103ms!
   ✅ Foto presente nel vCard riletto
   MediaType: image/jpeg
   Data type: string

RISULTATO FINALE:
   PNG come base64 string: ✅ FUNZIONA
   JPEG come base64 string: ✅ FUNZIONA
```

---

## 🔧 Implementazione Fix

### File da Modificare

1. **`/web-client/src/services/vcard.ts`** (linee 283-310)
   - Rimuovere chiamata a `base64ToBuffer()`
   - Passare `vcard.photoData` direttamente come stringa

### Gestione Lettura vCard

Quando LEGGIAMO un vCard dal server:
```typescript
// In fetchVCardFromServer(), il server potrebbe restituire:
// - Stringa base64 (se salvata da noi)
// - Buffer (se salvata da altri client)

let photoData: string | undefined
if (photoRecord?.data) {
  if (typeof photoRecord.data === 'string') {
    // ✅ È già base64, usala direttamente
    photoData = photoRecord.data
  } else {
    // ✅ È un Buffer/Uint8Array, converti a base64
    photoData = bufferToBase64(photoRecord.data as Buffer | Uint8Array | ArrayBuffer)
  }
}
```

**IMPORTANTE**: La funzione `bufferToBase64()` serve ancora per leggere foto salvate da altri client!

---

## ⚠️ Note Tecniche

### Perché Buffer Non Funziona?

Possibili ragioni:

1. **Libreria stanza.io**: La libreria potrebbe serializzare Buffer in modo non compatibile con il formato XML vCard-temp
   
2. **Formato XML vCard**: Lo standard XEP-0054 specifica che il tag `<BINVAL>` deve contenere dati base64 come testo, non binari

3. **Serializzazione WebSocket**: Il Buffer potrebbe essere serializzato in modo incompatibile quando inviato via WebSocket

4. **Timeout vs Errore**: 
   - Buffer → Timeout (il server non risponde)
   - Uint8Array → Errore immediato (formato non valido)
   - String → Successo (formato corretto)

### Standard XEP-0054 (vCard-temp)

Dal documento XEP-0054:
```xml
<PHOTO>
  <TYPE>image/jpeg</TYPE>
  <BINVAL>
    <!-- Base64 encoded binary data -->
  </BINVAL>
</PHOTO>
```

Il contenuto di `<BINVAL>` deve essere **testo base64**, non dati binari.

---

## ✅ Checklist Implementazione

- [x] ✅ Identificato problema (conversione Buffer)
- [x] ✅ Testata soluzione (base64 string)
- [x] ✅ Confermata con multipli formati (PNG, JPEG)
- [x] ✅ Documentato fix
- [ ] ⏳ Modificare `vcard.ts` - `publishVCard()`
- [ ] ⏳ Verificare `fetchVCardFromServer()` (lettura)
- [ ] ⏳ Testare nel client web
- [ ] ⏳ Testare su entrambi account (testarda, testardo)
- [ ] ⏳ Verificare che altri campi funzionino ancora

---

## 🧪 Piano Test Post-Fix

### Test Funzionali

1. **Salvataggio foto PNG**
   - Seleziona immagine PNG
   - Verifica compressione
   - Salva profilo
   - ✅ Deve completare in <1s

2. **Salvataggio foto JPEG**
   - Seleziona immagine JPEG
   - Verifica compressione
   - Salva profilo
   - ✅ Deve completare in <1s

3. **Salvataggio senza foto**
   - Solo nome/descrizione
   - ✅ Deve funzionare come prima

4. **Lettura foto esistenti**
   - Ricarica pagina
   - ✅ Foto deve apparire
   - ✅ Altri campi devono apparire

5. **Modifica foto**
   - Cambia foto esistente
   - ✅ Deve aggiornare

6. **Rimozione foto**
   - Click "Rimuovi foto"
   - ✅ Deve rimuovere dal server

---

## 📁 File Script Test

Test script creati durante l'analisi:

- `/web-client/test-vcard-publish.js` - Test base pubblicazione
- `/web-client/test-vcard-photo-debug.js` - Debug foto
- `/web-client/test-both-accounts-photo.js` - Test comparativo
- `/web-client/test-photo-formats.js` - Test formati sistematico ✅
- `/web-client/test-base64-string-solution.js` - Conferma soluzione ✅

I file con ✅ confermano la soluzione trovata.

---

## 🎓 Lezioni Apprese

1. **Non assumere il formato dati**: Anche se altri client usano foto, non significa che possiamo inviare qualsiasi formato

2. **Test incrementali**: Testare prima in script standalone, poi modificare il client

3. **Logging dettagliato**: I log hanno permesso di vedere che base64 string funziona

4. **Standard XMPP**: Leggere attentamente le specifiche XEP (in questo caso XEP-0054)

5. **Timeout vs Errore**: Un timeout può indicare serializzazione problematica, non sempre problemi di rete

---

## 🔗 Riferimenti

- **XEP-0054**: vcard-temp - https://xmpp.org/extensions/xep-0054.html
- **Stanza.io docs**: https://stanzajs.org
- **Account test**: testarda@conversations.im, testardo@conversations.im
- **Branch**: `cursor/test-server-for-profile-save-issue-claude-4.5-sonnet-thinking-6fd4`

---

**Status**: ✅ SOLUZIONE TROVATA - Pronto per implementazione  
**Prossimo Step**: Modificare `vcard.ts` per usare base64 string  
**Ultimo aggiornamento**: 2025-11-30
