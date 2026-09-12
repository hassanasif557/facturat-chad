begin;

create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from pg_type where typname = 'role_enum') then
    execute 'alter type role_enum add value if not exists ''customer''';
  end if;

  if exists (select 1 from pg_type where typname = 'invoice_status_enum') then
    execute 'alter type invoice_status_enum add value if not exists ''issued''';
    execute 'alter type invoice_status_enum add value if not exists ''partially_paid''';
    execute 'alter type invoice_status_enum add value if not exists ''overdue''';
    execute 'alter type invoice_status_enum add value if not exists ''cancelled''';
  end if;

  if exists (select 1 from pg_type where typname = 'transaction_status_enum') then
    execute 'alter type transaction_status_enum add value if not exists ''created''';
    execute 'alter type transaction_status_enum add value if not exists ''expired''';
    execute 'alter type transaction_status_enum add value if not exists ''cancelled''';
    execute 'alter type transaction_status_enum add value if not exists ''refunded''';
  end if;
end$$;

commit;
begin;

create or replace function public.normalize_phone_e164(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if raw_phone is null then
    return null;
  end if;
  cleaned := regexp_replace(trim(raw_phone), '[^0-9+]', '', 'g');
  if cleaned ~ '^\+[1-9][0-9]{7,14}$' then
    return cleaned;
  end if;
  return null;
end;
$$;

alter table public."user" add column if not exists "phoneNormalized" text;
alter table public."user" add column if not exists "phoneVerifiedAt" timestamptz;
alter table public."user" add column if not exists "emailVerifiedAt" timestamptz;
alter table public."user" add column if not exists "language" text default 'fr';
alter table public."user" add column if not exists "accountStatus" text default 'active';
alter table public."user" add column if not exists "otpChallengeId" text;
alter table public."user" add column if not exists "notificationPreferences" jsonb;
alter table public."user" alter column tax_number drop not null;

update public."user"
set "phoneNormalized" = public.normalize_phone_e164(phone)
where "phoneNormalized" is null and phone is not null;

update public."user"
set "phoneVerifiedAt" = coalesce("phoneVerifiedAt", now())
where coalesce("otpVerified", false) = true;

create unique index if not exists ux_user_phone_normalized
  on public."user"("phoneNormalized")
  where "phoneNormalized" is not null;

alter table public."user" drop constraint if exists chk_user_account_status;
alter table public."user"
  add constraint chk_user_account_status
  check ("accountStatus" in ('active', 'suspended', 'deleted'));

alter table public.invoice add column if not exists "customerUserId" bigint;
alter table public.invoice add column if not exists "customerPhone" text;
alter table public.invoice add column if not exists "customerPhoneNormalized" text;
alter table public.invoice add column if not exists "customerEmail" text;
alter table public.invoice add column if not exists "invoiceNumber" text;
alter table public.invoice add column if not exists "issuedAt" timestamptz;
alter table public.invoice add column if not exists "dueAt" timestamptz;
alter table public.invoice add column if not exists "currency" text default 'XAF';
alter table public.invoice add column if not exists "subtotalAmount" integer default 0;
alter table public.invoice add column if not exists "taxAmount" integer default 0;
alter table public.invoice add column if not exists "discountAmount" integer default 0;
alter table public.invoice add column if not exists "amountPaid" integer default 0;
alter table public.invoice add column if not exists "balanceDue" integer default 0;
alter table public.invoice add column if not exists "paymentStatus" text default 'unpaid';
alter table public.invoice add column if not exists "deliveryStatus" text default 'pending';

update public.invoice
set "customerPhoneNormalized" = public.normalize_phone_e164("customerPhone")
where "customerPhoneNormalized" is null and "customerPhone" is not null;

update public.invoice
set "issuedAt" = coalesce("issuedAt", now())
where "issuedAt" is null;

update public.invoice
set "subtotalAmount" = coalesce("subtotalAmount", "totalAmount"),
    "taxAmount" = coalesce("taxAmount", 0),
    "discountAmount" = coalesce("discountAmount", 0),
    "amountPaid" = coalesce("amountPaid", 0),
    "balanceDue" = coalesce("balanceDue", greatest("totalAmount" - coalesce("amountPaid", 0), 0)),
    "currency" = coalesce("currency", 'XAF'),
    "paymentStatus" = coalesce("paymentStatus", 'unpaid');

update public.invoice
set status = case
  when status = 'pending' then 'issued'
  when status = 'unpaid' then 'issued'
  when status in ('issued','partially_paid','paid','overdue','cancelled') then status
  else 'issued'
end;

alter table public.invoice drop constraint if exists chk_invoice_status_v2;
alter table public.invoice
  add constraint chk_invoice_status_v2
  check (status in ('issued','partially_paid','paid','overdue','cancelled'));

alter table public.invoice drop constraint if exists chk_invoice_payment_status_v2;
alter table public.invoice
  add constraint chk_invoice_payment_status_v2
  check ("paymentStatus" in ('created','pending','success','failed','expired','cancelled','refunded','unpaid'));

alter table public.invoice drop constraint if exists chk_invoice_currency_v2;
alter table public.invoice
  add constraint chk_invoice_currency_v2
  check ("currency" = 'XAF');

alter table public.invoice
  drop constraint if exists fk_invoice_customer_user;
alter table public.invoice
  add constraint fk_invoice_customer_user
  foreign key ("customerUserId") references public."user"(id) on delete set null;

create index if not exists idx_invoice_customer_user_id on public.invoice("customerUserId");
create index if not exists idx_invoice_customer_phone_norm on public.invoice("customerPhoneNormalized");
create index if not exists idx_invoice_payment_status on public.invoice("paymentStatus");
create unique index if not exists ux_invoice_number_user
  on public.invoice("invoiceNumber", "userId")
  where "invoiceNumber" is not null and "userId" is not null;

alter table public."transaction" add column if not exists "publicReference" text;
alter table public."transaction" add column if not exists "customerUserId" bigint;
alter table public."transaction" add column if not exists "amountInt" integer default 0;
alter table public."transaction" add column if not exists "currency" text default 'XAF';
alter table public."transaction" add column if not exists "customerPhoneNormalized" text;
alter table public."transaction" add column if not exists "providerTransactionId" text;
alter table public."transaction" add column if not exists "failureCode" text;
alter table public."transaction" add column if not exists "failureMessage" text;
alter table public."transaction" add column if not exists "idempotencyKey" text;
alter table public."transaction" add column if not exists "completedAt" timestamptz;

update public."transaction"
set "amountInt" = coalesce("amountInt", amount),
    "currency" = coalesce("currency", 'XAF'),
    "customerPhoneNormalized" = coalesce("customerPhoneNormalized", public.normalize_phone_e164("customerPhone")),
    "publicReference" = coalesce("publicReference", "transactionId");

alter table public."transaction" drop constraint if exists chk_transaction_status_v2;
alter table public."transaction"
  add constraint chk_transaction_status_v2
  check (status in ('created','pending','success','failed','expired','cancelled','refunded'));

alter table public."transaction" drop constraint if exists chk_transaction_currency_v2;
alter table public."transaction"
  add constraint chk_transaction_currency_v2
  check ("currency" = 'XAF');

alter table public."transaction"
  drop constraint if exists fk_transaction_customer_user;
alter table public."transaction"
  add constraint fk_transaction_customer_user
  foreign key ("customerUserId") references public."user"(id) on delete set null;

create unique index if not exists ux_transaction_public_reference on public."transaction"("publicReference") where "publicReference" is not null;
create unique index if not exists ux_transaction_provider_ref on public."transaction"("providerTransactionId") where "providerTransactionId" is not null;
create unique index if not exists ux_transaction_idempotency on public."transaction"("customerUserId","idempotencyKey") where "idempotencyKey" is not null and "customerUserId" is not null;
create index if not exists idx_transaction_customer_user on public."transaction"("customerUserId");

alter table public.notification add column if not exists "dataJson" jsonb;
alter table public.notification add column if not exists "readAt" timestamptz;
create index if not exists idx_notification_user_read on public.notification("userId","readAt");

create table if not exists public.device_token (
  id bigserial primary key,
  "userId" bigint not null references public."user"(id) on delete cascade,
  "deviceId" text not null,
  token text not null,
  platform text not null,
  "appVersion" text null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("userId", "deviceId")
);

create table if not exists public.invoice_issue (
  id bigserial primary key,
  "invoiceId" bigint not null references public.invoice(id) on delete cascade,
  "customerUserId" bigint not null references public."user"(id) on delete cascade,
  type text not null check (type in ('unknown_invoice','incorrect_amount','incorrect_item','incorrect_customer','other')),
  message text not null,
  status text not null default 'open',
  "clientRequestId" text null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("invoiceId","customerUserId","clientRequestId")
);

create table if not exists public.payment_webhook_event (
  id bigserial primary key,
  provider text not null,
  "providerEventId" text not null,
  "providerTransactionId" text null,
  "merchantReference" text null,
  payload jsonb not null,
  "signatureValid" boolean not null default false,
  processed boolean not null default false,
  "processedAt" timestamptz null,
  "createdAt" timestamptz not null default now(),
  unique (provider, "providerEventId")
);

create or replace function public.claim_invoices_for_customer(p_user_id bigint, p_verified_phone text)
returns integer
language plpgsql
as $$
declare
  normalized text;
  claimed_count integer;
begin
  normalized := public.normalize_phone_e164(p_verified_phone);
  if normalized is null then
    raise exception 'Invalid E.164 phone format';
  end if;

  update public.invoice
  set "customerUserId" = p_user_id
  where "customerUserId" is null
    and "customerPhoneNormalized" = normalized
    and status <> 'cancelled';

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

commit;
