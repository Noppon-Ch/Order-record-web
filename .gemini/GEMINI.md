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

## RLS Policy Optimization
Updated `rls-policy.json` to resolve issues where users with the `member` role could not insert or view customer data correctly within their team scope.

### Key Changes
1. **Unified Role Access**: Replaced all instances of problematic OID `16481` with role `0` (authenticated), ensuring consistent permission checks across `customers`, `products`, `teams`, `orders`, and `zipcode_th`.
2. **Member Visibility & Insertion**:
   - Updated `customers_team_select_by_all_role` to include the `member` role.
   - Fixed `customers_private_insert`, `customers_private_select`, and `customers_private_update` to broaden their scope to include team members who are the creators of the record.
3. **Fixing .select() Failures**: Ensured that any user who can insert a record can also read it immediately after, fixing common "Permission Denied" errors during `.select().single()` operations in the service layer.

## Data Integrity & Identity Fixes (Auth Correction)
Resolved issues where Google/LINE sign-in could fail during the profile creation phase, leading to "Unknown User" displays.

### Key Changes
1. **Self-Healing Profile Upsert**:
   - Modified `auth.service.ts` to allow automatic profile creation if a user exists in Supabase Auth but is missing their `user_profiles` row.
   - This repairs "orphaned" users automatically upon their next login without forcing them to re-register.
2. **Robust Identity Mapping**:
   - Added exhaustive fallback checks for `provider_user_id` using `user_metadata.sub` and `user_metadata.provider_user_id`.
   - Added `Array.isArray()` guard for `identities` to prevent server crashes on unexpected Supabase API responses.
3. **Improved Diagnostics**:
   - Added detailed server-side logging in `auth.routes.ts` and `auth.service.ts` to track OAuth callback states and database upsert results.
   - Enhanced the global error handler in `app.ts` to provide specific error messages during development.
4. **UI Resiliency**:
   - Updated `team.ejs` to use `user.user_full_name` from the session as a fallback if the profile fetch for the current user fails.

## Thai Error Messages Implementation
Translated user-facing error messages in the Customer module from English to Thai for better user experience.

### Key Changes
1. **Service Layer (`customer.service.ts`)**:
   - Translated unique constraint violation errors (e.g., "พบข้อมูลลูกค้าที่มีเลขบัตรประชาชนนี้ในระบบแล้ว").
   - Added Thai prefixes to generic error messages for better context.
2. **Controller Layer (`customer.controller.ts`)**:
   - Translated all form submission error fallbacks (Add/Edit customer).
   - Translated API responses for Search, Delete, and Details fetch.
   - Translated Authorization/Token error messages ("โทเค็นหมดอายุ").
   - Translated permission-related messages (Unauthorized / ไม่มีสิทธิ์).
3. **PDF Controller Layer (`customer-pdf.controller.ts`)**:
   - Translated error messages for missing customers, missing templates, and general PDF generation failures.

## Customer Module Enhancement (Add Old Customer)
Added optional address and phone number fields to the "Add Old Customer" form to improve data richness while maintaining the simplicity of old record entry.

### Key Changes
1. **Frontend (`add-old-customer.ejs`)**: 
   - Added `customer_address1`, `customer_address2`, `customer_zipcode`, and `customer_phone` fields.
   - Set these fields as "not required" to simplify entry for older records (labels updated, `required` attribute removed).
   - Integrated address autocomplete functionality via the existing `form.js`.
2. **Backend (`customer.controller.ts`)**: 
   - Modified `addOldCustomer` to capture these optional fields from the request body.
   - Synchronized dummy recommender record creation logic to use consistent placeholder values (`-`) across both new and old customer registration paths.

### Customer Edit & PDPA Consent Improvements
Refined the Customer Edit form to handle data requirements and PDPA consent status more effectively.

#### Key Changes
1. **Frontend (`edit.ejs`)**:
   - Updated field validation: Set Thai names, position, citizen ID, and recommender details as `required`. Set optional fields (address, phone, birthdate, etc.) to `not required`.
   - **Consent Persistence**: If a customer has already given PDPA consent, the checkbox is now displayed as checked and disabled. The explicit "Accept PDPA" modal link is hidden for these users to streamline the UI.
   - Added a "Consented on" date display using the `customer_created_at` timestamp as a reference.
2. **Backend (`customer.controller.ts`)**:
   - Modified `updateCustomer` to fetch existing customer data before updating.
   - **Protection Logic**: If `customer_consent_status` is already `true`, it is locked to `true` during updates, preventing accidental or unauthorized removal of consent via form submission.
