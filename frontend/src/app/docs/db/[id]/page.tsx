import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DatabasePage } from "./_components/DatabasePage";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Database",
    description: `Database view ${id}`,
  };
}

export default async function DbIdPage({ params }: Props) {
  const { id } = await params;
  return (
    <AppShell title="Database">
      <DatabasePage databaseId={id} />
    </AppShell>
  );
}
