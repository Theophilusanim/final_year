import React, { useState, useEffect } from 'react'
import { LayoutDashboard, ClipboardList, Camera, UserCheck, Users, ShieldAlert, Smartphone, LogOut, UserCircle } from 'lucide-react'
import Login from './components/Login'
import { apiFetch, readJson } from './api'
import Dashboard from './components/Dashboard'
import AttendanceList from './components/AttendanceList'
import CameraTerminal from './components/CameraTerminal'
import StaffDetails from './components/StaffDetails'
import StaffManagement from './components/StaffManagement'
import MobileTerminal from './components/MobileTerminal'
import Account from './components/Account'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [networkBlocked, setNetworkBlocked] = useState(false)
  const [blockedIp, setBlockedIp] = useState('')
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('aegis_access_token')))
  const [account, setAccount] = useState(null)
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false)
  const isAdmin = account?.role === 'admin'

  useEffect(() => {
    if (!authenticated) return
    async function loadAccount() {
      try {
        const response = await apiFetch('/api/auth/me')
        const data = await readJson(response)
        if (!response.ok) throw new Error(data?.detail || 'Unable to load account')
        setAccount(data)
        if (data.role !== 'admin') setActiveTab('account')
      } catch (err) {
        console.error('Account loading failed:', err)
      }
    }
    loadAccount()
  }, [authenticated])

  useEffect(() => {
    const expire = () => setAuthenticated(false)
    window.addEventListener('auth-expired', expire)
    return () => window.removeEventListener('auth-expired', expire)
  }, [])

  // Check subnet connectivity on mount and tab switches
  useEffect(() => {
    if (!authenticated || !isAdmin) return
    async function checkNetwork() {
      try {
        const res = await apiFetch('/api/staff')
        if (res.status === 403) {
          const data = await readJson(res)
          if (data.detail && data.detail.includes("Campus Network")) {
            setNetworkBlocked(true)
            const ipMatch = data.detail.match(/\(([^)]+)\)/)
            if (ipMatch) {
              setBlockedIp(ipMatch[1])
            }
          }
        } else {
          setNetworkBlocked(false)
        }
      } catch (err) {
        console.error("Network check failed:", err)
      }
    }
    checkNetwork()
  }, [activeTab, isAdmin])

  function handleSignOut() {
    setShowLogoutPrompt(false)
    localStorage.removeItem('aegis_access_token')
    window.dispatchEvent(new Event('auth-expired'))
    setAuthenticated(false)
    setAccount(null)
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />

  return (
    <div className="app-container">
      {/* Network Lock Screen Overlay */}
      {networkBlocked && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '2rem'
        }}>
          <div className="glass-card" style={{ 
            maxWidth: '520px', 
            textAlign: 'center', 
            padding: '3rem 2rem', 
            borderColor: 'var(--status-danger)',
            boxShadow: '0 20px 50px rgba(239, 68, 68, 0.15)'
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '1.25rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--status-danger)',
              marginBottom: '1.5rem'
            }}>
              <ShieldAlert size={48} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
              Campus Network Lock
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem', fontSize: '0.98rem' }}>
              Aegis Attendance security policies restrict operations to verified connection zones. 
              Please connect your device to the authorized campus local network or intranet to proceed.
            </p>
            {blockedIp && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                display: 'inline-block'
              }}>
                Detected IP: <span style={{ color: 'var(--status-danger)', fontWeight: '600' }}>{blockedIp}</span> (Unauthorized)
              </div>
            )}
          </div>
        </div>
      )}

      {showLogoutPrompt && (
        <div className="logout-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowLogoutPrompt(false)
        }}>
          <section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <div className="logout-modal-icon"><LogOut size={24} /></div>
            <h2 id="logout-title">Log out?</h2>
            <p>Are you sure you want to end your session?</p>
            <div className="logout-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setShowLogoutPrompt(false)}>Cancel</button>
              <button className="btn btn-danger" type="button" onClick={handleSignOut}>Log out</button>
            </div>
          </section>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Camera size={22} />
          </div>
          <span className="logo-text">Aegis Attendance</span>
        </div>

        <ul className="nav-menu">
          <li>
            <button 
              className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <UserCircle size={20} />
              My Account
            </button>
          </li>
          {isAdmin && <li>
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
          </li>}
          {isAdmin && <li>
            <button 
              className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <ClipboardList size={20} />
              Attendance List
            </button>
          </li>}
          <li>
            <button 
              className={`nav-item ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => setActiveTab('camera')}
            >
              <Camera size={20} />
              Camera Terminal
            </button>
          </li>
          <li>
            <button 
              className={`nav-item ${activeTab === 'mobile' ? 'active' : ''}`}
              onClick={() => setActiveTab('mobile')}
            >
              <Smartphone size={20} />
              Mobile Wi-Fi Terminal
            </button>
          </li>
          {isAdmin && <li>
            <button 
              className={`nav-item ${activeTab === 'staff_details' ? 'active' : ''}`}
              onClick={() => setActiveTab('staff_details')}
            >
              <UserCheck size={20} />
              Staff Details
            </button>
          </li>}
          {isAdmin && <li>
            <button
              className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => setActiveTab('staff')}
            >
              <Users size={20} />
              Staff Directory
            </button>
          </li>}
        </ul>
        <button className="nav-item logout-button" onClick={() => setShowLogoutPrompt(true)}>
          <LogOut size={20} />
          Sign out
        </button>
      </aside>

      {/* Main Content View */}
      <main className="main-content">
        {isAdmin && activeTab === 'dashboard' && <Dashboard />}
        {isAdmin && activeTab === 'attendance' && <AttendanceList />}
        {activeTab === 'camera' && <CameraTerminal />}
        {activeTab === 'mobile' && <MobileTerminal />}
        {isAdmin && activeTab === 'staff_details' && <StaffDetails />}
        {isAdmin && activeTab === 'staff' && <StaffManagement />}
        {activeTab === 'account' && <Account />}
      </main>
    </div>
  )
}

export default App

