#!/usr/bin/env node

/**
 * Test ENTRAMBI gli account per capire se il problema foto è:
 * - Specifico dell'account testarda
 * - Generale del server conversations.im
 */

import { createClient } from 'stanza';

const ACCOUNTS = [
  { jid: 'testarda@conversations.im', password: 'FyqnD2YpGScNsuC', name: 'TESTARDA' },
  { jid: 'testardo@conversations.im', password: 'FyqnD2YpGScNsuC', name: 'TESTARDO' }
];

// Foto test molto piccola
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

console.log('🧪 TEST COMPARATIVO: testarda vs testardo');
console.log('=' .repeat(60));
console.log('Obiettivo: Capire se il problema foto è specifico di testarda');
console.log('=' .repeat(60));

async function testAccountPhoto(account) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Test account: ${account.name} (${account.jid})`);
  console.log('='.repeat(60));
  
  const client = createClient({
    jid: account.jid,
    password: account.password,
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
      resolve({ account: account.name, success: false, error: 'Connection timeout' });
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(connectionTimeout);
      console.log('✅ Connesso');

      try {
        // Test 1: Salva SENZA foto
        console.log('\n📝 Test 1: Salva vCard SENZA foto...');
        const vcardNoPhoto = {
          fullName: `${account.name} Test`,
          records: [
            {
              type: 'description',
              value: `Test account ${account.name} - senza foto`
            }
          ]
        };

        const start1 = Date.now();
        await client.publishVCard(vcardNoPhoto);
        const duration1 = Date.now() - start1;
        console.log(`✅ Salvato SENZA foto in ${duration1}ms`);

        // Attendi un po'
        await new Promise(r => setTimeout(r, 1000));

        // Test 2: Salva CON foto
        console.log('\n📸 Test 2: Salva vCard CON foto (timeout 15s)...');
        const vcardWithPhoto = {
          fullName: `${account.name} Test con foto`,
          records: [
            {
              type: 'photo',
              data: TINY_PNG,
              mediaType: 'image/png'
            },
            {
              type: 'description',
              value: `Test account ${account.name} - con foto 1x1 PNG`
            }
          ]
        };

        const start2 = Date.now();
        
        // Race con timeout manuale
        const publishPromise = client.publishVCard(vcardWithPhoto);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout 15s')), 15000)
        );

        try {
          await Promise.race([publishPromise, timeoutPromise]);
          const duration2 = Date.now() - start2;
          console.log(`✅ ✅ ✅ Salvato CON foto in ${duration2}ms`);
          
          client.disconnect();
          resolve({ 
            account: account.name, 
            success: true, 
            withoutPhoto: duration1,
            withPhoto: duration2
          });
        } catch (photoError) {
          const duration2 = Date.now() - start2;
          console.error(`❌ FALLITO CON foto dopo ${duration2}ms: ${photoError.message}`);
          
          client.disconnect();
          resolve({ 
            account: account.name, 
            success: false,
            withoutPhoto: duration1,
            photoError: photoError.message
          });
        }

      } catch (error) {
        console.error('❌ Errore:', error.message);
        client.disconnect();
        resolve({ account: account.name, success: false, error: error.message });
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(connectionTimeout);
      console.error('❌ Auth fallita');
      client.disconnect();
      resolve({ account: account.name, success: false, error: 'Auth failed' });
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    client.connect();
  });
}

async function main() {
  const results = [];
  
  for (const account of ACCOUNTS) {
    const result = await testAccountPhoto(account);
    results.push(result);
    
    // Pausa tra test
    console.log('\n⏳ Attesa 3 secondi prima del prossimo test...\n');
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Riepilogo finale
  console.log('\n\n' + '🎯'.repeat(30));
  console.log('📊 RIEPILOGO RISULTATI');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    console.log(`\n${result.account}:`);
    console.log(`  Senza foto: ${result.withoutPhoto ? result.withoutPhoto + 'ms ✅' : 'N/A'}`);
    console.log(`  Con foto: ${result.withPhoto ? result.withPhoto + 'ms ✅' : '❌ ' + (result.photoError || result.error || 'FAILED')}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 CONCLUSIONE:');
  
  const allFailed = results.every(r => !r.success);
  const allSucceeded = results.every(r => r.success);
  const mixed = !allFailed && !allSucceeded;
  
  if (allFailed) {
    console.log('❌ ENTRAMBI gli account FALLISCONO con le foto!');
    console.log('   Problema GENERALE del server conversations.im');
    console.log('   Il server NON supporta correttamente il salvataggio foto.');
  } else if (allSucceeded) {
    console.log('✅ ENTRAMBI gli account FUNZIONANO con le foto!');
    console.log('   Il problema nel client web è di implementazione.');
  } else {
    console.log('⚠️  RISULTATI MISTI!');
    results.forEach(r => {
      if (r.success) {
        console.log(`   ✅ ${r.account} funziona`);
      } else {
        console.log(`   ❌ ${r.account} NON funziona`);
      }
    });
    console.log('   Problema SPECIFICO di alcuni account.');
  }
  console.log('='.repeat(60));
  
  process.exit(allFailed ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});
