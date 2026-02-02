## Implementation Steps
### Phase 1: Feature Structure Setup
Create the folder structure at src/features/teams
and create model teams and team_members

models/
├── team.model.ts
├── team_member.model.ts

src/features/teams/
├── controllers/
│   ├── team.controller.ts    # CRUD for Teams
│   └── member.controller.ts  # Add/Remove members
├── middlewares/
│   ├── team-guard.ts         # Middleware: Check if user belongs to the team
│   └── team-role.guard.ts    # Middleware: Check permissions (e.g., only Admin/Owner)
├── services/
│   └── team.service.ts       # Business Logic
├── types/
│   └── team.types.ts         # Interfaces
├── views/
│   ├── index.ejs             # List of user's teams
│   ├── create.ejs            # Create new team form
│   └── settings/
│       ├── index.ejs         # Team dashboard/settings
│       └── members.ejs       # Member management table
└── team.routes.ts            # Router Definition

### Phase 2: Core Logic & Types
1. src/features/teams/types/team.types.ts Define interfaces for Team, TeamMember, and CreateTeamDTO.

2. src/features/teams/services/team.service.ts Implement these functions:

createTeam(userId: string, name: string): Create team & add creator as 'owner'.

getTeamsByUser(userId: string): Return list of teams the user belongs to.

getTeamMembers(teamId: string): Return list of members with their user info.

addMember(teamId: string, email: string, role: string): Logic to find user by email and add to team.

checkMembership(teamId: string, userId: string): Returns member details if exists, else null.

Phase 3: Middleware Implementation
1. src/features/teams/middlewares/team-guard.ts

Intercepts routes with :teamId.

Checks if req.user.id exists in team_members for that teamId.

If valid, attach req.team and req.teamMember to the request object.

If invalid, redirect to forbidden page or team list.

2. src/features/teams/middlewares/team-role.guard.ts

A factory function: requireTeamRole(['owner', 'admin']).

Checks req.teamMember.role.

Returns 403 if role is insufficient.

### Phase 4: Route Configuration (Context Switching)
File: src/features/teams/team.routes.ts Construct the router to handle both management and context-switching.

const router = Router();

// --- Management ---
router.get('/', teamController.listTeams);
router.post('/', teamController.createTeam);
router.get('/:teamId/settings/members', 
    teamGuard, 
    requireTeamRole(['owner', 'admin']), 
    memberController.listMembers
);

// --- Context Switching (Reusing other features) ---
// Import controllers from other features
import * as orderController from '../orders/order.controller.js';
import * as customerController from '../customers/customer.controller.js';

// Orders in Team Context
router.get('/:teamId/orders', teamGuard, orderController.listOrders);
router.post('/:teamId/orders', teamGuard, orderController.createOrder);

// Customers in Team Context
router.get('/:teamId/customers', teamGuard, customerController.listCustomers);

export default router;

### Phase 5: Refactoring Existing Services (Orders/Customers)
Crucial: Do not duplicate logic. Update order.service.ts and customer.service.ts to support context.

Example order.service.ts update:

TypeScript

interface GetOrdersParams {
    userId: string;
    teamId?: string | null; // Optional
}

export const getOrders = async (params: GetOrdersParams) => {
    let query = supabase.from('orders').select('*');
    
    if (params.teamId) {
        // Team Context
        query = query.eq('team_id', params.teamId);
    } else {
        // Personal Context
        query = query.eq('customer_record_by_user_id', params.userId).is('team_id', null);
    }
    
    return query;
}