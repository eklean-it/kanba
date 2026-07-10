import { redirect } from "next/navigation";

// Accounts are provisioned by super-admins (invite-only) — no public sign-up.
export default function SignUp() {
  redirect("/login");
}
