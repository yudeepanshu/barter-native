import { useAuthStore } from "@/lib/auth/authStore";

export function useSession() {
  return useAuthStore((s) => s.session);
}

export function useAuthStatus() {
  return useAuthStore((s) => s.status);
}

export function useIsAuthenticated() {
  return useAuthStore((s) => s.status === "authenticated");
}
