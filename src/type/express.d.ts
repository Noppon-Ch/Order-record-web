import { User as AppUser } from '../features/users/user.types.js';

declare global {
    namespace Express {
        interface User extends AppUser { }
    }
}
