import React, { useRef, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api'
import { Camera, CheckCircle, AlertCircle, RefreshCw, Video, UserCheck, XCircle, Pause, ShieldCheck, User } from 'lucide-react'

function CameraTerminal() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  
  const [streamActive, setStreamActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [autoScanEnabled, setAutoScanEnabled] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [cooldownActive, setCooldownActive] = useState(false)
  
  // Prompt modal state
  const [identifiedStaff, setIdentifiedStaff] = useState(null) // { staff_id, first_name, last_name, name, staff_code, department, designation, already_checked_in }
  const [confirming, setConfirming] = useState(false)
  
  const [result, setResult] = useState(null) // { status, name, message }
  const [error, setError] = useState(null)
  
  const [cameras, setCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('preferred_camera_id') || '')

  useEffect(() => {
    fetchCamerasAndStart()
    return () => {
      stopCamera()
    }
  }, [])

  async function fetchCamerasAndStart() {
    const availableCameras = await updateCameraList()
    const storedId = localStorage.getItem('preferred_camera_id')
    let deviceToUse = storedId || ''
    
    if (availableCameras.length > 0) {
      const matchExists = availableCameras.some(c => c.deviceId === storedId)
      if (!matchExists) {
        deviceToUse = availableCameras[0].deviceId
      }
    }
    
    setSelectedDeviceId(deviceToUse)
    await startCamera(deviceToUse)
  }

  async function updateCameraList() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return []
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1} (${device.deviceId.slice(0, 5)}...)`
        }))
      setCameras(videoDevices)
      return videoDevices
    } catch (e) {
      console.error('Error enumerating camera devices:', e)
      return []
    }
  }

  async function startCamera(deviceId = selectedDeviceId) {
    setError(null)
    setResult(null)
    setCameraReady(false)
    stopCamera()

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Live camera access requires HTTPS. On a phone, open Mobile Wi-Fi Terminal and use the native face capture instead, or serve this app over HTTPS.')
      return
    }

    let stream = null
    const attemptConstraints = []

    if (deviceId) {
      attemptConstraints.push({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
      attemptConstraints.push({
        video: { deviceId: deviceId }
      })
    }

    attemptConstraints.push({
      video: { width: { ideal: 640 }, height: { ideal: 480 } }
    })
    attemptConstraints.push({ video: true })

    let lastError = null
    for (const constraints of attemptConstraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (stream) break
      } catch (err) {
        lastError = err
      }
    }

    if (!stream) {
      console.error("Camera access error:", lastError)
      setError(parseCameraError(lastError))
      return
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = async () => {
        try {
          await videoRef.current?.play()
          setStreamActive(true)
          setCameraReady(videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0)
          
          const updatedDevices = await updateCameraList()
          if (updatedDevices.length > 0 && !selectedDeviceId) {
            const activeTrack = stream.getVideoTracks()[0]
            const activeSettings = activeTrack ? activeTrack.getSettings() : {}
            if (activeSettings.deviceId) {
              setSelectedDeviceId(activeSettings.deviceId)
              localStorage.setItem('preferred_camera_id', activeSettings.deviceId)
            }
          }
        } catch (playError) {
          console.error('Camera playback error:', playError)
          setError('The camera started but could not play the video feed. Please retry.')
        }
      }
    }
  }

  function parseCameraError(err) {
    if (!err) return "Unable to access camera. Please verify permissions."
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return "Camera permission denied. Please allow browser camera access and verify Windows Privacy Settings -> Camera."
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return "USB Camera is already in use by another program (e.g., Zoom, Teams, Skype, or Windows Camera app). Please close it and retry."
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return "No camera device found. Please verify your USB camera cable connection."
    }
    if (err.name === 'OverconstrainedError') {
      return "The selected camera settings are unsupported by this USB camera device."
    }
    return `Camera access error (${err.name || 'Unknown'}): ${err.message || 'Check camera permissions and connection.'}`
  }

  function handleCameraChange(newDeviceId) {
    setSelectedDeviceId(newDeviceId)
    if (newDeviceId) {
      localStorage.setItem('preferred_camera_id', newDeviceId)
    } else {
      localStorage.removeItem('preferred_camera_id')
    }
    startCamera(newDeviceId)
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
      setStreamActive(false)
      setCameraReady(false)
    }
  }

  const triggerCooldown = useCallback((durationMs = 5000) => {
    setCooldownActive(true)
    setTimeout(() => {
      setCooldownActive(false)
    }, durationMs)
  }, [])

  // Auto-scan logic running continuously when camera is ready
  const autoScanFrame = useCallback(async () => {
    if (
      !streamActive ||
      !cameraReady ||
      !autoScanEnabled ||
      isScanning ||
      cooldownActive ||
      identifiedStaff ||
      !videoRef.current ||
      !canvasRef.current
    ) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return
    }

    setIsScanning(true)
    try {
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) {
        setIsScanning(false)
        return
      }

      const formData = new FormData()
      formData.append('file', blob, 'autoscan.jpg')

      const res = await apiFetch('/api/attendance/identify', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        if (data.status === 'success' && data.staff_id) {
          // Identity recognized! Bring up confirmation prompt
          setIdentifiedStaff(data)
        }
      }
    } catch (err) {
      console.debug('Auto-scan check exception:', err)
    } finally {
      setIsScanning(false)
    }
  }, [streamActive, cameraReady, autoScanEnabled, isScanning, cooldownActive, identifiedStaff])

  useEffect(() => {
    const interval = setInterval(() => {
      autoScanFrame()
    }, 2500)

    return () => clearInterval(interval)
  }, [autoScanFrame])

  // Confirm identity action (Yes, That's Me)
  async function handleConfirmAttendance() {
    if (!identifiedStaff || confirming) return

    setConfirming(true)
    setError(null)
    setResult(null)

    try {
      const res = await apiFetch('/api/attendance/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: identifiedStaff.staff_id })
      })

      const data = await res.json()

      if (res.ok && data.status === 'success') {
        setResult({
          status: 'success',
          name: data.name,
          message: data.message
        })
      } else {
        setResult({
          status: 'error',
          message: data.detail || data.message || 'Failed to record attendance.'
        })
      }
    } catch (err) {
      setResult({
        status: 'error',
        message: err.message || 'Network error while recording attendance.'
      })
    } finally {
      setConfirming(false)
      setIdentifiedStaff(null)
      triggerCooldown(5000)
    }
  }

  // Reject identity action (No, Not Me)
  function handleRejectIdentity() {
    setIdentifiedStaff(null)
    setResult({
      status: 'error',
      message: 'Verification prompt dismissed. Scanning will resume in 5 seconds.'
    })
    triggerCooldown(5000)
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>Attendance Camera Terminal</h1>
          <p>Automatic continuous face recognition terminal</p>
        </div>
      </div>

      <div className="glass-card camera-container">
        {/* Camera Selector & Auto-Scan Toggle Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Video size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <select
              value={selectedDeviceId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.75rem', appearance: 'none', cursor: 'pointer', width: '100%' }}
            >
              {cameras.length === 0 && <option value="">Select Camera Device...</option>}
              {cameras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary"
            onClick={fetchCamerasAndStart}
            title="Rescan video devices"
            style={{ padding: '0.65rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} />
            Rescan
          </button>

          <button
            className={`btn ${autoScanEnabled ? 'btn-secondary' : ''}`}
            onClick={() => setAutoScanEnabled(!autoScanEnabled)}
            style={{
              padding: '0.65rem 1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderColor: autoScanEnabled ? 'var(--status-success)' : 'var(--border-color)',
              color: autoScanEnabled ? 'var(--status-success)' : 'var(--text-secondary)'
            }}
          >
            {autoScanEnabled ? (
              <>
                <span className="pulse-dot"></span>
                Auto-Scan ON
              </>
            ) : (
              <>
                <Pause size={16} />
                Auto-Scan Paused
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--status-danger)',
            color: 'var(--status-danger)',
            padding: '1rem',
            borderRadius: '10px',
            width: '100%'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
            <button
              className="btn btn-secondary"
              style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem', flexShrink: 0 }}
              onClick={() => startCamera(selectedDeviceId)}
            >
              Retry
            </button>
          </div>
        )}

        <div className="video-wrapper">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="webcam-feed"
          />
          {cameraReady && (
            <>
              <div className="scan-overlay"></div>
              <div className="scan-line"></div>
              
              {/* Live Status Indicator Overlay */}
              <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                backgroundColor: 'rgba(10, 14, 26, 0.75)',
                backdropFilter: 'blur(8px)',
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                {cooldownActive ? (
                  <>
                    <RefreshCw size={14} style={{ color: 'var(--status-warning)' }} />
                    <span>Cooldown active...</span>
                  </>
                ) : isScanning ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span>Scanning face...</span>
                  </>
                ) : autoScanEnabled ? (
                  <>
                    <span className="pulse-dot"></span>
                    <span>Auto-Scanning Active</span>
                  </>
                ) : (
                  <>
                    <Pause size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Auto-Scan Paused</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Hidden Canvas for captures */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {result && (
          <div className="result-card" style={{
            backgroundColor: result.status === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${result.status === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`
          }}>
            {result.status === 'success' ? (
              <>
                <CheckCircle size={24} style={{ color: 'var(--status-success)' }} />
                <div>
                  <h4 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--status-success)' }}>{result.name}</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{result.message}</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={24} style={{ color: 'var(--status-danger)' }} />
                <div>
                  <h4 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--status-danger)' }}>Status Notice</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{result.message}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Identity Recognition Confirmation Modal */}
      {identifiedStaff && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--accent-gradient)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                marginBottom: '0.75rem',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.35)'
              }}>
                <ShieldCheck size={32} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-primary)' }}>Identity Recognized!</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Please verify if you are the staff member recognized:
              </p>
            </div>

            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)',
                border: '1px solid var(--border-color)',
                flexShrink: 0
              }}>
                <User size={24} />
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {identifiedStaff.name}
                </h4>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  <span>Code: <strong style={{ color: 'var(--text-primary)' }}>{identifiedStaff.staff_code}</strong></span>
                  {identifiedStaff.department && (
                    <span>• Dept: <strong style={{ color: 'var(--text-primary)' }}>{identifiedStaff.department}</strong></span>
                  )}
                </div>
                {identifiedStaff.already_checked_in && (
                  <span style={{
                    display: 'inline-block',
                    marginTop: '0.4rem',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--status-warning)',
                    border: '1px solid var(--status-warning)'
                  }}>
                    Already Checked In Today
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-danger"
                onClick={handleRejectIdentity}
                disabled={confirming}
                style={{ flex: 1, padding: '0.85rem' }}
              >
                <XCircle size={18} />
                No, Not Me
              </button>

              <button
                className="btn"
                onClick={handleConfirmAttendance}
                disabled={confirming}
                style={{ flex: 1.2, padding: '0.85rem' }}
              >
                {confirming ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                    Logging...
                  </>
                ) : (
                  <>
                    <UserCheck size={18} />
                    Yes, That's Me
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  )
}

export default CameraTerminal
