/**
 * Public page layout — no AppShell, no auth chrome.
 * Wraps all /p/[slug] routes with minimal public scaffolding only.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
