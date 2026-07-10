// Super-admins may provision accounts on the Team page. There is no global
// "super-admin" role in the schema (roles are per-board owner/admin/member),
// so — like ekgo-admin's lucy-access allowlist — this is an explicit email list.
// Enforced in two layers: the /dashboard/team page (UX) and the
// /api/admin/users route (the real security boundary, service-role gated).
export const SUPER_ADMIN_EMAILS = [
  "it@eklean.com",
  "erykah@eklean.com",
  "bruce@eklean.com",
] as const;

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}
