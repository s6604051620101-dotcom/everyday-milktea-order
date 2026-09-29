'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function GenerateQRPage() {
  // 1. State ของฟอร์ม
  const postnatalState = { tableNumber: '', adultCount: '1', childCount: '0' }
  const [formData, setFormData] = useState(postnatalState)
  
  // State ของระบบ Session และการแสดงผล QR
  const [activeSession, setActiveSession] = useState(null) // เก็บข้อมูลถ้าเจอโต๊ะเปิดค้างอยู่
  const [createdSessionData, setCreatedSessionData] = useState(null) // เก็บข้อมูลเมื่อสร้างสำเร็จเพื่อโชว์ QR
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // State ของกล่องยืนยันปิดโต๊ะเดิม (Confirm Dialog)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // คำนวณเวลา "เปิดมาแล้ว N นาที" เมื่อเปิด Modal ยืนยัน
  useEffect(() => {
    if (activeSession && activeSession.created_at) {
      const createdAtTime = new Date(activeSession.created_at).getTime()
      const now = new Date().getTime()
      const diffMs = now - createdAtTime
      const diffMins = Math.floor(diffMs / (1000 * 60))
      setElapsedMinutes(diffMins >= 0 ? diffMins : 0)
    }
  }, [activeSession])

  // ฟังก์ชันกดปุ่ม "เปิดโต๊ะ"
  const handleOpenTable = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)
    setActiveSession(null)
    setCreatedSessionData(null)

    const tableNum = parseInt(formData.tableNumber)
    const adult = parseInt(formData.adultCount)
    const child = parseInt(formData.childCount)

    if (!tableNum || isNaN(tableNum)) {
      setErrorMessage('กรุณากรอกเลขโต๊ะให้ถูกต้อง')
      setLoading(false)
      return
    }

    try {
      // 2. เช็คว่ามีตาราง sessions ของโต๊ะนี้ที่ status = 'open' อยู่แล้วหรือไม่
      const { data: existingSessions, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('table_number', tableNum)
        .eq('status', 'open')
        .limit(1)

      if (fetchError) throw fetchError

      if (existingSessions && existingSessions.length > 0) {
        // ถ้ามีอยู่แล้ว ให้เก็บข้อมูลเพื่อแสดงกล่องเตือน (ไม่สร้างใหม่)
        setActiveSession(existingSessions[0])
        setLoading(false)
        return
      }

      // ถ้าไม่มี ให้ insert แถวใหม่ลงตาราง sessions
      const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert([
          {
            table_number: tableNum,
            adult_count: adult,
            child_count: child,
            status: 'open'
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError

      // สร้างสำเร็จ เตรียมแสดงผล QR
      setCreatedSessionData(newSession)
    } catch (err) {
      console.error('Error opening table:', err)
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันกดยืนยัน "ปิดโต๊ะเดิม"
  const handleCloseExistingSession = async () => {
    if (!activeSession) return
    setLoading(true)

    try {
      // Update ตาราง sessions ให้ status = 'closed' เฉพาะแถวนี้ และเช็คซ้ำว่า status ยังเป็น 'open' อยู่
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', activeSession.id)
        .eq('status', 'open')
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        alert('โต๊ะนี้อาจถูกปิดไปแล้วโดยอุปกรณ์อื่น')
      }

      // ปิดสำเร็จ ปิด Modal, เอากล่องเตือนออก, กลับไปที่ฟอร์มเดิม (ค่าที่กรอกไว้ยังอยู่)
      setShowConfirmModal(false)
      setActiveSession(null)
    } catch (err) {
      console.error('Error closing session:', err)
      alert('ไม่สามารถปิดออเดอร์เดิมได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันคัดลอกลิงก์
  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
    alert('คัดลอกลิงก์เรียบร้อยแล้ว!')
  }

  // ฟังก์ชันกด "เปิดโต๊ะใหม่" เพื่อรีเซ็ตหน้าจอทั้งหมด
  const handleReset = () => {
    setCreatedSessionData(null)
    setActiveSession(null)
    setFormData({ tableNumber: '', adultCount: '1', childCount: '0' })
  }

  // Domain ปัจจุบันสำหรับสร้าง URL (ใช้งานได้ทั้ง Local และ Production บน Vercel)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const targetUrl = createdSessionData ? `${origin}/order/${createdSessionData.table_number}` : ''
  const encodedUrl = encodeURIComponent(targetUrl)
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`

  return (
    <main style={styles.container}>
      <h1 style={styles.headerTitle}>🧋 เปิดโต๊ะ & สร้าง QR Code</h1>
      <p style={styles.subTitle}>ระบบพนักงานหน้าร้าน Everyday Milktea</p>

      {/* แสดง Error ถ้ามี */}
      {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

      {/* --- กรณีที่ 1: ยังไม่ได้สร้าง QR หรือเพิ่งเคลียร์ค่า ให้แสดงฟอร์มปกติ --- */}
      {!createdSessionData && (
        <form onSubmit={handleOpenTable} style={styles.formCard}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>เลขโต๊ะ (Table Number):</label>
            <input
              type="number"
              required
              min="1"
              value={formData.tableNumber}
              onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
              style={styles.input}
              placeholder="เช่น 7"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>จำนวนผู้ใหญ่:</label>
            <input
              type="number"
              required
              min="1"
              value={formData.adultCount}
              onChange={(e) => setFormData({ ...formData, adultCount: e.target.value })}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>จำนวนเด็ก:</label>
            <input
              type="number"
              required
              min="0"
              value={formData.childCount}
              onChange={(e) => setFormData({ ...formData, childCount: e.target.value })}
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.primaryButton}>
            {loading ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
          </button>
        </form>
      )}

      {/* --- กล่องเตือน เมื่อโต๊ะมี Session เปิดค้างอยู่แล้ว (ข้อ 3) --- */}
      {activeSession && !createdSessionData && (
        <div style={styles.warningCard}>
          <h3 style={styles.warningTitle}>⚠️ แจ้งเตือน: โต๊ะนี้ไม่ว่าง</h3>
          <p style={styles.warningText}>โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน</p>
          <button
            onClick={() => setShowConfirmModal(true)}
            style={styles.warningActionButton}
          >
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {/* --- Modal ยืนยันปิดโต๊ะเดิม --- */}
      {showConfirmModal && activeSession && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ color: '#dc2626', marginBottom: '15px' }}>ยืนยันปิดโต๊ะเดิม</h2>
            <div style={styles.modalInfoBox}>
              <p><strong>โต๊ะเลขที่:</strong> {activeSession.table_number}</p>
              <p><strong>จำนวนคน:</strong> ผู้ใหญ่ {activeSession.adult_count} / เด็ก {activeSession.child_count}</p>
              <p><strong>สถานะ:</strong> เปิดมาแล้ว <span style={{ color: '#dc2626', fontSize: '1.2rem' }}>{elapsedMinutes}</span> นาที</p>
            </div>
            <p style={{ margin: '15px 0', fontSize: '1rem' }}>คุณต้องการปิดโต๊ะนี้เพื่อล้างข้อมูลและเปิดใหม่ใช่หรือไม่?</p>
            
            <div style={styles.modalButtonRow}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={styles.cancelButton}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCloseExistingSession}
                style={styles.confirmButton}
                disabled={loading}
              >
                {loading ? 'กำลังดำเนินการ...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- กรณีที่ 2: สร้าง Session สำเร็จ แสดงรูป QR Code (ข้อ 4) --- */}
      {createdSessionData && (
        <div style={styles.successCard}>
          <h2 style={{ color: '#16a34a', marginBottom: '10px' }}>✅ เปิดโต๊ะสำเร็จ!</h2>
          
          <div style={styles.qrContainer}>
            <img src={qrCodeImageUrl} alt="QR Code สำหรับสั่งอาหาร" style={styles.qrImage} />
          </div>

          <p style={styles.summaryText}>
            โต๊ะ {createdSessionData.table_number} · ผู้ใหญ่ {createdSessionData.adult_count} · เด็ก {createdSessionData.child_count}
          </p>

          <div style={styles.linkBox}>
            <span style={styles.linkText}>{targetUrl}</span>
            <button onClick={() => handleCopyLink(targetUrl)} style={styles.copyButton}>
              คัดลอกลิงก์
            </button>
          </div>

          <button onClick={handleReset} style={styles.resetButton}>
            + เปิดโต๊ะใหม่ / โต๊ะอื่น
          </button>
        </div>
      )}
    </main>
  )
}

// --- สไตล์ CSS แบบ Inline สำหรับความรวดเร็วและตัวหนังสือใหญ่อ่านง่าย ---
const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'sans-serif',
    color: '#1f2937',
  },
  headerTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '5px',
  },
  subTitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: '2rem',
    fontSize: '1.1rem',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  inputGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px',
    fontSize: '1.2rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: '16px',
    fontSize: '1.3rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  warningCard: {
    backgroundColor: '#fef2f2',
    border: '3px solid #ef4444',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    marginTop: '1.5rem',
  },
  warningTitle: {
    color: '#dc2626',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  warningText: {
    fontSize: '1.2rem',
    color: '#7f1d1d',
    marginBottom: '1.5rem',
  },
  warningActionButton: {
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '12px',
    maxWidth: '450px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  modalInfoBox: {
    backgroundColor: '#f3f4f6',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'left',
    fontSize: '1.1rem',
    lineHeight: '1.6',
  },
  modalButtonRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#9ca3af',
    color: '#fff',
    padding: '12px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    color: '#fff',
    padding: '12px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    border: '3px solid #22c55e',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
  },
  qrContainer: {
    margin: '1.5rem 0',
    display: 'inline-block',
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  qrImage: {
    width: '260px',
    height: '260px',
    display: 'block',
  },
  summaryText: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: '1rem',
  },
  linkBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    padding: '10px 15px',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    wordBreak: 'break-all',
  },
  linkText: {
    fontSize: '1rem',
    color: '#4b5563',
    textAlign: 'left',
    marginRight: '10px',
  },
  copyButton: {
    backgroundColor: '#4b5563',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    fontSize: '0.9rem',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resetButton: {
    width: '100%',
    backgroundColor: '#16a34a',
    color: '#fff',
    padding: '14px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}