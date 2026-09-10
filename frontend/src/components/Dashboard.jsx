import React, { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX } from 'lucide-react'
import { apiFetch, readJson } from '../api'

function Dashboard() {
  const [logs, setLogs] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [logsRes, staffRes] = await Promise.all([
          apiFetch('/api/attendance/logs'),
          apiFetch('/api/staff')
        ])
        const logsData = await readJson(logsRes)
        const staffData = await readJson(staffRes)
        setLogs(logsData)
        setStaff(staffData)
      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Calculate quick metrics
  const totalStaff = staff.length
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayLogs = logs.filter(log => {
    const checkIn = new Date(log.check_in)
    const checkInKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}-${String(checkIn.getDate()).padStart(2, '0')}`
    return checkInKey === todayKey
  })
  
  // Unique staff checked in today
  const checkedInToday = new Set(todayLogs.map(l => l.staff_id)).size
  const lateArrivals = todayLogs.filter(l => l.status === 'Late').length
  const absentCount = Math.max(0, totalStaff - checkedInToday)

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <h1>Attendance Dashboard</h1>
          <p>Real-time analytics and staff presence logs</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>Total Staff</h3>
            <p>{totalStaff}</p>
          </div>
          <div className="stat-icon blue">
            <Users size={24} />
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>Present Today</h3>
            <p>{checkedInToday}</p>
          </div>
          <div className="stat-icon green">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>Late Arrivals</h3>
            <p>{lateArrivals}</p>
          </div>
          <div className="stat-icon amber">
            <Clock size={24} />
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>Absent Today</h3>
            <p>{absentCount}</p>
          </div>
          <div className="stat-icon danger">
            <UserX size={24} />
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent logs table */}
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Recent Attendance Logs</h2>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No logs found for today.</p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Staff Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Check In</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '600' }}>{log.staff.staff_code}</td>
                      <td>{log.staff.first_name} {log.staff.last_name}</td>
                      <td>{log.staff.department || 'N/A'}</td>
                      <td>{new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <span className={`badge ${
                          log.status === 'Present' ? 'success' : 
                          log.status === 'Late' ? 'warning' : 'danger'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attendance Rate Sidebar */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Today's Presence Rate</h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '1rem 0' }}>
            <div style={{
              position: 'relative',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: `conic-gradient(var(--accent-blue) ${totalStaff ? (checkedInToday / totalStaff) * 360 : 0}deg, var(--bg-primary) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifycontent: 'center'
            }}>
              <div style={{
                position: 'absolute',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifycontent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                  {totalStaff ? Math.round((checkedInToday / totalStaff) * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendance</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Registered staff:</span>
              <span style={{ fontWeight: '600' }}>{totalStaff}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Confirmed check-ins:</span>
              <span style={{ fontWeight: '600' }}>{checkedInToday}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
