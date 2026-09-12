# FacturaT Chad Backend API Flow + Postman Testing Guide

This document explains the complete backend API flow and a practical way to test it in Postman.

## 1) Project Setup

## Base URL
- Local: `http://localhost:3000`
- There is no global API prefix (routes are exactly like `/auth/login`, `/invoices/create`, etc.).

## Prerequisites
- Node.js + npm
- PostgreSQL running and reachable from `DATABASE_URL`
- Firebase Admin credentials (required at app startup)

## Install and Run
```bash
npm install
npm run start:dev
```

## Required Environment Variables

Add these to your `.env` (or runtime env):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - access token secret
- `JWT_REFRESH_SECRET` - refresh token secret
- `BASE_URL` - public backend URL used for file/PDF links
- `BASE_URL_PROD` - allowed CORS origin (prod)
- `PORT` - API port (default `3000`)
- `FIREBASE_PRIVATE_KEY` - Firebase Admin private key
- `FIREBASE_PROJECT_ID` - Firebase project id
- `FIREBASE_CLIENT_EMAIL` - Firebase client email

Notes:
- Static uploads are served from: `GET /uploads/<filename>`
- Validation is globally enabled (`whitelist`, `transform`), but some controllers still use loose `any` body typing.

---

## 2) Authentication Model

## Token Flow
1. `POST /auth/register` or `POST /auth/login` -> OTP generated
2. `POST /auth/verify-otp` -> returns `accessToken` + `refreshToken`
3. Send bearer token on protected APIs:
   - `Authorization: Bearer <accessToken>`
4. `POST /auth/refresh` to rotate tokens
5. `POST /auth/logout` to invalidate refresh token

## Token Expiry
- Access token: 15 minutes
- Refresh token: 7 days

---

## 3) Postman Preparation

Create a Postman Environment with:

- `baseUrl` = `http://localhost:3000`
- `accessToken`
- `refreshToken`
- `adminAccessToken`
- `userId`
- `planId`
- `subscriptionId`
- `invoiceId`
- `transactionId`
- `paymentOptionId`
- `paymentMethodId`

Optional auth helper:
- In protected requests, use Header:
  - `Authorization: Bearer {{accessToken}}`

---

## 4) API Endpoint Map (Complete)

Auth legend:
- `Public` = no token
- `Bearer` = any authenticated user
- `Admin` = authenticated + admin role
- `User` = authenticated + user role

## App
- `GET /` - Public - basic health response

## Auth
- `POST /auth/register` - Public - register user (`multipart/form-data`, optional `profilePicture`)
- `POST /auth/login` - Public - login with phone + password (returns OTP)
- `POST /auth/verify-otp` - Public - verify OTP and issue tokens
- `POST /auth/forgot-password` - Public - send OTP for reset flow
- `POST /auth/reset-password` - Bearer - set new password
- `POST /auth/refresh` - Public - refresh token pair
- `POST /auth/logout` - Bearer - invalidate refresh token

## Users
- `POST /users` - Admin - create user (optional profile picture upload)
- `GET /users` - Admin - list users
- `GET /users/search` - Admin - search/filter users
- `GET /users/:id` - Admin - get user by id
- `PUT /users/:id` - Admin - update user
- `PUT /users/:id/verification` - Admin - update verification status
- `DELETE /users/:id` - Admin - delete user
- `GET /users/me` - Bearer (`admin`/`user`) - current profile + org/subscription summary
- `PUT /users/me` - Bearer (`admin`/`user`) - update own profile
- `DELETE /users/me` - Bearer (`admin`/`user`) - delete own account
- `POST /users/apply-verification` - Bearer (`admin`/`user`) - submit verification request
- `POST /users/fcm-token` - User - save push token

## Organization
- `POST /organization` - User - create organization (`multipart/form-data`, optional `profilePicture`)
- `POST /organization/invite` - User - invite member
- `PUT /organization/invite/:id/accept` - User - accept invite
- `PUT /organization/invite/:id/reject` - User - reject invite
- `GET /organization/my-invites` - User - my invites
- `DELETE /organization/remove/:userId` - User - remove member
- `GET /organization/users` - User - list members
- `GET /organization/my/details` - User - my organization details
- `GET /organization` - Bearer - list organizations
- `GET /organization/stats` - Bearer - organization stats
- `GET /organization/:id` - Bearer - org details by id

