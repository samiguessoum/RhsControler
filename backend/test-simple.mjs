console.log('STEP 1: Starting...');
import express from 'express';
console.log('STEP 2: Express imported');
const app = express();
app.get('/test', (req, res) => res.send('OK'));
console.log('STEP 3: Starting server');
app.listen(3002, () => console.log('STEP 4: Running on 3002'));
