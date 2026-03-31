/**
 * User-friendly error messages for all HTTP status codes and network errors.
 *
 * RULE: Never expose technical codes (HTTP status numbers, API names, stack traces)
 * to users. Every error the user sees must be plain English that tells them
 * what happened AND what to do next.
 */

/**
 * Map an HTTP status code to a user-friendly message.
 *
 * @param status - HTTP status code (e.g. 401, 429, 503)
 * @param context - Optional action context for more specific messages (e.g. "uploading your file")
 * @returns A plain-English message the user can act on.
 */
export function getUserFriendlyError(status: number, context?: string): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again."
    case 403:
      return "You don't have permission to access this. If you think this is a mistake, please contact support."
    case 404:
      return "We couldn't find what you're looking for. It may have been moved or deleted."
    case 408:
      return "The request took too long. Please check your connection and try again."
    case 409:
      return "This action conflicts with something that already exists. Please refresh and try again."
    case 413:
      return "The file or data you're sending is too large. Please try with a smaller file."
    case 415:
      return "This file type isn't supported. Please try a different format."
    case 422:
      return "Some of the information you provided isn't valid. Please check your inputs and try again."
    case 429:
      return "You're making requests too quickly. Please wait a moment and try again."
    case 500:
      return "Something went wrong on our end. Please try again in a moment."
    case 502:
      return "We're having trouble connecting right now. Please try again in a moment."
    case 503:
      return "The service is temporarily unavailable. Please try again in a moment."
    case 504:
      return "The request took too long to reach our servers. Please try again in a moment."
    default:
      if (status >= 500) {
        return "We're having trouble connecting. Please try again in a moment."
      }
      if (status >= 400) {
        return context
          ? `Something went wrong while ${context}. Please try again.`
          : "Something went wrong. Please try again."
      }
      return "Something unexpected happened. Please try again."
  }
}

/**
 * Convert any error (Error object, HTTP response status, network failure) into
 * a user-friendly message.
 *
 * This is the SINGLE entry point for all error display logic across the app.
 *
 * @param error - The raw error caught in a catch block
 * @param context - Optional action context (e.g. "saving your settings")
 * @returns A plain-English message the user can act on.
 */
export function getFriendlyErrorMessage(error: unknown, context?: string): string {
  // AbortError — user or app cancelled the request, not an error worth showing
  if (error instanceof Error && error.name === "AbortError") {
    return "Request was cancelled."
  }

  // Network failure (no internet, server completely unreachable)
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Can't reach the server. Please check your internet connection and try again."
  }

  if (error instanceof Error) {
    const msg = error.message

    // Extract HTTP status codes embedded in error messages like
    // "API error: 503", "Chat API error: 401 - body", "Billing API error: 429"
    const statusMatch = msg.match(/:\s*(\d{3})/)
    if (statusMatch) {
      return getUserFriendlyError(parseInt(statusMatch[1], 10), context)
    }

    // Circuit breaker open — service is temporarily unavailable
    if (error.name === "CircuitBreakerOpenError") {
      return "We're having trouble connecting. Please wait a moment and try again."
    }

    // Timeout
    if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out")) {
      return "The request took too long. Please try again."
    }

    // Session / auth
    if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("session")) {
      return "Your session has expired. Please sign in again."
    }
  }

  // Fallback
  return context
    ? `Something went wrong while ${context}. Please try again.`
    : "Something went wrong. Please try again."
}

/**
 * Convenience: map a raw HTTP Response status to a user-friendly error string.
 * Useful right after checking !response.ok.
 */
export function errorFromResponse(response: Response, context?: string): string {
  return getUserFriendlyError(response.status, context)
}
