import { Router } from 'express';
import passport from 'passport';
import { upsertUserProfileAfterOAuth } from './auth.service.js';
import { teamService } from '../teams/services/team.service.js';

const router = Router();

// --- Google Login Flow ---
// 1. User กดลิงก์นี้เพื่อเริ่ม Login
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// 2. Google ส่ง User กลับมาที่นี่ (Callback)
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res, next) => {
        try {
            // @ts-ignore
            const user = req.user;
            await upsertUserProfileAfterOAuth(user, 'google');

            // --- Debug: Check Team Data Immediately After Login ---
            if (user?.id) {
                console.log(`[Auth] Login success for user: ${user.id}`);
                // @ts-ignore
                const teamData = await teamService.getTeamByUserId(user.id, user.access_token);
                console.log('[Auth] Initial Team Check:', JSON.stringify(teamData, null, 2));
            }
            // ----------------------------------------------------

            res.redirect('/homepage');
        } catch (err) {
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