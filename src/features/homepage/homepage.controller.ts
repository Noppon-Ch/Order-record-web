import type { Request, Response } from 'express';

export const renderHomepage = (req: Request, res: Response) => {
  const user = req.user;
  res.render('homepage', { user });
};