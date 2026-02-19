import type { Request, Response, NextFunction } from 'express';
import { refreshSession } from './auth.service.js';

// Render login page
// Render login page
export const renderLoginPage = (req: Request, res: Response) => {
	// If already authenticated AND no error is present, redirect to homepage.
	// If there's an error (e.g. session expired, JWT expired), we should show the login page even if passport thinks we are "logged in" (likely with a stale session).
	if (req.isAuthenticated && req.isAuthenticated() && !req.query.error && !req.query.session_expired) {
		return res.redirect('/homepage');
	}

	// If session_expired flag is present, force logout to clear stale session
	if (req.query.session_expired === 'true') {
		req.logout(() => {
			// Callback after logout
		});
	}

	res.render('login');
};

// Google OAuth callback
export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// @ts-ignore
		const user = req.user;
		if (user) {
			res.redirect('/homepage');
		} else {
			res.redirect('/');
		}
	} catch (err) {
		next(err);
	}
};

// LINE OAuth callback
export const lineCallback = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// @ts-ignore
		const user = req.user;
		if (user) {
			res.redirect('/homepage');
		} else {
			res.redirect('/');
		}
	} catch (err) {
		next(err);
	}
};


// Refresh Token Endpoint
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// Handle CORS/Cookie issues manually for debugging
		const oldRefreshToken = req.cookies.refresh_token || req.body.refresh_token;
		if (!oldRefreshToken) {
			console.error('[Auth] No refresh token found in cookies or body');
			console.error('[Auth] Cookies:', req.cookies);
			return res.status(401).json({ error: 'No refresh token provided' });
		}

		console.log('[Auth] Refreshing token...');
		console.log('[Auth] Cookies received:', req.cookies); // DEBUG
		const { session, error } = await refreshSession(oldRefreshToken);

		if (error || !session) {
			console.error('[Auth] Refresh failed:', error);
			// Clear cookie if invalid
			res.clearCookie('refresh_token');
			return res.status(403).json({ error: 'Invalid or expired refresh token' });
		}

		// Update Refresh Token Cookie (Rotation)
		// FORCE SECURE FALSE FOR DEBUGGING
		res.cookie('refresh_token', session.refresh_token, {
			httpOnly: true,
			secure: false, // process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
		});

		// Return new Access Token
		res.json({ access_token: session.access_token });

	} catch (err) {
		next(err);
	}
};

// Logout
export const logout = (req: Request, res: Response) => {
	res.clearCookie('refresh_token');
	req.logout(() => {
		res.redirect('/');
	});
};
