src/
├── app.ts                          # ไฟล์หลักสำหรับ Config Express, Middleware และ Routes
├── server.ts                       # Entry Point สำหรับ Start Server
│
├── config/                         # การตั้งค่าระบบ
│   ├── database.ts                 # Config เชื่อมต่อ Database
│   └── passport.ts                 # Config Passport (Google/LINE Login Strategies)
│
├── models/
│   ├── user.model.ts
│   ├── order.model.ts
│   ├── customer.model.ts
│   ├── product.model.ts
│   ├── order_item.model.ts
│   ├── consent_doc.model.ts
│   └── consent_record.model.ts
│
├── features/                       # 📂 แยกตามฟีเจอร์ทางธุรกิจ
│   ├── auth/                       # ฟีเจอร์: การยืนยันตัวตน (Login/Register)
│   │   ├── views/
│   │   │   ├── login.ejs           # หน้า Login
│   │   │   └── register.ejs        # หน้า Register
│   │   ├── auth.controller.ts      # Logic การรับ-ส่ง Request
│   │   ├── auth.routes.ts          # กำหนด URL (/login, /register, /auth/google)
│   │   ├── auth.service.ts         # Logic เบื้องหลัง (สร้าง User, จัดการ Session)
│   │   └── auth.types.ts           # Type Definitions ของ Auth
│   │
│   ├── customers/                  # ฟีเจอร์: ข้อมูลลูกค้า
│   │   ├── customer.controller.ts
│   │   ├── customer.routes.ts
│   │   ├── customer.service.ts
│   │   └── customer.types.ts       # Interface ข้อมูลลูกค้า (Citizen ID, Address ฯลฯ)
│   │
│   ├── dashboard/                  # ฟีเจอร์: หน้าหลักหลัง Login (/home)
│   │   ├── views/
│   │   │   └── home.ejs            # หน้า Dashboard
│   │   ├── dashboard.controller.ts
│   │   └── dashboard.routes.ts
│   │
│   ├── orders/                     # ฟีเจอร์: การจัดการคำสั่งซื้อ
│   │   ├── order.controller.ts
│   │   ├── order.model.ts          # Schema ของ Database สำหรับ Order
│   │   ├── order.routes.ts
│   │   ├── order.service.ts
│   │   └── order.types.ts
│   │
│   ├── public/                     # ฟีเจอร์: หน้าแรกสำหรับคนทั่วไป (Landing Page)
│   │   ├── views/
│   │   │   └── index.ejs           # หน้าแรก (Localhost:3000/)
│   │   └── public.controller.ts
│   │
│   └── users/                      # ฟีเจอร์: ผู้ใช้งานระบบ (Admin/Staff)
│       ├── user.controller.ts
│       ├── user.routes.ts
│       ├── user.service.ts
│       └── user.types.ts
│
├── shared/                         # 📂 ไฟล์ที่ใช้ร่วมกันทุกฟีเจอร์
│   ├── middlewares/
│   │   └── auth.middleware.ts      # เช็คว่า Login หรือยัง (requireLogin)
│   ├── types/
│   │   └── index.ts                # Type กลางของระบบ
│   ├── utils/
│   │   └── date.util.ts            # ตัวช่วยจัดการวันที่
│   └── views/                      # Layout กลางของ EJS
│       ├── layout.ejs              # โครงสร้างหลัก (HTML, Head, Body wrapper)
│       └── partials/
│           ├── footer.ejs
│           └── header.ejs
│
├── styles/                         # ไฟล์ CSS ต้นฉบับ
│   └── input.css                   # Tailwind Directives (@tailwind base; ...)
│
└── types/                          # Type Definitions พิเศษ (แก้ Error Library)
    └── passport-line-auth.d.ts     # แก้ Error ไม่มี Type ของ Line Auth"# Order-record-web" 
