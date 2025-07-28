const Log = require('../models/logs')

module.exports = async function logEvent({ user, action, status, details = '', ip }) {
  try {
    await Log.create({ user, action, status, details, ip });
  } catch (err) {
    console.error('Failed to log event:', err);
  }
};
