# FanPulse AI ⚽ — FIFA World Cup 2026

FanPulse AI is a real-time, multi-agent generative AI system designed to enhance the fan, volunteer, and operational experience for the FIFA World Cup 2026. It leverages a modern full-stack architecture to provide dynamic routing, accessibility assistance, sustainability metrics, and crowd control management.

## 🌟 Features

- **Multi-Agent Orchestrator:** Intelligent request routing with prompt-injection defense.
- **Navigator Agent:** Provides directions and route mapping within the stadium zones.
- **Crowd Sentinel:** Real-time crowd density monitoring and alert system.
- **Transit Copilot:** Recommends eco-friendly transport options to and from the stadium.
- **Access Companion:** Dedicated assistance for finding accessible routes and quiet zones.
- **Green Ops:** Tracks sustainability metrics like recycling rates and carbon footprints.
- **Polyglot Concierge:** Seamless multilingual support for international fans.
- **Real-Time Communication:** Powered by Socket.IO for instant updates and alerts.

## 🏗️ Architecture

This project is built as a unified monorepo containing both the frontend and backend applications, designed for effortless containerized deployment.

- **Frontend:** React 19, Vite, React Router, Lucide Icons.
- **Backend:** Node.js, Express, Socket.IO, Zod (for validation), SQLite (for context graph).
- **Deployment:** Dockerized for modern PaaS providers (Render, Railway, GCP Cloud Run).

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- npm or yarn

### 1. Setup the Backend
```bash
cd backend
npm install
npm run seed  # Initialize the SQLite context database
npm run dev   # Start the Express/Socket.IO server on port 3001
```

### 2. Setup the Frontend
```bash
cd frontend
npm install
npm run dev   # Start the Vite development server on port 5173
```

## ☁️ Deployment

The project includes a multi-stage `Dockerfile` that builds the React frontend and serves it statically through the Node.js Express backend. 

**To deploy on Render (Recommended):**
1. Connect this repository to your Render account.
2. Create a new **Web Service**.
3. Render will automatically detect the Dockerfile and handle the deployment.

---
*Built for the PROMPTWAR Challenge.*
