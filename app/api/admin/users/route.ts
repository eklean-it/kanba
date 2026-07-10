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
export async function PATCH(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id || "").trim();
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const password = generatePassword();
  const { data, error } = await gate.admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email }, password });
}
