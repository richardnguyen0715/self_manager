import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PublicPage } from "@/types";
import { API_ENDPOINTS } from "@/types";
import { PublicPageView } from "@/features/docs/public/PublicPageView";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Server-side fetch for a public page by slug.
 * No auth header — the backend serves this unauthenticated.
 * Returns null on 404 or fetch error.
 */
async function fetchPublicPage(slug: string): Promise<PublicPage | null> {
  try {
    const res = await fetch(
      `${API_BASE}${API_ENDPOINTS.PUBLIC_PAGE(slug)}`,
      {
        // Cache for 60 seconds; ISR via Next.js
        next: { revalidate: 60 },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PublicPage;
  } catch {
    return null;
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublicPage(slug);

  if (!page) {
    return {
      title: "Page not found",
    };
  }

  // Build a plain-text description from the icon + title.
  const titleWithIcon = page.icon
    ? `${page.icon} ${page.title}`
    : page.title;

  // Extract a short description from the content if possible.
  const description = extractTextSnippet(page.content, 160);

  return {
    title: titleWithIcon || "Public page",
    description: description || undefined,
    openGraph: {
      title: titleWithIcon || "Public page",
      description: description || undefined,
      type: "article",
      modifiedTime: page.updated_at,
      images: page.cover_url
        ? [
            {
              url: page.cover_url.startsWith("http")
                ? page.cover_url
                : `${API_BASE}${page.cover_url}`,
              alt: page.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titleWithIcon || "Public page",
      description: description || undefined,
    },
  };
}

// ─── Text snippet extractor ───────────────────────────────────────────────────

/**
 * Walk the TipTap JSON tree and collect the first `maxLength` characters of
 * plain text for use in meta descriptions.
 */
function extractTextSnippet(
  doc: Record<string, unknown> | null | undefined,
  maxLength: number,
): string {
  if (!doc) return "";
  const parts: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (parts.join("").length >= maxLength) return;
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    const children = node.content as Record<string, unknown>[] | undefined;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (parts.join("").length >= maxLength) break;
        walk(child);
      }
    }
  }

  walk(doc);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default async function PublicSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = await fetchPublicPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <PublicPageView
      page={page}
      slug={slug}
      rootSlug={slug}
    />
  );
}
