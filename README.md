# PUN AAN

MVP เว็บไซต์แลกเปลี่ยนหนังสือเรียนและหนังสือเตรียมสอบ พร้อมระบบแนะนำหนังสือตามความสนใจ

## ฟีเจอร์ที่ใช้งานได้

- สมัครสมาชิกและเข้าสู่ระบบด้วย JWT
- ลงรายการหนังสือและระบุสภาพ
- แนะนำหนังสือด้วยคะแนนจากวิชาและระดับการศึกษา
- กดสนใจหรือไม่สนใจหนังสือ
- เสนอหนังสือของตัวเองเพื่อขอแลก
- ตอบรับ ปฏิเสธ ยกเลิก และยืนยันการแลกสำเร็จ
- ใช้ข้อมูลสาธิตได้ทันที หรือเชื่อม PostgreSQL ด้วย `DATABASE_URL`

## เริ่มใช้งาน

ต้องมี Node.js 20 ขึ้นไป จากโฟลเดอร์หลักให้รัน:

```bash
npm install
npm --prefix client install
npm --prefix server install
cp server/.env.example server/.env
npm run dev
```

เปิด `http://localhost:4173`

บัญชีสาธิต:

```text
อีเมล: natcha@demo.com
รหัสผ่าน: demo1234
```

ข้อมูลสาธิตเก็บในหน่วยความจำและจะเริ่มใหม่เมื่อปิด API เหมาะสำหรับทดลองหน้าจอและขั้นตอนการแลก

## เชื่อม PostgreSQL

สร้างฐานข้อมูล PostgreSQL แล้วใส่ connection string ใน `server/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/pun_aan
JWT_SECRET=replace-with-a-long-random-value
```

เมื่อเปิด API ระบบจะสร้างตารางจาก `server/src/schema.sql` ให้อัตโนมัติ ฐานข้อมูลใหม่จะยังไม่มีข้อมูล ให้สมัครสมาชิกผ่านหน้าเว็บและลงหนังสือได้ทันที

## คำสั่งหลัก

```bash
npm run dev      # เปิดเว็บไซต์และ API พร้อมกัน
npm run build    # สร้างเว็บไซต์สำหรับ production
npm test         # ทดสอบ API และตรวจโค้ดเว็บไซต์
```

## โครงสร้าง

```text
pun-aan/
├── client/      React + Vite
├── server/      Express + PostgreSQL / demo memory store
├── package.json คำสั่งรวมทั้งโปรเจกต์
└── README.md
```

## Git workflow ที่แนะนำ

ก่อนเริ่มฟีเจอร์ใหม่:

```bash
git switch -c feature/ชื่อฟีเจอร์
```

เมื่อทำและทดสอบเสร็จ:

```bash
git status
git add .
git commit -m "feat: อธิบายฟีเจอร์ที่เพิ่ม"
git switch main
git merge --no-ff feature/ชื่อฟีเจอร์
```

ห้าม commit ไฟล์ `server/.env` เพราะมีข้อมูลลับ
