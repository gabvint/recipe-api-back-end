const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }, 
    
    action: {
        type: String
    }, 

    status: { 
        type: String, 
        enum: ['success', 'failure'], 
        required: true 
    },

    details: {
        type: String
    },

    ip: {
        type: String
    },

    createdAt: { 
        type: Date, 
        default: Date.now 
    }

});


module.exports = mongoose.model('Logs', logSchema);