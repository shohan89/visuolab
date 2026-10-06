import "server-only";

/**
 * Route handlers (the JSON API, media) that throw would otherwise be answered with the raw error text, which can name tables and
 * file paths. This turns any unexpected error into a short generic answer and logs only the error's class.
 */
export function safeRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response> | Response): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      // redirects and not-found signals thrown by the framework must pass through untouched
      if (e && typeof e === "object" && "digest" in e) throw e;
      console.error("route failed:", e instanceof Error ? e.name : "unknown error");
      return Response.json({ error: "server_error" }, { status: 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
  };
}
