#!/usr/bin/env node

/**
 * ANALISI FOTO ESISTENTI caricate da altri client
 * Obiettivo: Capire COME gli altri client salvano le foto con successo
 */

import { createClient } from 'stanza';
import { writeFileSync } from 'fs';

const ACCOUNTS = [
  { jid: 'testarda@conversations.im', password: 'FyqnD2YpGScNsuC', name: 'TESTARDA' },
  { jid: 'testardo@conversations.im', password: 'FyqnD2YpGScNsuC', name: 'TESTARDO' }
];

console.log('🔍 ANALISI FOTO PROFILO ESISTENTI');
console.log('=' .repeat(60));
console.log('Obiettivo: Capire il formato delle foto salvate da altri client');
console.log('=' .repeat(60));

async function analyzeExistingPhoto(account) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📸 Analisi account: ${account.name}`);
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
    const timeout = setTimeout(() => {
      console.error('❌ Timeout');
      client.disconnect();
      resolve(null);
    }, 30000);

    client.on('session:started', async () => {
      clearTimeout(timeout);
      console.log('✅ Connesso');

      try {
        console.log('\n📖 Lettura vCard dal server...');
        const vcard = await client.getVCard(account.jid.split('/')[0]);
        
        if (!vcard) {
          console.log('❌ Nessun vCard trovato');
          client.disconnect();
          resolve(null);
          return;
        }

        console.log('\n📋 VCard ricevuto:');
        console.log('   fullName:', vcard.fullName || '(vuoto)');
        console.log('   records:', vcard.records?.length || 0);

        if (!vcard.records || vcard.records.length === 0) {
          console.log('   ℹ️  Nessun record nel vCard');
          client.disconnect();
          resolve(null);
          return;
        }

        // Cerca la foto
        const photoRecord = vcard.records.find(r => r.type === 'photo');
        
        if (!photoRecord) {
          console.log('   ℹ️  Nessuna foto nel vCard');
          client.disconnect();
          resolve(null);
          return;
        }

        console.log('\n🎯 FOTO TROVATA! Analisi dettagliata:');
        console.log('   mediaType:', photoRecord.mediaType);
        console.log('   data presente:', !!photoRecord.data);
        console.log('   data type:', typeof photoRecord.data);
        console.log('   data constructor:', photoRecord.data?.constructor?.name);
        
        if (photoRecord.data) {
          // Analisi binaria
          const isBuffer = Buffer.isBuffer(photoRecord.data);
          const isUint8Array = photoRecord.data instanceof Uint8Array;
          const isArrayBuffer = photoRecord.data instanceof ArrayBuffer;
          
          console.log('\n   🔬 Tipo dati:');
          console.log('      - Buffer.isBuffer:', isBuffer);
          console.log('      - instanceof Uint8Array:', isUint8Array);
          console.log('      - instanceof ArrayBuffer:', isArrayBuffer);
          
          let buffer;
          if (isBuffer) {
            buffer = photoRecord.data;
          } else if (isUint8Array) {
            buffer = Buffer.from(photoRecord.data);
          } else if (isArrayBuffer) {
            buffer = Buffer.from(photoRecord.data);
          } else {
            console.log('      ⚠️  Tipo non riconosciuto!');
            client.disconnect();
            resolve(null);
            return;
          }
          
          console.log('\n   📊 Dimensioni:');
          console.log('      - Bytes:', buffer.length);
          console.log('      - KB:', (buffer.length / 1024).toFixed(2));
          
          // Analizza header per determinare formato reale
          console.log('\n   🔍 Analisi header (primi 20 bytes):');
          const header = buffer.slice(0, 20);
          console.log('      Hex:', header.toString('hex'));
          console.log('      Bytes:', Array.from(header).join(', '));
          
          // Identifica formato da magic bytes
          let detectedFormat = 'UNKNOWN';
          if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            detectedFormat = 'JPEG';
          } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            detectedFormat = 'PNG';
          } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            detectedFormat = 'GIF';
          } else if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
            detectedFormat = 'WEBP';
          }
          
          console.log('      Formato rilevato:', detectedFormat);
          console.log('      MediaType dichiarato:', photoRecord.mediaType);
          
          if (detectedFormat !== 'UNKNOWN') {
            const match = photoRecord.mediaType?.includes(detectedFormat.toLowerCase());
            if (match) {
              console.log('      ✅ MediaType CORRISPONDE al formato');
            } else {
              console.log('      ⚠️  MediaType NON corrisponde!');
            }
          }
          
          // Converti a base64
          const base64 = buffer.toString('base64');
          console.log('\n   📝 Base64:');
          console.log('      - Length:', base64.length);
          console.log('      - Preview (primi 100 char):', base64.substring(0, 100) + '...');
          console.log('      - Preview (ultimi 50 char):', '...' + base64.substring(base64.length - 50));
          
          // Salva file per ispezione
          const filename = `/workspace/web-client/test-photo-${account.name.toLowerCase()}.${detectedFormat.toLowerCase()}`;
          writeFileSync(filename, buffer);
          console.log(`\n   💾 Foto salvata in: ${filename}`);
          
          // Salva anche il base64
          const base64Filename = `/workspace/web-client/test-photo-${account.name.toLowerCase()}.txt`;
          writeFileSync(base64Filename, base64);
          console.log(`   💾 Base64 salvato in: ${base64Filename}`);
          
          console.log('\n   🎯 PROVA ORA A RIPUBBLICARE ESATTAMENTE QUESTA FOTO...');
          
          // Prova a ripubblicare la stessa identica foto
          const republishVCard = {
            fullName: vcard.fullName || `${account.name} test`,
            records: [
              {
                type: 'photo',
                data: buffer, // Usa esattamente lo stesso buffer
                mediaType: photoRecord.mediaType // Usa esattamente lo stesso mediaType
              },
              {
                type: 'description',
                value: `Test ripubblicazione foto esistente - ${new Date().toISOString()}`
              }
            ]
          };
          
          console.log('\n   ⏳ Ripubblicazione in corso (timeout 20s)...');
          const startTime = Date.now();
          
          try {
            const publishPromise = client.publishVCard(republishVCard);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout 20s')), 20000)
            );
            
            await Promise.race([publishPromise, timeoutPromise]);
            const duration = Date.now() - startTime;
            
            console.log(`\n   ✅ ✅ ✅ SUCCESSO! Ripubblicazione in ${duration}ms`);
            console.log('   La foto esistente PUÒ essere ripubblicata!');
            
            client.disconnect();
            resolve({
              account: account.name,
              hasPhoto: true,
              format: detectedFormat,
              mediaType: photoRecord.mediaType,
              size: buffer.length,
              canRepublish: true,
              buffer: buffer,
              base64: base64
            });
            
          } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`\n   ❌ FALLITO dopo ${duration}ms: ${error.message}`);
            console.log('   Anche ripubblicare la foto esistente fallisce!');
            
            client.disconnect();
            resolve({
              account: account.name,
              hasPhoto: true,
              format: detectedFormat,
              mediaType: photoRecord.mediaType,
              size: buffer.length,
              canRepublish: false,
              error: error.message,
              buffer: buffer,
              base64: base64
            });
          }
        }

      } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
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

async function main() {
  const results = [];
  
  for (const account of ACCOUNTS) {
    const result = await analyzeExistingPhoto(account);
    if (result) {
      results.push(result);
    }
    
    console.log('\n⏳ Pausa 3 secondi...\n');
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Riepilogo
  console.log('\n\n' + '🎯'.repeat(30));
  console.log('📊 RIEPILOGO ANALISI');
  console.log('='.repeat(60));
  
  if (results.length === 0) {
    console.log('❌ Nessuna foto trovata su nessun account');
  } else {
    results.forEach(r => {
      console.log(`\n${r.account}:`);
      console.log(`  Formato: ${r.format}`);
      console.log(`  MediaType: ${r.mediaType}`);
      console.log(`  Dimensione: ${r.size} bytes (${(r.size/1024).toFixed(2)} KB)`);
      console.log(`  Ripubblicabile: ${r.canRepublish ? '✅ SI' : '❌ NO'}`);
      if (r.error) {
        console.log(`  Errore: ${r.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PROSSIMO STEP:');
    console.log('   Se la ripubblicazione funziona, il problema è nella');
    console.log('   CONVERSIONE delle immagini nel nostro client web!');
    console.log('   Controlla: compressAvatar() e base64ToBuffer()');
    console.log('='.repeat(60));
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});
