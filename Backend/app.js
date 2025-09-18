// server/app.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const logRoutes = require('./Routes/logRoutes');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', logRoutes); // Ab yeh sahi se kaam karega

app.get('/', (req, res) => {
  res.send('Proctoring API Running...');
});

module.exports = app;