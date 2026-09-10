import React, { useState, useEffect } from 'react'
import { apiFetch, readJson } from '../api'
import { Wifi, WifiOff, Smartphone, LogIn, LogOut, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, Camera, ScanFace, X } from 'lucide-react'

function MobileTerminal() {
  const [networkInfo, setNetworkInfo] = useState(null)
  const [loadingNetwork, setLoadingNetwork] = useState(true)
  const [mode, setMode] = useState('check-in') // 'check-in' or 'check-out'
  const [faceImage, setFaceImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [alreadyPresent, setAlreadyPresent] = useState(null)

  useEffect(() => {
    fetchNetworkInfo()
  }, [])

  async function fetchNetworkInfo() {
    setLoadingNetwork(true)
    setError(null)
    try {
      const response = await apiFetch('/api/network/info')
      const netData = await readJson(response)
      if (!response.ok) throw new Error(netData.detail || 'Network check failed.')

      setNetworkInfo(netData)
    } catch (err) {
      console.error("Failed to load network info:", err)
      setError("Failed to fetch server network configuration.")
    } finally {
      setLoadingNetwork(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setResult(null)
    setError(null)

    if (!faceImage) {
      setError('Please capture a face image before continuing.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', faceImage)
      const identifyEndpoint = mode === 'check-in' ? '/api/attendance/verify-face' : '/api/attendance/identify'
      const identifyResponse = await apiFetch(identifyEndpoint, { method: 'POST', body: formData })
      const identifyData = await readJson(identifyResponse)
      if (!identifyResponse.ok) throw new Error(identifyData.detail || 'Face verification failed.')

      if (mode === 'check-in' && identifyData.already_checked_in) {
        setAlreadyPresent(identifyData)
        setFaceImage(null)
        return
      }

      let message = identifyData.message
      if (mode === 'check-out') {
        const checkoutResponse = await apiFetch('/api/attendance/check-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staff_id: identifyData.staff_id })
        })
        const checkoutData = await readJson(checkoutResponse)
        if (!checkoutResponse.ok) throw new Error(checkoutData.detail || 'Check-out failed.')
        message = checkoutData.message
        window.dispatchEvent(new Event('attendance-updated'))
      }
      setResult({ status: 'success', name: identifyData.name, message, mode })
      setFaceImage(null)
    } catch (err) {
      setError(err.message || "Server communication error.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mobile-terminal">
      {alreadyPresent && (
        <div className="duplicate-attendance-backdrop" role="presentation">
          <section className="duplicate-attendance-modal" role="alertdialog" aria-modal="true" aria-labelledby="already-present-title">
            <div className="duplicate-attendance-icon"><AlertCircle size={28} /></div>
            <h2 id="already-present-title">Already marked present</h2>
            <p>{alreadyPresent.name} is already checked in today. No second attendance record was created.</p>
            <button className="btn btn-secondary" type="button" onClick={() => setAlreadyPresent(null)}><X size={18} /> Close</button>
          </section>
        </div>
      )}
      <div className="header">
        <div className="header-title">
          <h1>Mobile Wi-Fi Check-In & Out</h1>
          <p>Check in or out directly from your smartphone on the campus Wi-Fi network</p>
        </div>
      </div>

      <div className="dashboard-grid mobile-terminal-grid" style={{ gap: '1.5rem' }}>

        {/* Left Column: Wi-Fi Status & Phone Access Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Wi-Fi Network Banner */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {networkInfo?.is_on_wifi ? (
                  <Wifi size={24} style={{ color: 'var(--status-success)' }} />
                ) : (
                  <WifiOff size={24} style={{ color: 'var(--status-danger)' }} />
                )}
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Local Network Status</h3>
              </div>
              <button
                className="btn btn-secondary"
                onClick={fetchNetworkInfo}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {loadingNetwork ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Detecting local Wi-Fi IP configuration...</p>
            ) : networkInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{
                  backgroundColor: networkInfo.is_on_wifi ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${networkInfo.is_on_wifi ? 'var(--status-success)' : 'var(--status-danger)'}`,
                  color: networkInfo.is_on_wifi ? 'var(--status-success)' : 'var(--status-danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {networkInfo.is_on_wifi ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{networkInfo.is_on_wifi ? "Connected to Local Wi-Fi Network" : "Not Detected on Office Wi-Fi"}</span>
                </div>

                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.88rem'
                }}>
                  <div className="network-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Server Local IP:</span>
                    <strong style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{networkInfo.server_ip}</strong>
                  </div>
                  <div className="network-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Your Device IP:</span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{networkInfo.client_ip}</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Smartphone Access Guide Card */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Smartphone size={22} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Mobile Phone Quick Access</h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              To check in or check out directly from your phone:
            </p>

            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>Connect your mobile phone to the same **Campus / Office Wi-Fi**.</li>
              <li>Open your phone's web browser (Safari or Chrome).</li>
              <li>
                Type this exact URL address in your browser:
                <div style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid var(--accent-blue)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  marginTop: '0.4rem',
                  fontSize: '0.95rem'
                }}>
                  {networkInfo?.frontend_mobile_url || 'http://192.168.x.x:5173'}
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* Right Column: Interactive Mobile Check-In / Check-Out Form */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <ShieldCheck size={24} style={{ color: 'var(--accent-blue)' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Wi-Fi Verification Terminal</h2>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="mode-switcher" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${mode === 'check-in' ? '' : 'btn-secondary'}`}
              onClick={() => setMode('check-in')}
              style={{
                flex: 1,
                padding: '0.85rem',
                backgroundColor: mode === 'check-in' ? 'var(--status-success)' : '',
                borderColor: mode === 'check-in' ? 'var(--status-success)' : ''
              }}
            >
              <LogIn size={18} />
              Check In Mode
            </button>

            <button
              className={`btn ${mode === 'check-out' ? '' : 'btn-secondary'}`}
              onClick={() => setMode('check-out')}
              style={{
                flex: 1,
                padding: '0.85rem',
                backgroundColor: mode === 'check-out' ? 'var(--accent-purple)' : '',
                borderColor: mode === 'check-out' ? 'var(--accent-purple)' : ''
              }}
            >
              <LogOut size={18} />
              Check Out Mode
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            border: '1px solid var(--accent-blue)',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem'
          }}>
            <ScanFace size={22} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span>Identity is verified by facial recognition. Staff codes are not accepted on this terminal.</span>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--status-danger)',
              color: 'var(--status-danger)',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              fontSize: '0.9rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid var(--status-success)',
              color: 'var(--status-success)',
              padding: '1rem',
              borderRadius: '12px',
              marginBottom: '1.5rem'
            }}>
              <CheckCircle size={24} style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontWeight: '700', fontSize: '1.05rem' }}>{result.name}</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{result.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Live face capture</label>
              <input type="file" accept="image/*" capture="user" onChange={(e) => setFaceImage(e.target.files?.[0] || null)} className="form-input" required />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Look directly at the camera and make sure your face is clearly visible.</span>
            </div>

            <button
              type="submit"
              className="btn"
              disabled={submitting || (!networkInfo?.is_on_wifi && networkInfo !== null)}
              style={{
                marginTop: '0.5rem',
                padding: '0.95rem',
                backgroundColor: mode === 'check-in' ? 'var(--accent-blue)' : 'var(--accent-purple)'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw className="animate-spin" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                  Processing {mode === 'check-in' ? 'Check-In' : 'Check-Out'}...
                </>
              ) : (
                <>
                  {mode === 'check-in' ? <LogIn size={18} /> : <LogOut size={18} />}
                  Confirm {mode === 'check-in' ? 'Check-In' : 'Check-Out'}
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

export default MobileTerminal
