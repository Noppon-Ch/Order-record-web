export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: 'leader' | 'member';
    status: 'active' | 'pending' | 'inactive';
    joined_at: Date;
    customer_id_of_user?: string;
}
