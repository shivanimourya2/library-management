const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath);

let facts = '';

db.get('SELECT * FROM users LIMIT 1', (err, user) => {
    db.get('SELECT * FROM books LIMIT 1', (err, book) => {
        let userId = user.user_id;
        let bookId = book.book_id;
        
        db.get('SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status = "active"', [userId], (err, row) => {
            const borrowedCount = row ? row.count : 0;
            db.get('SELECT SUM(fine_amount) as total FROM fines WHERE user_id = ? AND status = "unpaid"', [userId], (err, fRow) => {
                const unpaidFines = fRow && fRow.total ? fRow.total : 0.0;
                
                facts += `user('${user.user_id}', ${user.user_type}, ${borrowedCount}, ${unpaidFines}).\n`;
                if (user.is_blacklisted) facts += `blacklisted('${user.user_id}').\n`;
                
                facts += `book('${book.book_id}', '${book.title.replace(/'/g, "''")}', '${book.subject}', ${book.book_type}, ${book.availability_status}).\n`;
                facts += `book_copies('${book.book_id}', ${book.available_copies}).\n`;
                
                db.all('SELECT user_id FROM reservations WHERE book_id = ? AND status = "pending" ORDER BY reservation_timestamp ASC', [bookId], (err, resv) => {
                    if (resv && resv.length > 0) {
                        const queueList = '[' + resv.map(r => `'${r.user_id}'`).join(', ') + ']';
                        facts += `reservation_queue('${bookId}', ${queueList}).\n`;
                    } else {
                        facts += `reservation_queue('${bookId}', []).\n`;
                    }
                    
                    console.log("GENERATED FACTS:\n", facts);
                });
            });
        });
    });
});
