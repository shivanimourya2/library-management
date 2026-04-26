const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const dbPath = path.resolve(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Ensure sessions table exists (in case DB was created before schema update)
db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

function generateToken() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
}

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    db.get('SELECT * FROM sessions WHERE token = ?', [token], (err, session) => {
        if (err || !session) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }
        req.user = { id: session.user_id, role: session.role, email: session.email };
        next();
    });
}

function runProlog(facts, query, outputVar, callback) {
    const tempFile = path.join(
        __dirname,
        `temp_query_${Date.now()}_${Math.floor(Math.random() * 1000)}.pl`
    );

    const printAction = outputVar
        ? `format('~w', [${outputVar}])`
        : `writeln('true')`;

    const policyPath = path.join(__dirname, 'library_policy.pl').replace(/\\/g, '/');

    const content = `
:- consult('${policyPath}').

${facts}

:- initialization(main, main).
main :-
    ( ${query} -> ${printAction} ; writeln('false') ).
`;

    fs.writeFileSync(tempFile, content);

    exec(`swipl -q -s "${tempFile}"`, (error, stdout, stderr) => {
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {}

        if (error) {
            console.error('Prolog Execution Error:', error.message);
            return callback(null, error);
        }

        callback(stdout.trim());
    });
}

function buildPrologFactsForUserBook(userId, bookId, callback) {
    let facts = '';

    db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
        if (err || !user) return callback('');

        db.get(
            'SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status = "active"',
            [userId],
            (err, row) => {
                const borrowedCount = row ? row.count : 0;

                db.get(
                    'SELECT SUM(fine_amount) as total FROM fines WHERE user_id = ? AND status = "unpaid"',
                    [userId],
                    (err, fRow) => {
                        const unpaidFines = fRow && fRow.total ? fRow.total : 0.0;

                        facts += `user('${user.user_id}', ${user.user_type}, ${borrowedCount}, ${unpaidFines}, '${user.year}').\n`;

                        if (user.is_blacklisted) {
                            facts += `blacklisted('${user.user_id}').\n`;
                        }

                        db.all('SELECT book_id FROM borrow_records WHERE user_id = ? AND status = "active"', [userId], (err, records) => {
                            if (records) {
                                records.forEach(r => facts += `has_book('${userId}', '${r.book_id}').\n`);
                            }

                            db.get(
                                'SELECT * FROM books WHERE book_id = ?',
                                [bookId],
                                (err, book) => {
                                    if (book) {
                                        facts += `book('${book.book_id}', '${book.title.replace(/'/g, "''")}', '${book.subject}', ${book.book_type}, ${book.availability_status}).\n`;
                                        facts += `book_copies('${book.book_id}', ${book.available_copies}).\n`;
                                    }

                                    db.all(
                                        'SELECT user_id FROM reservations WHERE book_id = ? AND status = "pending" ORDER BY reservation_timestamp ASC',
                                        [bookId],
                                        (err, resv) => {
                                            if (resv && resv.length > 0) {
                                                const queueList =
                                                    '[' +
                                                    resv.map(r => `'${r.user_id}'`).join(', ') +
                                                    ']';

                                                facts += `reservation_queue('${bookId}', ${queueList}).\n`;
                                            } else {
                                                facts += `reservation_queue('${bookId}', []).\n`;
                                            }

                                            callback(facts);
                                        }
                                    );
                                }
                            );
                        });
                    }
                );
            }
        );
    });
}

// --- Auth Routes ---

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }
        const token = generateToken();
        const role = user.user_type === 'senior' ? 'admin' : 'user';
        db.run(
            'INSERT OR REPLACE INTO sessions (token, user_id, role, email) VALUES (?, ?, ?, ?)',
            [token, user.user_id, role, user.email],
            (dbErr) => {
                if (dbErr) console.error('Session save error:', dbErr.message);
            }
        );
        res.json({ 
            success: true, 
            data: {
                token, 
                user: { id: user.user_id, name: user.first_name + ' ' + user.last_name, role, type: user.user_type, dept: 'Computer Engineering', year: user.year }
            }
        });
    });
});

app.post('/api/auth/admin-login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
        if (err || !user || user.email !== 'admin@kgce.edu') {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
        }
        const token = generateToken();
        db.run(
            'INSERT OR REPLACE INTO sessions (token, user_id, role, email) VALUES (?, ?, ?, ?)',
            [token, user.user_id, 'admin', user.email],
            (dbErr) => {
                if (dbErr) console.error('Session save error:', dbErr.message);
            }
        );
        res.json({ 
            success: true, 
            data: {
                token, 
                user: { id: user.user_id, name: user.first_name + ' ' + user.last_name, role: 'admin', type: user.user_type, dept: 'Administration', year: user.year }
            }
        });
    });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    db.run('DELETE FROM sessions WHERE token = ?', [token], () => {
        res.json({ success: true, data: { message: 'Logged out successfully' } });
    });
});

