import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthenticatedApp } from './AuthenticatedApp'
import { LOGIN_ENDPOINT } from './api'
import './App.css'

const TOKEN_STORAGE_KEY = 'authToken'
const EMAIL_STORAGE_KEY = 'authUserEmail'
const DEMO_TOKEN = 'demo-auth-token'
const DEMO_MODE_ENABLED = (import.meta.env.VITE_ENABLE_DEMO_LOGIN ?? '').toLowerCase() === 'true'

type LoginStatus = {
  type: 'success' | 'error'
  message: string
}

type Session = {
  email: string
  token: string
}

function getRequestErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'No se pudo conectar con el servidor de autenticacion.'
  }

  const message = error.message.trim()

  if (!message) {
    return 'No se pudo conectar con el servidor de autenticacion.'
  }

  if (message === 'Bad Gateway') {
    return 'La API configurada no responde correctamente.'
  }

  if (message === 'Failed to fetch') {
    return 'No se pudo alcanzar el servidor de autenticacion.'
  }

  return message
}

function getInitialSession(): Session | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  const email = window.localStorage.getItem(EMAIL_STORAGE_KEY)

  if (!token || !email) {
    return null
  }

  return { token, email }
}

function clearSessionStorage() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(EMAIL_STORAGE_KEY)
}

function looksLikeAccessToken(value: string) {
  const trimmed = value.trim()

  if (!trimmed || /\s/.test(trimmed)) {
    return false
  }

  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
    return true
  }

  return trimmed.length >= 24
}

function findToken(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return looksLikeAccessToken(payload) ? payload.trim() : null
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const response = payload as Record<string, unknown>
  const tokenKeys = ['token', 'accessToken', 'access_token', 'jwt']

  for (const key of tokenKeys) {
    const value = response[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  for (const value of Object.values(response)) {
    if (!value || typeof value !== 'object') {
      continue
    }

    const token = findToken(value)

    if (token) {
      return token
    }
  }

  return null
}

function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const response = payload as Record<string, unknown>
  const message = response.message ?? response.error ?? response.detail

  return typeof message === 'string' && message.trim() ? message : null
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7.5h15a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15V9a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m4 8 8 5 8-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10V8a3.5 3.5 0 1 1 7 0v2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4 20 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.6 6.3A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a14.4 14.4 0 0 1-3 3.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.6 9.1A14.2 14.2 0 0 0 3 12s3.5 6 9 6c1 0 2-.2 2.8-.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.3 10.2A2.9 2.9 0 0 0 9.5 12a2.5 2.5 0 0 0 4 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(getInitialSession)
  const [email, setEmail] = useState(session?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setLoginStatus(null)

    if (DEMO_MODE_ENABLED) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, DEMO_TOKEN)
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email)
      setPassword('')
      setSession({ token: DEMO_TOKEN, email })
      setLoginStatus({
        type: 'success',
        message: 'Sesion iniciada en modo demo.',
      })
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const isJson = response.headers.get('content-type')?.includes('application/json')
      const payload: unknown = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload)
            ?? (response.status === 502
              ? 'La API configurada no responde correctamente.'
              : 'No se pudo iniciar sesion.'),
        )
      }

      const token = findToken(payload)

      if (!token) {
        throw new Error('La API respondio correctamente, pero no envio un token.')
      }

      window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email)
      setPassword('')
      setSession({ token, email })
      setLoginStatus({
        type: 'success',
        message: 'Sesion iniciada correctamente.',
      })
    } catch (error) {
      clearSessionStorage()
      setSession(null)
      setLoginStatus({
        type: 'error',
        message: getRequestErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    clearSessionStorage()
    window.localStorage.removeItem('cyclix-admin-section')
    setSession(null)
    setPassword('')
    setLoginStatus(null)
  }

  if (session) {
    return <AuthenticatedApp authToken={session.token} userEmail={session.email} onLogout={handleLogout} />
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <form className="form-panel" onSubmit={handleSubmit}>
          {DEMO_MODE_ENABLED && (
            <p className="demo-banner" role="status">
              Modo demo activo. El acceso local no requiere backend.
            </p>
          )}

          <div className="heading">
            <img className="heading-logo" src="/cyclix-logo-transparent.png" alt="Cyclix" />
            <h1 id="login-title">Iniciar Sesi&oacute;n</h1>
            <p>Ingresa tus credenciales para continuar</p>
          </div>

          <label className="field">
            <span>Correo Electr&oacute;nico</span>
            <div className="input-wrap">
              <span className="input-icon">
                <MailIcon />
              </span>
              <input
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                autoComplete="email"
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>

          <label className="field">
            <span>Contrase&ntilde;a</span>
            <div className="input-wrap">
              <span className="input-icon">
                <LockIcon />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
                value={password}
                autoComplete="current-password"
                required
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="visibility-toggle"
                type="button"
                aria-label={showPassword ? 'Ocultar contrase\u00f1a' : 'Mostrar contrase\u00f1a'}
                onClick={() => setShowPassword((current) => !current)}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </label>

          {loginStatus && (
            <p className={`form-message ${loginStatus.type}`} role="status">
              {loginStatus.message}
            </p>
          )}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Iniciar Sesi\u00f3n'}
          </button>
        </form>
      </section>

      <p className="footer-note">&copy; 2026 Cyclix. Todos los derechos reservados - 1190 032.</p>
    </main>
  )
}

export default App
