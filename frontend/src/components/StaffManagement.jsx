import React, { useState, useEffect, useRef } from 'react'
import { UserPlus, List, Check, AlertCircle, Camera, Upload, RefreshCw, Video } from 'lucide-react'

function StaffManagement() {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)

  // Registration Form State
  const [formData, setFormData] = useState({
    staff_code: '',
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    designation: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null) // { type, text }

  // Face Enrollment State
  const [newStaffId, setNewStaffId] = useState(null)
  const [newStaffName, setNewStaffName] = useState('')
  const [enrollMethod, setEnrollMethod] = useState('upload') // 'upload' or 'camera'
  const [uploadFile, setUploadFile] = useState(null)

  // Camera Devices and State
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [streamActive, setStreamActive] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('preferred_camera_id') || '')

  useEffect(() => {
    fetchStaff()
    return () => {
      stopCamera()
    }
  }, [])

  async function fetchStaff() {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      if (Array.isArray(data)) {
        setStaffList(data)
      } else {
        console.error("Non-array data received from /api/staff:", data)
        setStaffList([])
      }
    } catch (err) {
      console.error("Error fetching staff list:", err)
      setStaffList([])
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleProfileSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        setNewStaffId(data.id)
        setNewStaffName(`${data.first_name} ${data.last_name}`)
        setMessage({ type: 'success', text: `Profile registered! Now enroll the face for ${data.first_name}.` })
        setFormData({
          staff_code: '',
          first_name: '',
          last_name: '',
          email: '',
          department: '',
          designation: ''
        })
      } else {
        setMessage({ type: 'error', text: data.detail || "Profile registration failed." })
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Server communication error." })
    } finally {
      setSubmitting(false)
    }
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

  // --- Web Cam Functions for Enrollment ---
  async function startCamera(deviceId = selectedDeviceId) {
    setMessage(null)
    stopCamera()

    const availableCameras = await updateCameraList()
    let targetDeviceId = deviceId || localStorage.getItem('preferred_camera_id') || ''
    if (availableCameras.length > 0 && !availableCameras.some(c => c.deviceId === targetDeviceId)) {
      targetDeviceId = availableCameras[0].deviceId
    }
    setSelectedDeviceId(targetDeviceId)

    let stream = null
    const attemptConstraints = []
    if (targetDeviceId) {
      attemptConstraints.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
      })
      attemptConstraints.push({ video: { deviceId: targetDeviceId } })
    }
    attemptConstraints.push({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
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
      let textMsg = "Unable to access camera for enrollment. Please verify permissions or use file upload."
      if (lastError) {
        if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
          textMsg = "USB Camera is in use by another program (e.g. Zoom, Teams, Skype, Camera App). Close other apps and retry."
        } else if (lastError.name === 'NotAllowedError') {
          textMsg = "Camera permission denied. Check browser permissions and Windows Privacy Settings -> Camera."
        }
      }
      setMessage({ type: 'error', text: textMsg })
      return
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      setStreamActive(true)
      await updateCameraList()
    }
  }

  function handleCameraChange(newDeviceId) {
    setSelectedDeviceId(newDeviceId)
    if (newDeviceId) {
      localStorage.setItem('preferred_camera_id', newDeviceId)
    }
    startCamera(newDeviceId)
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
      setStreamActive(false)
    }
  }

  useEffect(() => {
    if (enrollMethod === 'camera' && newStaffId) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [enrollMethod, newStaffId])

  async function handleFaceEnroll(imageBlob) {
    if (!newStaffId) return
    setEnrolling(true)
    setMessage(null)

    const uploadFormData = new FormData()
    uploadFormData.append('file', imageBlob, 'profile_face.jpg')

    try {
      const res = await fetch(`/api/staff/${newStaffId}/face`, {
        method: 'POST',
        body: uploadFormData
      })

      const data = await res.json()

      if (res.ok && data.status === 'success') {
        setMessage({ type: 'success', text: `Face successfully enrolled for ${newStaffName}! Registration complete.` })
        stopCamera()
        setNewStaffId(null)
        setNewStaffName('')
        setUploadFile(null)
        fetchStaff()
      } else {
        setMessage({ type: 'error', text: data.detail || "Face enrollment failed. Please try again with a clear photo." })
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Server communication error during face enrollment." })
    } finally {
      setEnrolling(false)
    }
  }

  function handleFileUploadSubmit(e) {
    e.preventDefault()
    if (!uploadFile) return
    handleFaceEnroll(uploadFile)
  }

  function captureAndEnroll() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        handleFaceEnroll(blob)
      }
    }, 'image/jpeg', 0.95)
  }

  function startEnrollForStaff(staff) {
    setNewStaffId(staff.id)
    setNewStaffName(`${staff.first_name} ${staff.last_name}`)
    setMessage(null)
    setUploadFile(null)
  }

  function cancelEnrollment() {
    stopCamera()
    setNewStaffId(null)
    setNewStaffName('')
    setUploadFile(null)
    setMessage(null)
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>Staff Directory</h1>
          <p>Register profiles and enroll biometric face templates</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>

        {/* Registration Panel */}
        <div className="glass-card">
          {!newStaffId ? (
            // Phase 1: Text Details Form
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <UserPlus style={{ color: 'var(--accent-blue)' }} size={22} />
                <h2 style={{ fontSize: '1.25rem' }}>Add New Staff Profile</h2>
              </div>

              {message && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
                  color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem'
                }}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <span>{message.text}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Staff Code / ID</label>
                    <input
                      type="text"
                      name="staff_code"
                      value={formData.staff_code}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g. EMP1024"
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        required
                        placeholder="firstname"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        required
                        placeholder="lastname"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="john.doe@company.com"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      placeholder="e.g. Engineering, Sales"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Designation</label>
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      placeholder="e.g. Software Engineer"
                      className="form-input"
                    />
                  </div>

                  <button type="submit" className="btn" disabled={submitting} style={{ marginTop: '0.5rem' }}>
                    {submitting ? 'Registering...' : 'Next: Enroll Face'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            // Phase 2: Face Enrollment Form
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Camera style={{ color: 'var(--accent-purple)' }} size={22} />
                  <h2 style={{ fontSize: '1.25rem' }}>Enroll Face: {newStaffName}</h2>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={cancelEnrollment}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  + Add New Profile
                </button>
              </div>

              {message && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
                  color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem'
                }}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Enrollment Mode Toggles */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                  className={`btn btn-secondary ${enrollMethod === 'upload' ? 'active' : ''}`}
                  onClick={() => setEnrollMethod('upload')}
                  style={{ flex: 1, backgroundColor: enrollMethod === 'upload' ? 'rgba(255, 255, 255, 0.05)' : '' }}
                >
                  <Upload size={16} /> File Upload
                </button>
                <button
                  className={`btn btn-secondary ${enrollMethod === 'camera' ? 'active' : ''}`}
                  onClick={() => setEnrollMethod('camera')}
                  style={{ flex: 1, backgroundColor: enrollMethod === 'camera' ? 'rgba(255, 255, 255, 0.05)' : '' }}
                >
                  <Camera size={16} /> Use Webcam
                </button>
              </div>

              {enrollMethod === 'upload' ? (
                // Upload Form
                <form onSubmit={handleFileUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="file-upload-zone" onClick={() => document.getElementById('enroll-file').click()}>
                    <Upload size={32} style={{ color: 'var(--text-secondary)' }} />
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {uploadFile ? uploadFile.name : "Click to select a profile photo"}
                    </p>
                    <input
                      id="enroll-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      style={{ display: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={cancelEnrollment}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn"
                      disabled={enrolling || !uploadFile}
                      style={{ flex: 1 }}
                    >
                      {enrolling ? 'Enrolling...' : 'Enroll Face'}
                    </button>
                  </div>
                </form>
              ) : (
                // Camera Capture Form
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
                  {/* Camera Selector Dropdown */}
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Video size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => handleCameraChange(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.25rem', fontSize: '0.85rem', appearance: 'none', cursor: 'pointer', width: '100%' }}
                      >
                        {cameras.length === 0 && <option value="">Select Camera...</option>}
                        {cameras.map((cam, idx) => (
                          <option key={cam.deviceId || idx} value={cam.deviceId}>
                            {cam.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startCamera(selectedDeviceId)}
                      title="Rescan camera devices"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <RefreshCw size={14} />
                      Rescan
                    </button>
                  </div>

                  <div style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#000',
                    position: 'relative'
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={cancelEnrollment}
                      style={{ flex: 1 }}
                      disabled={enrolling}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={captureAndEnroll}
                      disabled={enrolling || !streamActive}
                      style={{ flex: 1 }}
                    >
                      {enrolling ? (
                        <>
                          <RefreshCw style={{ animation: 'spin 1.5s linear infinite' }} size={16} />
                          Enrolling...
                        </>
                      ) : (
                        'Capture & Enroll'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Directory List */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <List style={{ color: 'var(--accent-purple)' }} size={22} />
            <h2 style={{ fontSize: '1.25rem' }}>Registered Staff Directory</h2>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading directory...</p>
          ) : staffList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              <p>No staff profiles found. Register your first staff member.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Dept / Role</th>
                    <th>Biometric</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(item => {
                    const isEnrolled = item.embeddings && item.embeddings.length > 0;
                    const isSelected = newStaffId === item.id;
                    return (
                      <tr key={item.id} style={{ backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : undefined }}>
                        <td style={{ fontWeight: '600' }}>{item.staff_code}</td>
                        <td>{item.first_name} {item.last_name}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.email}</td>
                        <td>
                          <div>{item.department || 'N/A'}</div>
                          {item.designation && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.designation}</div>}
                        </td>
                        <td>
                          <span className={`badge ${isEnrolled ? 'success' : 'danger'}`}>
                            {isEnrolled ? 'Enrolled' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              borderColor: isSelected ? 'var(--accent-blue)' : undefined
                            }}
                            onClick={() => startEnrollForStaff(item)}
                          >
                            <Camera size={14} />
                            {isEnrolled ? 'Re-enroll Face' : 'Enroll Face'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StaffManagement

