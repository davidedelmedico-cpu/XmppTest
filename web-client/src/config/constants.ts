// XMPP Configuration
export const DEFAULT_XMPP_DOMAIN = 'jabber.hot-chilli.net';
export const DEFAULT_XMPP_WEBSOCKET = 'wss://jabber.hot-chilli.net:5281/xmpp-websocket';
export const DEFAULT_RESOURCE = 'web-messaging-app';

// UI Configuration
export const UI = {
  appName: 'Alfred',
} as const;

// Pagination & Loading
export const PAGINATION = {
  DEFAULT_MESSAGE_LIMIT: 50,
  DEFAULT_CONVERSATION_LIMIT: 100,
  LOAD_MORE_THRESHOLD: 200, // px from top to trigger load more
  SCROLL_TO_BOTTOM_THRESHOLD: 100, // px from bottom to consider "at bottom"
} as const;

// Pull to Refresh
export const PULL_TO_REFRESH = {
  THRESHOLD: 60, // px distance to trigger refresh
  MAX_DISTANCE: 100, // px max pull distance
  ANIMATION_DURATION: 300, // ms
} as const;

// Message Status
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const;

// Timeouts & Delays
export const TIMEOUTS = {
  CONNECTION: 5000, // ms - XMPP connection timeout
  AUTO_SCROLL_DELAY: 100, // ms - delay before auto-scroll after update
} as const;

// Text Limits
export const TEXT_LIMITS = {
  MAX_MESSAGE_PREVIEW_LENGTH: 50,
  MAX_JID_LENGTH: 1023,
  MAX_TEXTAREA_HEIGHT: 120, // px
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  JID: 'xmpp_jid',
  PASSWORD: 'xmpp_password',
  PUSH_CONFIG: 'push_config',
} as const;

// Push Notifications Configuration
export const PUSH_NOTIFICATIONS = {
  // Chiave pubblica VAPID (deve essere generata lato server)
  // Per ora lasciamo vuota - deve essere configurata dall'utente o dal server
  VAPID_PUBLIC_KEY: '',
  // JID del servizio push (deve essere configurato in base al server XMPP)
  DEFAULT_PUSH_JID: '',
} as const;
