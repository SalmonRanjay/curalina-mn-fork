import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  profileImageUrl: string | null;
}

export function useAuth() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    // getQueryFn always calls fetch with credentials: "include",
    // and here we treat 401 as "not logged in" instead of an error.
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    error,
  };
}

