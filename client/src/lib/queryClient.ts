import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export function getAuthHeaders(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit);
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const customInit: RequestInit = { ...(init || {}) };
  customInit.headers = getAuthHeaders(customInit.headers);
  if (customInit.credentials === undefined) {
    customInit.credentials = "include";
  }
  return fetch(input, customInit);
}

function safeJsonStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    const seen = new WeakSet();
    return JSON.stringify(data, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (value instanceof Node || value instanceof Event || seen.has(value)) {
          return undefined;
        }
        seen.add(value);
      }
      return value;
    });
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = getAuthHeaders(data ? { "Content-Type": "application/json" } : undefined);
  const res = await fetch(url, {
    method,
    headers,
    body: data !== undefined ? safeJsonStringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
