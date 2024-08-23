const express = require('express');
const verifyToken = require('../middleware/verify-token.js');
const Recipe = require('../models/recipe.js');
const router = express.Router();


router.use(verifyToken);

// // create hoots
// router.post('/', async (req, res) => {
//     try {
//       req.body.author = req.user._id;
//       const hoot = await Hoot.create(req.body);
//       hoot._doc.author = req.user;
//       res.status(201).json(hoot);

//     } catch (error) {
//       console.log(error);
//       res.status(500).json(error);

//     }
// });


// create recipes 
router.post('/', async (req, res) => {
    try {
        
        req.body.author = req.user._id
        const recipe = await Recipe.create(req.body)
        recipe._doc.author = req.user 
        res.status(201).json(recipe)

    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

module.exports = router;