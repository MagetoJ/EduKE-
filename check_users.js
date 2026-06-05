import { query } from './server/db/connection.js';

console.log('Checking existing users...');
const result = await query('SELECT id, email, role, first_name, last_name FROM users LIMIT 10');
console.log('Users found:', result.rows);