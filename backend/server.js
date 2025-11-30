import express from 'express';
import cors from 'cors';
import './config/db.js';
import itemsRoutes from './src/routes/items.js';
import visitsRoutes from './src/routes/visits.js';
import usersRoutes from './src/routes/users.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/items', itemsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/users', usersRoutes);

app.listen(3000, () => console.log("Backend running on port 3000"));
