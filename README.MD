# 🎓 MentorLink — Connect. Learn. Grow.

MentorLink is a fullstack mentorship platform where learners can connect with experienced mentors for personalized guidance through **1:1 or group video sessions**. Designed for scale, speed, and reliability, MentorLink combines modern technologies like **Next.js**, **Node.js**, **Kafka**, and **AWS** to deliver a seamless experience for both mentors and mentees.

---

## 🚀 Features

### 👥 Core Functionality
- 🔎 **Search & Discover** mentors by skill, experience, and availability
- 🗓️ **Book Sessions** with real-time slot availability
- 📹 **1:1 and 1:Many Video Calls** (WebRTC)
- 📝 **Pre-Session Forms** to define agendas
- 🧾 **Post-Session Feedback** and reviews
- 💳 **Payments & Credits** (Stripe/UPI support)
- 🔒 **Role-Based Access Control** (Admin, Mentor, Mentee)

---

### 🧠 Advanced Features
- 🎥 **Video Recording + Transcoding** (FFmpeg)
- ⏺️ **Auto-recorded Sessions** (like Riverside.fm)
- 📨 **In-App Notifications** + Emails via Kafka
- 🧾 **Audit Logs** for critical system actions
- 🔁 **Refresh Token Rotation** + Secure Cookie Auth
- 🧠 **Rate Limiting** for security-sensitive routes (login, booking)
- 🔍 **Smart Filtering** of mentors by rating, tags, topics

---

## 🏗️ Tech Stack & System Design

### 🖼️ Frontend
- **Next.js 14** with App Router & SSR
- **TailwindCSS** for responsive UI
- **Zustand/Redux** for global state management
- **WebRTC + Socket.io** for video + real-time messaging

### 🧩 Backend
- **Node.js + Express** API
- **Prisma ORM** with **PostgreSQL**
- **Kafka** for async communication (session events, notifications)
- **Redis** for rate limiting, token session cache
- **FFmpeg** for on-the-fly video encoding
- **JWT + Cookies** for Auth & Session management

### ☁️ AWS Infrastructure
| Service         | Purpose                          |
|----------------|----------------------------------|
| EC2             | Hosts Node backend               |
| S3              | Stores recorded session videos   |
| Lambda          | Handles background jobs (e.g., FFmpeg processing, emails)
| RDS (PostgreSQL)| Scalable managed database        |
| CloudWatch      | Logs and monitoring              |
| ElastiCache     | Redis instance for caching       |

---
### Backend Features list:
- Scalable Auth System , include Google Login too
- Role Based Access Control
- AWS s3 to store videos
- FFMPEG for video transcoding and recording
- AUTO Record feature
- Rate limit the routes
- filter the Mentors by Skill , Name , Tag , Experience , rating
- Payment Integration(stripe)
- Rating System
- After Session feedback and review
- Pre session forms for Agendas
- Session Booking
- 1:1 or 1:Many video call session SFU architecture
- Email system via Kafka + Session events Notification
- Refresh Token
- Scalable Chat system [Global chat for interested topics]
- Free session by Mentors
- Prisma + Postgres