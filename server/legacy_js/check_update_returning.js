const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  db.run('INSERT INTO users (name) VALUES (?)', ['Original Name']);
  
  db.all('UPDATE users SET name = ? WHERE id = 1 RETURNING *', ['Updated Name'], (err, rows) => {
    if (err) {
      console.log('UPDATE RETURNING NOT supported:', err.message);
    } else {
      console.log('UPDATE RETURNING supported!', rows);
    }
    db.close();
  });
});
