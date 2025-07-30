const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Recipe = require('../models/recipe.js');
const Log = require('../models/logs.js');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verify-token');
const verifyRole = require('../middleware/verify-role');
const logEvent = require('../utils/logEvents.js');



const SALT_LENGTH = 12;

const passwordRegEx = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{12,}$/;

router.post('/signup', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { firstname, lastname, email, username } = req.body;
    try {   

        if (!passwordRegEx.test(req.body.password)){
            return res.status(400).json({
                error: 'Password must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.'
            }); 
        }

        // Check if the username is already taken
        const userInDatabase = await User.findOne({ username: req.body.username });
        const emailInDatabase = await User.findOne({ email: req.body.email });
        
        if (userInDatabase) {
            return res.json({error: 'Username already taken.'});
        }
        if (emailInDatabase) {
            return res.json({error: 'Email already taken.'});
        }

        if (!firstname || firstname.length < 2 || firstname.length > 30){
            return res.json({ error: 'First name must be 2-30 characters.' });
        }

        if (!lastname || lastname.length < 2 || lastname.length > 30){
            return res.json({ error: 'Last name must be 2-30 characters.' });
        }

        if (!username || username.length < 2 || username.length > 30){
            return res.json({ error: 'Username must be 4-30 characters.' });
        }

        if (!email || email.length > 50){
            return res.json({ error: 'Email is required and must be under 50 characters.' });
        }

        // Create a new user with hashed password
        const user = await User.create({
            firstname: req.body.firstname, 
            lastname: req.body.lastname, 
            email: req.body.email, 
            username: req.body.username,
            hashedPassword: bcrypt.hashSync(req.body.password, SALT_LENGTH),
            securityQuestion1: req.body.securityQuestion1,
            securityAnswer1: bcrypt.hashSync(req.body.securityAnswer1, SALT_LENGTH),
            securityQuestion2: req.body.securityQuestion2,
            securityAnswer2: bcrypt.hashSync(req.body.securityAnswer2, SALT_LENGTH)
        })

        const token = jwt.sign(
            {
                _id: user._id,
                username: user.username,
                role: user.role  
            },
            process.env.JWT_SECRET,  // Secret key
            { expiresIn: '1h' }  // Set token expiration
        );

        await logEvent({ action: 'signup', status: 'success', details: 'user created', ip });
        res.status(201).json({ user, token });
    } catch (error) {
        await logEvent({ action: 'signup', status: 'failure', details: error.message, ip });
        res.status(400).json({ error: "Invalid request."  });
    }
});

