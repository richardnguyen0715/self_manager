import Link from "next/link";
import { FileX2 } from "lucide-react";

export default function PublicPageNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <FileX2 className="h-16 w-16 text-muted-foreground/40" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page doesn&apos;t exist or is no longer public. The link may be
          outdated or the page owner may have unpublished it.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        Go home
      </Link>
    </div>
  );
}
