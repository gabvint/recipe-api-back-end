const mongoose = require('mongoose'); 


const commentSchema = new mongoose.Schema({

    text: {
        type: String,
        required: true,
    },

    author: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
 },
    { timestamps: true }
);

const ingredientSchema = new mongoose.Schema({

    name: {
        type: String, 
        required: true,
    },

    measurement: {
        type: String, 
        required: true,
    }

});

const instructionSchema = new mongoose.Schema({

    description: {
        type: String,
    }

});

const recipeSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
    },
    
    imageUrl: {
        type: String, 

    },

    preptime: {
        type: String, 
        required: true,
    },

    cooktime: {
        type: String, 
        required: true,
    },

    
    ingredients: [ingredientSchema],

    instructions: [instructionSchema],
    
    author: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
    }, 

    isPublic: {
        type: Boolean, 
        default: true, // recipes are default to be public 
    },

    comments: [commentSchema],

    savedBy: [
        {
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
        }
    ]

    }
);

const Recipe = mongoose.model('Recipe', recipeSchema);
 
module.exports = Recipe;