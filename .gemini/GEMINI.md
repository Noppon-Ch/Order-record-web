# GEMINI AI Implementation Update

## Supabase RLS & Environment Key Fix
Resolved a critical issue where new users could not be upserted into the `user_profiles` table during the Google OAuth callback in production, resulting in a `new row violates row-level security policy` error.

### Key Changes
1. **Added INSERT Policy**: 
   - Added `user_profiles_insert_own` (command: `a`) policy in `rls-policy.json` to allow authenticated users to insert their own profile row, closing a gap where only `w` (update) and `r` (read) policies existed.
2. **Environment Variable Configuration Warning**:
   - The backend `auth.service.ts` uses the `SUPABASE_SERVICE_ROLE_KEY` to perform administrative upserts. Since `service_role` natively bypasses RLS, an RLS error should theoretically never occur during this step. 
   - Identified that the production environment (Render) was failing while the local environment worked perfectly, strongly indicating that the **`SUPABASE_SERVICE_ROLE_KEY` environment variable in Render was mistakenly set to the `anon` public key.** The user must update their Render environment variables properly.

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

### Customer List Pagination Improvements
Updated the pagination section in the Customer List view (`list.ejs`) to enhance localization and mobile user experience.

#### Key Changes
1. **Localization**: Translated all pagination labels (Previous, Next, Showing, to, of, results) and screen reader text (First, Last) from English to Thai.
2. **Mobile Responsiveness**: Improved the mobile view by displaying the result count (e.g., "1-20 / 100") on the same line as the "Previous" and "Next" buttons for a more compact and modern feel.
3. **UI Layout**: Optimized the mobile pagination layout using `flex-row items-center justify-between` to ensure all elements fit perfectly on smaller screens.

### UI Localization (Thai Translation)
Localized various UI elements and buttons to Thai to provide a consistent user experience.

#### Key Changes
1. **Search Results**: Changed the "Select" button text to "เลือก" in all customer and person search result modals across the application.
2. **Status Messages**: Translated "Searching..." to "กำลังค้นหา..." and "No results found." to "ไม่พบข้อมูล" in search modules.
3. **Affected Components**: Updated `public/js/customers/form.js`, `public/js/orders/form.js`, `public/js/referrer-search.js`, `public/js/order-form.js`, and `public/js/customers/add.js`.

### Modal Centering (Mobile Responsive)
Fixed an issue where modals (popups) were appearing at the bottom of the screen on mobile devices instead of being centered.

#### Key Changes
1. **Layout Adjustment**: Changed the modal flex container from `items-end` to `items-center` for mobile view.
2. **Alignment Adjustment**: Updated modal panel alignment from `align-bottom` to `align-middle` on mobile.
3. **Affected Views**: Updated `add-new-customer.ejs`, `add-old-customer.ejs`, `edit.ejs`, `new.ejs`, `continue.ejs`, `team.ejs`, and `team-member-setting.ejs`.

### Auth Callback Resilience (RLS & TokenError Fix)
Fixed a critical issue where Google Sign-In would show "Something went wrong!" due to RLS policy errors on `user_profiles` upsert, even though the user was successfully authenticated.

#### Root Cause
- The `upsertUserProfileAfterOAuth` function threw on RLS `42501` errors, crashing the entire callback handler.
- `TokenError: Malformed auth code` occurred when the browser retried the callback URL with an already-consumed OAuth code.
- Both errors propagated to the global error handler, showing a 500 error page.

#### Key Changes
1. **Non-blocking Profile Upsert (`auth.routes.ts`)**:
   - Wrapped `upsertUserProfileAfterOAuth` in its own try-catch inside the Google callback.
   - RLS failures are logged as warnings but do not block the redirect to `/homepage`.
   - The auth session is already established by passport at this point; the profile upsert is best-effort.
2. **Graceful RLS Handling (`auth.service.ts`)**:
   - Added specific handling for error code `42501` — returns gracefully instead of throwing.
   - Logs a warning suggesting to check `SUPABASE_SERVICE_ROLE_KEY` configuration.
3. **Global Error Handler (`app.ts`)**:
   - Added detection for OAuth-specific errors (`TokenError`, `invalid_grant`, `Malformed auth code`).
   - Redirects to `/homepage` if user is already authenticated, or `/login?error=auth_failed` otherwise.
   - Added detection for RLS `42501` errors with the same redirect logic.
4. **Cookie Security Fix (`auth.routes.ts`)**:
   - Fixed `secure: false` hardcode to `secure: process.env.NODE_ENV === 'production'` for the refresh token cookie.

## Customer PDF Download Filename Customization
Updated the downloaded customer history PDF filename to include the customer's Thai name and register date.

### Key Changes
1. **Filename Format**: Changed from `customer_history_${customer.customer_citizen_id}.pdf` to `คุณ${fname}_${lname}_${dd-mm-yyyy}.pdf`.
2. **Date Formatting**: Parsed and formatted `customer_registerdate` to standard `DD-MM-YYYY` format.
3. **HTTP Header Compliance**: Used `encodeURIComponent` and `filename*=UTF-8''` parameter in the `Content-Disposition` header to safely support non-ASCII characters (Thai language) in all browsers.

## Order PDF Download Filename Customization
Updated the downloaded First Order and Continue Order PDF filenames to include the customer's Thai name and order date in a standardized format.

### Key Changes
1. **First Order Filename**: Changed from `ใบสั่งซื้อรอบแรก_${customerName}_${safeDate}.pdf` (where `safeDate` was YYYY-MM-DD) to `ใบสั่งซื้อรอบแรก_${fname}_${lname}_${dd-mm-yyyy}.pdf` (using DD-MM-YYYY order date format).
2. **Continue Order Filename**: Changed from `ใบสั่งซื้อต่อเนื่อง_${customerName}_${safeDate}.pdf` (where `safeDate` was YYYY-MM-DD) to `ใบสั่งซื้อต่อเนื่อง_${fname}_${lname}_${dd-mm-yyyy}.pdf` (using DD-MM-YYYY order date format).
3. **Date & Name Formatting**: Parsed and formatted the order date to `DD-MM-YYYY` and formatted the name to `fname_lname` with full fallbacks.

