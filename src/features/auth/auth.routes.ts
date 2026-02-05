import { Router } from 'express';
import passport from 'passport';
import { upsertUserProfileAfterOAuth } from './auth.service.js';
import { teamService } from '../teams/services/team.service.js';

const router = Router();

// --- Google Login Flow ---
// 1. User กดลิงก์นี้เพื่อเริ่ม Login (Intent: Login)
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: 'login'
}));

// Route สำหรับ Registerโดยเฉพาะ (Intent: Register)
router.get('/google/register', passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: 'register'
}));

// 2. Google ส่ง User กลับมาที่นี่ (Callback)
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res, next) => {
        try {
            // @ts-ignore
            const user = req.user;
            const state = req.query.state as string || 'login'; // Defaults to login if missing

            // Pass intent (state) to service
            await upsertUserProfileAfterOAuth(user, 'google', state as 'login' | 'register');

            // --- Debug: Check Team Data Immediately After Login ---
            if (user?.id) {
                console.log(`[Auth] Login success for user: ${user.id} (Intent: ${state})`);
                // @ts-ignore
                const teamData = await teamService.getTeamByUserId(user.id, user.access_token);
                console.log('[Auth] Initial Team Check:', JSON.stringify(teamData, null, 2));
            }
            // ----------------------------------------------------

            res.redirect('/homepage');
        } catch (err) {
            // If error is "User not found" (from strict login check), redirect to register
            if (err instanceof Error && err.message === 'User not found. Please register first.') {
                return res.redirect('/register?error=needs_registration');
            }
            next(err);
        }
    }
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

export default router;