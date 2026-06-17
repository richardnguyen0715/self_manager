"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardErrorProps {
  message?: string;
  onRetry: () => void;
}

export function DashboardError({
  message = "Failed to load dashboard data.",
  onRetry,
}: DashboardErrorProps) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <div>
          <p className="font-medium text-foreground">Something went wrong</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
