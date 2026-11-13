/**
 * Authentication is cookie-only. The browser must not decode or retain a JWT to
 * infer session expiry. Reintroduce a warning only when the API exposes a
 * non-sensitive session-expiry timestamp through `/api/auth/me`.
 */
const SessionExpiryWarning = () => null;

export { SessionExpiryWarning };
