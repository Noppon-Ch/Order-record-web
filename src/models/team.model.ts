export interface Team {
    team_id: string;
    team_name: string;
    team_code: string;
    owner_user_id: string;
    created_at: Date;
    status: 'pending' | 'active' | 'inactive';
}
