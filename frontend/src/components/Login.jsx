import React, { useState } from 'react'
import { Camera, Eye, EyeOff, LockKeyhole, Mail, LogIn } from 'lucide-react'

function getErrorMessage(data, status) {
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) {
    return data.detail.map(error => error.msg || JSON.stringify(error)).join(', ')
  }
  if (data?.detail && typeof data.detail === 'object') return JSON.stringify(data.detail)
  return `Sign-in failed${status ? ` (${status})` : ''}`
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(data, response.status))
      localStorage.setItem('aegis_access_token', data.access_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card glass-card">
        <div className="login-brand">
          <div className="logo-icon"><Camera size={24} /></div>
          <span className="logo-text">Aegis Attendance</span>
        </div>
        <h1>Welcome back</h1>
        <p className="login-subtitle">Sign in to manage attendance operations.</p>
        <form onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email</span>
            <div className="login-input"><Mail size={18} /><input type="text" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" /></div>
          </label>
          <label className="login-field">
            <span>Password</span>
            <div className="login-input">
              <LockKeyhole size={18} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword(current => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="login-submit" type="submit" disabled={loading}>
            <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default Login