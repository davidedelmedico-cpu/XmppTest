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

const buildClient = (settings: XmppConnectionSettings): Agent => {
  const { domain, websocketUrl, username, password, resource = DEFAULT_RESOURCE } = settings
  const trimmedWs = websocketUrl?.trim()
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
      websocket: trimmedWs && trimmedWs.length > 0 ? trimmedWs : true,
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
  const client = buildClient(settings)

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
