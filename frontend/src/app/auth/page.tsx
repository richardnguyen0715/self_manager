import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthPanel } from "@/features/auth/components/AuthPanel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a ManageMyLife account.",
  robots: { index: false, follow: false },
};

/**
 * /auth — unified sign-in / register page.
 * Tab is controlled via ?tab=login|register search param.
 *
 * AuthPanel uses useSearchParams() so it must be wrapped in Suspense per
 * Next.js App Router rules for static rendering.
 */
export default function AuthPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <AuthPanel />
      </Suspense>
    </AuthLayout>
  );
}