router.post('/signin', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const user = await User.findOne({ username: req.body.username });

        if (!user){
            await logEvent({ action: 'login', status: 'failure', details: 'User not found', ip });
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // track last login attempt
        user.lastLoginAttempt = new Date();
        await user.save();

        // check if the user's account is locked and if the lock time has passed
        if (user.isLocked && user.lockUntil > Date.now()) {
            const remainingTime = user.lockUntil - Date.now();
            const remainingMinutes = Math.ceil(remainingTime / (1000 * 60)); 

            return res.status(403).json({
                error: `Account locked. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
            });
        }

        // If the lock period has passed, reset the failed attempts and lock status
        if (user.isLocked && user.lockUntil < Date.now()) {
            user.isLocked = false;
            user.failedLoginAttempts = 0; // Reset failed attempts after lockout period
            user.lockUntil = null; // Remove the lock time
            await user.save();
        }


        const passwordMatch = bcrypt.compareSync(req.body.password, user.hashedPassword);

        if (passwordMatch) {
            // reset failed attempts on successful login 
            await logEvent({ user: user._id, action: 'login', status: 'success', ip });
            user.failedLoginAttempts = 0; 
            await user.save();

             const token = jwt.sign(
                {
                    _id: user._id,
                    username: user.username,
                    role: user.role  
                },
                process.env.JWT_SECRET,  
                { expiresIn: '1h' }  
            );
            res.status(200).json({ token }); 
        } else {
            user.failedLoginAttempts += 1; 

            await logEvent({ 
                user: user._id, 
                action: 'login', 
                status: 'failure', 
                details:  `Failed login attempt = ${user.failedLoginAttempts}`, 
                ip 
            });


            if (user.failedLoginAttempts >= 5){
                await logEvent({ 
                    user: user._id, 
                    action: 'login', 
                    status: 'failure', 
                    details:  `Account locked for 15 minutes`, 
                    ip 
                });
                user.isLocked = true; 
                user.lockUntil = Date.now() + 15 * 60 * 1000; // lock for 15 mins 
            }
            await user.save(); 
            res.status(401).json({ error: 'Invalid username or password.' });
        }

    } catch (error) {
        await logEvent({ action: 'login', status: 'failure', details: error.message, ip });
        res.status(400).json({ error: "Invalid request."  });
    }
});



router.post('/:userId/change-password', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const { username, currentPassword, newPassword, confirmPassword} = req.body;
        const user = await User.findOne({ username });

        if (!user){
            return res.status(404).json({ error: 'User not found' });
        }

        // Re-authenticate user by checking current password
        if (!bcrypt.compareSync(currentPassword, user.hashedPassword)) {
            return res.status(401).json({ error: 'Password is incorrect.' });
        }

         // compare the new password to confirm password
        if (newPassword !== confirmPassword){
            return res.status(400).json({ error: "Passwords do not match "}); 
        }

        if(!passwordRegEx.test(newPassword)) {
             return res.status(400).json({
                error: 'New password must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.'
            });
        }

        // Prevent password reuse: Check if new password is reused
        if (user.isPasswordReused(newPassword)) {
            return res.status(400).json({ error: 'You cannot reuse one of your previous passwords.' });
        }

        //Enforce password age (24 hours)
        const oneDayInMs = 24 * 60 * 60 * 1000;  // 24 hours in milliseconds
        if (Date.now() - user.lastPasswordChange < oneDayInMs) {
            return res.status(400).json({ error: 'You cannot change your password within 24 hours of the last change.' });
        }

        // Hash the new password
        const newHashedPassword = bcrypt.hashSync(newPassword, SALT_LENGTH);

        // Update password history and save new password
        await user.updatePasswordHistory(newHashedPassword);

        // Update the user's password in the database
        user.hashedPassword = newHashedPassword;
        await user.save();


        await logEvent({ action: 'change password', status: 'success', details: 'password changed', ip });
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        await logEvent({ action: 'change password', status: 'failure', details: error.message, ip });
        res.status(400).json({ error: "Invalid request."  });
    }

});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user){
            return res.status(404).json({ error: "Email not found "});
        }

        // send security questions 
        res.status(200).json({
            securityQuestion1: user.securityQuestion1,
            securityQuestion2: user.securityQuestion2,
        });

    } catch (error) {
        res.status(400).json({ error: "Invalid request."  });
    }
});

router.post('/forgot-password/validate', async (req, res) => {
    try {
        const { email, securityAnswer1, securityAnswer2 } = req.body;
        const user = await User.findOne({ email });
        console.log(user)

        if (!user){
            return res.status(404).json({ error: "Email not found "});
        }

        const isValidAnswer1 = bcrypt.compareSync(securityAnswer1, user.securityAnswer1);
        const isValidAnswer2 = bcrypt.compareSync(securityAnswer2, user.securityAnswer2);

        if (isValidAnswer1 && isValidAnswer2) {
            return res.status(200).json( { message: 'Answers are valid, you can now change your password '});
        } else {
            res.status(400).json({ error: 'Incorrect answers' });
        }

    } catch (error) {
        res.status(400).json({ error: "Invalid request."  });
    }
});

router.post('/forgot-password/change-pw', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const { email, newPassword, confirmPassword } = req.body;
        const user = await User.findOne({ email });
        console.log(user)

        if (!user) {
            return res.status(404).json({ error: 'User not found' }); 
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        if(!passwordRegEx.test(newPassword)) {
             return res.status(400).json({
                error: 'New password must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.'
            });
        }

        if (user.isPasswordReused(newPassword)) {
            return res.status(400).json({ error: 'You cannot reuse one of your previous passwords.' });
        }

        const oneDayInMs = 24 * 60 * 60 * 1000; 
        if (Date.now() - user.lastPasswordChange < oneDayInMs) {
            return res.status(400).json({ error: 'You cannot change your password within 24 hours of the last change.' });
        }

        const newHashedPassword = bcrypt.hashSync(newPassword, SALT_LENGTH);
        await user.updatePasswordHistory(newHashedPassword);
        user.hashedPassword = newHashedPassword;
        await user.save();


        await logEvent({ action: 'forgot password', status: 'success', details: 'password changed', ip });
        res.status(200).json({ message: 'Password updated successfully.' });

    } catch (error) {
        await logEvent({ action: 'forgot password', status: 'failure', details: error.message, ip });
        res.status(400).json({ error: "Invalid request."  });
    }
});


router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

    res.json({
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        username: user.username,
        role: user.role,
    });

    } catch (error) {
        res.status(400).json({ error: "Invalid request."  });
    }
});

router.put('/edit-profile', verifyToken, async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const { firstname, lastname, username, email } = req.body

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.firstname = firstname || user.firstname;
        user.lastname = lastname || user.lastname;
        user.username = username || user.username;
        user.email = email || user.email;

        await user.save();

        res.json({
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            username: user.username,
            role: user.role,
        });

        await logEvent({ action: 'edit profile', status: 'success', details: "edit user credentials", ip });
    } catch (error) {
        await logEvent({ action: 'edit profile', status: 'failure', details: error.message, ip });
        res.status(400).json({ error: "Invalid request."  });
    }
}); 

router.delete('/delete-account', verifyToken, async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  try {
    const { password, securityAnswer1, securityAnswer2 } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // Check password
    const isPasswordCorrect = bcrypt.compareSync(password, user.hashedPassword);
    if (!isPasswordCorrect){
        return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Check security answers (case-insensitive)
    const isAnswer1Correct = bcrypt.compareSync(securityAnswer1.toLowerCase(), user.securityAnswer1);
    const isAnswer2Correct = bcrypt.compareSync(securityAnswer2.toLowerCase(), user.securityAnswer2);
    if (!isAnswer1Correct || !isAnswer2Correct){
        return res.status(401).json({ error: 'Incorrect security answers.' });
    }

    // Delete recipes by this user
    await Recipe.deleteMany({ author: user._id });

    // Delete user
    await User.findByIdAndDelete(user._id);

    await logEvent({ action: 'delete user', status: 'success', details: "user account deleted", ip });
    return res.json({ message: 'Your account and all associated recipes have been deleted.' });
  } catch (error) {
    await logEvent({ action: 'delete user', status: 'failure', details: error.message, ip });
    res.status(500).json({ error: "Invalid request."   });
  }
});


router.get('/logs', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const { userId, action, status, limit = 100, skip = 0 } = req.query;
    let filter = {};
    if (userId) filter.user = userId;
    if (action) filter.action = action;
    if (status) filter.status = status;

    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate('user', 'username email role');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Invalid request."  });
  }
});

router.get('/', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const users = await User.find({}, '-hashedPassword -securityAnswer1 -securityAnswer2').lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Invalid request." });
  }
});
router.patch('/:userid/role', verifyToken, verifyRole(['admin']), async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const { userid } = req.params; 
        const { role, adminPassword } = req.body;
        const adminId = req.user._id;
        
        // Prevent admin from editing their own role
        if (userid === adminId.toString()) {
            return res.status(403).json({ error: "You cannot change your own role." });
        }

        // Validate role
        if (!['admin','moderator','user'].includes(role)) {
            return res.status(400).json({ error: "Invalid role." });
        }

        // get admin and verify pw
        const adminUser = await User.findById(adminId);
        if (!adminUser){
            return res.status(401).json({ error: "Unauthorized." });
        }
        // Check password (make sure you have passwordMatch implemented!)
        const passwordMatch = bcrypt.compareSync(adminPassword, adminUser.hashedPassword);
        if (!passwordMatch){
            return res.status(401).json({ error: "Incorrect password." });
        }

        const user = await User.findById(userid);
        if (!user){
            return res.status(404).json({ error: "User not found." });
        }

        user.role = role;
        await user.save();

        await logEvent({ 
            user: adminId, 
            action: 'change role',
            status: 'success', 
            details: `Changed ${user.username} to ${role}`,
            ip 
        });

        res.json({ message: "Role updated.", user }); 
    } catch (error) {
        res.status(500).json({ error: "Invalid request."  });
    }
});

module.exports = router;