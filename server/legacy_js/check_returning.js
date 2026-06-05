const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  
  db.all('INSERT INTO users (name) VALUES (?) RETURNING *', ['Test User'], (err, rows) => {
    if (err) {
      console.log('RETURNING NOT supported:', err.message);
    } else {
      console.log('RETURNING supported!', rows);
    }
    db.close();
  });
});
