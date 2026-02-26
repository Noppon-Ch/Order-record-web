import type { Request, Response, NextFunction } from 'express';

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    // Check if it's an API request or expects JSON
    if (req.xhr || req.headers.accept?.indexOf('json') !== -1 || req.path.startsWith('/api/') || req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized or token expired' });
    }

    // Standard behavior: redirect to login and force clear session
    res.redirect('/login?session_expired=true');
}
