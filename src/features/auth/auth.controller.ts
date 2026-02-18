import type { Request, Response, NextFunction } from 'express';

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
