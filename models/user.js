const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true,
    }, 
    
    lastname: {
        type: String,
        required: true,
    }, 
    email: {
        type: String,
        required: true,
    }, 
    username: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
     role: {
        type: String,
        enum: ['admin', 'moderator', 'user'], 
        default: 'user' 
    }, 
    failedLoginAttempts: {
        type: Number, 
        default: 0
    }, 
    isLocked: {
        type: Boolean, 
        default: false, 
    }, 
    lockUntil: {
        type: Date, 
        default: null
    }, 
    securityQuestion1: { 
        type: String, required: true 
    },
    securityAnswer1: { 
        type: String, 
        required: true 
    },
    securityQuestion2: { 
        type: String, required: true 
    },

    securityAnswer2: { 
        type: String, required: true 
    }

});

userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        delete returnedObject.hashedPassword;
        delete returnedObject.securityAnswer1;
        delete returnedObject.securityAnswer2;
    }
});

module.exports = mongoose.model('User', userSchema);