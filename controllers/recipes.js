const express = require('express');
const verifyToken = require('../middleware/verify-token.js');
const router = express.Router();
const Recipe = require('../models/recipe.js');
const User = require('../models/user.js');
const logEvent = require('../utils/logEvents.js');
const Log = require('../models/logs.js');
const multer = require('multer');
const verifyRole = require('../middleware/verify-role.js');

router.use(verifyToken);


// create recipes 
router.post('/', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {

        req.body.author = req.user._id
        const recipe = await Recipe.create({
            ...req.body, 
            isApproved: false, 
        });

        recipe._doc.author = req.user 

        await logEvent({ 
            user: req.user._id, 
            action: 'recipe creation',
            status: 'success', 
            details: `recipe = ${recipe.name}`,
            ip 
        });

        res.status(201).json(recipe)

    } catch (error) {
        await logEvent({ 
            user: req.user._id, 
            action: 'recipe creation',
            status: 'failure', 
            details: error.message,
            ip 
        });
        res.status(500).json(error)
    }
})

// get all recipes
router.get('/', async (req, res) => {
    try {
        const recipe = await Recipe.find({ isApproved: true , isPublic: true }).populate('author')
         res.status(200).json(recipe)

    } catch (error) {
        console.log(error)
        res.status(500).json(error);
    }
});

// get all pending recipes
router.get('/pending', verifyToken, verifyRole(['moderator']), async (req, res) => {
    try {
        const pending = await Recipe.find({ isPublic: true }).populate('author')
        res.status(200).json(pending)

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending recipes.' });
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
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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

        await logEvent({ 
            user: req.user._id, 
            action: 'edited recipe',
            status: 'success', 
            details: `recipe = ${recipe.name}`,
            ip 
        });

        res.status(200).json(updatedRecipe);

    } catch (error) {
        await logEvent({ 
            user: req.user._id, 
            action: 'edited recipe',
            status: 'failure', 
            details: `recipe = ${recipe.name}`,
            ip 
        });
        res.status(500).json(error)
    }
})

// delete a specific recipe 
router.delete('/:recipeId', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const recipe = await Recipe.findById(req.params.recipeId)

        if (!recipe.author.equals(req.user._id)) {
            return res.status(403).send ("You are not authorize to do that!");
        }

         await logEvent({ 
            user: req.user._id, 
            action: 'deleted recipe',
            status: 'success', 
            details: `recipe = ${recipe.name}`,
            ip 
        });


        const deletedRecipe = await Recipe.findByIdAndDelete(req.params.recipeId)

       
        res.status(200).json(deletedRecipe)
    } catch (error) {
        await logEvent({ 
            user: req.user._id, 
            action: 'deleted recipe',
            status: 'failure', 
            details: error.message,
            ip 
        });

        res.status(500).json(error)
    }
})



//save recipes and remove
router.post('/user/:userId/favorites/:recipeId', async (req, res) => {

    try {
        const recipe = await Recipe.findById(req.params.recipeId)

        if (recipe.savedBy.includes(req.user._id)){
            recipe.savedBy.remove(req.user._id);
        } else {
            recipe.savedBy.push(req.user._id);
        }

        await recipe.save()
        res.status(200).json(recipe);

    } catch (error) {
        res.status(500).json(error)
    }
}) 

// get user saved recipe information 
router.get('/user/:userId/favorites', async (req, res) => {
   
    try {
        const recipes = await Recipe.find({ savedBy: req.user._id })
        res.status(200).json(recipes)

        
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


// approve a recipe for r
router.patch('/:id/approve', verifyToken, verifyRole(['moderator']), async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  try {
    const { approve } = req.body; 
    const recipe = await Recipe.findById(req.params.id);
    const moderatorId = req.user._id;

    if (!recipe){
        return res.status(404).json({ error: "Recipe not found." });
    } 

    recipe.isApproved = !!approve;
    await recipe.save();

    await logEvent({ 
        user: moderatorId, 
        action: 'recipe approval',
        status: 'success', 
        details: `approved recipe = ${recipe.name} `,
        ip 
    });

    res.json({ message: approve ? "Recipe approved." : "Recipe unapproved.", recipe });

  } catch (error) {
    res.status(500).json({ error: 'Failed to update recipe approval.' });
  }
});

module.exports = router;