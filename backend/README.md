# Xaytheon Authentication Backend

A lightweight, self-hostable authentication backend built with Node.js and Express.
This backend replaces the inactive Supabase authentication previously used in Xaytheon.

The backend is intentionally kept simple, secure, and beginner-friendly so that new contributors can easily understand and extend it.

---

## ✨ Features

- User registration
- User login
- JWT-based authentication
- Secure password hashing using bcrypt
- SQLite database for lightweight storage
- Environment-based configuration
- Clean and modular project structure

---

## 🛠 Tech Stack

- Node.js
- Express.js
- SQLite
- JSON Web Tokens (JWT)
- bcrypt
- dotenv

---

## 📂 Project Structure
```
backend/
├── src/
│ ├── app.js
│ ├── server.js
│ ├── config/
│ │ └── db.js
│ ├── models/
│ │ └── user.model.js
│ ├── routes/
│ │ └── auth.routes.js
│ ├── controllers/
│ │ └── auth.controller.js
│ └── middleware/
│ └── auth.middleware.js
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Navigate to the backend directory
```bash
cd backend
```

### 2️⃣ Install dependencies
```bash
npm install
```

### 3️⃣ Configure environment variables

- Create a .env file using the example:
```bash
cp .env.example .env
```

- Update .env with the following values:
```
PORT=5000
JWT_SECRET=your_secret_key
```

### 4️⃣ Start the server
```
npm start
```

The server will start at:
```
http://localhost:5000
```

---

## 🔐 API Endpoints

### Register User
```
POST /api/auth/register
```
#### Request Body
```
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Login User
```
POST /api/auth/login
```
#### Request Body
```
{
  "email": "user@example.com",
  "password": "password123"
}
```
Response
```
{
  "token": "jwt_token_here"
}
```

---

## 🧪 Development Notes

- The SQLite database file (users.db) is created automatically on first run
- Authentication is token-based using JWT
- Logout can be handled on the frontend by clearing the stored token
- Frontend integration is intentionally kept out of this implementation to keep the backend focused and reviewable

## 🚫 Security Notes

- Do NOT commit .env files
- Do NOT commit database files
- Always store secrets in environment variables

## 🤝 Contribution Notes

This backend is designed to be minimal and easy to understand.
Contributors are encouraged to extend it with:

- Authentication middleware
- `/me` endpoint
- Token refresh logic
- Role-based access control

## 📜 License
This backend follows the same license as the main Xaytheon repository.

---
