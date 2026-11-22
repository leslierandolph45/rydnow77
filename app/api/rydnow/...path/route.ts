/**
 * app/api/rydnow/[...path]/route.ts
 *
 * Server-side proxy between the browser and the Django backend:
 *
 *   browser  ->  /api/rydnow/<path>  ->  this file  ->  <RYDNOW_API_URL>/api/<path>
 *
 * The browser only ever talks to its own origin, so there are no CORS problems and the backend
 * address stays out of client code.
 *
 * Env (set in .env.local and in Vercel; restart `next dev` after changing it):
 *   RYDNOW_API_URL=https://rydnow-backend.onrender.com     (NO "/api" at the end; a trailing
 *                                                           "/api" is tolerated and removed)
 *
 * Trailing slashes
 * ----------------
 * Django routes end with "/" (APPEND_SLASH), and a redirected POST loses its body. Next.js strips
 * trailing slashes from incoming URLs by default, so this proxy always puts the slash back when it
 * calls Django. The one route Django serves WITHOUT a slash is customer/wallet.
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A sleeping Render instance can take a while to answer the first call. */
export const maxDuration = 60;

const DEFAULT_BACKEND = 'https://rydnow-backend.onrender.com';
const BACKEND = (process.env.RYDNOW_API_URL || DEFAULT_BACKEND).replace(/\/+$/, '').replace(/\/api$/, '');

/** Paths (after /api/) that Django serves without a trailing slash. */
const NO_TRAILING_SLASH = new Set(['customer/wallet']);

/** Only these request headers are forwarded to the backend. */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'idempotency-key'] as const;

/** Only these response headers are returned to the browser. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after'] as const;

const UPSTREAM_TIMEOUT_MS = 55_000;

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

const problem = (detail: string, code: string, status: number) => NextResponse.json({ detail, code }, { status });

async function proxy(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path = [] } = await ctx.params;
  if (path.length === 0) return problem('Not found.', 'route_not_found', 404);

  const slash = NO_TRAILING_SLASH.has(path.join('/')) ? '' : '/';
  const url = `${BACKEND}/api/${path.map(encodeURIComponent).join('/')}${slash}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return timedOut
      ? problem('The server took too long to respond.', 'upstream_timeout', 504)
      : problem('The server could not be reached.', 'upstream_unreachable', 502);
  }

  // The backend should never redirect (slashes are added above). A redirect here means a
  // misconfigured URL, and following it could silently turn a POST into a GET.
  if (upstream.status >= 300 && upstream.status < 400) {
    return problem('Unexpected redirect from the server.', 'upstream_redirect', 502);
  }

  const responseHeaders = new Headers({ 'cache-control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const emptyBody = upstream.status === 204 || upstream.status === 205;
  return new Response(emptyBody ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

