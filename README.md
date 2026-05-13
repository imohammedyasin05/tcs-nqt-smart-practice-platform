# 🚀 TCS NQT Smart Practice Platform

A full-stack web application to practice for the **TCS National Qualifier Test (NQT)** with real exam simulation, AI-generated questions, and performance tracking.

---

## ✨ Features

- 🎯 Subject Selection (Quant, Logical, Verbal, Coding)
- 🧠 AI Question Generation (Gemini + Groq)
- 📊 Difficulty Levels (Basics / Core / Advanced)
- ⏱️ Timed & Untimed Modes
- 📝 Real Exam Mode (No Back Navigation)
- 💻 Coding Practice with Input/Output
- 📈 Result Analysis + Explanations
- 📱 Fully Mobile Responsive

---

## 🧠 AI Integration

- **Primary:** Gemini API  
- **Fallback:** Groq API (LLaMA 3.3 70B)

Smart switching ensures:
- High-quality questions
- Fast responses
- Cost optimization

---

## 🏗️ Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- TypeScript

### Backend
- Node.js
- Express.js

### AI APIs
- Gemini API
- Groq API

### Deployment
- Frontend → Vercel  
- Backend → Render  

---

## 📁 Project Structure

```text
/tcs-nqt-smart-practice-platform
├── server.ts             # Express Backend + Hybrid AI Routing + Vite Middleware
├── src/
│   ├── App.tsx           # Main React Application
│   ├── main.tsx          # React Entry Point
│   ├── types.ts          # TypeScript Definitions
│   ├── index.css         # Tailwind Styling
│   └── components/       # UI Components
├── dist/                 # Production Build Output (Frontend)
├── package.json          # Dependencies & Scripts
├── vite.config.ts        # Vite Configuration
├── tsconfig.json         # TypeScript Configuration
└── .env                  # API Keys & Secrets (Git Ignored)
```

---

## ⚙️ Local Setup Instructions

**1. Clone the Repository:**
```bash
git clone https://github.com/imohammedyasin05/tcs-nqt-smart-practice-platform.git
cd tcs-nqt-smart-practice-platform
```

**2. Install Dependencies:**
```bash
npm install
```

**3. Configure Environment Variables:**
Create a `.env` file in the root directory and add your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
```

**4. Start the Application Locally:**
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

## 🚀 Deployment

**Backend (Render):**
1. Connect this repository to a new Render Web Service.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Add Environment Variables: `GEMINI_API_KEY` and `GROQ_API_KEY`.

**Frontend (Vercel):**
1. Connect this repository to Vercel.
2. Vercel automatically detects the Vite configuration.
3. Add Environment Variable: `VITE_API_URL` pointing to your Render backend URL.
4. Deploy!

---
*Created by [imohammedyasin05](https://github.com/imohammedyasin05) - A smart way to prepare for TCS NQT.*
