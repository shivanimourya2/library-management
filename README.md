# 📚 Library Management System

A full-stack academic project that combines **web development, database management, and logic programming** to simulate an intelligent Library Management System.

---

## 🚀 Features

### 📊 Librarian Dashboard

* Manage books, members, and transactions
* Input and track 25+ attributes
* Monitor availability, fines, and reservations

### 👨‍🎓 Student Portal

* Check borrowing eligibility
* View fines and return details
* Get smart book recommendations

## 🛠️ Tech Stack

| Layer        | Technology            |
| ------------ | --------------------- |
| Frontend     | HTML, CSS, JavaScript |
| Backend      | Node.js, Express      |
| Database     | MySQL                 |
| Logic Engine | Prolog (SWI-Prolog)   |

---

## 📁 Project Structure

```
project-root/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── backend/
│   ├── server.js
│   ├── db.js
│   └── routes.js
│
├── prolog/
│   └── rules.pl
│
├── database/
│   └── schema.sql
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```
git clone https://github.com/your-username/library-optimizer.git
cd library-optimizer
```

---

### 2️⃣ Setup MySQL Database

* Open MySQL
* Run:

```
SOURCE database/schema.sql;
```

---

### 3️⃣ Start Backend Server

```
cd backend
npm install
node server.js
```

---

### 4️⃣ Run Prolog

Make sure SWI-Prolog is installed:

```
swipl prolog/rules.pl
```

---

### 5️⃣ Open Frontend

* Open `frontend/index.html` in browser

---

## 👩‍💻 Author

Shivani Mourya

---

## 📜 License

This project is for educational purposes only.
