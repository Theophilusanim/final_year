import React, { useState, useEffect } from 'react'
import { Search, Mail, Hash, UserCheck, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

function StaffDetails() {
  const [staffList, setStaffList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffLogs, setStaffLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchStaffAndLogs()
  }, [])

  async function fetchStaffAndLogs() {
    setLoading(true)
    try {
      const [staffRes, logsRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/attendance/logs')
      ])
      const staffData = await staffRes.json()
      const logsData = await logsRes.json()
      
      const safeStaff = Array.isArray(staffData) ? staffData : []
      const safeLogs = Array.isArray(logsData) ? logsData : []

      setStaffList(safeStaff)
      if (safeStaff.length > 0) {
        // Select first staff by default if none selected
        setSelectedStaff(safeStaff[0])
        filterLogsForStaff(safeStaff[0].id, safeLogs)
      }
    } catch (err) {
      console.error("Error fetching staff details:", err)
      setStaffList([])
    } finally {
      setLoading(false)
    }
  }

  function filterLogsForStaff(staffId, allLogs) {
    const safeLogs = Array.isArray(allLogs) ? allLogs : []
    const logs = safeLogs.filter(log => log.staff_id === staffId)
    setStaffLogs(logs)
  }

  async function handleSelectStaff(staff) {
    setSelectedStaff(staff)
    try {
      const res = await fetch('/api/attendance/logs')
      const logsData = await res.json()
      filterLogsForStaff(staff.id, logsData)
    } catch (err) {
      console.error("Error updating logs:", err)
    }
  }

  // Helper to extract initials for avatar
  function getInitials(firstName, lastName) {
    const f = firstName ? firstName[0].toUpperCase() : ''
    const l = lastName ? lastName[0].toUpperCase() : ''
    return `${f}${l}` || 'U'
  }

  const filteredStaffList = staffList.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase()
    const code = s.staff_code.toLowerCase()
    const q = searchQuery.toLowerCase().trim()
    return !q || name.includes(q) || code.includes(q)
  })

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Staff Details</h1>
          <p>Select a staff member to view their profile and attendance activity.</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: Staff Selector List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Find staff"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '550px', overflowY: 'auto' }}>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>Loading staff...</p>
            ) : filteredStaffList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>No staff found.</p>
            ) : (
              filteredStaffList.map(staff => {
                const isSelected = selectedStaff?.id === staff.id
                const initials = getInitials(staff.first_name, staff.last_name)

                return (
                  <div
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.05)'}`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Avatar Circle */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '0.95rem'
                    }}>
                      {initials}
                    </div>

                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>
                        {staff.first_name} {staff.last_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {staff.staff_code}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Profile & Attendance Details */}
        {selectedStaff ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Top Profile Card */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {/* Big Avatar */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-blue)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: '700'
                  }}>
                    {getInitials(selectedStaff.first_name, selectedStaff.last_name)}
                  </div>

                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                      {selectedStaff.first_name} {selectedStaff.last_name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      {selectedStaff.designation || 'Staff Member'} · {selectedStaff.department || 'General'}
                    </p>
                  </div>
                </div>

                <span className={`badge ${selectedStaff.status ? 'success' : 'danger'}`} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  {selectedStaff.status ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              {/* 2x2 Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.75rem' }}>
                
                {/* Email Card */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <Mail size={20} style={{ color: 'var(--accent-blue)' }} />
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', wordBreak: 'break-all' }}>{selectedStaff.email}</div>
                  </div>
                </div>

                {/* Staff Code Card */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-blue)' }} />
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff code</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{selectedStaff.staff_code}</div>
                  </div>
                </div>

                {/* Face Profile Card */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <UserCheck size={20} style={{ color: 'var(--accent-purple)' }} />
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Face profile</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      {selectedStaff.embeddings && selectedStaff.embeddings.length > 0 ? 'Enrolled' : 'Pending'}
                    </div>
                  </div>
                </div>

                {/* Total Check-ins Card */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <Calendar size={20} style={{ color: 'var(--status-success)' }} />
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total check-ins</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{staffLogs.length}</div>
                  </div>
                </div>

              </div>
            </div>

            {/* Attendance History Card */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Attendance history</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {staffLogs.length} {staffLogs.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              {staffLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                  <p>No check-ins have been recorded for this staff member.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CHECK IN</th>
                        <th>METHOD</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffLogs.map(log => {
                        const checkInDate = new Date(log.check_in)
                        const formattedDate = checkInDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        const formattedTime = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

                        return (
                          <tr key={log.id}>
                            <td style={{ fontWeight: '600' }}>{formattedDate}</td>
                            <td>{formattedTime}</td>
                            <td>{log.recognized_via || 'Camera'}</td>
                            <td>
                              <span className={`badge ${
                                log.status === 'Present' ? 'success' : 
                                log.status === 'Late' ? 'warning' : 'danger'
                              }`}>
                                {log.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
            <p>Select a staff member from the list to view profile details.</p>
          </div>
        )}

      </div>
    </div>
  )
}

export default StaffDetails
