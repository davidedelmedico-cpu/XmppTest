#!/usr/bin/env node

/**
 * CONFERMA SOLUZIONE: Il server vuole BASE64 STRING
 * Testa PNG e JPEG come base64 string
 */

import { createClient } from 'stanza';

const TEST_ACCOUNT = {
  jid: 'testarda@conversations.im',
  password: 'FyqnD2YpGScNsuC'
};

// PNG 1x1
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

// JPEG 1x1
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

console.log('✅ CONFERMA SOLUZIONE: BASE64 STRING');
console.log('=' .repeat(60));

async function testBase64String(name, buffer, mediaType) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name} come BASE64 STRING`);
  console.log('='.repeat(60));
  
  const base64 = buffer.toString('base64');
  console.log('   Base64 length:', base64.length);
  console.log('   MediaType:', mediaType);
  
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
          fullName: `Test ${name} base64`,
          records: [
            {
              type: 'photo',
              data: base64,  // <-- STRINGA BASE64, non Buffer!
              mediaType: mediaType
            },
            {
              type: 'description',
              value: `Test ${name} salvato come base64 string`
            }
          ]
        };

        console.log('\n⏳ Pubblicazione vCard...');
        const startTime = Date.now();
        
        await client.publishVCard(vcard);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ ✅ ✅ SUCCESSO in ${duration}ms!`);
        console.log(`   ${name} come base64 string FUNZIONA!`);
        
        // Verifica che sia stato salvato
        console.log('\n🔍 Verifica lettura...');
        await new Promise(r => setTimeout(r, 500));
        
        const readVCard = await client.getVCard(TEST_ACCOUNT.jid.split('/')[0]);
        const photoRecord = readVCard?.records?.find(r => r.type === 'photo');
        
        if (photoRecord) {
          console.log('   ✅ Foto presente nel vCard riletto');
          console.log('   MediaType:', photoRecord.mediaType);
          console.log('   Data type:', typeof photoRecord.data);
          console.log('   Data length:', photoRecord.data?.length || 0, 'bytes');
        } else {
          console.log('   ⚠️  Foto non trovata nel vCard riletto');
        }
        
        client.disconnect();
        resolve(true);

      } catch (error) {
        console.error('\n❌ Errore:', error.message);
        if (error.error) {
          console.error('   Condition:', error.error.condition);
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

async function main() {
  // Test PNG
  const pngResult = await testBase64String('PNG', TINY_PNG, 'image/png');
  await new Promise(r => setTimeout(r, 2000));
  
  // Test JPEG
  const jpegResult = await testBase64String('JPEG', TINY_JPEG, 'image/jpeg');
  
  console.log('\n\n' + '🎯'.repeat(30));
  console.log('📊 RISULTATO FINALE');
  console.log('='.repeat(60));
  console.log('PNG come base64 string:', pngResult ? '✅ FUNZIONA' : '❌ FALLITO');
  console.log('JPEG come base64 string:', jpegResult ? '✅ FUNZIONA' : '❌ FALLITO');
  
  if (pngResult && jpegResult) {
    console.log('\n✅ ✅ ✅ SOLUZIONE CONFERMATA! ✅ ✅ ✅');
    console.log('='.repeat(60));
    console.log('Il server XMPP vuole la foto come STRINGA BASE64');
    console.log('NON come Buffer o Uint8Array!');
    console.log('\nIl nostro client deve passare:');
    console.log('  {');
    console.log('    type: "photo",');
    console.log('    data: "<stringa_base64>",  // ← STRING, non Buffer!');
    console.log('    mediaType: "image/jpeg"');
    console.log('  }');
    console.log('='.repeat(60));
    console.log('\n🔧 FIX NECESSARIO NEL CLIENT:');
    console.log('   In vcard.ts, NON convertire base64 a Buffer');
    console.log('   Passare direttamente la stringa base64!');
  } else {
    console.log('\n⚠️  Risultati inattesi, rivedere approccio');
  }
  
  console.log('='.repeat(60));
  
  process.exit((pngResult && jpegResult) ? 0 : 1);
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});
