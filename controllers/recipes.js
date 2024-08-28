const express = require('express');
const verifyToken = require('../middleware/verify-token.js');
const router = express.Router();
const Recipe = require('../models/recipe.js');
const User = require('../models/user.js');

const multer = require('multer');

router.use(verifyToken);

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, "uploads/");
//     }, 
//     filename: function (req, file, cb) {
//         cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//     },
// })

// const upload = multer({ 
//     storage: storage,
//     //dest : "uploads/"
// })

// create recipes 
router.post('/', async (req, res) => {
    try {
        // console.log('image',req.file); 
        // console.log('body',req.body); 
        // // The file is stored in req.file
        // const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      
        req.body.author = req.user._id
        //if (imageUrl) req.body.imageUrl = req.file.filename;

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
        const user = await User.findById(req.params.userId)

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



//save recipes 
router.post('/user/:userId/favorites/:recipeId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
        const recipe = await Recipe.findById(req.params.recipeId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        user.savedRecipes.push(recipe);
        await user.save();

        res.status(200).json({ message: 'Ok' });
    } catch (error) {
        res.status(500).json(error)
    }
}) 

// get user saved recipe information 
router.get('/user/:userId/favorites', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('savedRecipes');
       // console.log(user)
        if (!user){
            res.status(404).json({ message: 'User not found' });
        }

        const savedRecipes = user.savedRecipes
        console.log('saved recipes', savedRecipes.name)
        res.status(200).json(savedRecipes)

    } catch (error) {
        res.status(500).json(error)
    }
})

// remove favorite recipe 
router.delete('/user/:userId/favorites/:recipeId', async (req, res) => {

    const { userId, recipeId } = req.params;

    const user = await User.findById(req.params.userId)
    
    if (!user){
        res.status(404).json({ message: 'User not found' });
    }

    user.savedRecipes = user.savedRecipes.filter((recipe) => recipe.toString() !== recipeId)
    user.save()
    res.status(200).json({ message: 'Ok'})

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