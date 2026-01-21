import type { Request, Response, NextFunction } from 'express';

// Render login page
export const renderLoginPage = (req: Request, res: Response) => {
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
