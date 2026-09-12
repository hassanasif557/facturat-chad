# Customer Module Postman Flow (Production Contract)

This file documents how to test the new customer APIs in Postman, while keeping existing merchant APIs working.

## 1) Postman Environment

Create an environment with:

- `baseUrl` = `http://localhost:3000`
- `customerPhone` = `+23566123456`
- `customerPassword` = `StrongPassword123`
- `customerEmail` = `moussa@example.com`
- `customerName` = `Moussa Mahamat`
- `customerAccessToken`
- `customerRefreshToken`
- `merchantAccessToken`
- `challengeId`
- `otp`
- `invoiceId`
- `paymentId`
- `paymentOptionId`
- `notificationId`

Optional:
- `deviceId` = `install-uuid-001`
- `idempotencyKey` = random UUID

## 2) Global Headers

For authenticated requests:

- `Authorization: Bearer {{customerAccessToken}}`
- `Content-Type: application/json`
- `Accept: application/json`

For payment initiation:
- `Idempotency-Key: {{idempotencyKey}}` (required)

## 3) Collection Structure

- `00 Auth (Customer)`
- `01 Merchant Invoice (Modified)`
- `02 Customer Profile`
- `03 Customer Dashboard & Invoices`
- `04 Customer Payments`
- `05 Notifications`
- `06 Device Token`
- `07 Webhooks`
- `08 Session & Password`
- `09 Negative / Security`

---

## 4) Auth APIs (Modified)

## 4.1 Register customer
**POST** `{{baseUrl}}/auth/register`

Body:
```json
{
  "name": "{{customerName}}",
  "phone": "{{customerPhone}}",
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}",
  "role": "customer"
}
```

Expect:
- `201`
- `success = true`
- `data.challengeId` exists
- no raw OTP in production response

Postman test script:
```javascript
pm.test("status 201", () => pm.response.to.have.status(201));
const res = pm.response.json();
pm.environment.set("challengeId", res.data.challengeId);
```

## 4.2 Customer login
**POST** `{{baseUrl}}/auth/login`

Body:
```json
{
  "phone": "{{customerPhone}}",
  "password": "{{customerPassword}}",
  "requestedRole": "customer"
}
```

Expect:
- `200`
- generic errors on invalid credentials (no account enumeration)
- `challengeId` returned for OTP verification

## 4.3 Verify OTP and create session
**POST** `{{baseUrl}}/auth/verify-otp`

Body:
```json
{
  "challengeId": "{{challengeId}}",
  "phone": "{{customerPhone}}",
  "otp": "{{otp}}",
  "device": {
    "platform": "android",
    "deviceId": "{{deviceId}}",
    "appVersion": "1.0.0"
  }
}
```

Expect:
- `200`
- `data.accessToken`, `data.refreshToken`
- `data.user.activeRole = "customer"`
- `data.claimedInvoiceCount` exists

Test script:
```javascript
const res = pm.response.json();
pm.environment.set("customerAccessToken", res.data.accessToken);
pm.environment.set("customerRefreshToken", res.data.refreshToken);
```

## 4.4 Refresh session
**POST** `{{baseUrl}}/auth/refresh`

Body:
```json
{ "refreshToken": "{{customerRefreshToken}}" }
```

Expect:
- `200`
- rotated refresh token (new value)

## 4.5 Logout session
**POST** `{{baseUrl}}/auth/logout`

Body:
```json
{
  "refreshToken": "{{customerRefreshToken}}",
  "deviceId": "{{deviceId}}"
}
```

Expect:
- `204`

## 4.6 Forgot password
**POST** `{{baseUrl}}/auth/forgot-password`

Body:
```json
{ "phone": "{{customerPhone}}" }
```

Expect:
- `200`
- generic message (same response for existing/non-existing account)

## 4.7 Reset password
**POST** `{{baseUrl}}/auth/reset-password`

Body:
```json
{
  "challengeId": "otp_reset_01J8",
  "otp": "1234",
  "password": "NewStrongPassword123"
}
```

Expect:
- `200`
- older refresh sessions revoked

---

## 5) Merchant Invoice Creation (Critical Modified API)

## 5.1 Create invoice with customer identity
**POST** `{{baseUrl}}/invoices/create`  
Header: merchant bearer token  
Type: `multipart/form-data`

