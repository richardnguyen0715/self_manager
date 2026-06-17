import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api-error";

// Re-export so existing import sites `import { ApiClientError } from "@/lib/query"`
// continue to work without changes.
export { ApiClientError } from "@/lib/api-error";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error) => {
        // Do not retry on 401/403/404
        if (error instanceof ApiClientError) {
          if ([401, 403, 404].includes(error.status)) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
