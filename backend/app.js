// Main file entry point backend

// Imports
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'
import usersRoutes from './routes/usersRoutes.js';
import postsRoutes from './routes/postsRoutes.js';
import commentarysRoutes from './routes/commentsRoutes.js';
import likesRoutes from './routes/likesRouter.js'

// load variables .env file
dotenv.config();

// App creation and port configuration
const app = express();
const PORT = 3000;

// Global middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/users', usersRoutes);
app.use('/post', postsRoutes);
app.use('/commentary', commentarysRoutes);
app.use('/likes', likesRoutes);


// start the server
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
