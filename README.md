# Everyday Milktea Ordering System

ระบบสั่งน้ำสำหรับร้าน Everyday Milktea พัฒนาด้วย Next.js (App Router, JavaScript) และ Supabase สำหรับใช้งานบน Vercel

## ⚠️ ข้อควรระวังสำคัญสำหรับ Developer (Next.js Latest & React)
โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด **params ของ Dynamic Route จะเป็น Promise เสมอ** 
เวลาใช้งานในหน้า Component จะต้องทำการ unwrap ด้วยฟังก์ชัน `use()` จาก React ก่อนเสมอ (จะใช้งานบ่อยตอนทำหน้าสั่งอาหาร เช่น `/order/[tableId]`)

ตัวอย่างการใช้งาน:
```javascript
'use client'
import { use } from 'react'

export default function TableOrderPage({ params }) {
  const resolvedParams = use(params)
  const tableId = resolvedParams.tableId
  
  return <div>โต๊ะหมายเลข: {tableId}</div>
}