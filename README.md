# 🎓 Student Attendance System (Serverless Architecture)

A production-ready, ultra-fast **Student Attendance Management Web Application** built with **Astro (SSR), Vercel, Neon PostgreSQL, Drizzle ORM, Zod, and Tailwind CSS**.

Engineered for **speed, simplicity, security, and zero manual server maintenance**.

---

## 🚀 Key Features

- **⚡ 1-Tap Student Attendance**: Students open the app, automatically see their current class session, and record attendance with a single tap.
- **☁️ 100% Serverless & Cloud Native**: Automatically hosted 24/7 on Vercel + Neon PostgreSQL. No daily manual server starts (`npm start`) required.
- **🔐 Secure Serverless Auth**: HTTP-only secure cookie session tokens with Argon2id/bcrypt password hashing and Role-Based Access Control (`student`, `teacher`, `admin`).
- **👨‍🏫 Faculty Live Monitor & Dynamic QR**: Real-time student attendance tracking, manual status overrides (`present`, `late`, `absent`, `excused`), and 20-second expiring dynamic QR codes.
- **📊 Admin Portal**: Full CRUD management for Students, Teachers, Classes, Subjects, and Timetables, plus CSV Report Exports and Security Audit Logs.
- **📱 Mobile-First PWA**: Web App Manifest & Service Worker included for native-like mobile app experience.
- **⏰ Scheduled Cron Automation**: Vercel Cron integration for auto-closing expired attendance windows and marking unexcused absences.

---

## 🛠️ Tech Stack

- **Frontend**: Astro (SSR Mode), Tailwind CSS, Lucide Icons, TypeScript, PWA Service Worker
- **Backend**: Astro Server Endpoints (`/api/*`), HTTP-only Session Auth, Zod Validation
- **Database**: Neon PostgreSQL Serverless DB, Drizzle ORM
- **Deployment**: Vercel Serverless Functions + Neon PostgreSQL

---

## 🔑 Demo Seed Accounts

After seeding the database, test with these pre-configured credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@institution.edu` | `AdminPass123!` |
| **Teacher** | `teacher@institution.edu` | `TeacherPass123!` |
| **Student 1** | `student1@institution.edu` | `StudentPass123!` |
| **Student 2** | `student2@institution.edu` | `StudentPass123!` |

---

## 💻 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
DATABASE_URL="postgresql://neondb_owner:...@ep-sample.neon.tech/neondb?sslmode=require"
SESSION_SECRET="super-secret-32-character-minimum-random-string"
PUBLIC_SITE_URL="http://localhost:4321"
MIN_ATTENDANCE_PERCENTAGE="75"
CRON_SECRET="vercel-cron-secret-token"
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Push Database Schema & Seed Data
```bash
npm run db:push
npm run db:seed
```

### 5. Launch Development Server
```bash
npm run dev
```

---

## ☁️ Deployment Guide (Vercel + Neon)

### 1. Create a Neon PostgreSQL Database
1. Go to [Neon.tech](https://neon.tech) and create a free PostgreSQL database project.
2. Copy your pooled connection string (`DATABASE_URL`).

### 2. Connect Repository to Vercel
1. Push this project to GitHub.
2. Open [Vercel.com](https://vercel.com) -> **Add New Project** -> Import your GitHub repository.
3. Vercel automatically detects **Astro**.

### 3. Set Environment Variables in Vercel
In Vercel Project Settings -> **Environment Variables**, add:
- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `SESSION_SECRET`: Random 32+ character secret key
- `PUBLIC_SITE_URL`: Your production Vercel domain (`https://your-app.vercel.app`)

### 4. Deploy!
Click **Deploy**. Vercel will automatically build the Astro Serverless deployment.

Once deployed:
```text
Developer computer: OFF
Local Node process: OFF

Website: ONLINE 24/7
Database: ONLINE 24/7
Students: CAN ATTEND
Teachers: CAN MANAGE
Admins: CAN MANAGE
```
