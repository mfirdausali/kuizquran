// Cloudflare Pages advanced-mode worker. Serves the SPA statically and forwards
// /api/* to the standalone API worker (iman-worker-staging) via a Service Binding
// (env.WORKER). Same-origin from the browser's view (iman-quiz.pages.dev), so the
// session cookie SameSite=Lax works (PRD FR7). Method, body, and headers are
// preserved explicitly on the forwarded request (a bare `new Request(url, req)`
// can drop the method/body when the URL changes → 405).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const target = new URL(request.url);
      target.pathname = url.pathname.replace(/^\/api/, "") || "/";
      const init = {
        method: request.method,
        headers: request.headers,
        redirect: "manual",
      };
      // Only GET/HEAD may omit a body; everything else forwards the body stream.
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
      }
      return env.WORKER.fetch(new Request(target.toString(), init));
    }
    return env.ASSETS.fetch(request);
  },
};
