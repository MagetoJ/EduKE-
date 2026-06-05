const { initializeDatabase } = require('./server/database');

async function run() {
    console.log('Starting unified database initialization...');
    try {
        await initializeDatabase();
        console.log('Initialization finished.');
    } catch (err) {
        console.error('Initialization failed:', err);
    } finally {
        process.exit(0);
    }
}

run();
