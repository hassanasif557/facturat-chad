// notification-event.enum.ts
export enum NotificationEvent {
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',

  INVOICE_CREATED = 'invoice_created',

  PAYMENT_SUCCESS = 'payment_success',

  // 🔥 NEW (subscription)
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_REJECTED = 'subscription_rejected',
  SUBSCRIPTION_ACTIVATED = 'subscription_activated',

  // 🔥 ORGANIZATION EVENTS
  ORGANIZATION_CREATED = 'organization_created',
  USER_INVITED = 'user_invited',
  INVITE_ACCEPTED = 'invite_accepted',
  INVITE_REJECTED = 'invite_rejected',
  USER_REMOVED = 'user_removed',

  // 🔥 USAGE ALERT
  USAGE_INCREMENTED = 'usage_incremented',
  USAGE_RESET = 'usage_reset',
}