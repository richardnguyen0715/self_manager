"use client";

import { format } from "date-fns";
import { useAuthStore } from "@/stores";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.display_name?.split(" ")[0] ?? "there";
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground sm:text-xl">
        {getGreeting()}, {firstName}
      </h2>
      <p className="text-sm text-muted-foreground">{today}</p>
    </div>
  );
}
