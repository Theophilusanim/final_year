import React, { useRef, useState, useEffect } from 'react'
import { Camera, CheckCircle, AlertCircle, RefreshCw, Video } from 'lucide-react'

function CameraTerminal() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  
  const [streamActive, setStreamActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [verifying, setVerifying] = useState(false)
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
          
          // Re-enumerate to get labeled device names now that permission is granted
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

  async function captureAndVerify() {
    if (!streamActive || !cameraReady || verifying || !videoRef.current || !canvasRef.current) return
    
    setVerifying(true)
    setResult(null)
    setError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
        setError('The camera is still preparing a frame. Please wait a moment and try again.')
        setVerifying(false)
        return
      }

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Could not prepare the image capture canvas.')
      }
      
      // Draw frame to canvas
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert to blob and send
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) {
        throw new Error('Failed to capture an image from the video feed.')
      }

      const formData = new FormData()
      formData.append('file', blob, 'face_capture.jpg')
      const res = await fetch('/api/attendance/verify-face', {
        method: 'POST',
        body: formData
      })
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json') ? await res.json() : {}

      if (res.ok && data.status === 'success') {
        setResult({
          status: 'success',
          name: data.name,
          message: data.message
        })
      } else {
        setResult({
          status: 'error',
          message: data.detail || data.message || `Verification request failed (${res.status}).`
        })
      }
      setVerifying(false)
      
    } catch (err) {
      console.error(err)
      setError(err.message || 'Verification process failed.')
      setVerifying(false)
    }
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>Attendance Camera Terminal</h1>
          <p>Scan your face to register check-in logs</p>
        </div>
      </div>

      <div className="glass-card camera-container">
        {/* Camera Selector Dropdown */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
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
            </>
          )}
        </div>

        {/* Hidden Canvas for captures */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
          <button 
            className="btn" 
            disabled={!cameraReady || verifying} 
            onClick={captureAndVerify}
            style={{ minWidth: '180px' }}
          >
            {verifying ? (
              <>
                <RefreshCw className="animate-spin" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                Verifying Face...
              </>
            ) : (
              <>
                <Camera size={18} />
                Verify Identity
              </>
            )}
          </button>
        </div>

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
                  <h4 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--status-danger)' }}>Verification Failed</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{result.message}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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

