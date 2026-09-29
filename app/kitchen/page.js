'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function KitchenPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // 1. โหลดออเดอร์เริ่มต้นที่ status เป็น 'received' หรือ 'cooking' เรียงจากเก่าไปใหม่
  useEffect(() => {
    async function fetchInitialOrders() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .in('status', ['received', 'cooking'])
          .order('created_at', { ascending: true }) // เก่าไปใหม่ (หรือจะสลับถ้าต้องการใหม่สุดไว้บน)

        if (error) throw error
        setOrders(data || [])
      } catch (err) {
        console.error('Error fetching initial orders:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialOrders()

    // 2. Setup Supabase Realtime Subscription เพื่อฟังการเปลี่ยนแปลงของตาราง orders
    const channel = supabase
      .channel('kitchen-orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*', // ฟังทุก Event (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Realtime change received:', payload)
          
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new
            // ถ้าออเดอร์ใหม่เข้ามาและยังอยู่ในสถานะที่ครัวต้องทำ ให้เพิ่มเข้า State
            if (newOrder.status === 'received' || newOrder.status === 'cooking') {
              setOrders((prev) => {
                // เช็คกันซ้ำ
                if (prev.some((o) => o.id === newOrder.id)) return prev
                return [...prev, newOrder]
              })
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new
            setOrders((prev) => {
              // ถ้าออเดอร์ถูกเปลี่ยนเป็น 'served' หรือ 'closed' ให้เอาออกจากการ์ดหน้าจอ
              if (updatedOrder.status === 'served' || updatedOrder.status === 'closed') {
                return prev.filter((o) => o.id !== updatedOrder.id)
              }
              // ถ้ายังอยู่ในสถานะที่ต้องแสดง ให้ทำการอัปเดตข้อมูลในการ์ดนั้นๆ
              return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            })
          }
        }
      )
      .subscribe()

    // Cleanup subscription เมื่อปิดหน้าเว็บ
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 4. ฟังก์ชันกดเปลี่ยนสถานะออเดอร์
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error

      // อัปเดตใน Local State ทันทีเพื่อความลื่นไหล (Realtime จะช่วยซิงค์อีกชั้นหนึ่ง)
      if (newStatus === 'served') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        )
      }
    } catch (err) {
      console.error('Error updating order status:', err)
      alert('ไม่สามารถอัปเดตสถานะออเดอร์ได้ กรุณาลองใหม่')
    }
  }

  // แปลงรูปแบบเวลาให้ดูง่าย (เช่น 14:32:05)
  const formatTime = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (loading) {
    return (
      <div style={styles.centerScreen}>
        <h2>🧋 กำลังเชื่อมต่อระบบห้องครัว (Kitchen Display)...</h2>
      </div>
    )
  }

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>🍳 หน้าจอห้องครัว (Kitchen Display) - Everyday Milktea</h1>
        <div style={styles.statsBadge}>
          ออเดอร์ที่ต้องทำ: <strong>{orders.length}</strong> รายการ
        </div>
      </header>

      {orders.length === 0 ? (
        <div style={styles.emptyState}>
          <h2>🎉 ยอดเยี่ยม! ไม่มีออเดอร์ค้างในขณะนี้</h2>
          <p>ระบบจะแสดงออเดอร์ใหม่อัตโนมัติทันทีที่มีลูกค้าสั่งเข้ามา</p>
        </div>
      ) : (
        /* 5. จัดวางเป็นตาราง Grid หลายคอลัมน์ ตัวหนังสือใหญ่ */
        <div style={styles.gridContainer}>
          {orders.map((order) => {
            const isCooking = order.status === 'cooking'
            return (
              <div 
                key={order.id} 
                style={{
                  ...styles.orderCard,
                  backgroundColor: isCooking ? '#fef9c3' : '#ffffff', // สีเหลืองอ่อนถ้ากำลังทำ, ขาวถ้าพึ่งได้รับ
                  borderColor: isCooking ? '#eab308' : '#cbd5e1',
                }}
              >
                {/* ส่วนหัวการ์ด: เลขโต๊ะ & เวลา */}
                <div style={styles.cardHeader}>
                  <span style={styles.tableNumberText}>โต๊ะ {order.table_number}</span>
                  <span style={styles.timeText}>⏱️ {formatTime(order.created_at)}</span>
                </div>

                <div style={styles.statusBadgeRow}>
                  <span style={{
                    ...styles.statusTag,
                    backgroundColor: isCooking ? '#ca8a04' : '#2563eb',
                  }}>
                    {isCooking ? '🔥 กำลังทำ' : '🔔 รอทำ'}
                  </span>
                </div>

                <hr style={styles.divider} />

                {/* รายการสินค้า (จากฟิลด์ jsonb items) */}
                <div style={styles.itemList}>
                  {Array.isArray(order.items) && order.items.map((item, idx) => (
                    <div key={idx} style={styles.itemRow}>
                      <span style={styles.itemName}>• {item.name}</span>
                      <span style={styles.itemQty}>x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* ปุ่มควบคุมสถานะ (ข้อ 4) */}
                <div style={styles.buttonContainer}>
                  {!isCooking ? (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'cooking')}
                      style={styles.cookingBtn}
                    >
                      เริ่มทำ 🍳
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      style={styles.servedBtn}
                    >
                      จัดเสิร์ฟแล้ว ✅
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

// --- ดีไซเนอร์สำหรับหน้าจอครัว (ตัวหนังสือใหญ่ อ่านจากระยะไกลได้) ---
const styles = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    backgroundColor: '#0f172a', // พื้นหลังเข้มสไตล์ KDS มืออาชีพ
    color: '#f8fafc',
    fontFamily: 'sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '2px solid #334155',
    paddingBottom: '16px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  headerTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    margin: 0,
  },
  statsBadge: {
    backgroundColor: '#334155',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '1.2rem',
  },
  centerScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  emptyState: {
    textAlign: 'center',
    padding: '5rem 2rem',
    color: '#94a3b8',
    fontSize: '1.2rem',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  orderCard: {
    borderWidth: '3px',
    borderStyle: 'solid',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    color: '#0f172a', // ข้อความด้านในการ์ดเป็นสีเข้มเพื่อให้ตัดกับพื้นหลังการ์ด
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableNumberText: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  timeText: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#64748b',
  },
  statusBadgeRow: {
    marginTop: '6px',
  },
  statusTag: {
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  divider: {
    margin: '12px 0',
    border: '0',
    borderTop: '1px solid #cbd5e1',
  },
  itemList: {
    flexGrow: 1,
    margin: '10px 0 20px 0',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    padding: '6px 0',
    borderBottom: '1px dashed #e2e8f0',
  },
  itemName: {
    color: '#1e293b',
  },
  itemQty: {
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '1.1rem',
  },
  buttonContainer: {
    marginTop: 'auto',
  },
  cookingBtn: {
    width: '100%',
    backgroundColor: '#eab308',
    color: '#713f12',
    border: 'none',
    padding: '14px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
  servedBtn: {
    width: '100%',
    backgroundColor: '#22c55e',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
}
