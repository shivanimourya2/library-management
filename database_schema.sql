-- ==============================================================================
-- Library Resource & Fine Optimizer Tool - Database Schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Configuration Tables (Replaces Prolog Configuration Facts)
-- ------------------------------------------------------------------------------
-- Stores the configurable policies of the library
CREATE TABLE user_type_policies (
    user_type VARCHAR(50) PRIMARY KEY, -- 'student', 'professor', 'senior'
    max_borrow_limit INT NOT NULL,
    max_unpaid_fines DECIMAL(10, 2) NOT NULL,
    grace_period_days INT NOT NULL,
    fine_rate_per_day DECIMAL(10, 2) NOT NULL,
    fine_discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00
);

-- Stores the subject ontology for the Smart Recommendation System
CREATE TABLE subject_relations (
    subject_1 VARCHAR(100),
    subject_2 VARCHAR(100),
    PRIMARY KEY (subject_1, subject_2)
);

-- ------------------------------------------------------------------------------
-- 2. Core Entities (Users and Books)
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL,
    year VARCHAR(10) DEFAULT 'FE', -- 'FE', 'SE', 'TE', 'BE'
    is_blacklisted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_type) REFERENCES user_type_policies(user_type)
);

CREATE TABLE books (
    book_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) DEFAULT 'Unknown Author',
    subject VARCHAR(100) NOT NULL,
    book_type VARCHAR(50) NOT NULL, -- 'normal', 'reference'
    isbn VARCHAR(50),
    total_copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    availability_status VARCHAR(50) NOT NULL DEFAULT 'available' -- 'available', 'borrowed', 'lost'
);

-- ------------------------------------------------------------------------------
-- 3. Transactional Tables (Borrowing, Reservations, Fines)
-- ------------------------------------------------------------------------------
CREATE TABLE borrow_records (
    borrow_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(50) NOT NULL,
    book_id VARCHAR(50) NOT NULL,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'returned', 'overdue'
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id)
);

CREATE TABLE reservations (
    reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    reservation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'fulfilled', 'cancelled'
    FOREIGN KEY (book_id) REFERENCES books(book_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE fines (
    fine_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(50) NOT NULL,
    borrow_id INTEGER NOT NULL,
    fine_amount DECIMAL(10, 2) NOT NULL,
    fine_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'waived'
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (borrow_id) REFERENCES borrow_records(borrow_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- Sample Data Insertion
-- ==============================================================================

-- Insert Policies
INSERT INTO user_type_policies (user_type, max_borrow_limit, max_unpaid_fines, grace_period_days, fine_rate_per_day, fine_discount_percentage) VALUES
('student', 3, 20.00, 7, 2.00, 0.00),
('professor', 10, 50.00, 30, 1.00, 0.00),
('senior', 5, 30.00, 14, 2.00, 0.50),
('staff', 5, 30.00, 14, 2.00, 0.00),
('researcher', 8, 40.00, 21, 1.50, 0.00);

-- Insert Subject Relations
INSERT INTO subject_relations (subject_1, subject_2) VALUES
('Java', 'Data Structures'),
('Java', 'OOP'),
('Data Structures', 'Algorithms'),
('Algorithms', 'Mathematics');

-- Insert Users
INSERT INTO users (user_id, first_name, last_name, email, password, user_type, year, is_blacklisted) VALUES
('u1', 'Aarav', 'Patel', 'aarav@kgce.edu', 'pass123', 'student', 'BE', FALSE),
('u2', 'Suresh', 'Kumar', 'suresh@kgce.edu', 'pass123', 'professor', 'N/A', FALSE),
('u3', 'Charlie', 'Davis', 'charlie@kgce.edu', 'pass123', 'senior', 'N/A', FALSE),
('u4', 'Admin', 'User', 'admin@kgce.edu', 'admin123', 'senior', 'N/A', FALSE),
('u6', 'Eve', 'Adams', 'eve@kgce.edu', 'pass123', 'student', 'SE', TRUE); -- Blacklisted

-- Insert Books
INSERT INTO books (book_id, title, author, subject, book_type, isbn, total_copies, available_copies, availability_status) VALUES
('b101', 'Intro to Java', 'James Gosling', 'Java', 'normal', '978-0134685991', 5, 5, 'available'),
('b102', 'Data Structures', 'Mark Allen Weiss', 'Data Structures', 'normal', '978-0132576275', 3, 3, 'available'),
('b103', 'Encyclopedia', 'Britannica', 'General', 'reference', '978-1593392925', 1, 1, 'available'),
('b104', 'Advanced OOP', 'Grady Booch', 'OOP', 'normal', '978-0201895513', 2, 0, 'borrowed'),
('b105', 'Design Patterns', 'Gang of Four', 'OOP', 'normal', '978-0201633610', 4, 4, 'available');

-- Insert Sample Reservation (Queue)
-- Ordered by timestamp to maintain queue priority
INSERT INTO reservations (book_id, user_id, reservation_timestamp, status) VALUES
('b101', 'u2', '2023-10-24 10:00:00', 'pending'),
('b101', 'u1', '2023-10-24 10:05:00', 'pending'); -- u2 has priority over u1
