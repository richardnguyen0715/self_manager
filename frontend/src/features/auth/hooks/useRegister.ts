"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { RegisterRequest, AuthResponse } from "@/types";
import { API_ENDPOINTS } from "@/types";

export function useRegister() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<AuthResponse, Error, RegisterRequest>({
    mutationFn: (body) =>
      api.post<AuthResponse>(API_ENDPOINTS.AUTH_REGISTER, body),

    onSuccess: (data) => {
      setAuth(data.user, { access_token: data.access_token, refresh_token: data.refresh_token });
      router.replace("/dashboard");
    },
  });
}