app.post('/api/auth/register', (req, res) => {
    const { name, email, password, type, dept } = req.body;
    const names = name.split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ') || '';
    const userId = 'u' + Math.floor(Math.random() * 100000);
    
    db.run(
        'INSERT INTO users (user_id, first_name, last_name, email, password, user_type, year) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [userId, firstName, lastName, email, password, type || 'student', dept || 'FE'], 
        function(err) {
            if (err) {
                return res.status(400).json({ success: false, error: 'Email already exists or invalid data.' });
            }
            res.json({ success: true, data: { message: 'User registered successfully.' } });
        }
    );
});

app.get('/api/books/:id/suggestions', authenticate, (req, res) => {
    const bookId = req.params.id;
    const userId = req.user.id;

    db.get('SELECT title, subject FROM books WHERE book_id = ?', [bookId], (err, b) => {
        if (err || !b) {
            return res.json({ success: true, data: [] });
        }
        
        // Find related subjects from relations table
        db.all(
            'SELECT subject_2 as rel FROM subject_relations WHERE subject_1 = ? UNION SELECT subject_1 as rel FROM subject_relations WHERE subject_2 = ?',
            [b.subject, b.subject],
            (err, relations) => {
                const relatedSubjects = (relations || []).map(r => r.rel);
                relatedSubjects.push(b.subject); // Include current subject

                const placeholders = relatedSubjects.map(() => '?').join(',');
                const firstLetter = b.title.charAt(0);

                db.all(
                    `SELECT book_id as id, title, author FROM books 
                     WHERE (subject IN (${placeholders}) OR title LIKE ?) 
                     AND book_id != ? 
                     AND available_copies > 0 
                     AND book_id NOT IN (SELECT book_id FROM borrow_records WHERE user_id = ? AND status = "active") 
                     ORDER BY CASE WHEN subject = ? THEN 0 WHEN subject IN (${placeholders}) THEN 1 ELSE 2 END, RANDOM()
                     LIMIT 2`,
                    [...relatedSubjects, firstLetter + '%', bookId, userId, b.subject, ...relatedSubjects],
                    (err, suggestions) => {
                        res.json({
                            success: true,
                            data: suggestions || []
                        });
                    }
                );
            }
        );
    });
});

app.get('/api/books', (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : '%';

    db.all(
        'SELECT * FROM books WHERE title LIKE ? OR subject LIKE ?',
        [search, search],
        (err, rows) => {
            if (err) {
                return res.json({ success: false, error: err.message });
            }

            const result = rows.map(r => ({
                id: r.book_id,
                title: r.title,
                author: r.author,
                category: r.subject,
                available: r.available_copies,
                total: r.total_copies
            }));

            res.json({ success: true, data: result });
        }
    );
});


app.post('/api/issues', authenticate, (req, res) => {
    const bookId = req.body.bookId;
    const userId = req.user.id;

    buildPrologFactsForUserBook(userId, bookId, (facts) => {
        const query = `can_borrow('${userId}', '${bookId}')`;

        runProlog(facts, query, null, (result, err) => {
            if (err || result === 'false') {
                return res.json({
                    success: false,
                    error: 'Prolog Policy Denied'
                });
            }

            const issueDate = new Date().toISOString().split('T')[0];
            const due = new Date();
            due.setDate(due.getDate() + 14);
            const dueDate = due.toISOString().split('T')[0];

            db.run(
                'INSERT INTO borrow_records (user_id, book_id, borrow_date, due_date, status) VALUES (?, ?, ?, ?, ?)',
                [userId, bookId, issueDate, dueDate, 'active'],
                function (err) {
                    if (err) {
                        return res.json({
                            success: false,
                            error: err.message
                        });
                    }

                    db.run(
                        'UPDATE books SET available_copies = available_copies - 1, availability_status = CASE WHEN available_copies - 1 <= 0 THEN "borrowed" ELSE "available" END WHERE book_id = ?',
                        [bookId]
                    );

                    db.run(
                        'UPDATE reservations SET status = "fulfilled" WHERE user_id = ? AND book_id = ? AND status = "pending"',
                        [userId, bookId]
                    );

                    db.get('SELECT title, subject, book_id FROM books WHERE book_id = ?', [bookId], (err, b) => {
                        if (err || !b) {
                            return res.json({ success: true, data: { message: 'Borrowed successfully' } });
                        }
                        
                        const firstLetter = b.title.charAt(0);
                        db.all(
                            'SELECT book_id as id, title, author FROM books WHERE (subject = ? OR title LIKE ?) AND book_id != ? AND available_copies > 0 AND book_id NOT IN (SELECT book_id FROM borrow_records WHERE user_id = ? AND status = "active") LIMIT 3',
                            [b.subject, firstLetter + '%', bookId, userId],
                            (err, suggestions) => {
                                res.json({
                                    success: true,
                                    data: { 
                                        message: 'Borrowed successfully', 
                                        suggestions: suggestions || [] 
                                    }
                                });
                            }
                        );
                    });
                }
            );
        });
    });
});

