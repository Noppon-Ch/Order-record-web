import type { Request, Response, NextFunction } from 'express';
import { getUserProfile, updateUserProfile } from './user.service.js';
import { teamService } from '../teams/services/team.service.js';

export async function renderUserSetting(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user;
        console.log('[User] renderUserSetting user:', user);
        if (!user) return res.redirect('/login');

        console.log('[User] renderUserSetting access_token:', user.access_token);
        // Fetch latest profile data to ensure view is up-to-date
        const profile = await getUserProfile(user.id, user.access_token);
        console.log('[User] renderUserSetting profile:', profile);

        const userTeam = await teamService.getTeamByUserId(user.id, user.access_token);

        res.render('setting', {
            user: { ...user, ...(profile || {}) },
            userTeam,
            success: req.query.success === 'true',
            error: req.query.error
        });
    } catch (err) {
        next(err);
    }
}

export async function updateUserSetting(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user;
        console.log('[User] updateUserSetting user:', user);
        if (!user) return res.status(401).send('Unauthorized');

        console.log('[User] updateUserSetting access_token:', user.access_token);
        // Log form body for debugging
        console.log('[User] updateUserSetting form body:', req.body);

        // Filter empty string to undefined
        const clean = (v: any) => v === '' ? null : v;
        const {
            user_full_name,
            user_phone,
            user_payment_channel,
            user_payment_bank,
            user_payment_id
        } = req.body;

        const updatePayload = {
            user_full_name: clean(user_full_name),
            user_phone: clean(user_phone),
            user_payment_channel: clean(user_payment_channel),
            user_payment_bank: clean(user_payment_bank),
            user_payment_id: clean(user_payment_id)
        };
        console.log('[User] updateUserSetting updatePayload:', updatePayload);

        console.log('[User] DEBUG: updateUserSetting PRE-UPDATE payload:', JSON.stringify(updatePayload, null, 2));

        const result = await updateUserProfile(
            user.id,
            updatePayload,
            user.access_token
        );
        console.log('[User] DEBUG: updateUserSetting POST-UPDATE result:', JSON.stringify(result, null, 2));

        res.redirect('/user/setting?success=true');
    } catch (err) {
        // Log error details for debugging
        if (err instanceof Error) {
            console.error('Update user setting error:', err.message, err.stack);
        } else {
            console.error('Update user setting error:', err);
        }
        res.redirect('/user/setting?error=Update failed');
    }
}