import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import passport from 'passport';
import session from 'express-session';

import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/users/user.routes.js';
import homepageRoutes from './features/homepage/homepage.routes.js';
import { setupPassport } from './features/auth/auth.passport.js';
import { renderLoginPage } from './features/auth/auth.controller.js';

import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// --- Passport & Session Setup ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
}));
setupPassport(session);
app.use(passport.initialize());
app.use(passport.session());


// Set EJS as the view engine
app.set('view engine', 'ejs');
// รองรับ views หลายโฟลเดอร์แบบ feature-based
app.set('views', [
  path.resolve(process.cwd(), 'src', 'features', 'public', 'view'),
  path.resolve(process.cwd(), 'src', 'features', 'auth', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'homepage', 'views'),
  path.resolve(process.cwd(), 'src', 'shared', 'views')
]);

// Serve static files (if needed for Tailwind or assets)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Landing page route
app.get('/', (req, res) => {
  res.render('index');
});


// Login page route
app.get('/login', renderLoginPage);

// Register page route
app.get('/register', (req, res) => {
  res.render(path.resolve(process.cwd(), 'src', 'features', 'auth', 'views', 'register.ejs'));
});

// Mount auth routes
app.use('/auth', authRoutes);

// Mount user routes
app.use('/user', userRoutes);

// Mount homepage routes
app.use('/homepage', homepageRoutes);

export default app;