## Plans
- `POST /plans` - Admin - create plan
- `GET /plans` - Bearer (`admin`/`user`) - list plans
- `GET /plans/:id` - Admin - plan by id
- `PUT /plans/:id` - Admin - update plan
- `DELETE /plans/:id` - Admin - delete plan

## Subscription
- `POST /subscription` - User - request plan subscription
- `GET /subscription/me` - User - active/current subscription
- `PUT /subscription/:id/approve` - Admin - approve request
- `PUT /subscription/:id/reject` - Admin - reject request
- `GET /subscription/requests` - Admin - pending requests
- `GET /subscription/all` - Admin - all subscriptions
- `GET /subscription/stats` - Admin - subscription stats

## Usage
- `GET /usage` - User - current usage and limits
- `GET /usage/reset` - Admin - reset helper
- `POST /usage/reset/user/:userId` - Admin - reset user usage
- `POST /usage/reset/org/:orgId` - Admin - reset org usage
- `POST /usage/reset/all` - Admin - reset all usage

## Products
- `POST /products/upload` - Bearer - upload product image (`multipart/form-data`, field: `file`)
- `POST /products/global` - Admin - create global product
- `GET /products/admin/all` - Admin - all products (admin)
- `GET /products/admin/popular` - Admin - popular products
- `GET /products/global` - Bearer (`admin`/`user`) - list global products
- `PUT /products/global/:id` - Admin - update global product
- `DELETE /products/global/:id` - Admin - delete global product
- `POST /products/admin/add-popular-to-global` - Admin - promote products
- `POST /products` - User - create user product
- `GET /products` - User - list own products
- `PUT /products/:id` - User - update own product
- `DELETE /products/:id` - User - delete own product

## Invoices
- `POST /invoices/create` - Bearer (`user`/`admin`) - create invoice and generate PDF
- `GET /invoices/my` - User - my invoices
- `GET /invoices` - Admin - all invoices
- `GET /invoices/search` - Admin - invoice search
- `GET /invoices/my/search` - User - my invoice search
- `PUT /invoices/:id` - Admin - update invoice
- `DELETE /invoices/:id` - Admin - delete invoice
- `PUT /invoices/:id/status` - User - update own invoice status
- `GET /invoices/dashboard` - User - user dashboard metrics
- `GET /invoices/report` - User - user reports
- `GET /invoices/admin/dashboard` - Admin - admin dashboard metrics
- `GET /invoices/admin/report` - Admin - admin reports
- `PUT /invoices/usage/reset/:userId` - Admin - reset user invoice usage
- `PUT /invoices/usage/reset-org/:orgId` - Admin - reset org invoice usage

## Payments
- `POST /payments/initiate` - User - initiate payment flow
- `GET /payments/my` - User - my transactions
- `PUT /payments/mock-webhook/:transactionId` - Admin - simulate callback
- `GET /payments` - Admin - all transactions

## Payment Methods
- `POST /payment-methods` - User - add method (wallet/account)
- `GET /payment-methods` - User - list own methods
- `GET /payment-methods/:id` - User - method detail
- `PUT /payment-methods/:id` - User - update method
- `DELETE /payment-methods/:id` - User - delete method

## Payment Options
- `POST /payment-options` - Admin - create option (`cash`, `mobile_money`, `payment_link`)
- `GET /payment-options/admin` - Admin - all options
- `PUT /payment-options/:id` - Admin - update option
- `DELETE /payment-options/:id` - Admin - delete option
- `GET /payment-options` - User - active options

## Settings
- `GET /settings` - Admin - list settings
- `POST /settings` - Admin - create/update setting

## Notifications
- `POST /notifications/test` - Public - send test notification
- `POST /notifications/test-data` - Public - send test with payload
- `POST /notifications/broadcast` - Public - broadcast notification
- `GET /notifications/my` - Public - list own notifications (implementation caveat)
- `GET /notifications/admin/history` - Public - notification history (implementation caveat)

