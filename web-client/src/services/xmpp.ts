import { createClient } from 'stanza'
import type { Agent } from 'stanza'
import { DEFAULT_RESOURCE } from '../config/constants'

export type XmppConnectionSettings = {
  domain: string
  websocketUrl?: string
  username: string
  password: string
  resource?: string
}

/**
 * Discovers WebSocket URL from domain using XEP-0156 (host-meta discovery)
 * Throws an error if discovery fails - no automatic fallback
 */
const discoverWebSocketUrl = async (domain: string): Promise<string> => {
  const hostMetaUrl = `https://${domain}/.well-known/host-meta`
  
  let response: Response
  try {
    response = await fetch(hostMetaUrl, {
      method: 'GET',
      headers: { Accept: 'application/xrd+xml, application/xml, text/xml' },
    })
  } catch (error) {
    throw new Error(
      `Impossibile raggiungere il server per l'auto-discovery: ${hostMetaUrl}. ` +
      `Inserisci manualmente l'URL WebSocket nel campo dedicato.`
    )
  }

  if (!response.ok) {
    throw new Error(
      `Il server non fornisce informazioni di discovery (${response.status}). ` +
      `Inserisci manualmente l'URL WebSocket nel campo dedicato.`
    )
  }

  const text = await response.text()
  
  // Parse XRD XML to find WebSocket link
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const links = doc.querySelectorAll('Link[rel="urn:xmpp:alt-connections:websocket"]')
  
  if (links.length === 0) {
    throw new Error(
      `Il server non espone un endpoint WebSocket tramite host-meta discovery. ` +
      `Inserisci manualmente l'URL WebSocket nel campo dedicato.`
    )
  }

  const href = links[0].getAttribute('href')
  if (!href) {
    throw new Error(
      `L'endpoint WebSocket trovato nel host-meta è invalido. ` +
      `Inserisci manualmente l'URL WebSocket nel campo dedicato.`
    )
  }

  return href
}

export type XmppResult = {
  success: boolean
  message: string
  details?: string
  jid?: string
}

type Intent = 'register' | 'login'

type RegistrationPayload = {
  domain: string
  username: string
  password: string
}

type GenericHandler = (...args: any[]) => void

const addCustomListener = (client: Agent, event: string, handler: GenericHandler, once = false) => {
  const emitter = client as unknown as {
    on: (name: string, cb: GenericHandler) => Agent
    once: (name: string, cb: GenericHandler) => Agent
  }

  if (once) {
    emitter.once(event, handler)
  } else {
    emitter.on(event, handler)
  }
}

const removeCustomListener = (client: Agent, event: string, handler: GenericHandler) => {
  const emitter = client as unknown as { removeListener: (name: string, cb: GenericHandler) => Agent }
  emitter.removeListener(event, handler)
}

const emitCustomEvent = (client: Agent, event: string, ...args: unknown[]) => {
  const emitter = client as unknown as { emit: (name: string, ...payload: unknown[]) => boolean }
  emitter.emit(event, ...args)
}

const buildClient = async (settings: XmppConnectionSettings): Promise<Agent> => {
  const { domain, websocketUrl, username, password, resource = DEFAULT_RESOURCE } = settings
  const trimmedWs = websocketUrl?.trim()
  
  // Auto-discover WebSocket URL if not provided
  let finalWebSocketUrl: string | true = true
  if (trimmedWs && trimmedWs.length > 0) {
    finalWebSocketUrl = trimmedWs
  } else {
    // Discover WebSocket URL from domain
    finalWebSocketUrl = await discoverWebSocketUrl(domain)
  }
  
  const jid = `${username}@${domain}`

  return createClient({
    jid,
    resource,
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
      websocket: finalWebSocketUrl,
      bosh: false,
    },
  })
}

const enableInBandRegistration = (client: Agent, payload: RegistrationPayload) => {
  let attempted = false

  client.registerFeature('inbandRegistration', 50, async (features, done) => {
    if (attempted) {
      done()
      return
    }

    attempted = true

    if (!features.inbandRegistration) {
      emitCustomEvent(client, 'register:unsupported')
      done()
      return
    }

    try {
      await client.sendIQ({
        account: {
          username: payload.username,
          password: payload.password,
        },
        to: payload.domain,
        type: 'set',
      })
      emitCustomEvent(client, 'register:completed')
    } catch (error) {
      emitCustomEvent(client, 'register:error', error)
    }

    done()
  })
}

const runFlow = (client: Agent, intent: Intent): Promise<XmppResult> => {
  let settled = false
  let registerMessage = 'Account creato e autenticato.'

  return new Promise((resolve) => {
    const cleanup = () => {
      client.removeListener('session:started', handleSessionStarted)
      client.removeListener('auth:failed', handleAuthFailed)
      client.removeListener('stream:error', handleStreamError)
      client.removeListener('disconnected', handleDisconnected)
      removeCustomListener(client, 'register:completed', handleRegisterCompleted)
      removeCustomListener(client, 'register:error', handleRegisterError)
      removeCustomListener(client, 'register:unsupported', handleRegisterUnsupported)
    }

    const finish = (result: XmppResult) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      void client.disconnect()
      resolve(result)
    }

    const fail = (message: string, details?: string) => {
      finish({
        success: false,
        message,
        details,
      })
    }

    const handleSessionStarted = () => {
      const baseMessage =
        intent === 'register'
          ? registerMessage
          : 'Autenticazione completata con successo.'

      finish({
        success: true,
        message: baseMessage,
        jid: client.jid,
      })
    }

    const handleAuthFailed = () => {
      fail('Autenticazione rifiutata dal server XMPP.', 'Controlla username/password o se il server richiede prerequisiti.')
    }

    const handleStreamError = (error: any) => {
      fail('Il server ha chiuso lo stream.', error?.text || error?.condition)
    }

    const handleDisconnected = () => {
      if (!settled) {
        fail('Connessione terminata prima di completare la procedura.')
      }
    }

    const handleRegisterCompleted = () => {
      registerMessage = 'Account registrato e sessione aperta.'
    }

    const handleRegisterError = (error: any) => {
      fail('Registrazione fallita.', error?.message || 'Verifica che il server consenta la registrazione in-band.')
    }

    const handleRegisterUnsupported = () => {
      fail('Il server non supporta la registrazione in-band (XEP-0077).')
    }

    client.once('session:started', handleSessionStarted)
    client.once('auth:failed', handleAuthFailed)
    client.once('stream:error', handleStreamError)
    client.once('disconnected', handleDisconnected)
    addCustomListener(client, 'register:completed', handleRegisterCompleted)
    addCustomListener(client, 'register:error', handleRegisterError, true)
    addCustomListener(client, 'register:unsupported', handleRegisterUnsupported, true)

    client.connect()
  })
}

const connectWithIntent = async (settings: XmppConnectionSettings, intent: Intent) => {
  const client = await buildClient(settings)

  if (intent === 'register') {
    enableInBandRegistration(client, {
      domain: settings.domain,
      username: settings.username,
      password: settings.password,
    })
  }

  return runFlow(client, intent)
}

export const registerAccount = async (
  settings: XmppConnectionSettings,
): Promise<XmppResult> => connectWithIntent(settings, 'register')

export const login = async (
  settings: XmppConnectionSettings,
): Promise<XmppResult> => connectWithIntent(settings, 'login')
