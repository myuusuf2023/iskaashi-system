# Iskaashi Management System

A private internal platform for **Iskaashi Educational Development Organisation** to manage its annual orphan student sponsorship programme — tracking donors, payments, student disbursements, and generating financial reports.

---

## Prerequisites

Make sure the following are installed on your machine before you begin:

| Tool | Minimum Version | Download |
|------|----------------|---------|
| Node.js | v18 or higher | https://nodejs.org |
| npm | v9 or higher | comes with Node.js |
| Git | any recent version | https://git-scm.com |

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/myuusuf2023/iskaashi-system.git
```

---

## Step 2 — Navigate into the project folder

```bash
cd iskaashi-system
```

---

## Step 3 — Install dependencies

```bash
npm install
```

This will install all required packages (React, Vite, Tailwind CSS, Recharts, etc.). It may take a minute.

---

## Step 4 — Start the development server

```bash
npm run dev
```

Once running, open your browser and go to:

```
http://localhost:5173
```

---

## Step 5 — Log in

Use one of the built-in accounts:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `super123` |
| Admin | `admin` | `admin123` |
| Viewer | `viewer` | `viewer123` |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

---

## Tech Stack

- **React 19** — UI framework
- **Vite** — build tool and dev server
- **Tailwind CSS** — styling
- **Recharts** — charts and analytics
- **Lucide React** — icons
- **xlsx** — Excel file import
- **html2canvas** — student ID card export

---

## Data Storage

All data (donors, payments, students) is stored in **browser localStorage** — no backend or database required. Data persists across page refreshes on the same browser.

---

*Iskaashi Educational Development Organisation — Internal Use Only*
