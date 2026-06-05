/**
 * Unified Database Connection
 * This file proxies to server/database.js to ensure consistency across the application.
 */

const database = require('../database');

module.exports = {
  ...database
};
