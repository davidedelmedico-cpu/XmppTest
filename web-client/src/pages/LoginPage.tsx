import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import '../App.css'

type AsyncState = 'idle' | 'pending' | 'success' | 'error'

type FormStatus = {
  state: AsyncState
  message?: string
  details?: string
}

const initialStatus: FormStatus = { state: 'idle' }

/**
 * Valida e normalizza un username completo (formato: username@server.com)
 */
const validateAndNormalizeJid = (input: string): { valid: boolean; jid?: string; error?: string } => {
  const trimmed = input.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'Inserisci il tuo username completo.' }
  }

  if (!trimmed.includes('@')) {
    return { valid: false, error: 'Inserisci il tuo username completo nel formato: username@server.com' }
  }

  const parts = trimmed.split('@')
  if (parts.length !== 2) {
    return { valid: false, error: 'Formato non valido. Usa: username@server.com' }
  }

  const [local, domainPart] = parts
  const [domain, resource] = domainPart.split('/')

  if (local && local.length > 0) {
    if (local.length > 1023) {
      return { valid: false, error: 'Lo username è troppo lungo.' }
    }
  }

  if (!domain || domain.length === 0) {
    return { valid: false, error: 'Inserisci anche il server (esempio: username@server.com).' }
  }

  if (domain.length > 1023) {
    return { valid: false, error: 'Il nome del server è troppo lungo.' }
  }

  const normalizedDomain = domain.toLowerCase()
  const normalizedJid = local ? `${local}@${normalizedDomain}${resource ? `/${resource}` : ''}` : normalizedDomain

  return { valid: true, jid: normalizedJid }
}

export function LoginPage() {
  const navigate = useNavigate()
  const { connect } = useXmpp()
  const [loginForm, setLoginForm] = useState({ jid: '', password: '' })
  const [loginStatus, setLoginStatus] = useState<FormStatus>(initialStatus)

  const handleLoginChange = (field: 'jid' | 'password') => (event: ChangeEvent<HTMLInputElement>) => {
    setLoginForm((prev) => ({ ...prev, [field]: event.target.value }))
    setLoginStatus(initialStatus)
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loginStatus.state === 'pending') {
      return
    }

    const jidValidation = validateAndNormalizeJid(loginForm.jid)
    if (!jidValidation.valid) {
      setLoginStatus({ state: 'error', message: jidValidation.error || 'Username non valido.' })
      return
    }

    const password = loginForm.password

    if (!password) {
      setLoginStatus({ state: 'error', message: 'Inserisci la password per continuare.' })
      return
    }

    setLoginStatus({ state: 'pending', message: 'Connessione al server...' })

    try {
      await connect(jidValidation.jid!, password)
      setLoginStatus({
        state: 'success',
        message: 'Accesso completato con successo!',
      })
      // Naviga alle conversazioni dopo breve delay
      setTimeout(() => {
        navigate('/conversations')
      }, 500)
    } catch (error) {
      setLoginStatus({
        state: 'error',
        message: 'Errore durante il login.',
        details: (error as Error).message,
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <h1>Alfred</h1>
        </div>
      </header>

      <main className="panels">
        <section className="auth-card">
          <div className="auth-card__header">
            <h3>Accedi</h3>
          </div>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Username</span>
                <input
                  autoComplete="username"
                  value={loginForm.jid}
                  onChange={handleLoginChange('jid')}
                  placeholder="mario@conversations.im"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={handleLoginChange('password')}
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit" disabled={loginStatus.state === 'pending'}>
                {loginStatus.state === 'pending' ? 'Connessione in corso...' : 'Collegati'}
              </button>
            </div>
          </form>
          <StatusBanner status={loginStatus} successHint="Accesso completato con successo!" />
        </section>
      </main>
    </div>
  )
}

const StatusBanner = ({ status, successHint }: { status: FormStatus; successHint: string }) => {
  if (status.state === 'idle') {
    return null
  }

  return (
    <div className={`status status--${status.state}`}>
      <p>{status.message}</p>
      {status.details && <p className="status__details">{status.details}</p>}
      {status.state === 'success' && successHint && <p className="status__hint">{successHint}</p>}
    </div>
  )
}
