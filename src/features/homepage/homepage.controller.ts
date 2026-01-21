import type { Request, Response } from 'express';

export const renderHomepage = (req: Request, res: Response) => {
  // @ts-ignore
  const email = req.user?.email || '';
  res.render('homepage', { email });
};