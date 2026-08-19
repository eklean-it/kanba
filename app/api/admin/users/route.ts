import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Service-role client — never exposed to the browser; used only in this route.
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The real security boundary: verify the caller's bearer token resolves to a
// super-admin. The token is the caller's Supabase session access token.
async function requireSuperAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, error: "Not authenticated", status: 401 };
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, error: "Invalid session", status: 401 };
  if (!isSuperAdmin(data.user.email)) return { ok: false as const, error: "Forbidden", status: 403 };
  return { ok: true as const, admin, caller: data.user };
}

// A ban is stored as a timestamp in the future. GoTrue accepts "none" to clear
// it. 100 years is effectively permanent while staying reversible.
const BAN_FOREVER = "876000h";

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const t = Date.parse(bannedUntil);
  return Number.isFinite(t) && t > Date.now();
}

function generatePassword() {
  // Ekgo-<12 hex>: strong, readable, changed on first login.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `Ekgo-${hex}`;
}

export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data, error } = await gate.admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: (u.user_metadata as Record<string, unknown> | null)?.full_name ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_super_admin: isSuperAdmin(u.email),
      // Offboarding state. GoTrue reports a ban as a future `banned_until`;
      // un-banning clears it. See PATCH for why we ban rather than delete.
      disabled: isBanned((u as { banned_until?: string | null }).banned_until),
    }))
    .sort((a, b) => (a.email > b.email ? 1 : -1));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const password = generatePassword();
  const { data, error } = await gate.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pre-confirmed — no verification email needed
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    password,
  });
}

// Reset a member's password to a freshly generated one (shown once).
/**
 * Three offboarding/credential actions, selected by `action`. Defaults to
 * `reset_password` so existing callers are unaffected.
 *
 * ⚠️ There is deliberately NO delete-user action, and one must never be added
 * casually. The FK chain is:
 *
 *   auth.users → profiles (ON DELETE CASCADE)
 *              → projects.user_id (ON DELETE CASCADE)
 *              → columns.project_id (ON DELETE CASCADE)
 *              → tasks.column_id (ON DELETE CASCADE)
 *
 * so deleting a departing employee silently destroys EVERY BOARD THEY OWN plus
 * all of its columns and tasks — including boards the rest of the team works in.
 * Banning blocks sign-in, keeps every row intact, and is reversible. If a real
 * delete is ever needed, board ownership has to be transferred first.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id || "").trim();
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const action = String(body.action || "reset_password");
  if (!["reset_password", "disable", "enable"].includes(action)) {
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  }

  if (action === "reset_password") {
    const password = generatePassword();
    const { data, error } = await gate.admin.auth.admin.updateUserById(userId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: { id: data.user.id, email: data.user.email }, password });
  }

  // Look the target up before mutating, so the guards below can name it and so
  // we never ban an id that doesn't exist.
  const { data: target, error: lookupErr } =
    await gate.admin.auth.admin.getUserById(userId);
  if (lookupErr || !target?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "disable") {
    // Locking yourself out is unrecoverable from inside the app — the only way
    // back would be the Supabase dashboard.
    if (userId === gate.caller.id) {
      return NextResponse.json(
        { error: "You can't disable your own account." },
        { status: 400 },
      );
    }
    // Admins can provision accounts and reset anyone's password. One admin
    // disabling another is a fight this UI should not host; do it in code (the
    // allowlist) or in the Supabase dashboard.
    if (isSuperAdmin(target.user.email)) {
      return NextResponse.json(
        { error: "Admins can't be disabled here — remove them from the allowlist instead." },
        { status: 400 },
      );
    }
  }

  const { error } = await gate.admin.auth.admin.updateUserById(userId, {
    ban_duration: action === "disable" ? BAN_FOREVER : "none",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    action,
    user: { id: target.user.id, email: target.user.email },
  });
}
