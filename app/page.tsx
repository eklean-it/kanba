import { redirect } from "next/navigation";

// EKGO! Tasks is an internal tool — no marketing landing page.
// Send everyone to /login; the login page forwards signed-in users to /dashboard.
export default function Home() {
  redirect("/login");
}