app.get('/api/users', (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    db.all(
        'SELECT * FROM users WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?',
        [search, search, search],
        (err, rows) => {
            if (err) return res.json({ success: false, error: err.message });
            const result = rows.map(r => ({
                id: r.user_id,
                name: r.first_name + ' ' + r.last_name,
                email: r.email,
                type: r.user_type,
                year: r.year,
                dept: 'N/A'
            }));
            res.json({ success: true, data: result });
        }
    );
});

app.get('/api/issues', (req, res) => {
    db.all('SELECT * FROM borrow_records', [], (err, rows) => {
        if (err) return res.json({ success: false, error: err.message });
        const result = rows.map(r => ({
            id: r.borrow_id,
            userId: r.user_id,
            bookId: r.book_id,
            issueDate: r.borrow_date,
            dueDate: r.due_date,
            returnDate: r.return_date,
            returned: r.status === 'returned'
        }));
        res.json({ success: true, data: result });
    });
});

app.post('/api/books', (req, res) => {
    const { title, author, category, total, isbn } = req.body;
    const bookId = 'b' + Math.floor(Math.random() * 100000);
    db.run(
        'INSERT INTO books (book_id, title, author, subject, book_type, isbn, total_copies, available_copies, availability_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [bookId, title, author, category, 'normal', isbn || '', total, total, total > 0 ? 'available' : 'borrowed'],
        function(err) {
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, data: { message: 'Book added' } });
        }
    );
});

app.delete('/api/books/:id', (req, res) => {
    db.run('DELETE FROM books WHERE book_id = ?', [req.params.id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true, data: { message: 'Book deleted' } });
    });
});

app.patch('/api/issues/:id/return', (req, res) => {
    const issueId = req.params.id;
    const returnDate = new Date().toISOString().split('T')[0];
    
    db.get('SELECT book_id, status FROM borrow_records WHERE borrow_id = ?', [issueId], (err, record) => {
        if (err || !record) return res.json({ success: false, error: 'Record not found' });
        if (record.status === 'returned') return res.json({ success: false, error: 'Already returned' });
        
        db.run('UPDATE borrow_records SET status = "returned", return_date = ? WHERE borrow_id = ?', [returnDate, issueId], function(err) {
            if (err) return res.json({ success: false, error: err.message });
            
            db.run('UPDATE books SET available_copies = available_copies + 1, availability_status = "available" WHERE book_id = ?', [record.book_id]);
            res.json({ success: true, data: { message: 'Book returned' } });
        });
    });
});

app.post('/api/fines/calculate', (req, res) => {
    const { userId, daysOverdue, year: yearOverride } = req.body;
    db.get('SELECT user_type, year FROM users WHERE user_id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.json({ success: false, error: 'User not found' });
        }
        
        const year = yearOverride || user.year || 'FE';
        const tempFile = path.join(__dirname, `temp_fine_${Date.now()}_${Math.floor(Math.random() * 1000)}.pl`);
        const policyPath = path.join(__dirname, 'library_policy.pl').replace(/\\/g, '/');
        
        const content = `
:- consult('${policyPath}').
:- initialization(main, main).
main :-
    ( calculate_fine(${daysOverdue}, ${user.user_type}, '${year}', TotalFine) -> format('~w', [TotalFine]) ; writeln('0.0') ).
`;
        fs.writeFileSync(tempFile, content);
        
        exec(`swipl -q -s "${tempFile}"`, (error, stdout, stderr) => {
            try { fs.unlinkSync(tempFile); } catch (e) {}
            if (error) {
                console.error('Fine calculation error:', error.message);
                return res.json({ success: false, error: 'Prolog Execution Error' });
            }
            res.json({ success: true, data: { fine: parseFloat(stdout.trim()) } });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});