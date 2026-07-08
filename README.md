<<<<<<< HEAD
# Parking Lot System

A full-stack parking lot management dashboard built with **React**, **Node.js (Express)**, and **SQL** (SQLite by default, MySQL compatible).

## Features

1. **Dashboard & Live Availability**: Cards showing live parked count and remaining slot limits for Bikes (5), Cars (5), and Trucks (2) with animated percentage indicators.
2. **Park Vehicle**: Checks availability before issuing a ticket. Rejects duplicate active license plates.
3. **Exit/Checkout Vehicle**: Search by Ticket ID or Vehicle Number, calculate stay duration (rounded up to full hours), compute fare based on slabs, and process checkout.
4. **Interactive Simulation**: Lets you mock an entry time in the past (e.g. 2 hours ago, 5 hours ago, 8 hours ago) so you can verify fare calculations immediately.
5. **Parked List**: A clean searchable table of all active parked vehicles.

## Tech Stack
- **Frontend**: React (Vite, vanilla CSS)
- **Backend**: Node.js, Express
- **Database**: SQLite (zero-config local file `parking_lot.db`, created automatically on start) or MySQL.

---

## Quick Start (Local Run)

You will need two terminals to run the system: one for the backend, and one for the frontend.

### 1. Run the Backend

1. Navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   *Note: On first boot, the server will automatically create `parking_lot.db` (SQLite database) and initialize the table.*

### 2. Run the Frontend

1. Navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (usually `http://localhost:5173`) in your web browser.

---

## Configuration (Optional MySQL)

If you prefer to run the system using a MySQL database instead of the built-in SQLite:

1. Create a database in MySQL named `parking_lot` using the `schema.sql` file.
2. Create a `.env` file in the `backend/` directory with the following variables:
   ```env
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_mysql_username
   DB_PASS=your_mysql_password
   DB_NAME=parking_lot
   ```
3. Restart the backend server. It will connect to MySQL instead of SQLite.

## Pricing Rules
- **0–3 hours**: ₹30
- **3–6 hours**: ₹85
- **6+ hours**: ₹120
- *Stay time is rounded up to whole hours.*

---

## Production Deployment (Vercel & Render)

We have added **PostgreSQL** support so you can easily deploy the system to production:
1. **Database**: Create a free PostgreSQL instance on Render.
2. **Backend**: Deploy the `backend/` folder as a Web Service on Render, and set the `DATABASE_URL` environment variable to link your PostgreSQL database.
3. **Frontend**: Deploy the `frontend/` folder to Vercel, and set the `VITE_API_URL` environment variable to point to your Render backend web service.

*For complete, step-by-step instructions, see the [Deployment Guide](file:///C:/Users/pooji/.gemini/antigravity/brain/e07d2099-df04-4a9f-baf4-c32a7f718371/deployment_guide.md) artifact.*
=======
# parking-lot-system
>>>>>>> d8cc68c46a4ed0270d87d0ef1abf0f61470fbb80
