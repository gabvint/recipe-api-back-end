
<div align="center">
<img width="500" alt="logo" src="./uploads/logo.png">

</div>

<p align="center">
This is the backend code for Kusina Ku application. This is built to handle API requests, manage user data and perform other server-side operations. 
</p>

## 📌 API ENDPOINTS


| HTTP Method              | Path/Endpoint                                               | Description                   |
| ------------------ | -------------------------------------------------- | ----------------------------- |
| `POST`      |     /recipes          | Create new recipes         |
| `GET`    | /recipes      | Get list of all recipes |
| `GET`      | /recipes/user/:userId           | Get list of user's uploaded recipes              |
| `GET` | /recipes/:recipeId | Show specific recipe details       |
| `PUT`    | /recipes/:recipeId       | update specific recipe          |
| `DELETE`      | /recipes/:recipeId           | delete specific recipe  |
| `POST`            | /recipes/user/:userId/favorites/:recipeId                       | save recipe with delete functionality               |
| `GET`          | /recipes/user/:userId/favorites                   | show user's saved/favorited recipes       |
| `POST`          | /recipes/:recipeId/comments                   | create comments in a specific recipe       |
| `PUT`          | /recipes/:recipeId/comments/:commentId                   | update/edit comment       |
| `DELETE`          | /recipes/:recipeId/comments/:commentId                   | delete comment       |


## 📌 TECHNOLOGIES USED
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)
[![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white)](#)
[![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?logo=express&logoColor=%2361DAFB)](#)
[![Heroku](https://img.shields.io/badge/Heroku-430098?logo=heroku&logoColor=fffe)](#)
