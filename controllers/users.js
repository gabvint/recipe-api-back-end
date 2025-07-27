const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Recipe = require('../models/recipe.js');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verify-token');



const SALT_LENGTH = 12;

const passwordRegEx = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{12,}$/;

router.post('/signup', async (req, res) => {
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

        res.status(201).json({ user, token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/signin', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });

        if (!user){
            res.status(401).json({ error: 'Invalid username or password.' });
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
            // increment failed login attempts 

            user.failedLoginAttempts += 1; 
            console.log('Failed Login Attempt:', user.failedLoginAttempts); // debugging

            if (user.failedLoginAttempts >= 5){
                user.isLocked = true; 
                user.lockUntil = Date.now() + 15 * 60 * 1000; // lock for 15 mins 
                console.log(`Account locked until: ${new Date(user.lockUntil)}`);
            }
            await user.save(); 
            res.status(401).json({ error: 'Invalid username or password.' });
        }

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



router.post('/:userId/change-password', async (req, res) => {
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

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
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
        res.status(400).json({ error: error.message });
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
        res.status(400).json({ error: error.message });
    }
});

router.post('/forgot-password/change-pw', async (req, res) => {
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

        res.status(200).json({ message: 'Password updated successfully.' });

    } catch (error) {
        res.status(400).json({ error: error.message });
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
        res.status(400).json({ error: error.message });
    }
});

router.put('/edit-profile', verifyToken, async (req, res) => {
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

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}); 

router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    const { password, securityAnswer1, securityAnswer2 } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Check password
    const isPasswordCorrect = bcrypt.compareSync(password, user.hashedPassword);
    if (!isPasswordCorrect)
      return res.status(401).json({ error: 'Incorrect password.' });

    // Check security answers (case-insensitive)
    const isAnswer1Correct = bcrypt.compareSync(securityAnswer1.toLowerCase(), user.securityAnswer1);
    const isAnswer2Correct = bcrypt.compareSync(securityAnswer2.toLowerCase(), user.securityAnswer2);
    if (!isAnswer1Correct || !isAnswer2Correct)
      return res.status(401).json({ error: 'Incorrect security answers.' });

    // Delete recipes by this user
    await Recipe.deleteMany({ author: user._id });

    // Delete user
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Your account and all associated recipes have been deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;