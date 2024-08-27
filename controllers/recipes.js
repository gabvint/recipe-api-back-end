const express = require('express');
const verifyToken = require('../middleware/verify-token.js');
const router = express.Router();
const Recipe = require('../models/recipe.js');
const User = require('../models/user.js');

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
        const recipe = await Recipe.find({}).populate('author')
         res.status(200).json(recipe)

    } catch (error) {
        console.log(error)
        res.status(500).json(error);
    }
});

// get all of the user's recipes
router.get('/user/:userId', async (req, res) => {
    try {
        console.log('userId:', req.params.userId);
        const user = await User.findById(req.params.userId)
        console.log('user', user)

        if (!user){
            res.status(404).json({ message: 'User not found' });
        }
        const authorRecipes = await Recipe.find({ author: user._id })

        console.log('recipe', authorRecipes)
        res.status(200).json(authorRecipes)

    } catch (error) {
        res.status(500).json(error)
    }
})

// get a specific recipe
router.get('/:recipeId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId).populate([
            'author', 
            'ingredients',
            'instructions', 
            'comments.author',
        ])

        res.status(200).json(recipe)
    } catch (error) {
        res.status(500).json(error)
    }
})


// router.get('/myrecipes', async (req, res) => {
//     try {

//         const userRecipes = await Recipe.find({ author: req.user._id })

//         res.status(200).json(userRecipes)

//     } catch (error) {
//         res.status(500).json(error)
//     }
// })

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

// create recipe comments
router.post('/:recipeId/comments', async (req, res) => {
    try {
        req.body.author = req.user._id
        const recipe = await Recipe.findById(req.params.recipeId)
        recipe.comments.push(req.body)
        await recipe.save()

        const newComment = recipe.comments[recipe.comments.length - 1]
        newComment._doc.author = req.user

        res.status(200).json(newComment)

    } catch (error) {
        res.status(500).json(error)
    }
});


// edit recipe comment
router.put('/:recipeId/comments/:commentId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId);
        const comment = recipe.comments.id(req.params.commentId);
        comment.text = req.body.text;
        await recipe.save();
        res.status(200).json({ message: 'Ok' });

    } catch (error) {
        res.status(500).json(error)
    }
})

// delete recipe comment
router.delete('/:recipeId/comments/:commentId', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.recipeId);


        recipe.comments.remove({ _id: req.params.commentId });
        await recipe.save();
        res.status(200).json({ message: 'Ok' });
    } catch (error) {
        res.status(500).json(error)
    }
})



module.exports = router;