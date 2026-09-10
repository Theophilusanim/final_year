import React, { useState, useEffect } from 'react'
import { apiFetch, readJson } from '../api'
import { Search, RotateCw, Calendar, Filter } from 'lucide-react'

function AttendanceList() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/attendance/logs')
      const data = await readJson(res)
      if (Array.isArray(data)) {
        setLogs(data)
      } else {
        setLogs([])
      }
    } catch (err) {
      console.error("Error fetching attendance logs:", err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  // Filter logs based on search query, date, and status
  const safeLogs = Array.isArray(logs) ? logs : []
  const filteredLogs = safeLogs.filter(log => {
    const staffName = log.staff ? `${log.staff.first_name} ${log.staff.last_name}`.toLowerCase() : ''
    const staffCode = log.staff ? log.staff.staff_code.toLowerCase() : ''
    const query = searchQuery.toLowerCase().trim()
    
    const matchesSearch = !query || staffName.includes(query) || staffCode.includes(query)
    
    let matchesDate = true
    if (selectedDate && log.check_in) {
      const logDate = new Date(log.check_in).toISOString().split('T')[0]
      matchesDate = logDate === selectedDate
    }

    let matchesStatus = true
    if (selectedStatus !== 'All') {
      matchesStatus = log.status.toLowerCase() === selectedStatus.toLowerCase()
    }

    return matchesSearch && matchesDate && matchesStatus
  })

  return (
    <div>
      {/* Header */}
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="header-title">
          <h1>Attendance List</h1>
          <p>Review and filter every recorded staff check-in.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <RotateCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text"
              placeholder="Search name or staff code"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>

          {/* Date Picker */}
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ position: 'relative' }}>
            <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.75rem', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="All">All statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

        </div>
      </div>

      {/* Records Card Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Check-in records</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>Loading check-in records...</p>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
            <p>No check-in records found for the selected criteria.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>STAFF</th>
                  <th>DEPARTMENT</th>
                  <th>DATE</th>
                  <th>CHECK IN</th>
                  <th>CHECK OUT</th>
                  <th>METHOD</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const checkInDate = new Date(log.check_in)
                  const formattedDate = checkInDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  const formattedTime = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                          {log.staff ? `${log.staff.first_name} ${log.staff.last_name}` : 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {log.staff ? log.staff.staff_code : ''}
                        </div>
                      </td>
                      <td>{log.staff?.department || 'N/A'}</td>
                      <td>{formattedDate}</td>
                      <td style={{ fontWeight: '600' }}>{formattedTime}</td>
                      <td>{log.check_out ? new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Active'}</td>
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
  )
}

export default AttendanceList