## Notification Templates
- `POST /notification-templates` - Intended admin (currently no auth guard)
- `GET /notification-templates` - Intended admin (currently no auth guard)
- `PATCH /notification-templates/:id` - Intended admin (currently no auth guard)
- `DELETE /notification-templates/:id` - Intended admin (currently no auth guard)

---

## 5) End-to-End Postman Testing Flow (Recommended)

Follow this order to avoid dependency issues:

## A. Bootstrap (Admin)
1. Login as admin:
   - `POST /auth/login`
   - `POST /auth/verify-otp`
   - Save token to `{{adminAccessToken}}`
2. Create a `Free` plan using `POST /plans` (important for new user onboarding path).
3. Create payment options using `POST /payment-options` (at least one active option).

If no admin exists in DB yet, create one manually in database first.

## B. User Onboarding
4. `POST /auth/register` (multipart, optional profile image)
5. `POST /auth/verify-otp` and save:
   - `{{accessToken}}`
   - `{{refreshToken}}`
6. `GET /users/me` to confirm profile.

## C. Subscription Activation
7. User requests subscription if needed: `POST /subscription`
8. Admin approves subscription:
   - `GET /subscription/requests`
   - `PUT /subscription/:id/approve`
9. User checks `GET /subscription/me` and ensure status is active.

Invoice creation is blocked if subscription is not active or invoice limit is reached.

## D. Product + Invoice
10. Optional image upload: `POST /products/upload` (multipart `file`)
11. Create user product: `POST /products`
12. Create invoice: `POST /invoices/create` as `multipart/form-data`
    - Text fields:
      - `customerName`
      - `date`
      - `invoiceNumber`
      - `totalAmount`
      - `products` (JSON string)
    - File fields:
      - `files` (optional, up to 10)
13. Save `invoiceId` from response.
14. Validate with:
    - `GET /invoices/my`
    - `GET /invoices/my/search`
    - `GET /invoices/dashboard`

Example `products` value (stringified JSON):
```json
[{"name":"Item A","price":100,"quantity":2}]
```

## E. Payment Flow
15. Optional wallet: `POST /payment-methods`
16. Get active options: `GET /payment-options`
17. Initiate payment: `POST /payments/initiate`
18. If mobile money returns pending transaction, simulate callback:
    - (Admin) `PUT /payments/mock-webhook/:transactionId` with `{"status":"SUCCESS"}`
19. Verify payment records:
    - User: `GET /payments/my`
    - Admin: `GET /payments`

## F. Token Lifecycle Tests
20. Refresh token: `POST /auth/refresh`
21. Logout: `POST /auth/logout`
22. Confirm protected route fails with old token.

---

## 6) Suggested Postman Collection Structure

- `00 Health`
- `01 Auth`
- `02 Admin Setup`
- `03 User Profile`
- `04 Organization`
- `05 Plans & Subscriptions`
- `06 Products`
- `07 Invoices`
- `08 Payments`
- `09 Usage & Reports`
- `10 Notifications`
- `11 Negative Tests` (no token, invalid payload, role mismatch)

---

## 7) Known Caveats / Things to Watch

- No migration/seed flow; first-time DB setup is manual.
- The app expects Firebase env values at startup.
- Notification and notification-template routes appear insufficiently guarded in current implementation.
- Some endpoints accept loose body types; validation can be inconsistent.
- Payment link value may reference frontend route not implemented in this backend.

---

## 8) Quick Request Samples

## Login
`POST {{baseUrl}}/auth/login`
```json
{
  "phone": "+12345678901",
  "password": "secret123"
}
```

## Verify OTP
`POST {{baseUrl}}/auth/verify-otp`
```json
{
  "phone": "+12345678901",
  "otp": "123456"
}
```

## Create Product
`POST {{baseUrl}}/products`
```json
{
  "name": "Rice Bag",
  "price": 1500,
  "category": "Grocery",
  "imageUrl": "https://example.com/rice.jpg"
}
```

## Initiate Cash Payment
`POST {{baseUrl}}/payments/initiate`
```json
{
  "invoice_id": 1,
  "paymentOptionId": 1
}
```
