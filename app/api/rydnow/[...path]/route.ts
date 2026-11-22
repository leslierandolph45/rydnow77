/**
 * app/api/rydnow/[...path]/route.ts
 *
 *   browser -> /api/rydnow/<path> -> this file -> <RYDNOW_API_URL>/api/<path>
 *
 * Diagnostics (remove once signup works):
 *   GET /api/rydnow/_debug      -> shows which backend URL this deployment is using
 *   Any upstream 404            -> returned as JSON with the exact target URL and a snippet of the body
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BACKEND = 'https://rydnow-backend.onrender.com';
const BACKEND = (process.env.RYDNOW_API_URL || DEFAULT_BACKEND).trim().replace(/\/+$/, '').replace(/\/api$/, '');

/** Paths (after /api/) that Django serves without a trailing slash. */
const NO_TRAILING_SLASH = new Set(['customer/wallet']);

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'idempotency-key'] as const;
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after'] as const;
const UPSTREAM_TIMEOUT_MS = 55_000;

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

const problem = (detail: string, code: string, status: number) => NextResponse.json({ detail, code }, { status });

async function proxy(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path = [] } = await ctx.params;
  const rest = (path[0] === 'rydnow' ? path.slice(1) : path).filter(Boolean);

  if (rest[0] === '_debug') {
    return NextResponse.json({
      backend: BACKEND,
      env_set: Boolean(process.env.RYDNOW_API_URL),
      example_target: `${BACKEND}/api/auth/register/customer/`,
    });
  }

  if (rest.length === 0) return problem('Not found.', 'route_not_found', 404);

  const slash = NO_TRAILING_SLASH.has(rest.join('/')) ? '' : '/';
  const url = `${BACKEND}/api/${rest.map(encodeURIComponent).join('/')}${slash}${req.nextUrl.search}`;

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

  if (upstream.status >= 300 && upstream.status < 400) {
    return problem('Unexpected redirect from the server.', 'upstream_redirect', 502);
  }

  const body = upstream.status === 204 || upstream.status === 205 ? null : await upstream.arrayBuffer();

  // DIAGNOSTIC: show exactly where the 404 came from.
  if (upstream.status === 404) {
    const snippet = body ? new TextDecoder().decode(body).slice(0, 300) : '';
    return NextResponse.json(
      {
        detail: 'Upstream 404',
        code: 'upstream_404',
        target: url,
        method: req.method,
        upstream_content_type: upstream.headers.get('content-type'),
        upstream_render_routing: upstream.headers.get('x-render-routing'),
        upstream_body: snippet,
      },
      { status: 404 },
    );
  }

  const responseHeaders = new Headers({ 'cache-control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

