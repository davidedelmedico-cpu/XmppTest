#!/usr/bin/env node

/**
 * TEST SISTEMATICO: Prova TUTTI i formati e approcci possibili
 * per capire COME salvare correttamente una foto nel vCard
 */

import { createClient } from 'stanza';

const TEST_ACCOUNT = {
  jid: 'testarda@conversations.im',
  password: 'FyqnD2YpGScNsuC'
};

console.log('🧪 TEST SISTEMATICO FORMATI FOTO');
console.log('=' .repeat(60));
console.log('Obiettivo: Trovare IL modo corretto per salvare foto');
console.log('=' .repeat(60));

// Test diversi formati di immagine

// 1. JPEG minimo (1x1 pixel)
const TINY_JPEG = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B,
  0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11,
  0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF,
  0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00,
  0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F,
  0xFF, 0xD9
]);

// 2. PNG minimo (1x1 pixel trasparente)
const TINY_PNG = Buffer.from([
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

// 3. GIF minimo (1x1 pixel)
const TINY_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
  0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3B
]);

const TEST_CASES = [
  {
    name: 'JPEG buffer',
    data: TINY_JPEG,
    mediaType: 'image/jpeg'
  },
  {
    name: 'PNG buffer',
    data: TINY_PNG,
    mediaType: 'image/png'
  },
  {
    name: 'GIF buffer',
    data: TINY_GIF,
    mediaType: 'image/gif'
  },
  {
    name: 'JPEG base64 string',
    data: TINY_JPEG.toString('base64'),
    mediaType: 'image/jpeg'
  },
  {
    name: 'PNG Uint8Array',
    data: new Uint8Array(TINY_PNG),
    mediaType: 'image/png'
  }
];

async function testPhotoFormat(testCase, testNumber) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST ${testNumber}: ${testCase.name}`);
  console.log('='.repeat(60));
  console.log('   Tipo dati:', typeof testCase.data);
  console.log('   Constructor:', testCase.data?.constructor?.name);
  console.log('   MediaType:', testCase.mediaType);
  console.log('   Dimensione:', testCase.data.length, 'bytes');
  
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
      console.error('❌ Timeout connessione');
      client.disconnect();
      resolve({ success: false, error: 'Connection timeout' });
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(connectionTimeout);
      console.log('✅ Connesso');
      
      let startTime = Date.now();

      try {
        const vcard = {
          fullName: `Test ${testCase.name}`,
          records: [
            {
              type: 'photo',
              data: testCase.data,
              mediaType: testCase.mediaType
            }
          ]
        };

        console.log('\n⏳ Pubblicazione vCard (timeout 10s)...');
        startTime = Date.now();
        
        const publishPromise = client.publishVCard(vcard);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout 10s')), 10000)
        );

        await Promise.race([publishPromise, timeoutPromise]);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ ✅ ✅ SUCCESSO in ${duration}ms!`);
        console.log(`   ${testCase.name} FUNZIONA!`);
        
        client.disconnect();
        resolve({ success: true, duration, testCase: testCase.name });

      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`\n❌ FALLITO dopo ${duration}ms`);
        console.error('   Errore:', error.message);
        
        if (error.error) {
          console.error('   XMPP Condition:', error.error.condition);
          console.error('   XMPP Type:', error.error.type);
          console.error('   XMPP Text:', error.error.text);
        }
        
        client.disconnect();
        resolve({ success: false, error: error.message, duration, testCase: testCase.name });
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(connectionTimeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve({ success: false, error: 'Auth failed' });
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

async function main() {
  const results = [];
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await testPhotoFormat(TEST_CASES[i], i + 1);
    results.push(result);
    
    console.log('\n⏳ Pausa 2 secondi...');
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Riepilogo
  console.log('\n\n' + '🎯'.repeat(30));
  console.log('📊 RIEPILOGO RISULTATI');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ SUCCESSI: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`   ✅ ${r.testCase} (${r.duration}ms)`);
  });
  
  console.log(`\n❌ FALLIMENTI: ${failed.length}/${results.length}`);
  failed.forEach(r => {
    console.log(`   ❌ ${r.testCase}: ${r.error}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (successful.length > 0) {
    console.log('🎉 TROVATO IL FORMATO CHE FUNZIONA!');
    console.log(`   Usa: ${successful[0].testCase}`);
    console.log('\n   Prossimo step: Modificare il client web per usare');
    console.log('   questo formato esatto.');
  } else {
    console.log('❌ NESSUN FORMATO FUNZIONA!');
    console.log('   Potrebbe essere un problema di:');
    console.log('   - Permessi account');
    console.log('   - Configurazione server');
    console.log('   - Limitazioni temporanee');
  }
  
  console.log('='.repeat(60));
  
  process.exit(successful.length > 0 ? 0 : 1);
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});
