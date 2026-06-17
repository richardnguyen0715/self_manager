import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TodayPanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 pt-5">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
      </CardHeader>

      {/* Fake tabs */}
      <div className="flex gap-4 border-b px-4 pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-14 animate-pulse rounded bg-muted" />
        ))}
      </div>

      <CardContent className="pt-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-1">
              <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-full max-w-xs animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
