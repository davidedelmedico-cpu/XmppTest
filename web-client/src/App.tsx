import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { DEFAULT_XMPP_DOMAIN, DEFAULT_XMPP_WEBSOCKET, UI } from './config/constants'
import { login, registerAccount } from './services/xmpp'

const MIN_PASSWORD_LENGTH = 6

type AsyncState = 'idle' | 'pending' | 'success' | 'error'

type FormStatus = {
  state: AsyncState
  message?: string
  details?: string
}

const initialStatus: FormStatus = { state: 'idle' }

const sanitizeDomain = (value: string) => value.trim().toLowerCase()
const sanitizeWebsocket = (value: string) => value.trim()

function App() {
  const [domain, setDomain] = useState(DEFAULT_XMPP_DOMAIN)
  const [websocketUrl, setWebsocketUrl] = useState(DEFAULT_XMPP_WEBSOCKET)

  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirm: '' })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })

  const [registerStatus, setRegisterStatus] = useState<FormStatus>(initialStatus)
  const [loginStatus, setLoginStatus] = useState<FormStatus>(initialStatus)

  const serverSummary = useMemo(() => {
    const cleanDomain = sanitizeDomain(domain) || DEFAULT_XMPP_DOMAIN
    const ws = sanitizeWebsocket(websocketUrl)
    return {
      domain: cleanDomain,
      websocket: ws.length ? ws : 'auto-discovery',
    }
  }, [domain, websocketUrl])

  const handleRegisterChange = (field: 'username' | 'password' | 'confirm') => (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterForm((prev) => ({ ...prev, [field]: event.target.value }))
    setRegisterStatus(initialStatus)
  }

  const handleLoginChange = (field: 'username' | 'password') => (event: ChangeEvent<HTMLInputElement>) => {
    setLoginForm((prev) => ({ ...prev, [field]: event.target.value }))
    setLoginStatus(initialStatus)
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (registerStatus.state === 'pending') {
      return
    }

    const username = registerForm.username.trim()
    const password = registerForm.password
    const confirm = registerForm.confirm

    if (!username) {
      setRegisterStatus({ state: 'error', message: 'Inserisci un username.' })
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setRegisterStatus({
        state: 'error',
        message: `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`,
      })
      return
    }

    if (password !== confirm) {
      setRegisterStatus({ state: 'error', message: 'Le due password non coincidono.' })
      return
    }

    setRegisterStatus({ state: 'pending', message: 'Invio richiesta di registrazione...' })

    try {
      const result = await registerAccount({
        domain: sanitizeDomain(domain) || DEFAULT_XMPP_DOMAIN,
        websocketUrl: sanitizeWebsocket(websocketUrl),
        username,
        password,
      })

      setRegisterStatus({
        state: result.success ? 'success' : 'error',
        message: result.message,
        details: result.success ? result.jid : result.details,
      })
    } catch (error) {
      setRegisterStatus({
        state: 'error',
        message: 'Errore inatteso durante la registrazione.',
        details: (error as Error).message,
      })
    }
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loginStatus.state === 'pending') {
      return
    }

    const username = loginForm.username.trim()
    const password = loginForm.password

    if (!username || !password) {
      setLoginStatus({ state: 'error', message: 'Inserisci username e password per continuare.' })
      return
    }

    setLoginStatus({ state: 'pending', message: 'Connessione al server...' })

    try {
      const result = await login({
        domain: sanitizeDomain(domain) || DEFAULT_XMPP_DOMAIN,
        websocketUrl: sanitizeWebsocket(websocketUrl),
        username,
        password,
      })

      setLoginStatus({
        state: result.success ? 'success' : 'error',
        message: result.message,
        details: result.jid || result.details,
      })
    } catch (error) {
      setLoginStatus({
        state: 'error',
        message: 'Errore inatteso durante il login.',
        details: (error as Error).message,
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Proof-of-concept</p>
          <h1>{UI.appName}</h1>
          <p className="tagline">{UI.tagline}</p>
          <ul className="checklist">
            <li>Registrazione XEP-0077 senza backend.</li>
            <li>Login e verifica presenza via WebSocket sicuro.</li>
            <li>Pronto per deploy statico (GitHub Pages/Netlify).</li>
          </ul>
        </div>
        <div className="server-card">
          <h2>Server XMPP</h2>
          <p className="muted">Personalizza dominio e WebSocket endpoint prima dei test.</p>
          <label className="field">
            <span>Dominio</span>
            <input value={domain} onChange={(event) => setDomain(event.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>WebSocket URL</span>
            <input value={websocketUrl} onChange={(event) => setWebsocketUrl(event.target.value)} autoComplete="off" />
          </label>
          <p className="server-summary">
            Connessione attuale: <strong>{serverSummary.domain}</strong> →{' '}
            <strong>{serverSummary.websocket}</strong>
          </p>
        </div>
      </header>

      <main className="panels">
        <section className="auth-card">
          <div className="auth-card__header">
            <h3>Crea account</h3>
            <p>Richiede che il server supporti la registrazione in-band.</p>
          </div>
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Username</span>
                <input
                  autoComplete="username"
                  value={registerForm.username}
                  onChange={handleRegisterChange('username')}
                  placeholder="es. nomeutente"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={handleRegisterChange('password')}
                  placeholder="Minimo 6 caratteri"
                />
              </label>
              <label className="field">
                <span>Conferma</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.confirm}
                  onChange={handleRegisterChange('confirm')}
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit" disabled={registerStatus.state === 'pending'}>
                {registerStatus.state === 'pending' ? 'Attendere...' : 'Registra e collega'}
              </button>
            </div>
          </form>
          <StatusBanner status={registerStatus} successHint="Copiati subito il JID, ti servirà per il login." />
        </section>

        <section className="auth-card">
          <div className="auth-card__header">
            <h3>Accedi</h3>
            <p>Usa un JID già esistente sullo stesso dominio.</p>
          </div>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Username</span>
                <input
                  autoComplete="username"
                  value={loginForm.username}
                  onChange={handleLoginChange('username')}
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
          <StatusBanner status={loginStatus} successHint="Sessione pronta: puoi passare al roster/chat." />
        </section>
      </main>

      <section className="notes">
        <h4>Come testare rapidamente</h4>
        <ol>
          <li>Registra un account usando il server pubblico suggerito o il tuo.</li>
          <li>Una volta creato, ripeti il login per confermare che la sessione parte.</li>
          <li>Successivamente estenderemo l'interfaccia con roster e conversazioni.</li>
        </ol>
        <p className="muted">
          Deployment: esegui <code>npm run build</code> e pubblica la cartella <code>dist/</code> su GitHub Pages o qualsiasi hosting
          statico.
        </p>
      </section>
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

export default App
