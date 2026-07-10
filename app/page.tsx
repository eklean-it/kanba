import { redirect } from "next/navigation";

// EKGO! Tasks is an internal tool — no marketing landing page.
// Send everyone to the dashboard; unauthenticated users bounce to /login.
export default function Home() {
  redirect("/dashboard");
}
