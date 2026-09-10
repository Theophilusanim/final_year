import React, { useEffect, useState } from 'react'
import { UserCircle, Mail, ShieldCheck, CalendarDays, BriefcaseBusiness, Hash, Clock3 } from 'lucide-react'
import { apiFetch, readJson } from '../api'

function Account() {
  const [account, setAccount] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAccount() {
      try {
        const [accountResponse, historyResponse] = await Promise.all([
          apiFetch('/api/auth/me'),
          apiFetch('/api/auth/me/attendance')
        ])
        const data = await readJson(accountResponse)
        const historyData = await readJson(historyResponse)
        if (!accountResponse.ok) throw new Error(data?.detail || 'Unable to load your profile')
        if (!historyResponse.ok) throw new Error(historyData?.detail || 'Unable to load your attendance history')
        setAccount(data)
        setHistory(Array.isArray(historyData) ? historyData : [])
      } catch (err) {
        setError(err.message)
      }
    }
    loadAccount()
    window.addEventListener('attendance-updated', loadAccount)
    return () => window.removeEventListener('attendance-updated', loadAccount)
  }, [])

  if (error) return <p className="login-error">{error}</p>
  if (!account) return <p style={{ color: 'var(--text-secondary)' }}>Loading your profile...</p>

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>My account</h1>
          <p>Your account details and access status.</p>
        </div>
      </div>
      <section className="glass-card account-card">
        <div className="account-avatar"><UserCircle size={42} /></div>
        <div className="account-details">
          <h2>{account.staff_profile ? `${account.staff_profile.first_name} ${account.staff_profile.last_name}` : account.email}</h2>
          <div className="account-row"><Mail size={17} /><span>{account.email}</span></div>
          {account.staff_profile && <>
            <div className="account-row"><Hash size={17} /><span>Staff code: {account.staff_profile.staff_code}</span></div>
            <div className="account-row"><BriefcaseBusiness size={17} /><span>{account.staff_profile.designation || 'Staff Member'} · {account.staff_profile.department || 'General'}</span></div>
          </>}
          <div className="account-row"><ShieldCheck size={17} /><span>Role: {account.role}</span></div>
          <div className="account-row"><CalendarDays size={17} /><span>Joined {new Date(account.created_at).toLocaleDateString()}</span></div>
        </div>
        <span className="badge success">{account.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
      </section>
      <section className="glass-card account-history-card">
        <div className="account-history-heading">
          <div>
            <h2>My attendance history</h2>
            <p>Check-in and sign-out times recorded for your profile.</p>
          </div>
          <Clock3 size={24} style={{ color: 'var(--accent-blue)' }} />
        </div>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No attendance records yet.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Date</th><th>Check in</th><th>Signed out</th><th>Status</th><th>Method</th></tr></thead>
              <tbody>{history.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.check_in).toLocaleDateString()}</td>
                  <td>{new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{log.check_out ? new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not signed out'}</td>
                  <td><span className={`badge ${log.status === 'Late' ? 'warning' : 'success'}`}>{log.status || 'Present'}</span></td>
                  <td>{log.recognized_via || 'Camera'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default Account