Form fields:
- `customerName` = `Moussa Mahamat`
- `customerPhone` = `+23566123456`
- `customerEmail` = `moussa@example.com` (optional)
- `date` = `2026-09-04`
- `dueDate` = `2026-09-11` (optional)
- `currency` = `XAF`
- `totalAmount` = `125000`
- `products` = `[{"name":"Riz 25 kg","price":50000,"quantity":2}]`
- `files` = optional attachments

Expect:
- `201`
- includes `customerPhone`, `customerUserId` (nullable), `customerLinked`
- includes `status`, `paymentStatus`, `amountPaid`, `balanceDue`

If customer is not yet registered:
- invoice stores normalized customer phone
- later auto-link happens on OTP verification

---

## 6) Customer Profile APIs

## 6.1 Get customer profile
**GET** `{{baseUrl}}/customer/me`

Expect:
- `200`
- only customer-safe fields (no merchant subscription/settlement secrets)

## 6.2 Update customer profile
**PATCH** `{{baseUrl}}/customer/me`

Body:
```json
{
  "name": "Moussa M Mahamat",
  "email": "new@example.com",
  "language": "fr"
}
```

Expect:
- `200`
- phone not directly editable here

## 6.3 Get notification preferences
**GET** `{{baseUrl}}/customer/me/notification-preferences`

Expect:
- `200`
- includes `pushNewInvoice`, `pushDueReminder`, `pushPaymentStatus`, `emailReceipts`

## 6.4 Update notification preferences
**PATCH** `{{baseUrl}}/customer/me/notification-preferences`

Body:
```json
{
  "pushDueReminder": false,
  "emailReceipts": true
}
```

Expect:
- `200`
- partial update only for provided keys

---

## 7) Customer Dashboard + Invoice APIs

## 7.1 Dashboard
**GET** `{{baseUrl}}/customer/dashboard?timezone=Africa/Ndjamena`

Expect:
- `200`
- returns `outstandingAmount`, `paidThisMonthAmount`, recent 3 invoices max

## 7.2 List received invoices
**GET** `{{baseUrl}}/customer/invoices?page=1&limit=20&search=central&paymentStatus=unpaid&status=issued&startDate=2026-09-01&endDate=2026-09-30&sort=-issuedAt`

Expect:
- `200`
- paginated envelope with `meta`
- only invoices where `customerUserId` is authenticated user

## 7.3 Get received invoice detail
**GET** `{{baseUrl}}/customer/invoices/{{invoiceId}}`

Expect:
- `200` for owner
- `404` for unknown or non-owned invoice

Test script:
```javascript
pm.test("owner-only visibility", function () {
  pm.expect([200,404]).to.include(pm.response.code);
});
```

## 7.4 Download invoice PDF
**GET** `{{baseUrl}}/customer/invoices/{{invoiceId}}/pdf`

Expect:
- `200`
- `Content-Type: application/pdf`
- owner-only authorization

## 7.5 Report invoice issue
**POST** `{{baseUrl}}/customer/invoices/{{invoiceId}}/issues`

Body:
```json
{
  "type": "incorrect_item",
  "message": "The rice quantity should be one",
  "clientRequestId": "mobile-uuid-001"
}
```

Expect:
- `201`
- duplicate open request prevention

## 7.6 List payment options for invoice
**GET** `{{baseUrl}}/customer/invoices/{{invoiceId}}/payment-options`

Expect:
- `200`
- only active/eligible options
- no merchant account secrets in payload

---

## 8) Customer Payment APIs

## 8.1 Initiate invoice payment
**POST** `{{baseUrl}}/customer/invoices/{{invoiceId}}/payments`  
Headers:
- `Authorization: Bearer {{customerAccessToken}}`
- `Idempotency-Key: {{idempotencyKey}}`

Body:
```json
{
  "paymentOptionId": 2,
  "provider": "airtel_money",
  "payerPhone": "{{customerPhone}}",
  "clientRequestId": "mobile-uuid-001",
  "returnUrl": "facturat-chad://payments/complete"
}
```

Expect:
- `202`
- amount comes from server invoice balance (never client-provided)
- status starts as `created` or `pending`

Test script:
```javascript
const res = pm.response.json();
if (res?.data?.id) pm.environment.set("paymentId", res.data.id);
```

## 8.2 Get payment status
**GET** `{{baseUrl}}/customer/payments/{{paymentId}}`

Expect:
- `200`
- final success only after verified provider response/webhook

## 8.3 List customer payments
**GET** `{{baseUrl}}/customer/payments?page=1&limit=20&status=success&startDate=2026-09-01&endDate=2026-09-30`

Expect:
- `200`
- paginated own payments only

