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
        maxlength: 50,
    },

    measurement: {
        type: String, 
        required: true,
        maxlength: 50,
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
        minlength: 2,
        maxlength: 50,
    },
    
    imageUrl: {
        type: String, 

    },

    preptime: {
        type: String, 
        required: true,
        maxlength: 30,
    },

    cooktime: {
        type: String, 
        required: true,
        maxlength: 30,
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

    isApproved: {
        type: Boolean, 
        default: false,
    }, 

   
    
    comments: [commentSchema],

    savedBy: [
        {
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
        }
    ]

    }, 
    { timestamps: true }
);

const Recipe = mongoose.model('Recipe', recipeSchema);
 
module.exports = Recipe;