const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require('jsonwebtoken');


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
            securityQuestion1: bcrypt.hashSync(req.body.securityQuestion1, SALT_LENGTH),
            securityAnswer1: bcrypt.hashSync(req.body.securityAnswer1, SALT_LENGTH),
            securityQuestion2: bcrypt.hashSync(req.body.securityQuestion2, SALT_LENGTH),
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
        // if (user && bcrypt.compareSync(req.body.password, user.hashedPassword)) {
        //     const token = jwt.sign(
        //         {
        //             _id: user._id,
        //             username: user.username,
        //             role: user.role  
        //         },
        //         process.env.JWT_SECRET,  
        //         { expiresIn: '1h' }  
        //     );
        //     res.status(200).json({ token });
        // } else {
        //     res.status(401).json({ error: 'Invalid username or password.' });
        // }

        if (!user){
            res.status(401).json({ error: 'Invalid username or password.' });
        }

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

module.exports = router;