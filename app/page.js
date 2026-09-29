'use client'

import { use, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function TableOrderPage({ params }) {
  // Unwrap params ด้วย use() ตามข้อกำหนด Next.js ล่าสุด
  const resolvedParams = use(params)
  const tableNumber = parseInt(resolvedParams.tableNumber)

  // State ควบคุมสถานะ Session และข้อมูลร้าน
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  const [isSessionClosed, setIsSessionClosed] = useState(false)

  // State เมนูอาหาร
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)

  // State ตะกร้าสินค้าและการส่งออเดอร์
  const [cart, setCart] = useState({}) // เช่น { "ชาไทย": 2, "ไข่มุก": 1 }
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccessMsg, setOrderSuccessMsg] = useState(false)

  // State สำหรับปุ่มเรียกเก็บเงิน (Checkout Modal)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  // 1. ตรวจสอบ Session ของโต๊ะเมื่อโหลดหน้าเว็บ
  useEffect(() => {
    async function fetchSessionAndMenu() {
      if (isNaN(tableNumber)) {
        setSessionError(true)
        setLoadingSession(false)
        return
      }

      try {
        // เช็คโต๊ะที่เปิดอยู่ (status = 'open')
        const { data: sessionData, error: sessionErr } = await supabase
          .from('sessions')
          .select('*')
          .eq('table_number', tableNumber)
          .eq('status', 'open')
          .limit(1)

        if (sessionErr || !sessionData || sessionData.length === 0) {
          setSessionError(true)
          setLoadingSession(false)
          return
        }

        setSession(sessionData[0])

        // ดึงหมวดหมู่เมนู
        const { data: catData, error: catErr } = await supabase
          .from('menu_categories')
          .select('*')
          .order('sort_order', { ascending: true })

        if (catErr) throw catErr
        setCategories(catData || [])
        if (catData && catData.length > 0) {
          setActiveCategory(catData[0].id)
        }

        // ดึงรายการเมนูทั้งหมด
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .select('*')

        if (itemErr) throw itemErr
        setMenuItems(itemData || [])

      } catch (err) {
        console.error('Error loading data:', err)
        setSessionError(true)
      } finally {
        setLoadingSession(false)
      }
    }

    fetchSessionAndMenu()
  }, [tableNumber])

  // จัดการเพิ่ม/ลด จำนวนในตะกร้า
  const handleQuantityChange = (itemName, delta) => {
    setCart((prev) => {
      const currentQty = prev[itemName] || 0
      const newQty = currentQty + delta

      // คำนวณจำนวนรวมทั้งหมดในตะกร้า
      const totalItemsCount = Object.values({ ...prev, [itemName]: newQty }).reduce((a, b) => a + b, 0)
      
      // จำกัดรวมไม่เกิน 10 รายการต่อการส่ง 1 ครั้ง
      if (delta > 0 && totalItemsCount > 10) {
        alert('จำกัดการสั่งซื้อสูงสุด 10 รายการต่อครั้ง กรุณาส่งออเดอร์ก่อนครับ')
        return prev
      }

      const updated = { ...prev }
      if (newQty <= 0) {
        delete updated[itemName]
      } else {
        if (newQty > 5) return prev // จำกัด 1 เมนูเลือกได้สูงสุด 5 ชิ้น
        updated[itemName] = newQty
      }
      return updated
    })
  }

  // คำนวณจำนวนรายการรวมในตะกร้า
  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  // 2. ส่งออเดอร์ไปยังตาราง orders
  const handleSubmitOrder = async () => {
    if (totalCartCount === 0 || !session) return
    setSubmitting(true)

    // แปลงตะกร้าเป็นรูปแบบ Array ตามโครงสร้าง jsonb items: [{name, quantity}]
    const itemsArray = Object.entries(cart).map(([name, quantity]) => ({
      name,
      quantity
    }))

    try {
      const { error } = await supabase
        .from('orders')
        .insert([
          {
            session_id: session.id,
            table_number: tableNumber,
            items: itemsArray,
            status: 'received'
          }
        ])

      if (error) throw error

      // สำเร็จ เคลียร์ตะกร้า แสดงข้อความแจ้งเตือน
      setCart({})
      setOrderSuccessMsg(true)
      setTimeout(() => setOrderSuccessMsg(false), 4000)
    } catch (err) {
      console.error('Error submitting order:', err)
      alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  // 3. ฟังก์ชันเรียกเก็บเงิน & ปิด Session
  const handleCheckoutConfirm = async () => {
    if (!session) return
    setCheckingOut(true)

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)

      if (error) throw error

      setIsSessionClosed(true)
      setShowCheckoutModal(false)
    } catch (err) {
      console.error('Error closing session:', err)
      alert('ไม่สามารถทำรายการได้ กรุณาติดต่อพนักงาน')
    } finally {
      setCheckingOut(false)
    }
  }

  // คำนวณยอดเงิน (ผู้ใหญ่ × 289 + เด็ก × 145)
  const totalBill = session ? (session.adult_count * 289) + (session.child_count * 145) : 0

  // หน้าจอ: กำลังโหลด
  if (loadingSession) {
    return (
      <div style={styles.centerScreen}>
        <h2>🧋 กำลังโหลดข้อมูลร้าน...</h2>
      </div>
    )
  }

  // หน้าจอ: โต๊ะยังไม่เปิดใช้งาน (ข้อ 1)
  if (sessionError) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.alertBoxRed}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>⚠️ แจ้งเตือน</h2>
          <p style={{ fontSize: '1.2rem' }}>โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน</p>
        </div>
      </div>
    )
  }

  // หน้าจอ: ขอบคุณที่ใช้บริการ หลังปิดบิลแล้ว (ข้อ 3)
  if (isSessionClosed) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.alertBoxGreen}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🎉 ขอบคุณที่ใช้บริการ</h1>
          <p style={{ fontSize: '1.3rem' }}>Everyday Milktea หวังว่าจะได้ต้อนรับท่านอีกครับ/ค่ะ</p>
        </div>
      </div>
    )
  }

  // กรองเมนูตามหมวดหมู่ที่เลือก
  const currentCategoryItems = menuItems.filter(item => item.category_id === activeCategory)

  return (
    <div style={styles.container}>
      {/* --- ส่วนหัว: ชื่อร้าน + ปุ่มเรียกเก็บเงิน (ข้อ 3) --- */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.shopTitle}>🧋 Everyday Milktea</h1>
          <p style={styles.tableBadge}>โต๊ะที่ {tableNumber}</p>
        </div>
        <button 
          onClick={() => setShowCheckoutModal(true)} 
          style={styles.checkoutButton}
        >
          💳 เรียกเก็บเงิน
        </button>
      </header>

      {/* ข้อความแจ้งเตือนส่งออเดอร์สำเร็จ */}
      {orderSuccessMsg && (
        <div style={styles.successNotification}>
          ✅ ส่งออเดอร์เรียบร้อยแล้ว! สามารถสั่งเพิ่มได้ทันที
        </div>
      )}

      {/* --- แท็บหมวดหมู่เมนู (ข้อ 2) --- */}
      <div style={styles.categoryScroll}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              ...styles.categoryTab,
              backgroundColor: activeCategory === cat.id ? '#2563eb' : '#e5e7eb',
              color: activeCategory === cat.id ? '#fff' : '#374151',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* --- รายการเมนูอาหารในหมวดหมู่ --- */}
      <div style={styles.menuListContainer}>
        {currentCategoryItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>ไม่มีรายการเมนูในหมวดหมู่นี้</p>
        ) : (
          currentCategoryItems.map((item) => {
            const qty = cart[item.name] || 0
            return (
              <div key={item.id} style={styles.menuCard}>
                <div style={{ flex: 1, paddingRight: '10px' }}>
                  <h3 style={styles.menuName}>{item.name}</h3>
                </div>
                <div style={styles.counterControl}>
                  {qty > 0 ? (
                    <>
                      <button 
                        onClick={() => handleQuantityChange(item.name, -1)} 
                        style={styles.qtyBtn}
                      >
                        -
                      </button>
                      <span style={styles.qtyText}>{qty}</span>
                      <button 
                        onClick={() => handleQuantityChange(item.name, 1)} 
                        style={styles.qtyBtn}
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleQuantityChange(item.name, 1)} 
                      style={styles.addBtn}
                    >
                      + เพิ่ม
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* --- ตะกร้าลอยด้านล่างจอ (Sticky Bottom Cart) --- */}
      {totalCartCount > 0 && (
        <div style={styles.stickyCart}>
          <div style={styles.cartInfo}>
            <span style={styles.cartCountBadge}>{totalCartCount}</span>
            <span>รายการในตะกร้า (สูงสุด 10)</span>
          </div>
          <button 
            onClick={handleSubmitOrder} 
            disabled={submitting}
            style={styles.submitOrderBtn}
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์ 🚀'}
          </button>
        </div>
      )}

      {/* --- Modal ยืนยันเรียกเก็บเงิน --- */}
      {showCheckoutModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ color: '#1f2937', marginBottom: '15px' }}>ยืนยันการเรียกเก็บเงิน</h2>
            <div style={styles.billBox}>
              <p>ผู้ใหญ่: {session.adult_count} ท่าน × 289.-</p>
              <p>เด็ก: {session.child_count} ท่าน × 145.-</p>
              <hr style={{ margin: '10px 0', border: '0.5px solid #d1d5db' }} />
              <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2563eb' }}>
                ยอดรวมสุทธิ: {totalBill.toLocaleString()} บาท
              </p>
            </div>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '15px 0' }}>
              เมื่อยืนยันแล้ว ระบบจะปิดโต๊ะและไม่สามารถสั่งอาหารเพิ่มได้อีก
            </p>
            <div style={styles.modalBtnRow}>
              <button 
                onClick={() => setShowCheckoutModal(false)} 
                style={styles.modalCancelBtn}
                disabled={checkingOut}
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleCheckoutConfirm} 
                style={styles.modalConfirmBtn}
                disabled={checkingOut}
              >
                {checkingOut ? 'กำลังดำเนินการ...' : 'ยืนยันเรียกเก็บเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- ดีไซน์สไตล์มือถือ (Mobile-first, กดง่ายด้วยนิ้วโป้ง) ---
const styles = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    paddingBottom: '100px', // เว้นพื้นที่ให้ตะกร้าลอยด้านล่าง
    fontFamily: 'sans-serif',
    boxSizing: 'border-box',
    position: 'relative',
  },
  centerScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f3f4f6',
  },
  alertBoxRed: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '2rem',
    borderRadius: '12px',
    border: '2px solid #ef4444',
  },
  alertBoxGreen: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    padding: '2.5rem',
    borderRadius: '16px',
    border: '2px solid #22c55e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  shopTitle: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: 0,
  },
  tableBadge: {
    fontSize: '0.9rem',
    color: '#4b5563',
    margin: '2px 0 0 0',
    fontWeight: '600',
  },
  checkoutButton: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  successNotification: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '12px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  categoryScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  categoryTab: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  menuListContainer: {
    padding: '16px',
  },
  menuCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  menuName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: 0,
  },
  counterControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  addBtn: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  qtyBtn: {
    backgroundColor: '#e5e7eb',
    color: '#1f2937',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    width: '20px',
    textAlign: 'center',
  },
  stickyCart: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: '480px',
    margin: '0 auto',
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.1)',
    zIndex: 20,
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
  },
  cartInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  cartCountBadge: {
    backgroundColor: '#2563eb',
    color: '#fff',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
  },
  submitOrderBtn: {
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
  },
  billBox: {
    backgroundColor: '#f3f4f6',
    padding: '16px',
    borderRadius: '12px',
    textAlign: 'left',
    fontSize: '1.1rem',
    lineHeight: '1.6',
  },
  modalBtnRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#9ca3af',
    color: '#fff',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
}