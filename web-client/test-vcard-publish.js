#!/usr/bin/env node

/**
 * Script di test per verificare il SALVATAGGIO dei vCard su server XMPP
 * Testa se il server accetta modifiche al profilo dall'account testarda
 * 
 * Questo script testa direttamente il server per isolare il problema:
 * - Se funziona: il problema è nel client web
 * - Se NON funziona: il problema è sul server XMPP
 */

import { createClient } from 'stanza';

const TEST_ACCOUNT = {
  jid: 'testarda@conversations.im',
  password: 'FyqnD2YpGScNsuC'
};

const TEST_VCARD_DATA = {
  fullName: 'Test Arda',
  nickname: 'testarda',
  email: 'testarda@test.com',
  description: 'Account di test - vCard modificato da script automatico'
};

console.log('🧪 TEST SALVATAGGIO VCARD SUL SERVER XMPP');
console.log('=' .repeat(60));
console.log('Account:', TEST_ACCOUNT.jid);
console.log('Obiettivo: Verificare se il server accetta modifiche al vCard');
console.log('=' .repeat(60));

async function testPublishVCard() {
  console.log('\n🔄 Fase 1: Connessione al server...');
  
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
    const connectionTimeout = setTimeout(() => {
      console.error('❌ TIMEOUT: Impossibile connettersi al server entro 30 secondi');
      client.disconnect();
      resolve({ success: false, error: 'Connection timeout' });
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(connectionTimeout);
      console.log('✅ Connessione riuscita');
      console.log('   JID completo:', client.jid);

      try {
        // FASE 2: Leggi vCard corrente
        console.log('\n📖 Fase 2: Lettura vCard corrente dal server...');
        let currentVCard;
        try {
          currentVCard = await client.getVCard(TEST_ACCOUNT.jid.split('/')[0]);
          console.log('✅ vCard corrente letto con successo');
          console.log('   fullName:', currentVCard?.fullName || '(vuoto)');
          console.log('   records:', currentVCard?.records?.length || 0);
          
          if (currentVCard?.records) {
            currentVCard.records.forEach(record => {
              if (record.type === 'nickname') {
                console.log('   nickname:', record.value);
              } else if (record.type === 'email') {
                console.log('   email:', record.value);
              } else if (record.type === 'description') {
                console.log('   description:', record.value);
              } else if (record.type === 'photo') {
                console.log('   foto: SI (', record.data?.length || 0, 'bytes)');
              }
            });
          }
        } catch (err) {
          console.warn('⚠️  Impossibile leggere vCard corrente:', err.message);
          console.log('   (Questo è OK se il vCard non esiste ancora)');
        }

        // FASE 3: Pubblica nuovo vCard (SENZA foto per semplicità)
        console.log('\n📝 Fase 3: Tentativo di pubblicazione NUOVO vCard...');
        console.log('   Dati da salvare:');
        console.log('   - fullName:', TEST_VCARD_DATA.fullName);
        console.log('   - nickname:', TEST_VCARD_DATA.nickname);
        console.log('   - email:', TEST_VCARD_DATA.email);
        console.log('   - description:', TEST_VCARD_DATA.description);
        console.log('   - foto: NO (test senza immagine)');
        
        const newVCard = {
          fullName: TEST_VCARD_DATA.fullName,
          records: [
            {
              type: 'nickname',
              value: TEST_VCARD_DATA.nickname
            },
            {
              type: 'email',
              value: TEST_VCARD_DATA.email
            },
            {
              type: 'description',
              value: TEST_VCARD_DATA.description
            }
          ]
        };

        const publishStartTime = Date.now();
        
        try {
          console.log('\n   ⏳ Invio richiesta publishVCard al server...');
          await client.publishVCard(newVCard);
          const publishDuration = Date.now() - publishStartTime;
          
          console.log(`\n✅ ✅ ✅ SUCCESSO! vCard pubblicato in ${publishDuration}ms`);
          console.log('   Il SERVER ha ACCETTATO le modifiche!');
          
          // FASE 4: Verifica che sia stato salvato
          console.log('\n🔍 Fase 4: Verifica che il vCard sia stato salvato...');
          await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi 1s
          
          const verifyVCard = await client.getVCard(TEST_ACCOUNT.jid.split('/')[0]);
          console.log('\n📋 vCard riletto dal server:');
          console.log('   fullName:', verifyVCard?.fullName);
          
          if (verifyVCard?.records) {
            verifyVCard.records.forEach(record => {
              if (record.type === 'nickname') {
                console.log('   nickname:', record.value);
              } else if (record.type === 'email') {
                console.log('   email:', record.value);
              } else if (record.type === 'description') {
                console.log('   description:', record.value);
              }
            });
          }
          
          // Verifica che i dati corrispondano
          const isMatch = verifyVCard?.fullName === TEST_VCARD_DATA.fullName;
          if (isMatch) {
            console.log('\n✅ ✅ ✅ VERIFICA COMPLETATA: I dati sono stati salvati correttamente!');
            console.log('\n' + '='.repeat(60));
            console.log('🎉 CONCLUSIONE: Il SERVER funziona correttamente!');
            console.log('   Il problema è probabilmente nel CLIENT WEB.');
            console.log('='.repeat(60));
          } else {
            console.log('\n⚠️  I dati non corrispondono perfettamente.');
            console.log('   Atteso:', TEST_VCARD_DATA.fullName);
            console.log('   Ricevuto:', verifyVCard?.fullName);
          }
          
          client.disconnect();
          resolve({ success: true });
          
        } catch (publishError) {
          const publishDuration = Date.now() - publishStartTime;
          console.error(`\n❌ ❌ ❌ ERRORE nel publishVCard dopo ${publishDuration}ms`);
          console.error('\nDettagli errore:');
          console.error('   Messaggio:', publishError.message);
          console.error('   Tipo:', publishError.constructor.name);
          
          if (publishError.error) {
            console.error('   Errore XMPP:', publishError.error);
            console.error('   Condition:', publishError.error.condition);
            console.error('   Type:', publishError.error.type);
            console.error('   Text:', publishError.error.text);
          }
          
          console.error('\nStack trace completo:');
          console.error(publishError.stack);
          
          console.log('\n' + '='.repeat(60));
          console.log('❌ CONCLUSIONE: Il SERVER ha un problema!');
          console.log('   Possibili cause:');
          console.log('   - Server non supporta vCard-temp (XEP-0054)');
          console.log('   - Permessi insufficienti sull\'account');
          console.log('   - Configurazione server restrittiva');
          console.log('   - Account bloccato o limitato');
          console.log('='.repeat(60));
          
          client.disconnect();
          resolve({ success: false, error: publishError });
        }

      } catch (error) {
        console.error('\n❌ Errore durante i test:', error);
        console.error('Stack:', error.stack);
        client.disconnect();
        resolve({ success: false, error });
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(connectionTimeout);
      console.error('❌ AUTENTICAZIONE FALLITA');
      console.error('   Le credenziali potrebbero essere errate o scadute');
      client.disconnect();
      resolve({ success: false, error: 'Authentication failed' });
    });

    client.on('stream:error', (error) => {
      console.error('❌ Errore stream XMPP:', error);
      client.disconnect();
      resolve({ success: false, error });
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso dal server');
    });

    console.log('   Connessione a: wss://xmpp.conversations.im:443/websocket');
    client.connect();
  });
}

