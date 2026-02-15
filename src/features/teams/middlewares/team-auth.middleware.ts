
import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { TeamMember } from '../../../models/team_member.model.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extend Express Request type to include teamMembership if needed, 
// but commonly we attach to res.locals or req object.
// For TypeScript, we might augment the definition or cast.
declare global {
    namespace Express {
        interface Request {
            teamMembership?: TeamMember;
        }
    }
}

/**
 * Middleware 1: Check if the user is a member of any active team.
 * If user has a Team ID in body/query/params, verify they belong to THAT team.
 * If no Team ID provided, just verify they are in A team and attach the membership.
 */
export const requireTeamMembership = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Fetch active team membership
        const { data: membership, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (error || !membership) {
            return res.status(403).json({ success: false, message: 'User is not an active team member' });
        }

        // Check if request targets a specific team
        const targetTeamId = req.body.teamId || req.query.teamId || req.params.teamId;
        if (targetTeamId && membership.team_id !== targetTeamId) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not belong to this team' });
        }

        // Attach membership to request for next middleware
        req.teamMembership = membership as TeamMember;
        next();
    } catch (error) {
        console.error('Error in requireTeamMembership middleware:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Middleware 2: Check if the user has the required role in their team.
 * This must be used AFTER requireTeamMembership.
 */
export const requireTeamRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.teamMembership) {
            return res.status(500).json({ success: false, message: 'Server Error: Team membership not validated' });
        }

        if (!allowedRoles.includes(req.teamMembership.role)) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};
