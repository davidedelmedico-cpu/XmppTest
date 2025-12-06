import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurazione test
const TEST_CONFIG = {
  baseUrl: 'http://localhost:4173', // Usa preview server (build produzione)
  timeout: 60000,
  accounts: {
    sender: {
      jid: 'testardo@conversations.im',
      password: 'FyqnD2YpGScNsuC'
    },
    receiver: {
      jid: 'testarda@conversations.im',
      password: 'FyqnD2YpGScNsuC'
    }
  }
};

let devServer = null;
let browser = null;

// Utility per logging
const log = {
  info: (msg) => console.log(`\x1b[36mℹ ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m⚠ ${msg}\x1b[0m`),
  debug: (msg) => console.log(`\x1b[90m  ${msg}\x1b[0m`),
  section: (msg) => console.log(`\n\x1b[1m${'='.repeat(60)}\x1b[0m\n\x1b[1m${msg}\x1b[0m\n\x1b[1m${'='.repeat(60)}\x1b[0m\n`)
};

// Avvia server di preview (build produzione)
async function startDevServer() {
  log.info('Avvio server preview (build produzione)...');
  
  return new Promise((resolve, reject) => {
    devServer = spawn('npm', ['run', 'preview', '--', '--port', '4173'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverReady = false;

    devServer.stdout.on('data', (data) => {
      const output = data.toString();
      if ((output.includes('Local:') || output.includes('localhost:4173')) && !serverReady) {
        serverReady = true;
        log.success('Server preview avviato');
        setTimeout(() => resolve(), 2000);
      }
    });

    devServer.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error')) {
        log.error(`Errore server: ${error}`);
      }
    });

    devServer.on('error', (error) => {
      reject(error);
    });

    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Timeout avvio server'));
      }
    }, 30000);
  });
}

// Ferma server
function stopDevServer() {
  if (devServer) {
    log.info('Arresto server preview...');
    devServer.kill();
    devServer = null;
  }
}

