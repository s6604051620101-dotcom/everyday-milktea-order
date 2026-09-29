import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>🧋 Everyday Milktea</h1>
      <p>ยินดีต้อนรับสู่ระบบสั่งน้ำร้าน Everyday Milktea</p>
      
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <Link 
          href="/generate-qr" 
          style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', borderRadius: '5px', textDecoration: 'none' }}
        >
          ไปหน้าสร้าง QR Code (สำหรับพนักงาน)
        </Link>
        <Link 
          href="/kitchen" 
          style={{ padding: '10px 20px', background: '#10b981', color: '#fff', borderRadius: '5px', textDecoration: 'none' }}
        >
          ไปหน้าจอห้องครัว (Kitchen Display)
        </Link>
      </div>
    </main>
  )
}
