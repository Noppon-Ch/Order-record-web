import { Router } from 'express';
import passport from 'passport';
import { upsertUserProfileAfterOAuth } from './auth.service.js';
import { refreshToken, logout } from './auth.controller.js';
import { teamService } from '../teams/services/team.service.js';

const router = Router();

// --- Google Login Flow ---
// 1. User กดลิงก์นี้เพื่อเริ่ม Login (Intent: Login)
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email', 'openid'],
    state: 'login'
}));

// Route สำหรับ Registerโดยเฉพาะ (Intent: Register)
router.get('/google/register', passport.authenticate('google', {
    scope: ['profile', 'email', 'openid'],
    state: 'register'
}));

// 2. Google ส่ง User กลับมาที่นี่ (Callback)
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    async (req, res, next) => {
        try {
            // @ts-ignore
            const user = req.user;
            const state = req.query.state as string || 'login'; // Defaults to login if missing

            // Pass intent (state) to service
            await upsertUserProfileAfterOAuth(user, 'google', state as 'login' | 'register');

            // Set Initial Refresh Token Cookie
            if (user && user.refresh_token) {
                res.cookie('refresh_token', user.refresh_token, {
                    httpOnly: true,
                    secure: false, // process.env.NODE_ENV === 'production', // Matches Controller
                    sameSite: 'lax',
                    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                });
            }

            res.redirect('/homepage');
        } catch (err) {
            console.error('[Auth Callback] Error:', err);
            // If error is "User not found" (from strict login check), redirect to register
            if (err instanceof Error && err.message === 'User not found. Please register first.') {
                return res.redirect('/register?error=needs_registration');
            }
            next(err);
        }
    }
);

// Refresh Token
router.post('/refresh', (req, res, next) => {
    console.log('[AuthRoute] POST /refresh hit!');
    next();
}, refreshToken);

// Logout route
router.get('/logout', logout);

export default router;