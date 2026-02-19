# GEMINI AI Implementation Update

## Silent Refresh & JWT Handling
Implemented a "Silent Refresh" strategy to handle token expiration seamlessly.

### Features
1. **Token Storage**:
   - Access Token: In-memory (window.USER_ACCESS_TOKEN) injected via server rendering.
   - Refresh Token: HttpOnly, Secure Cookie (managed by `auth.controller` & `auth.middleware`).

2. **Backend**:
   - `/auth/refresh`: New endpoint to rotate tokens using Supabase `refreshSession`.
   - Updated `GoogleCallback` in `auth.controller` to set the `refresh_token` cookie on login.
   - Using `cookie-parser` to read the Refresh Token.

3. **Frontend**:
   - `public/js/utils/api.js`: Created a global Axios instance (`window.api`).
   - **Interceptors**: Automatically catches 401 errors, calls `/auth/refresh`, updates the Access Token, and retries the original request.
   - **Queueing**: If multiple requests fail simultaneously, they queue up and wait for the single refresh request to complete.
   - **Session Dead**: If refresh fails (e.g., token revoked or expired), users are redirected to login with a message.

### Usage
To use the authenticated API in frontend scripts:
```javascript
// Instead of fetch or axios directly:
window.api.get('/some/endpoint')
  .then(res => console.log(res.data))
  .catch(err => console.error(err));
```
This ensures the request always has a valid token or handles refreshing automatically.
