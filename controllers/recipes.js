const express = require('express');
const verifyToken = require('../middleware/verify-token.js');
const Recipe = require('../models/recipe.js');
const router = express.Router();


router.use(verifyToken);


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

// get all recipes
router.get('/', async (req, res) => {
    try {
        const recipe = await Recipe.find({})
         .populate('author')
         res.status(200).json(recipe)

    } catch (error) {
        console.log(error)
        res.status(500).json(error);
    }
});

// get a specific recipe
router.get('/:recipeId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId).populate([
            'author', 
            'ingredients',
        ])

        res.status(200).json(recipe)
    } catch (error) {
        res.status(500).json(error)
    }
})

// edit a specific recipe
router.put('/:recipeId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId);

        // checks if the recipe author is authorized to update
        if (!recipe.author.equals(req.user._id)) {
            return res.status(403).send("You are not authorize to do that!");
        }

        const updatedRecipe = await Recipe.findByIdAndUpdate(
            req.params.recipeId,
            req.body,
            { new: true }
          );
      
        updatedRecipe._doc.author = req.user;

        res.status(200).json(updatedRecipe);

    } catch (error) {
        res.status(500).json(error)
    }
})

// delete a specific recipe 
router.delete('/:recipeId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId)

        if (!recipe.author.equals(req.user._id)) {
            return res.status(403).send ("You are not authorize to do that!");
        }

        const deletedRecipe = await Recipe.findByIdAndDelete(req.params.recipeId)

        res.status(200).json(deletedRecipe)
    } catch (error) {
        res.status(500).json(error)
    }
})

module.exports = router;