## 8.4 Download payment receipt
**GET** `{{baseUrl}}/customer/payments/{{paymentId}}/receipt`

Expect:
- `200` for successful payment
- `Content-Type: application/pdf`
- owner-only authorization

---

## 9) Notifications + Device APIs

## 9.1 Register customer device token
**POST** `{{baseUrl}}/users/fcm-token`

Body:
```json
{
  "token": "firebase-device-token",
  "deviceId": "{{deviceId}}",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Expect:
- `200`
- upsert by (`userId`, `deviceId`)

## 9.2 List notifications
**GET** `{{baseUrl}}/notifications?page=1&limit=20&unreadOnly=false`

Expect:
- `200`
- only authenticated user notifications

## 9.3 Mark notification read
**PATCH** `{{baseUrl}}/notifications/{{notificationId}}/read`

Expect:
- `204`
- idempotent

## 9.4 Mark all notifications read
**POST** `{{baseUrl}}/notifications/read-all`

Expect:
- `204`
- idempotent

---

## 10) Payment Webhook API (Source of Truth)

## 10.1 Provider webhook callback
**POST** `{{baseUrl}}/webhooks/payments/{{provider}}`  
Headers:
- `Provider-Signature: <provider-signature>`

Body:
```json
{
  "eventId": "provider-event-991",
  "transactionId": "provider-txn-551",
  "merchantReference": "PAY-260904-0092",
  "status": "SUCCESS",
  "amount": 125000,
  "currency": "XAF",
  "occurredAt": "2026-09-04T12:10:28Z"
}
```

Expect:
- `200` with `{ "received": true }`
- signature and event-id validation
- idempotent event processing
- transaction + invoice updates in one DB transaction

---

## 11) Required Envelope Assertions (Reusable Tests)

Add this in collection-level tests for success responses (`200/201/202`):

```javascript
const json = pm.response.json();
pm.test("success envelope", function () {
  pm.expect(json).to.have.property("success", true);
  pm.expect(json).to.have.property("data");
});
```

For paginated endpoints:
```javascript
const json = pm.response.json();
pm.test("pagination envelope", function () {
  pm.expect(json).to.have.property("meta");
  pm.expect(json.meta).to.have.property("page");
  pm.expect(json.meta).to.have.property("limit");
  pm.expect(json.meta).to.have.property("total");
  pm.expect(json.meta).to.have.property("lastPage");
});
```

For error responses:
```javascript
const json = pm.response.json();
pm.test("error envelope", function () {
  pm.expect(json).to.have.property("success", false);
  pm.expect(json).to.have.property("error");
  pm.expect(json.error).to.have.property("code");
  pm.expect(json.error).to.have.property("message");
});
```

---

## 12) Security and Negative Tests (Must Run)

1. Try opening another user's invoice/payment/notification id -> expect `404`.
2. Try `POST /customer/invoices/{id}/payments` without `Idempotency-Key` -> reject.
3. Repeat payment initiation with same idempotency key -> same payment reference or `409 PAYMENT_ALREADY_PENDING`.
4. Attempt forged mobile "success" callback path -> must not mark payment successful.
5. Send duplicate webhook eventId -> no double-write of amount or notifications.
6. Send out-of-order webhook after success -> final success state not reversed.
7. Try paying already paid/cancelled invoice -> `409 INVOICE_ALREADY_PAID` or suitable conflict.
8. Send non-E.164 phone -> `422 VALIDATION_ERROR`.

---

## 13) Suggested Execution Order (Happy Path)

1. Register customer -> login -> verify OTP
2. Merchant creates invoice with `customerPhone`
3. Customer lists invoices and opens detail
4. Customer lists invoice payment options
5. Customer initiates payment (with `Idempotency-Key`)
6. Provider webhook confirms payment success
7. Customer polls payment status and downloads receipt
8. Customer sees notification and marks it read

---

## 14) Status Enums to Validate

Invoice status:
- `issued`, `partially_paid`, `paid`, `overdue`, `cancelled`

Payment status:
- `created`, `pending`, `success`, `failed`, `expired`, `cancelled`, `refunded`

---

## 15) Important Compatibility Notes

- Keep merchant APIs and response fields stable.
- Add customer fields in invoice responses without removing existing merchant fields.
- Use integer FCFA values (`XAF`) only; no float amounts in new customer/payment logic.
- Phone is identity for invoice linking only after OTP verification.
- Customer data access must always be scoped by `customerUserId == authenticatedUserId`.
