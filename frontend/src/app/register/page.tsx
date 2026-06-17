import { redirect } from "next/navigation";

/**
 * /register is kept for backward-compat and bookmark links.
 * Canonical auth UI lives at /auth?tab=register.
 */
export default function RegisterPage() {
  redirect("/auth?tab=register");
}
