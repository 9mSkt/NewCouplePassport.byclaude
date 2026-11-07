/**
 * Logins are username + password. Supabase Auth needs an email per user, so each username is
 * stored as `<username>@couplepassport.local` (see supabase/seed.sql). No email is ever sent.
 */
export const LOGIN_DOMAIN = 'couplepassport.local';

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(u);
}

/**
 * Username-only login: Supabase still needs a password, so it is derived from the username
 * (must match `pg_temp.make_login` in supabase/seed.sql). This is NOT a secret — the username is.
 */
export function usernameToPassword(input: string): string {
  return `cp-login:${normalizeUsername(input)}`;
}

export function usernameToEmail(input: string): string {
  return `${normalizeUsername(input)}@${LOGIN_DOMAIN}`;
}

/** Shows the username for our synthetic emails, or the address as-is for anything else. */
export function displayLogin(email: string | null | undefined): string {
  if (!email) return '';
  const suffix = `@${LOGIN_DOMAIN}`;
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
