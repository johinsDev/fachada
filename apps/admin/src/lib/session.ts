import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface Session {
  tenant: { id: string; slug: string; name: string; template: "galias" | "pro" };
  siteUrl: string;
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async (): Promise<Session | null> => {
    const res = await api.auth.me.$get();
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`session ${res.status}`);
    return (await res.json()) as Session;
  },
  staleTime: 60_000,
});

export function useSession(): Session {
  const { data } = useQuery(sessionQuery);
  // The authenticated layout only renders after beforeLoad confirmed a session.
  return data!;
}
