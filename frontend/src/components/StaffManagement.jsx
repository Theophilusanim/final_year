import React, { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api'
import { UserPlus, List, Check, AlertCircle, Camera, Upload, RefreshCw, Video, Layers, PlusCircle, CheckCircle, Edit3, Trash2, X, ShieldAlert } from 'lucide-react'

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
  const [enrollMethod, setEnrollMethod] = useState('camera')
  const [uploadFiles, setUploadFiles] = useState([])

  // Multi-Sample Wizard State
  const [captureStep, setCaptureStep] = useState(1)
  const [enrolledCount, setEnrolledCount] = useState(0)

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState(null)
  const [editFormData, setEditFormData] = useState({
    staff_code: '',
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    designation: '',
    status: true
  })
  const [updating, setUpdating] = useState(false)

  // Delete Staff Modal State
  const [deletingStaff, setDeletingStaff] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const stepPrompts = [
    { step: 1, title: 'Sample 1: Frontal View', desc: 'Look directly into the camera with a neutral expression.' },
    { step: 2, title: 'Sample 2: Angle / Expression', desc: 'Tilt your head slightly or show a natural smile.' },
    { step: 3, title: 'Sample 3: Side Angle', desc: 'Turn your head slightly to the left or right.' }
  ]

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
      const res = await apiFetch('/api/staff')
      const data = await res.json()
      if (Array.isArray(data)) {
        setStaffList(data)
      } else {
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
      const res = await apiFetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        setNewStaffId(data.id)
        setNewStaffName(`${data.first_name} ${data.last_name}`)
        setCaptureStep(1)
        setEnrolledCount(0)
        setMessage({ type: 'success', text: `Profile created for ${data.first_name}! Now capture 3 multi-angle face samples.` })
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

  // --- Edit Staff Functions ---
  function openEditModal(staff) {
    setEditingStaff(staff)
    setEditFormData({
      staff_code: staff.staff_code || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      email: staff.email || '',
      department: staff.department || '',
      designation: staff.designation || '',
      status: staff.status !== undefined ? staff.status : true
    })
  }

  function handleEditInputChange(e) {
    const { name, value, type, checked } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleUpdateStaffSubmit(e) {
    e.preventDefault()
    if (!editingStaff) return

    setUpdating(true)
    try {
      const res = await apiFetch(`/api/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `Profile for ${data.first_name} ${data.last_name} updated successfully!` })
        setEditingStaff(null)
        fetchStaff()
      } else {
        alert(data.detail || "Failed to update staff profile.")
      }
    } catch (err) {
      alert("Communication error while updating staff profile.")
    } finally {
      setUpdating(false)
    }
  }

  // --- Delete Staff Functions ---
  async function handleDeleteStaffConfirm() {
    if (!deletingStaff) return

    setDeleting(true)
    try {
      const res = await apiFetch(`/api/staff/${deletingStaff.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || `Staff profile deleted.` })
        setDeletingStaff(null)
        fetchStaff()
      } else {
        alert(data.detail || "Failed to delete staff profile.")
      }
    } catch (err) {
      alert("Error communicating with server during deletion.")
    } finally {
      setDeleting(false)
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

  async function startCamera(deviceId = selectedDeviceId) {
    setMessage(null)
    stopCamera()

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage({ type: 'error', text: 'Live camera access requires HTTPS. Use the phone browser native capture for mobile attendance, or serve this app over HTTPS.' })
      return
    }

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
      let textMsg = "Unable to access camera for enrollment. Please verify permissions or use file upload."
      if (lastError) {
        if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
          textMsg = "USB Camera is in use by another program. Close other apps and retry."
        } else if (lastError.name === 'NotAllowedError') {
          textMsg = "Camera permission denied. Check browser permissions."
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

  async function handleSingleSampleEnroll(imageBlob, isAppend = false) {
    if (!newStaffId) return
    setEnrolling(true)
    setMessage(null)

    const uploadFormData = new FormData()
    uploadFormData.append('file', imageBlob, `face_sample_${captureStep}.jpg`)

    try {
      const res = await apiFetch(`/api/staff/${newStaffId}/face?append=${isAppend}`, {
        method: 'POST',
        body: uploadFormData
      })

      const data = await res.json()

      if (res.ok && data.status === 'success') {
        const currentCount = data.sample_count || (enrolledCount + 1)
        setEnrolledCount(currentCount)

        if (captureStep < 3) {
          setCaptureStep(prev => prev + 1)
          setMessage({
            type: 'success',
            text: `Sample ${captureStep}/3 saved! Now position face for Sample ${captureStep + 1}.`
          })
        } else {
          setMessage({
            type: 'success',
            text: `Multi-angle face enrollment complete for ${newStaffName}! Registered ${currentCount} samples.`
          })
          stopCamera()
          setTimeout(() => {
            setNewStaffId(null)
            setNewStaffName('')
            setUploadFiles([])
            fetchStaff()
          }, 2000)
        }
      } else {
        setMessage({ type: 'error', text: data.detail || "Face enrollment failed. Please try again with a clear photo." })
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Server communication error during face enrollment." })
    } finally {
      setEnrolling(false)
    }
  }

  async function handleBatchFileUploadSubmit(e) {
    e.preventDefault()
    if (!newStaffId || uploadFiles.length === 0) return

    setEnrolling(true)
    setMessage(null)

    const formData = new FormData()
    uploadFiles.forEach(file => {
      formData.append('files', file)
    })

    try {
      const res = await apiFetch(`/api/staff/${newStaffId}/faces/batch?append=false`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok && data.status === 'success') {
        setMessage({ type: 'success', text: data.message })
        setNewStaffId(null)
        setNewStaffName('')
        setUploadFiles([])
        fetchStaff()
      } else {
        setMessage({ type: 'error', text: data.detail || "Batch enrollment failed." })
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Server error during batch upload." })
    } finally {
      setEnrolling(false)
    }
  }

  function captureAndEnrollCurrentStep() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const isAppend = captureStep > 1
        handleSingleSampleEnroll(blob, isAppend)
      }
    }, 'image/jpeg', 0.92)
  }

  function startEnrollForStaff(staff) {
    setNewStaffId(staff.id)
    setNewStaffName(`${staff.first_name} ${staff.last_name}`)
    setCaptureStep(1)
    setEnrolledCount(staff.embeddings ? staff.embeddings.length : 0)
    setMessage(null)
    setUploadFiles([])
  }

  function cancelEnrollment() {
    stopCamera()
    setNewStaffId(null)
    setNewStaffName('')
    setUploadFiles([])
    setMessage(null)
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>Staff Directory & Biometrics</h1>
          <p>Register, edit, view and manage staff profiles and biometric templates</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>

        {/* Registration & Multi-Sample Wizard Panel */}
        <div className="glass-card">
          {!newStaffId ? (
            /* Phase 1: Text Details Form */
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
                        placeholder="First Name"
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
                        placeholder="Last Name"
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
                      placeholder="email@company.com"
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
                    {submitting ? 'Registering...' : 'Next: Multi-Angle Face Enrollment'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Phase 2: Multi-Sample Face Enrollment Wizard */
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Layers style={{ color: 'var(--accent-purple)' }} size={22} />
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Biometric Enrollment</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{newStaffName}</p>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={cancelEnrollment}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  Close Wizard
                </button>
              </div>

              {/* Progress Steps Header */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-blue)' }}>
                    {stepPrompts[captureStep - 1].title}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Step {captureStep} of 3
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {[1, 2, 3].map(stepNum => (
                    <div
                      key={stepNum}
                      style={{
                        flex: 1,
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: stepNum < captureStep ? 'var(--status-success)' : stepNum === captureStep ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  ))}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {stepPrompts[captureStep - 1].desc}
                </p>
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
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem'
                }}>
                  {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Method Switcher */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  className={`btn btn-secondary ${enrollMethod === 'camera' ? 'active' : ''}`}
                  onClick={() => setEnrollMethod('camera')}
                  style={{ flex: 1, backgroundColor: enrollMethod === 'camera' ? 'rgba(59, 130, 246, 0.15)' : '', borderColor: enrollMethod === 'camera' ? 'var(--accent-blue)' : '' }}
                >
                  <Camera size={16} /> Live Webcam Scan
                </button>
                <button
                  className={`btn btn-secondary ${enrollMethod === 'upload' ? 'active' : ''}`}
                  onClick={() => setEnrollMethod('upload')}
                  style={{ flex: 1, backgroundColor: enrollMethod === 'upload' ? 'rgba(59, 130, 246, 0.15)' : '', borderColor: enrollMethod === 'upload' ? 'var(--accent-blue)' : '' }}
                >
                  <Upload size={16} /> Batch Photo Upload
                </button>
              </div>

              {enrollMethod === 'camera' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  {/* Device selector */}
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
                      className="btn btn-secondary"
                      onClick={() => startCamera(selectedDeviceId)}
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  <div className="video-wrapper" style={{ maxHeight: '220px', width: '100%' }}>
                    <video ref={videoRef} autoPlay playsInline muted className="webcam-feed" />
                    {streamActive && <div className="scan-line"></div>}
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={cancelEnrollment}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>

                    <button
                      className="btn"
                      onClick={captureAndEnrollCurrentStep}
                      disabled={enrolling || !streamActive}
                      style={{ flex: 1.5 }}
                    >
                      {enrolling ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                          Saving Sample...
                        </>
                      ) : (
                        <>
                          <Camera size={16} />
                          Capture Sample ({captureStep}/3)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Batch Upload Form */
                <form onSubmit={handleBatchFileUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="file-upload-zone" onClick={() => document.getElementById('enroll-file').click()}>
                    <Upload size={32} style={{ color: 'var(--accent-blue)' }} />
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {uploadFiles.length > 0
                        ? `Selected ${uploadFiles.length} photo(s)`
                        : "Click to select multi-angle photos (1 to 5 images)"}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Select images showing frontal, tilt, and expression variations.
                    </p>
                    <input
                      id="enroll-file"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setUploadFiles(Array.from(e.target.files))}
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
                      disabled={enrolling || uploadFiles.length === 0}
                      style={{ flex: 1 }}
                    >
                      {enrolling ? 'Enrolling Batch...' : `Enroll ${uploadFiles.length} Photos`}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Right Column: Registered Staff Directory Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <List style={{ color: 'var(--accent-blue)' }} size={22} />
              <h2 style={{ fontSize: '1.25rem' }}>Staff Directory ({staffList.length})</h2>
            </div>
            <button className="btn btn-secondary" onClick={fetchStaff} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Samples</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading directory...</td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No staff registered yet.</td>
                  </tr>
                ) : (
                  staffList.map(staff => {
                    const sampleCount = staff.embeddings ? staff.embeddings.length : 0
                    return (
                      <tr key={staff.id}>
                        <td><strong>{staff.staff_code}</strong></td>
                        <td>{staff.first_name} {staff.last_name}</td>
                        <td>{staff.department || 'N/A'}</td>
                        <td>
                          {sampleCount > 0 ? (
                            <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <CheckCircle size={12} /> {sampleCount} Sample{sampleCount > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="badge danger">Pending</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => startEnrollForStaff(staff)}
                              title="Add face samples"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                            >
                              <PlusCircle size={14} />
                            </button>

                            <button
                              className="btn btn-secondary"
                              onClick={() => openEditModal(staff)}
                              title="Edit staff details"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                            >
                              <Edit3 size={14} style={{ color: 'var(--accent-blue)' }} />
                            </button>

                            <button
                              className="btn btn-danger"
                              onClick={() => setDeletingStaff(staff)}
                              title="Delete staff profile"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Edit3 size={20} style={{ color: 'var(--accent-blue)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Edit Staff Profile</h3>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setEditingStaff(null)}
                style={{ padding: '0.35rem 0.6rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStaffSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Staff Code</label>
                  <input
                    type="text"
                    name="staff_code"
                    value={editFormData.staff_code}
                    onChange={handleEditInputChange}
                    required
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      name="first_name"
                      value={editFormData.first_name}
                      onChange={handleEditInputChange}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      name="last_name"
                      value={editFormData.last_name}
                      onChange={handleEditInputChange}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={editFormData.designation}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="edit-status"
                    name="status"
                    checked={editFormData.status}
                    onChange={handleEditInputChange}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="edit-status" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Active Status (Allowed to check in)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingStaff(null)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={updating}
                    style={{ flex: 1 }}
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STAFF CONFIRMATION MODAL */}
      {deletingStaff && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem'
              }}>
                <ShieldAlert size={28} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)' }}>Delete Staff Profile?</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Are you sure you want to delete <strong>{deletingStaff.first_name} {deletingStaff.last_name}</strong> ({deletingStaff.staff_code})?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--status-danger)', marginTop: '0.5rem' }}>
                This action will permanently remove their profile, facial templates, and attendance logs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeletingStaff(null)}
                disabled={deleting}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteStaffConfirm}
                disabled={deleting}
                style={{ flex: 1 }}
              >
                {deleting ? 'Deleting...' : 'Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default StaffManagement
