import 'dotenv/config'; // Load env vars before other imports
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import passport from 'passport';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/users/user.routes.js';
import homepageRoutes from './features/homepage/homepage.routes.js';
import { setupPassport } from './features/auth/auth.passport.js';
import { renderLoginPage } from './features/auth/auth.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// --- Passport & Session Setup ---
// Middleware to parse application/x-www-form-urlencoded (for form POST)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Security Middleware ---
// --- Security Middleware ---
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdn.jsdelivr.net", "cdn.tailwindcss.com", "https://d3js.org", (req: any, res: any) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.use(limiter);
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  }
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
  path.resolve(process.cwd(), 'src', 'features', 'users', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'customers', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'products', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'orders', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'visualizations', 'views'),
  path.resolve(process.cwd(), 'src', 'features', 'teams', 'views'),
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
// Mount homepage routes
app.use('/homepage', homepageRoutes);

import customerRoutes from './features/customers/customer.routes.js';
app.use('/customer', customerRoutes);

import productRoutes from './features/products/product.routes.js';
app.use('/products', productRoutes);

import orderRoutes from './features/orders/order.routes.js';
app.use('/orders', orderRoutes);
app.use('/order', orderRoutes);

import { visualizationRoutes } from './features/visualizations/visualization.routes.js';
app.use('/visualizations', visualizationRoutes);

import teamRoutes from './features/teams/team.routes.js';
app.use('/teams', teamRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

export default app;