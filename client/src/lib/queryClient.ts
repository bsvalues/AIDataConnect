import { QueryClient, QueryFunction, DefaultOptions } from "@tanstack/react-query";

// Custom error class for API errors with additional context
export class ApiError extends Error {
  status: number;
  data?: any;
  
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Handles error responses by extracting the error message and throwing an ApiError
 * @param res Response object to process
 * @throws ApiError with status code and error message
 */
async function handleResponseError(res: Response): Promise<never> {
  let errorMessage: string;
  let errorData: any = undefined;
  
  try {
    errorData = await res.json();
    errorMessage = errorData.message || errorData.error || res.statusText;
  } catch {
    try {
      errorMessage = await res.text() || res.statusText;
    } catch {
      errorMessage = res.statusText || `HTTP Error ${res.status}`;
    }
  }
  
  throw new ApiError(res.status, errorMessage, errorData);
}

/**
 * Creates a controller and signal with timeout for fetch requests
 * @param timeoutMs Timeout in milliseconds (default: 30000ms)
 */
function createFetchSignal(timeoutMs = 30000): { 
  controller: AbortController; 
  signal: AbortSignal;
  timerId: NodeJS.Timeout;
} {
  const controller = new AbortController();
  const signal = controller.signal;
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  
  return { controller, signal, timerId };
}

/**
 * Makes API requests with proper error handling, timeouts, and FormData support
 * @param method HTTP method
 * @param url Request URL
 * @param options Request options
 */
export async function apiRequest<T = any>(
  method: string,
  url: string,
  options: {
    data?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
    parseJson?: boolean;
  } = {}
): Promise<T> {
  const { 
    data,
    headers: customHeaders = {}, 
    timeoutMs = 30000,
    parseJson = true
  } = options;
  
  const { signal, timerId } = createFetchSignal(timeoutMs);
  
  try {
    const headers: Record<string, string> = {
      "Accept": "application/json",
      ...customHeaders
    };
    
    // Only set Content-Type for non-FormData requests
    if (data && !(data instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    
    const requestBody = data instanceof FormData 
      ? data 
      : data 
        ? JSON.stringify(data) 
        : undefined;
    
    const res = await fetch(url, {
      method,
      headers,
      body: requestBody,
      credentials: "include",
      signal
    });

    // Clear the timeout as we got a response
    clearTimeout(timerId);

    // Handle error responses
    if (!res.ok) {
      await handleResponseError(res);
    }
    
    // Handle empty responses
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return {} as unknown as T;
    }
    
    // Parse response based on content type
    if (parseJson) {
      const data = await res.json();
      return data as T;
    } else {
      return res as unknown as T;
    }
  } catch (error) {
    // Clean up timeout if there's an error
    clearTimeout(timerId);
    
    // Handle abort errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs}ms`);
    }
    
    // Rethrow ApiErrors
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle other errors
    if (error instanceof Error) {
      throw new ApiError(500, `API Request failed: ${error.message}`);
    }
    
    // Fallback for unknown errors
    throw new ApiError(500, 'Unknown API error occurred');
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Creates a query function for react-query with error handling and auth checks
 */
export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
  timeoutMs?: number;
}): QueryFunction<T> {
  const { on401: unauthorizedBehavior, timeoutMs = 30000 } = options;
  
  return async ({ queryKey }): Promise<T> => {
    try {
      // Handle different types of queryKey safely
      let url: string;
      if (Array.isArray(queryKey) && queryKey.length > 0) {
        const firstKey = queryKey[0];
        if (typeof firstKey === 'string') {
          url = firstKey;
        } else {
          throw new ApiError(400, 'Invalid query key format. First element must be a string URL.');
        }
      } else if (typeof queryKey === 'string') {
        url = queryKey;
      } else {
        throw new ApiError(400, 'Invalid query key. Must be a string or array with string as first element.');
      }
      
      const { signal, timerId } = createFetchSignal(timeoutMs);
      
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        },
        signal
      });
      
      clearTimeout(timerId);

      // Handle unauthorized differently based on configured behavior
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null as unknown as T;
        } else {
          await handleResponseError(res);
        }
      }

      if (!res.ok) {
        await handleResponseError(res);
      }
      
      // Handle empty responses
      if (res.status === 204 || res.headers.get('content-length') === '0') {
        return {} as unknown as T;
      }
      
      const data = await res.json();
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(408, `Query timed out after ${timeoutMs}ms`);
      }
      
      if (error instanceof Error) {
        throw new ApiError(500, `Query failed: ${error.message}`);
      }
      
      throw new ApiError(500, 'Unknown query error occurred');
    }
  };
}

// Default query client configuration
const defaultQueryOptions: DefaultOptions = {
  queries: {
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 60000, // 1 minute
    gcTime: 300000,  // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        return false;
      }
      
      // Don't retry after 3 failures
      return failureCount < 3;
    },
  },
  mutations: {
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        return false;
      }
      
      // Only retry once for mutations
      return failureCount < 1;
    },
  },
};

// Export the global query client
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});