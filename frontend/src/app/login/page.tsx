import { redirect } from "next/navigation";

/**
 * /login is kept for backward-compat and bookmark links.
 * Canonical auth UI lives at /auth?tab=login.
 */
export default function LoginPage() {
  redirect("/auth?tab=login");
}
