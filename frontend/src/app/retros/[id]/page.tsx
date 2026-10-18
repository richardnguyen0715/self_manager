import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { RetroEditor } from "@/features/retros";

export const metadata: Metadata = {
  title: "Retro",
  description: "Retro editor: sections, context metrics, linked objects and action items.",
};

interface RetroPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetroPage({ params }: RetroPageProps) {
  const { id } = await params;
  return (
    <AppShell title="Retro">
      <RetroEditor retroId={id} />
    </AppShell>
  );
}
