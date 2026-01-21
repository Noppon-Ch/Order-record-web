import dotenv from 'dotenv';
dotenv.config();
console.log('SUPABASE_URL in server.ts:', process.env.SUPABASE_URL);

import app from './app.js'; // Import app จากไฟล์ app.ts

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});