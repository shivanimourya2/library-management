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

const sessions = {};

function generateToken() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
}

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!sessions[token]) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = sessions[token];
    next();
}

function runProlog(facts, query, outputVar, callback) {
    const tempFile = path.join(
        __dirname,
        `temp_query_${Date.now()}_${Math.floor(Math.random() * 1000)}.pl`
    );

    const printAction = outputVar
        ? `format('~w', [${outputVar}])`
        : `writeln('true')`;

    const content = `
:- consult('library_policy.pl').

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

                        facts += `user('${user.user_id}', ${user.user_type}, ${borrowedCount}, ${unpaidFines}).\n`;

                        if (user.is_blacklisted) {
                            facts += `blacklisted('${user.user_id}').\n`;
                        }

                        db.get(
                            'SELECT * FROM books WHERE book_id = ?',
                            [bookId],
                            (err, book) => {
                                if (book) {
                                    facts += `book('${book.book_id}', '${book.title.replace(/'/g, "''")}', '${book.subject}', ${book.book_type}, ${book.availability_status}).\n`;
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
                    }
                );
            }
        );
    });
}

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
                author: 'Unknown Author',
                category: r.subject,
                available: r.availability_status === 'available' ? 1 : 0,
                total: 1
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
                        'UPDATE books SET availability_status = "borrowed" WHERE book_id = ?',
                        [bookId]
                    );

                    res.json({
                        success: true,
                        data: { message: 'Borrowed successfully' }
                    });
                }
            );
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});