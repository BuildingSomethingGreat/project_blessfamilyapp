import { useQuery } from '@tanstack/react-query';
import { api, ApiError, getSponsorToken } from './api.ts';

/** The signed-in Holiday Konnector, if any. A 401 just means "not signed in", so it is never retried. */
export function useAccount() {
  const q = useQuery({
    queryKey: ['account'],
    queryFn: () => api.account.me().catch((e) => { if (e instanceof ApiError && e.status === 401) return null; throw e; }),
    retry: false,
    staleTime: 60_000,
  });
  const me = q.data ?? null;
  return { me, loading: q.isLoading, signedIn: !!me || !!getSponsorToken() };
}
