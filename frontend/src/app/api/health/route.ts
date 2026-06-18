// Liveness probe for the Next.js container (used by the Docker HEALTHCHECK).
// Note: external /api/* traffic is routed to the backend by Caddy; this route
// is only reached in-container at http://localhost:3000/api/health.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
