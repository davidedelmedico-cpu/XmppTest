import { createClient } from 'stanza';

const servers = [
  'jabber.hot-chilli.net',
  'chat.sum7.eu',
  'xmpp.nixnet.services',
  'jabber.systemausfall.org',
  'jabber.tcpreset.net',
  'xmpp.chinwag.im',
  'jabber.de',
  '404.city',
  'suchat.org',
  'anoxinon.de'
];

async function testServer(domain) {
  return new Promise(async (resolve) => {
    const username = 'testuser' + Math.floor(Math.random() * 100000);
    const password = 'testpass123';
    
    console.log(`\n=== Testing ${domain} ===`);
    
    // Discover WebSocket URL
    let websocketUrl;
    try {
      const response = await fetch(`https://${domain}/.well-known/host-meta`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const text = await response.text();
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM();
        const DOMParser = dom.window.DOMParser;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const parserError = doc.querySelector('parsererror');
        
        if (!parserError) {
          const allLinks = doc.getElementsByTagName('Link');
          for (let i = 0; i < allLinks.length; i++) {
            const link = allLinks[i];
            const rel = link.getAttribute('rel');
            if (rel === 'urn:xmpp:alt-connections:websocket') {
              const href = link.getAttribute('href');
              websocketUrl = href.trim().replace(/["']+$/g, '').replace(/^["']+/g, '');
              break;
            }
          }
        } else {
          // Try regex
          const wsMatch = text.match(/rel=["']urn:xmpp:alt-connections:websocket["'][^>]*href=["']([^"']+)["']+/i);
          if (wsMatch && wsMatch[1]) {
            websocketUrl = wsMatch[1].trim().replace(/["']+$/g, '').replace(/^["']+/g, '');
          }
        }
      }
    } catch (error) {
      console.log('  Host-meta failed:', error.message);
    }
    
    if (!websocketUrl) {
      websocketUrl = `wss://xmpp.${domain}/ws`;
      console.log('  Using fallback URL:', websocketUrl);
    } else {
      console.log('  WebSocket URL:', websocketUrl);
    }
    
    const client = createClient({
      jid: `${username}@${domain}`,
      resource: 'test',
      server: domain,
      autoReconnect: false,
      timeout: 10,
      transports: { websocket: websocketUrl, bosh: false },
    });
    
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        console.log('  ❌ TIMEOUT - server non risponde');
        settled = true;
        client.disconnect();
        resolve({ domain, success: false, reason: 'timeout' });
      }
    }, 8000);
    
    client.on('connected', () => console.log('  ✓ Connesso'));
    
    client.on('session:started', () => {
      console.log('  ✓✓✓ REGISTRAZIONE RIUSCITA!');
      clearTimeout(timeout);
      settled = true;
      client.disconnect();
      resolve({ domain, success: true, username, password });
    });
    
    client.on('stream:error', (err) => {
      if (err.condition !== 'policy-violation') {
        console.log('  Stream error:', err.condition);
      }
    });
    
    client.on('disconnected', () => {
      if (!settled) {
        clearTimeout(timeout);
        settled = true;
        resolve({ domain, success: false, reason: 'disconnected' });
      }
    });
    
    let attempted = false;
    client.registerFeature('inbandRegistration', 50, async (features, done) => {
      if (attempted) {
        done();
        return;
      }
      attempted = true;
      
      console.log('  Features:', features.inbandRegistration ? 'IBR supported' : 'No IBR');
      
      if (!features.inbandRegistration) {
        clearTimeout(timeout);
        settled = true;
        console.log('  ❌ Registrazione in-band non supportata');
        client.disconnect();
        resolve({ domain, success: false, reason: 'not_supported' });
        done();
        return;
      }
      
      try {
        await client.sendIQ({
          account: { username, password },
          to: domain,
          type: 'set',
        });
        console.log('  ✓ IQ registrazione OK');
        done();
      } catch (error) {
        const condition = error.error?.condition || error.condition;
        console.log('  ❌ Registrazione fallita:', condition);
        
        clearTimeout(timeout);
        settled = true;
        client.disconnect();
        resolve({ domain, success: false, reason: condition });
        done();
      }
    });
    
    client.connect();
  });
}

console.log('Cerco server XMPP con registrazione in-band attiva...\n');

for (const server of servers) {
  const result = await testServer(server);
  
  if (result.success) {
    console.log('\n✓✓✓ TROVATO SERVER FUNZIONANTE! ✓✓✓');
    console.log('Domain:', result.domain);
    console.log('Username:', result.username);
    console.log('Password:', result.password);
    console.log('\nPuoi usare questo server per testare la tua app!');
    process.exit(0);
  }
  
  // Small delay between tests
  await new Promise(r => setTimeout(r, 1000));
}

console.log('\n❌ Nessun server trovato con registrazione in-band attiva');
process.exit(1);
