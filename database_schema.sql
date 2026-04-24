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
    user_type VARCHAR(50) NOT NULL,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_type) REFERENCES user_type_policies(user_type)
);

CREATE TABLE books (
    book_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    book_type VARCHAR(50) NOT NULL, -- 'normal', 'reference'
    availability_status VARCHAR(50) NOT NULL DEFAULT 'available' -- 'available', 'borrowed', 'lost'
);

-- ------------------------------------------------------------------------------
-- 3. Transactional Tables (Borrowing, Reservations, Fines)
-- ------------------------------------------------------------------------------
CREATE TABLE borrow_records (
    borrow_id INT AUTO_INCREMENT PRIMARY KEY, -- Note: Use SERIAL for PostgreSQL
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
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    reservation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'fulfilled', 'cancelled'
    FOREIGN KEY (book_id) REFERENCES books(book_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE fines (
    fine_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    borrow_id INT NOT NULL, -- The borrow record that caused the fine
    fine_amount DECIMAL(10, 2) NOT NULL,
    fine_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'waived'
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (borrow_id) REFERENCES borrow_records(borrow_id)
);

-- ==============================================================================
-- Sample Data Insertion
-- ==============================================================================

-- Insert Policies
INSERT INTO user_type_policies (user_type, max_borrow_limit, max_unpaid_fines, grace_period_days, fine_rate_per_day, fine_discount_percentage) VALUES
('student', 3, 20.00, 7, 2.00, 0.00),
('professor', 10, 50.00, 30, 1.00, 0.00),
('senior', 5, 30.00, 14, 2.00, 0.50);

-- Insert Subject Relations
INSERT INTO subject_relations (subject_1, subject_2) VALUES
('Java', 'Data Structures'),
('Java', 'OOP'),
('Data Structures', 'Algorithms'),
('Algorithms', 'Mathematics');

-- Insert Users
INSERT INTO users (user_id, first_name, last_name, user_type, is_blacklisted) VALUES
('u1', 'Alice', 'Smith', 'student', FALSE),
('u2', 'Bob', 'Johnson', 'professor', FALSE),
('u3', 'Charlie', 'Davis', 'senior', FALSE),
('u6', 'Eve', 'Adams', 'student', TRUE); -- Blacklisted

-- Insert Books
INSERT INTO books (book_id, title, subject, book_type, availability_status) VALUES
('b101', 'Intro to Java', 'Java', 'normal', 'available'),
('b102', 'Data Structures', 'Data Structures', 'normal', 'available'),
('b103', 'Encyclopedia', 'General', 'reference', 'available'),
('b104', 'Advanced OOP', 'OOP', 'normal', 'borrowed'),
('b105', 'Design Patterns', 'OOP', 'normal', 'available');

-- Insert Sample Reservation (Queue)
-- Ordered by timestamp to maintain queue priority
INSERT INTO reservations (book_id, user_id, reservation_timestamp, status) VALUES
('b101', 'u2', '2023-10-24 10:00:00', 'pending'),
('b101', 'u1', '2023-10-24 10:05:00', 'pending'); -- u2 has priority over u1
