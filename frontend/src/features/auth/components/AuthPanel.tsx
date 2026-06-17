"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthTab = "login" | "register";

function isAuthTab(value: string | null): value is AuthTab {
  return value === "login" || value === "register";
}

/**
 * Reads ?tab=login|register from the URL and renders the appropriate form.
 * Switching tabs updates the URL without a full navigation.
 */
export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: AuthTab = isAuthTab(rawTab) ? rawTab : "login";

  const switchTab = (tab: AuthTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/auth?${params.toString()}`);
  };

  // Default: if no tab param set, push login into the URL (keeps Back button working)
  useEffect(() => {
    if (!rawTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "login");
      router.replace(`/auth?${params.toString()}`);
    }
  }, [rawTab, searchParams, router]);

  return (
    <div className="w-full space-y-6">
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="grid grid-cols-2 rounded-lg bg-muted p-1 text-muted-foreground"
      >
        <button
          role="tab"
          aria-selected={activeTab === "login"}
          aria-controls="tab-panel-login"
          id="tab-login"
          onClick={() => switchTab("login")}
          className={
            "rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (activeTab === "login"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground")
          }
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "register"}
          aria-controls="tab-panel-register"
          id="tab-register"
          onClick={() => switchTab("register")}
          className={
            "rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (activeTab === "register"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground")
          }
        >
          Register
        </button>
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id="tab-panel-login"
        aria-labelledby="tab-login"
        hidden={activeTab !== "login"}
      >
        {activeTab === "login" && <LoginForm />}
      </div>

      <div
        role="tabpanel"
        id="tab-panel-register"
        aria-labelledby="tab-register"
        hidden={activeTab !== "register"}
      >
        {activeTab === "register" && <RegisterForm />}
      </div>
    </div>
  );
}
