const jwt = require('jsonwebtoken');
const logEvent = require('../utils/logEvents');
const Log = require('../models/logs.js');

function verifyRole (allowedRoles) {
    return async (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await logEvent({
        user: req.user?._id || null,
        action: 'unauthorized access',
        status: 'failure',
        details: `Insufficient role for ${req.originalUrl}`,
        ip
      });
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
        next();
    };
}


module.exports = verifyRole