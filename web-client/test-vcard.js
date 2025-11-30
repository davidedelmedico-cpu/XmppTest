#!/usr/bin/env node

/**
 * Script di test per verificare il recupero dei vCard da un server XMPP
 * Testa se gli account hanno effettivamente degli avatar impostati
 */

import { createClient } from 'stanza';

const TEST_ACCOUNTS = [
  { jid: 'testardo@conversations.im', password: 'FyqnD2YpGScNsuC' },
  { jid: 'testarda@conversations.im', password: 'FyqnD2YpGScNsuC' }
];

async function testVCard(credentials) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing vCard per: ${credentials.jid}`);
  console.log('='.repeat(60));

  const client = createClient({
    jid: credentials.jid,
    password: credentials.password,
    transports: {
      websocket: 'wss://xmpp.conversations.im:443/websocket',
      bosh: false
    }
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Timeout connessione');
      client.disconnect();
      resolve(false);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connessione riuscita');
      console.log(`   JID completo: ${client.jid}`);

      try {
        // Test 1: Recupera il proprio vCard
        console.log('\n📋 Test 1: Recupero vCard proprio...');
        const myVCard = await client.getVCard(credentials.jid.split('/')[0]);
        console.log('   VCard ricevuto:', JSON.stringify(myVCard, null, 2));
        
        if (myVCard) {
          console.log('   - fullName:', myVCard.fullName || '(non impostato)');
          console.log('   - records:', myVCard.records?.length || 0, 'elementi');
          
          if (myVCard.records) {
            myVCard.records.forEach((record, idx) => {
              console.log(`   - Record ${idx + 1}:`, record.type);
              if (record.type === 'photo') {
                console.log('     ✅ FOTO TROVATA!');
                console.log('     - mediaType:', record.mediaType);
                console.log('     - data length:', record.data?.length || 0, 'bytes');
                console.log('     - data type:', typeof record.data);
                console.log('     - data constructor:', record.data?.constructor?.name);
                
                // Tenta conversione a base64
                if (record.data) {
                  try {
                    let base64;
                    if (Buffer.isBuffer(record.data)) {
                      base64 = record.data.toString('base64');
                      console.log('     - Base64 (primi 50 char):', base64.substring(0, 50) + '...');
                      console.log('     - Base64 length:', base64.length);
                    } else {
                      console.log('     ⚠️  Data non è un Buffer standard');
                    }
                  } catch (e) {
                    console.error('     ❌ Errore conversione base64:', e.message);
                  }
                }
              } else if (record.type === 'nickname') {
                console.log('     - nickname:', record.value);
              } else if (record.type === 'email') {
                console.log('     - email:', record.value);
              } else if (record.type === 'description') {
                console.log('     - description:', record.value);
              }
            });
          }
        } else {
          console.log('   ⚠️  Nessun vCard trovato');
        }

        // Test 2: Recupera vCard dell'altro account
        const otherJid = credentials.jid.includes('testardo') 
          ? 'testarda@conversations.im' 
          : 'testardo@conversations.im';
        
        console.log(`\n📋 Test 2: Recupero vCard di ${otherJid}...`);
        try {
          const otherVCard = await client.getVCard(otherJid);
          console.log('   VCard ricevuto:', JSON.stringify(otherVCard, null, 2));
          
          if (otherVCard?.records) {
            const photoRecord = otherVCard.records.find(r => r.type === 'photo');
            if (photoRecord) {
              console.log('   ✅ Altro account ha una foto!');
              console.log('     - mediaType:', photoRecord.mediaType);
              console.log('     - data length:', photoRecord.data?.length || 0, 'bytes');
            } else {
              console.log('   ℹ️  Altro account non ha foto');
            }
          }
        } catch (err) {
          console.error('   ⚠️  Errore recupero vCard altro account:', err.message);
        }

        // Test 3: Verifica roster
        console.log('\n📋 Test 3: Recupero roster...');
        try {
          const roster = await client.getRoster();
          console.log('   Roster items:', roster.roster?.items?.length || 0);
          if (roster.roster?.items) {
            roster.roster.items.forEach(item => {
              console.log(`   - ${item.jid}: ${item.name || '(nessun nome)'}`);
            });
          }
        } catch (err) {
          console.error('   ⚠️  Errore recupero roster:', err.message);
        }

      } catch (error) {
        console.error('❌ Errore durante i test:', error);
        console.error('   Stack:', error.stack);
      } finally {
        console.log('\n🔌 Disconnessione...');
        client.disconnect();
        resolve(true);
      }
    });

    client.on('auth:failed', () => {
      clearTimeout(timeout);
      console.error('❌ Autenticazione fallita');
      client.disconnect();
      resolve(false);
    });

    client.on('disconnected', () => {
      console.log('🔌 Disconnesso');
    });

    console.log('🔄 Connessione in corso...');
    client.connect();
  });
}

async function main() {
  console.log('🧪 Test vCard per account conversations.im');
  console.log('Verifica se gli avatar sono effettivamente impostati\n');

  for (const account of TEST_ACCOUNTS) {
    await testVCard(account);
    // Pausa tra i test
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Test completati');
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});