// Login su una pagina
async function login(page, account) {
  log.info(`Login con ${account.jid}...`);
  
  // Cattura errori JavaScript
  const jsErrors = [];
  page.on('pageerror', error => {
    jsErrors.push(error.message);
    log.error(`Errore JavaScript: ${error.message}`);
  });
  
  // Cattura log console (inclusi log push)
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      log.error(`Console error: ${text}`);
    }
    
    // Mostra log relativi a push notifications
    if (text.includes('🚀') || text.includes('🔍') || text.includes('✅') || 
        text.includes('❌') || text.includes('⚠️') || text.includes('📤') ||
        text.includes('Push Notifications') || text.includes('XEP-0357')) {
      
      // Determina il tipo di log dall'emoji
      if (text.includes('✅')) {
        log.success(`  ${text.replace('✅', '').trim()}`);
      } else if (text.includes('❌')) {
        log.error(`  ${text.replace('❌', '').trim()}`);
      } else if (text.includes('⚠️')) {
        log.warn(`  ${text.replace('⚠️', '').trim()}`);
      } else {
        log.debug(`  ${text}`);
      }
    }
  });
  
  // Attendi che la pagina sia completamente caricata
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  
  // Attendi che tutti i moduli JavaScript siano caricati
  await page.waitForFunction(() => {
    // Verifica che Vite client sia caricato
    return window.__vite_plugin_react_preamble_installed__ || 
           (window.$RefreshReg$ !== undefined) ||
           document.querySelector('script[type="module"]') !== null;
  }, { timeout: 30000 });
  
  // Attesa per il rendering di React
  await page.waitForTimeout(8000); // Attesa più lunga per React
  
  // Verifica se ci sono errori JavaScript
  if (jsErrors.length > 0) {
    log.warn(`Trovati ${jsErrors.length} errori JavaScript:`);
    jsErrors.forEach(err => log.warn(`  - ${err}`));
  }
  
  // Verifica stato iniziale
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  log.debug(`Contenuto root: ${rootContent} caratteri`);
  
  // Se il root è ancora vuoto, prova ad aspettare ancora
  if (rootContent === 0) {
    log.warn('Root ancora vuoto, attesa aggiuntiva...');
    await page.waitForTimeout(5000);
    
    // Verifica di nuovo
    const rootContent2 = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.length : 0;
    });
    log.debug(`Contenuto root dopo attesa: ${rootContent2} caratteri`);
    
    if (rootContent2 === 0) {
      // Screenshot per debug
      await page.screenshot({ path: `/tmp/login-no-react-${account.jid.split('@')[0]}.png`, fullPage: true });
      const consoleMessages = await page.evaluate(() => {
        // Non possiamo accedere ai log della console direttamente, ma possiamo verificare errori
        return window.onerror ? 'window.onerror presente' : 'nessun window.onerror';
      });
      log.error(`React non sta renderizzando. Screenshot: /tmp/login-no-react-${account.jid.split('@')[0]}.png`);
      throw new Error('React non sta renderizzando - verifica errori JavaScript');
    }
  }
  
  // Attendi che il popup di login appaia
  log.debug('Attesa popup di login...');
  try {
    await page.waitForSelector('.login-popup-overlay, .login-popup, [role="dialog"], input[type="text"]', { timeout: 20000, state: 'visible' });
  } catch (e) {
    // Screenshot per debug
    await page.screenshot({ path: `/tmp/login-timeout-${account.jid.split('@')[0]}.png`, fullPage: true });
    const rootHTML = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.substring(0, 500) : 'root non trovato';
    });
    log.debug(`Contenuto root HTML: ${rootHTML}`);
    throw new Error(`Popup login non trovato dopo 20 secondi. Screenshot: /tmp/login-timeout-${account.jid.split('@')[0]}.png`);
  }
  
  await page.waitForTimeout(1000); // Attesa aggiuntiva per React
  
  // Prova diversi selettori per il campo JID
  let jidInput = null;
  const selectors = [
    'input[type="text"]',
    'input[name="jid"]',
    'input[placeholder*="JID"]',
    'input[placeholder*="jid"]',
    'input[placeholder*="username"]',
    'input[placeholder*="Username"]',
    '.login-popup input[type="text"]',
    'form input[type="text"]',
    'input',
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      log.debug(`Trovati ${count} elementi con selector: ${selector}`);
      if (count > 0) {
        jidInput = page.locator(selector).first();
        // Verifica che sia visibile
        const isVisible = await jidInput.isVisible().catch(() => false);
        if (isVisible) {
          log.debug(`Usando selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Continua
    }
  }
  
  if (!jidInput) {
    // Screenshot per debug
    await page.screenshot({ path: `/tmp/login-debug-${account.jid.split('@')[0]}.png`, fullPage: true });
    const bodyText = await page.locator('body').textContent();
    log.debug(`Contenuto body: ${bodyText?.substring(0, 200)}...`);
    throw new Error(`Campo JID non trovato. Screenshot salvato in /tmp/login-debug-${account.jid.split('@')[0]}.png`);
  }
  
  const passwordInput = await page.locator('input[type="password"]').first();
  const submitButton = await page.locator('button[type="submit"], button:has-text("Connetti"), button:has-text("Accedi"), button:has-text("Login")').first();
  
  await jidInput.fill(account.jid);
  await passwordInput.fill(account.password);
  await submitButton.click();
  
  // Attendi che il login completi (popup scompare o lista conversazioni appare)
  await page.waitForTimeout(5000);
  
  // Verifica che il login sia riuscito
  const hasError = await page.locator('.error, [role="alert"], .message-error').first().isVisible().catch(() => false);
  if (hasError) {
    const errorText = await page.locator('.error, [role="alert"], .message-error').first().textContent();
    throw new Error(`Login fallito: ${errorText}`);
  }
  
  log.success(`Login riuscito per ${account.jid}`);
}

// Verifica stato push notifications
async function checkPushStatus(page, accountName) {
  log.section(`Verifica Push Notifications - ${accountName}`);
  
  // Esegui JavaScript nella pagina per verificare lo stato
  const pushStatus = await page.evaluate(() => {
    return {
      pushSupported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
      notificationPermission: 'Notification' in window ? Notification.permission : 'not-supported',
      serviceWorkerRegistered: navigator.serviceWorker ? navigator.serviceWorker.controller !== null : false,
    };
  });
  
  log.info(`Push supportato: ${pushStatus.pushSupported}`);
  log.info(`Permesso notifiche: ${pushStatus.notificationPermission}`);
  log.info(`Service Worker registrato: ${pushStatus.serviceWorkerRegistered}`);
  
  // Verifica se le push sono abilitate nel contesto React
  const reactPushStatus = await page.evaluate(() => {
    // Cerca nel localStorage
    const pushConfig = localStorage.getItem('push_config');
    return {
      hasPushConfig: pushConfig !== null,
      pushConfig: pushConfig ? JSON.parse(pushConfig) : null
    };
  });
  
  log.info(`Configurazione push salvata: ${reactPushStatus.hasPushConfig}`);
  if (reactPushStatus.pushConfig) {
    log.success(`  ✓ Push JID: ${reactPushStatus.pushConfig.pushJid}`);
    log.debug(`  Endpoint: ${reactPushStatus.pushConfig.endpoint?.substring(0, 60)}...`);
  } else {
    log.warn(`  ✗ Nessuna configurazione push trovata`);
  }
  
  // Verifica subscription push del browser
  const subscriptionStatus = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return { hasSubscription: false };
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return {
        hasSubscription: subscription !== null,
        endpoint: subscription ? subscription.endpoint.substring(0, 60) : null
      };
    } catch (e) {
      return { hasSubscription: false, error: e.message };
    }
  });
  
  if (subscriptionStatus.hasSubscription) {
    log.success(`  ✓ Browser push subscription attiva`);
    log.debug(`  Endpoint: ${subscriptionStatus.endpoint}...`);
  } else {
    log.warn(`  ✗ Nessuna browser push subscription`);
    if (subscriptionStatus.error) {
      log.warn(`  Errore: ${subscriptionStatus.error}`);
    }
  }
  
  return { pushStatus, reactPushStatus, subscriptionStatus };
}

// Richiedi permesso notifiche
async function requestNotificationPermission(page) {
  log.info('Richiesta permesso notifiche...');
  
  const permission = await page.evaluate(async () => {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    
    // Richiedi permesso
    const result = await Notification.requestPermission();
    return result;
  });
  
  log.info(`Permesso notifiche: ${permission}`);
  return permission;
}

// Invia messaggio
async function sendMessage(page, toJid, messageText) {
  log.info(`Invio messaggio a ${toJid}...`);
  
  // Cerca la conversazione nella lista
  const conversationSelector = `[data-jid="${toJid}"], [class*="conversation"]:has-text("${toJid.split('@')[0]}")`;
  
  // Prova a cliccare sulla conversazione
  try {
    await page.locator(conversationSelector).first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  } catch (e) {
    log.warn(`Conversazione non trovata con selector ${conversationSelector}, provo approccio alternativo...`);
    // Prova a cercare qualsiasi conversazione
    const anyConversation = await page.locator('[class*="conversation"], [class*="chat-item"]').first();
    if (await anyConversation.count() > 0) {
      await anyConversation.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Trova il campo di input del messaggio
  const messageInput = await page.locator('textarea, input[type="text"][placeholder*="messaggio"], input[type="text"][placeholder*="message"]').first();
  await messageInput.fill(messageText);
  
  // Trova il pulsante di invio
  const sendButton = await page.locator('button[type="submit"], button:has-text("Invia"), button:has-text("Send"), [aria-label*="invia"]').first();
  await sendButton.click();
  
  log.success(`Messaggio inviato: "${messageText}"`);
  await page.waitForTimeout(2000);
}

// Verifica se arrivano notifiche
async function checkNotifications(page, timeout = 10000) {
  log.info(`Attesa notifiche per ${timeout}ms...`);
  
  let notificationReceived = false;
  let notificationText = null;
  
  // Listener per le notifiche
  const notificationPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      // Verifica se ci sono notifiche già mostrate
      if (document.querySelector('.notification, [role="alert"]')) {
        resolve({ received: true, text: document.querySelector('.notification, [role="alert"]').textContent });
        return;
      }
      
      // Observer per nuove notifiche
      const observer = new MutationObserver((mutations) => {
        const notification = document.querySelector('.notification, [role="alert"]');
        if (notification) {
          observer.disconnect();
          resolve({ received: true, text: notification.textContent });
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Timeout
      setTimeout(() => {
        observer.disconnect();
        resolve({ received: false, text: null });
      }, 10000);
    });
  });
  
  const result = await notificationPromise;
  notificationReceived = result.received;
  notificationText = result.text;
  
  // Verifica anche nei log della console
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('notification') || text.includes('push') || text.includes('message')) {
      consoleLogs.push(text);
    }
  });
  
  return { notificationReceived, notificationText, consoleLogs };
}

// Test principale
async function runPushNotificationTest() {
  console.log('\n');
  log.section('🧪 Test Push Notifications - XEP-0357');
  
  try {
    // Avvia server
    await startDevServer();
    
    // Avvia browser
    log.info('Avvio browser Chromium...');
    browser = await chromium.launch({ 
      headless: true, // Headless per ambiente senza display
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Crea due context separati (simula due browser)
    const senderContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    });
    
    const receiverContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    });
    
    // Concedi permessi notifiche
    await senderContext.grantPermissions(['notifications']);
    await receiverContext.grantPermissions(['notifications']);
    
    const senderPage = await senderContext.newPage();
    const receiverPage = await receiverContext.newPage();
    
    // === SETUP RECEIVER (testarda) ===
    log.section('Setup Receiver (testarda)');
    await receiverPage.goto(`${TEST_CONFIG.baseUrl}/XmppTest/#/`, { waitUntil: 'networkidle' });
    // Attendi che React renderizzi
    await receiverPage.waitForTimeout(3000);
    await login(receiverPage, TEST_CONFIG.accounts.receiver);
    
    // Richiedi permesso notifiche sul receiver
    log.info('Richiesta permesso notifiche...');
    const permission = await requestNotificationPermission(receiverPage);
    if (permission !== 'granted') {
      log.warn(`Permesso notifiche non concesso: ${permission}`);
      log.warn('Le notifiche potrebbero non funzionare');
    } else {
      log.success(`Permesso notifiche concesso`);
    }
    
    // Chiudi il popup di debug push se è aperto
    try {
      const pushPopupCloseButton = receiverPage.locator('.push-status-close, button:has-text("Chiudi")');
      if (await pushPopupCloseButton.isVisible({ timeout: 2000 })) {
        log.info('Chiusura popup debug push notifications...');
        await pushPopupCloseButton.click();
        await receiverPage.waitForTimeout(500);
      }
    } catch (e) {
      // Popup non presente, continua
    }
    
    // Verifica stato push sul receiver PRIMA dell'attesa
    log.info('Stato push subito dopo login...');
    const receiverPushStatus = await checkPushStatus(receiverPage, 'Receiver (testarda) - Iniziale');
    
    // Attendi che le push si abilitino automaticamente
    log.info('');
    log.info('⏳ Attesa 8 secondi per abilitazione automatica push notifications...');
    log.info('   (Il sistema tenta di abilitare le push 2 secondi dopo la connessione)');
    await receiverPage.waitForTimeout(8000);
    
    // Chiudi di nuovo il popup se si è riaperto
    try {
      const pushPopupCloseButton = receiverPage.locator('.push-status-close, button:has-text("Chiudi")');
      if (await pushPopupCloseButton.isVisible({ timeout: 1000 })) {
        await pushPopupCloseButton.click();
        await receiverPage.waitForTimeout(500);
      }
    } catch (e) {
      // Popup non presente, continua
    }
    
    // Verifica di nuovo dopo l'attesa
    log.info('');
    const receiverPushStatusAfter = await checkPushStatus(receiverPage, 'Receiver (testarda) - Dopo attesa');
    
    // Confronta stato prima e dopo
    const pushActivated = !receiverPushStatus.reactPushStatus.hasPushConfig && 
                         receiverPushStatusAfter.reactPushStatus.hasPushConfig;
    
    if (pushActivated) {
      log.success('');
      log.success('🎉 PUSH NOTIFICATIONS ATTIVATE CON SUCCESSO!');
      log.success('');
    } else if (receiverPushStatusAfter.reactPushStatus.hasPushConfig) {
      log.success('');
      log.success('✓ Push notifications già configurate');
      log.success('');
    } else {
      log.error('');
      log.error('✗ Push notifications NON attivate');
      log.error('  Possibili cause:');
      log.error('  - Il server non supporta XEP-0357');
      log.error('  - Errore nella comunicazione con il server');
      log.error('  - Service Worker non registrato');
      log.error('');
    }
    
    // === SETUP SENDER (testardo) ===
    log.section('Setup Sender (testardo)');
    await senderPage.goto(`${TEST_CONFIG.baseUrl}/XmppTest/#/`, { waitUntil: 'networkidle' });
    // Attendi che React renderizzi
    await senderPage.waitForTimeout(3000);
    await login(senderPage, TEST_CONFIG.accounts.sender);
    
    // Verifica stato push sul sender (opzionale)
    const senderPushStatus = await checkPushStatus(senderPage, 'Sender (testardo)');
    
    // === INVIO MESSAGGIO ===
    log.section('Invio Messaggio');
    const testMessage = `Test push notification - ${new Date().toISOString()}`;
    await sendMessage(senderPage, TEST_CONFIG.accounts.receiver.jid, testMessage);
    
    // === VERIFICA NOTIFICHE ===
    log.section('Verifica Notifiche');
    
    // Minimizza o nascondi la finestra del receiver per simulare app in background
    // (Le notifiche push funzionano meglio quando l'app non è in foreground)
    await receiverPage.evaluate(() => {
      // Simula che la pagina non sia visibile
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    
    // Attendi che il messaggio arrivi e generi una notifica
    await receiverPage.waitForTimeout(5000);
    
    // Verifica notifiche
    const notificationCheck = await checkNotifications(receiverPage, 10000);
    
    // === RISULTATI ===
    log.section('📊 Risultati Test');
    
    log.info('Stato Push Notifications:');
    log.info(`  Supportato: ${receiverPushStatus.pushStatus.pushSupported}`);
    log.info(`  Permesso: ${receiverPushStatus.pushStatus.notificationPermission}`);
    log.info(`  Service Worker: ${receiverPushStatus.pushStatus.serviceWorkerRegistered}`);
    log.info(`  Config salvata: ${receiverPushStatus.reactPushStatus.hasPushConfig}`);
    
    log.info('\nNotifiche ricevute:');
    if (notificationCheck.notificationReceived) {
      log.success(`✓ Notifica ricevuta: ${notificationCheck.notificationText}`);
    } else {
      log.error('✗ Nessuna notifica ricevuta');
      log.warn('Possibili cause:');
      log.warn('  - Push notifications non abilitate sul server');
      log.warn('  - Service worker non registrato correttamente');
      log.warn('  - Il server non supporta XEP-0357');
      log.warn('  - Le notifiche arrivano solo quando l\'app è in background');
    }
    
    // Screenshot finale
    await receiverPage.screenshot({ path: '/workspace/test-push-receiver-final.png', fullPage: true });
    await senderPage.screenshot({ path: '/workspace/test-push-sender-final.png', fullPage: true });
    log.info('Screenshot salvati');
    
    // Attendi prima di chiudere
    log.info('Attesa 5 secondi prima di chiudere...');
    await Promise.all([
      senderPage.waitForTimeout(5000),
      receiverPage.waitForTimeout(5000)
    ]);
    
    await browser.close();
    
    return notificationCheck.notificationReceived ? 0 : 1;
    
  } catch (error) {
    log.error(`Errore critico: ${error.message}`);
    console.error(error);
    if (browser) await browser.close();
    return 1;
  } finally {
    stopDevServer();
  }
}

// Esegui test
runPushNotificationTest().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  log.error(`Errore fatale: ${error.message}`);
  console.error(error);
  stopDevServer();
  process.exit(1);
});
