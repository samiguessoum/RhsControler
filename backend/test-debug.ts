console.log('STEP 1: Starting...');

console.log('STEP 2: Importing dotenv');
import 'dotenv/config';

console.log('STEP 3: Importing express');
import express from 'express';

console.log('STEP 4: Importing Prisma');
import { PrismaClient } from '@prisma/client';

console.log('STEP 5: Creating Prisma client');
const prisma = new PrismaClient();

console.log('STEP 6: Creating express app');
const app = express();

console.log('STEP 7: Adding route');
app.get('/test', (req, res) => res.send('OK'));

console.log('STEP 8: Starting server');
app.listen(3000, () => {
  console.log('STEP 9: Server running on port 3000');
});

console.log('STEP 10: After listen call');
