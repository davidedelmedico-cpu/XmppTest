#!/usr/bin/env node

/**
 * Test di DEBUG specifico per il problema delle FOTO nel vCard
 * Testa diversi formati e dimensioni per capire cosa accetta il server
 */

import { createClient } from 'stanza';

const TEST_ACCOUNT = {
  jid: 'testarda@conversations.im',
  password: 'FyqnD2YpGScNsuC'
};

console.log('🐛 DEBUG: Test salvataggio FOTO nel vCard');
console.log('=' .repeat(60));

// Test 1: Leggi la foto esistente e analizzala
async function analyzeExistingPhoto() {
  console.log('\n📸 TEST 1: Analizza foto esistente sul server');
  console.log('-'.repeat(60));
  
  const client = createClient({
    jid: TEST_ACCOUNT.jid,
    password: TEST_ACCOUNT.password,
    transports: {
      websocket: 'wss://xmpp.conversations.im:443/websocket',
      bosh: false
    },
    timeout: 30
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Timeout connessione');
      client.disconnect();
      resolve(null);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        const vcard = await client.getVCard(TEST_ACCOUNT.jid.split('/')[0]);
        
        if (vcard?.records) {
          const photoRecord = vcard.records.find(r => r.type === 'photo');
          
          if (photoRecord) {
            console.log('\n✅ Foto trovata sul server!');
            console.log('   mediaType:', photoRecord.mediaType);
            console.log('   data type:', typeof photoRecord.data);
            console.log('   data constructor:', photoRecord.data?.constructor?.name);
            console.log('   data length:', photoRecord.data?.length, 'bytes');
            
            // Controlla se è Buffer o Uint8Array
            if (Buffer.isBuffer(photoRecord.data)) {
              console.log('   ✅ È un Buffer Node.js');
              const base64 = photoRecord.data.toString('base64');
              console.log('   Base64 length:', base64.length);
              console.log('   Base64 preview:', base64.substring(0, 100) + '...');
              
              // Salva la foto originale per confronto
              client.disconnect();
              resolve({
                mediaType: photoRecord.mediaType,
                buffer: photoRecord.data,
                base64: base64
              });
            } else if (photoRecord.data instanceof Uint8Array) {
              console.log('   ✅ È un Uint8Array');
              const buffer = Buffer.from(photoRecord.data);
              const base64 = buffer.toString('base64');
              console.log('   Base64 length:', base64.length);
              
              client.disconnect();
              resolve({
                mediaType: photoRecord.mediaType,
                buffer: buffer,
                base64: base64
              });
            } else {
              console.log('   ⚠️  Tipo di data non riconosciuto');
              client.disconnect();
              resolve(null);
            }
          } else {
            console.log('   ℹ️  Nessuna foto trovata');
            client.disconnect();
            resolve(null);
          }
        } else {
          console.log('   ℹ️  Nessun vCard trovato');
          client.disconnect();
          resolve(null);
        }
      } catch (error) {
        console.error('❌ Errore:', error.message);
        client.disconnect();
        resolve(null);
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve(null);
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

// Test 2: Prova a ripubblicare la STESSA foto che c'è già sul server
async function republishExistingPhoto(existingPhoto) {
  console.log('\n📤 TEST 2: Ripubblica la STESSA foto che c\'è già sul server');
  console.log('-'.repeat(60));
  console.log('   Questo dovrebbe funzionare al 100% perché è la foto che il server ha già.');
  
  const client = createClient({
    jid: TEST_ACCOUNT.jid,
    password: TEST_ACCOUNT.password,
    transports: {
      websocket: 'wss://xmpp.conversations.im:443/websocket',
      bosh: false
    },
    timeout: 30
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Timeout connessione');
      client.disconnect();
      resolve(false);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        const vcard = {
          fullName: 'Test Arda - Ripubblico foto esistente',
          records: [
            {
              type: 'photo',
              data: existingPhoto.buffer,
              mediaType: existingPhoto.mediaType
            },
            {
              type: 'description',
              value: 'Test: ripubblicazione foto esistente'
            }
          ]
        };

        console.log('\n⏳ Pubblicazione in corso...');
        console.log('   mediaType:', existingPhoto.mediaType);
        console.log('   buffer length:', existingPhoto.buffer.length);
        
        const startTime = Date.now();
        await client.publishVCard(vcard);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ ✅ ✅ SUCCESSO in ${duration}ms!`);
        console.log('   La foto esistente può essere ripubblicata.');
        
        client.disconnect();
        resolve(true);
        
      } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        if (error.error) {
          console.error('   Condition:', error.error.condition);
          console.error('   Type:', error.error.type);
        }
        client.disconnect();
        resolve(false);
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve(false);
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

// Test 3: Salva vCard SENZA foto (per ripulire)
async function saveWithoutPhoto() {
  console.log('\n🧹 TEST 3: Salva vCard SENZA foto');
  console.log('-'.repeat(60));
  
  const client = createClient({
    jid: TEST_ACCOUNT.jid,
    password: TEST_ACCOUNT.password,
    transports: {
      websocket: 'wss://xmpp.conversations.im:443/websocket',
      bosh: false
    },
    timeout: 30
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Timeout');
      client.disconnect();
      resolve(false);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        const vcard = {
          fullName: 'Test Arda',
          records: [
            {
              type: 'description',
              value: 'Test: vCard senza foto'
            }
          ]
        };

        console.log('\n⏳ Rimozione foto dal vCard...');
        await client.publishVCard(vcard);
        console.log('✅ SUCCESSO! Foto rimossa.');
        
        client.disconnect();
        resolve(true);
        
      } catch (error) {
        console.error('❌ Errore:', error.message);
        client.disconnect();
        resolve(false);
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve(false);
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

// Test 4: Salva con foto minuscola
async function saveWithTinyPhoto() {
  console.log('\n🖼️  TEST 4: Salva con foto MOLTO piccola (1x1 PNG trasparente)');
  console.log('-'.repeat(60));
  
  // PNG 1x1 trasparente più piccolo possibile
  const tinyPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
    0x54, 0x08, 0x5B, 0x63, 0x60, 0x00, 0x02, 0x00,
    0x00, 0x05, 0x00, 0x01, 0xE2, 0x26, 0x05, 0x9B,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ]);
  
  console.log('   Dimensione:', tinyPng.length, 'bytes');
  
  const client = createClient({
    jid: TEST_ACCOUNT.jid,
    password: TEST_ACCOUNT.password,
    transports: {
      websocket: 'wss://xmpp.conversations.im:443/websocket',
      bosh: false
    },
    timeout: 30
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Timeout dopo 30s');
      client.disconnect();
      resolve(false);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        const vcard = {
          fullName: 'Test Arda con foto tiny',
          records: [
            {
              type: 'photo',
              data: tinyPng,
              mediaType: 'image/png'
            },
            {
              type: 'description',
              value: 'Test: foto 1x1 PNG'
            }
          ]
        };

        console.log('\n⏳ Pubblicazione con timeout esteso (20s)...');
        const startTime = Date.now();
        
        // Aggiungi un timeout manuale
        const publishPromise = client.publishVCard(vcard);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Manual timeout dopo 20s')), 20000)
        );
        
        await Promise.race([publishPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`\n✅ ✅ ✅ SUCCESSO in ${duration}ms!`);
        console.log('   Il server accetta foto PNG piccole.');
        
        client.disconnect();
        resolve(true);
        
      } catch (error) {
        const duration = Date.now() - Date.now();
        console.error(`\n❌ ERRORE dopo ${duration}ms:`, error.message);
        if (error.error) {
          console.error('   Condition:', error.error.condition);
          console.error('   Type:', error.error.type);
        }
        client.disconnect();
        resolve(false);
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve(false);
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

// Main
async function main() {
  try {
    // Test 1: Analizza foto esistente
    const existingPhoto = await analyzeExistingPhoto();
    await new Promise(r => setTimeout(r, 2000));
    
    if (existingPhoto) {
      // Test 2: Ripubblica la stessa foto
      const result2 = await republishExistingPhoto(existingPhoto);
      await new Promise(r => setTimeout(r, 2000));
      
      if (result2) {
        console.log('\n✅ La foto esistente può essere ripubblicata!');
      } else {
        console.log('\n❌ Anche ripubblicare la foto esistente fallisce!');
      }
    }
    
    // Test 3: Rimuovi foto
    const result3 = await saveWithoutPhoto();
    await new Promise(r => setTimeout(r, 2000));
    
    if (result3) {
      // Test 4: Aggiungi foto nuova piccola
      const result4 = await saveWithTinyPhoto();
      
      if (result4) {
        console.log('\n\n' + '='.repeat(60));
        console.log('✅ CONCLUSIONE: Il server ACCETTA foto nuove!');
        console.log('   Il problema nel client web potrebbe essere:');
        console.log('   - Formato della foto inviata dal browser');
        console.log('   - Conversione base64 -> Buffer nel browser');
        console.log('   - Timeout troppo breve nel client');
        console.log('='.repeat(60));
      } else {
        console.log('\n\n' + '='.repeat(60));
        console.log('❌ CONCLUSIONE: Il server ha problemi con foto NUOVE');
        console.log('   Ma può ripubblicare quelle esistenti.');
        console.log('   Possibili cause:');
        console.log('   - Limitazioni account testarda');
        console.log('   - Problemi di rate limiting');
        console.log('   - Bug nel server XMPP');
        console.log('='.repeat(60));
      }
    }
    
    process.exit(0);
    
  } catch (err) {
    console.error('\n💥 Errore fatale:', err);
    process.exit(1);
  }
}

main();
