import { createClient } from 'stanza';

// Test real connection to trashserver.net
const testRegistration = async () => {
  console.log('=== Testing trashserver.net registration ===');
  
  const domain = 'trashserver.net';
  const username = 'testuser' + Math.floor(Math.random() * 100000);
  const password = 'testpass123';
  
  console.log(`Attempting registration for: ${username}@${domain}`);
  
  // Discover WebSocket URL
  let websocketUrl;
  try {
    const hostMetaUrl = `https://${domain}/.well-known/host-meta`;
    console.log(`Fetching host-meta from: ${hostMetaUrl}`);
    
    const response = await fetch(hostMetaUrl);
    const text = await response.text();
    console.log('Host-meta response:', text);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const allLinks = doc.getElementsByTagName('Link');
    
    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i];
      const rel = link.getAttribute('rel');
      if (rel === 'urn:xmpp:alt-connections:websocket') {
        const href = link.getAttribute('href');
        if (href) {
          websocketUrl = href.replace(/["']+$/g, '').replace(/^["']+/g, '').trim();
          console.log('Raw href:', href);
          console.log('Cleaned WebSocket URL:', websocketUrl);
        }
      }
    }
  } catch (error) {
    console.error('Host-meta discovery failed:', error);
    websocketUrl = `wss://${domain}:5281/xmpp-websocket`;
    console.log('Using fallback:', websocketUrl);
  }
  
  const jid = `${username}@${domain}`;
  
  const client = createClient({
    jid,
    resource: 'test-script',
    server: domain,
    lang: 'it',
    autoReconnect: false,
    timeout: 20,
    password,
    credentials: {
      username,
      password,
    },
    transports: {
      websocket: websocketUrl,
      bosh: false,
    },
  });
  
  let settled = false;
  const TIMEOUT = 10000;
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      if (!settled) {
        console.error('❌ TIMEOUT after 10 seconds');
        settled = true;
        client.disconnect();
        resolve({ success: false, reason: 'timeout' });
      }
    }, TIMEOUT);
    
    client.on('stream:data', (data) => {
      console.log('Stream data:', JSON.stringify(data, null, 2));
    });
    
    client.on('connected', () => {
      console.log('✓ WebSocket connected');
    });
    
    client.on('session:started', () => {
      console.log('✓ Session started - JID:', client.jid);
      clearTimeout(timeoutId);
      settled = true;
      client.disconnect();
      resolve({ success: true, jid: client.jid });
    });
    
    client.on('auth:failed', () => {
      console.error('❌ Authentication failed');
      clearTimeout(timeoutId);
      settled = true;
      client.disconnect();
      resolve({ success: false, reason: 'auth_failed' });
    });
    
    client.on('stream:error', (error) => {
      console.error('❌ Stream error:', error);
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        client.disconnect();
        resolve({ success: false, reason: 'stream_error', error });
      }
    });
    
    client.on('disconnected', () => {
      console.log('Disconnected');
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        resolve({ success: false, reason: 'disconnected_early' });
      }
    });
    
    client.on('features', (features) => {
      console.log('Server features:', features);
    });
    
    // Register in-band registration feature
    let attempted = false;
    client.registerFeature('inbandRegistration', 50, async (features, done) => {
      if (attempted) {
        done();
        return;
      }
      attempted = true;
      
      console.log('Checking in-band registration support...');
      
      if (!features.inbandRegistration) {
        console.error('❌ Server does not support in-band registration');
        done();
        return;
      }
      
      try {
        console.log('Sending registration IQ...');
        const result = await client.sendIQ({
          account: {
            username,
            password,
          },
          to: domain,
          type: 'set',
        });
        console.log('✓ Registration IQ result:', result);
        done();
      } catch (error) {
        console.error('❌ Registration IQ error:', error);
        done();
      }
    });
    
    console.log('Connecting...');
    try {
      client.connect();
    } catch (error) {
      console.error('❌ Sync connection error:', error);
      clearTimeout(timeoutId);
      settled = true;
      resolve({ success: false, reason: 'sync_error', error });
    }
  });
};

testRegistration()
  .then((result) => {
    console.log('\n=== Test Result ===');
    console.log(result);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n=== Test Failed ===');
    console.error(error);
    process.exit(1);
  });