// TEST CON FOTO (opzionale, solo se test base passa)
async function testPublishVCardWithPhoto() {
  console.log('\n\n' + '='.repeat(60));
  console.log('🧪 TEST AGGIUNTIVO: Salvataggio con FOTO');
  console.log('='.repeat(60));
  
  // Crea una piccola immagine PNG 1x1 pixel (più piccola possibile)
  // PNG header + IDAT + IEND
  const tinyPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0x5B, 0x63, 0x60, 0x00, 0x02, 0x00,
    0x00, 0x05, 0x00, 0x01, 0xE2, 0x26, 0x05, 0x9B,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
    0xAE, 0x42, 0x60, 0x82
  ]);

  console.log('   Dimensione immagine test:', tinyPng.length, 'bytes');
  console.log('   Base64 length:', tinyPng.toString('base64').length);
  
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
      resolve({ success: false });
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        const vcardWithPhoto = {
          fullName: 'Test Arda (con foto)',
          records: [
            {
              type: 'photo',
              data: tinyPng,
              mediaType: 'image/png'
            },
            {
              type: 'description',
              value: 'Test con foto minuscola (1x1 pixel PNG)'
            }
          ]
        };

        console.log('\n⏳ Pubblicazione vCard con foto...');
        await client.publishVCard(vcardWithPhoto);
        console.log('✅ ✅ ✅ SUCCESSO! vCard con foto pubblicato!');
        console.log('   Il server accetta anche le foto.');
        
        client.disconnect();
        resolve({ success: true });
        
      } catch (error) {
        console.error('❌ Errore pubblicazione con foto:', error.message);
        if (error.error) {
          console.error('   Condition:', error.error.condition);
        }
        client.disconnect();
        resolve({ success: false, error });
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve({ success: false });
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

// Main execution
async function main() {
  try {
    // Test 1: Salvataggio base (senza foto)
    const result1 = await testPublishVCard();
    
    if (result1.success) {
      // Se il test base passa, prova anche con la foto
      console.log('\n⏳ Attendere 3 secondi prima del test con foto...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result2 = await testPublishVCardWithPhoto();
      
      if (result2.success) {
        console.log('\n\n' + '🎉'.repeat(30));
        console.log('✅ TUTTI I TEST PASSATI!');
        console.log('   Il server XMPP funziona perfettamente.');
        console.log('   Il problema è SICURAMENTE nel client web.');
        console.log('🎉'.repeat(30));
      } else {
        console.log('\n\n⚠️  Test base OK, ma test con foto FALLITO');
        console.log('   Il server accetta vCard ma potrebbe avere problemi con le foto.');
      }
    } else {
      console.log('\n\n❌ Test base FALLITO');
      console.log('   Non ha senso testare con foto se il test base non passa.');
    }
    
    process.exit(result1.success ? 0 : 1);
    
  } catch (err) {
    console.error('\n💥 Errore fatale:', err);
    process.exit(1);
  }
}

main();
