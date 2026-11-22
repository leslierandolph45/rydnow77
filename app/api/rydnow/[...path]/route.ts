/**
 * app/api/rydnow/[...path]/route.ts      (use src/app/... if your project has a src folder)
 *
 *   browser -> /api/rydnow/<path> -> this file -> <RYDNOW_API_URL>/api/<path>
 *
 * Covers every route in api/urls.py and api/booking_urls.py (auth, bookings, quotes, dispatch,
 * rider wallet, customer wallet, deposits, withdrawals, payments, profile, nearby riders).
 *
 * - Django routes end with "/" (APPEND_SLASH), so the slash is always added back. The one exception
 *   is customer/wallet, which Django serves WITHOUT a slash.
 * - Server-to-server webhooks are blocked here on purpose: the payment provider must call
 *   https://<backend>/api/booking/webhook/ and /api/payments/paystack/webhook/ directly.
 * - Needs a normal (non-static) Next.js deployment. With `output: 'export'` in next.config,
 *   API routes do not exist and every call returns 404.
 *
 * Env (Vercel + .env.local): RYDNOW_API_URL=https://rydnow-backend.onrender.com   (no trailing /api)
 *
 * Quick test after deploy:  GET /api/rydnow/_debug
 *   -> shows the backend URL in use, and whether Render answers /api/health/ and the register route.
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A sleeping Render instance can take a while to answer the first call. */
export const maxDuration = 60;

const DEFAULT_BACKEND = 'https://rydnow-backend.onrender.com';
const BACKEND = (process.env.RYDNOW_API_URL || DEFAULT_BACKEND).trim().replace(/\/+$/, '').replace(/\/api$/, '');

const UPSTREAM_TIMEOUT_MS = 55_000;

/** Paths (after /api/) that Django serves without a trailing slash. */
const NO_TRAILING_SLASH = new Set(['customer/wallet']);

/** Provider-to-server only. Never reachable from the browser through this proxy. */
const BLOCKED = new Set(['booking/webhook', 'payments/paystack/webhook']);

/** "*" matches exactly one path segment. Paths are relative to /api/, without a trailing slash. */
const tpl = (p: string) => new RegExp('^' + p.split('*').join('[^/]+') + '$');

const ALLOWED: RegExp[] = [
  // health
  'health',

  // pricing + bookings (booking_urls.py)
  'booking/calculate-price',
  'quote',
  'bookings/quote',
  'booking/create',
  'booking',
  'booking/admin/revenue',
  'booking/*',
  'booking/*/status',
  'booking/*/cancel',
  'booking/*/release',
  'dispatch/rider/nearby',

  // auth + registration + verification
  'auth/login',
  'auth/token',
  'auth/register/customer',
  'auth/register/rider',
  'auth/verify/send-code',
  'auth/verify',
  'auth/rider/verify',
  'auth/rider/verification-status',
  'auth/me',
  'profile',

  // dispatch offers
  'rider/offers/*/accept',
  'rider/offers/*/decline',

  // rider wallet, transactions, deposits, withdrawals
  'rider/wallet',
  'rider/transactions',
  'rider/transactions/initiate',
  'rider/deposit',
  'rider/deposits',
  'rider/deposits/*/verify',
  'rider/withdraw',

  // customer wallet (no trailing slash on the backend)
  'customer/wallet',

  // location + nearby riders
  'rider/update-location',
  'riders/nearby',

  // legacy customer bookings
  'bookings',
  'bookings/*',
  'bookings/*/cancel',

  // promos
  'promos/validate',
  'promo/verify',

  // rider dashboard
  'list-bookings',
  'rider/bookings',
  'rider/presence',
  'accept-booking',
  'decline-booking',
  'arrive-ride',
  'start-ride',
  'complete-ride',
  'release-booking',

  // payments (Paystack): initialize + verify only; the webhook is blocked above
  'payments/initialize',
  'payments/verify',
].map(tpl);

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'idempotency-key'] as const;
/** content-disposition is needed for CSV exports (rider/transactions/?export=csv). */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'content-disposition'] as const;

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

const problem = (detail: string, code: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ detail, code, ...extra }, { status });

async function probe(url: string, method: 'GET' | 'POST' = 'GET') {
  try {
    const r = await fetch(url, {
      method,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
      ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
    });
    return {
      url,
      status: r.status,
      content_type: r.headers.get('content-type'),
      render_routing: r.headers.get('x-render-routing'),
      body: (await r.text()).slice(0, 200),
    };
  } catch (e) {
    return { url, error: String(e) };
  }
}

async function proxy(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path = [] } = await ctx.params;
  const rest = (path[0] === 'rydnow' ? path.slice(1) : path).filter(Boolean);

  // Diagnostics: GET /api/rydnow/_debug
  if (rest.length === 1 && rest[0] === '_debug') {
    return NextResponse.json({
      proxy: 'running',
      backend: BACKEND,
      env_set: Boolean(process.env.RYDNOW_API_URL),
      health: await probe(`${BACKEND}/api/health/`),
      // A POST with an empty body should answer 400 (validation), never 404.
      register: await probe(`${BACKEND}/api/auth/register/customer/`, 'POST'),
    });
  }

  if (rest.length === 0) return problem('Not found.', 'route_not_found', 404);
  if (rest.some((s) => s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    return problem('Bad path.', 'bad_path', 400);
  }

  const joined = rest.join('/');
  if (BLOCKED.has(joined)) return problem('Not available through this proxy.', 'route_blocked', 403);
  if (!ALLOWED.some((re) => re.test(joined))) {
    return problem('This API route is not exposed by the proxy.', 'route_not_allowed', 404, { path: joined });
  }

  const slash = NO_TRAILING_SLASH.has(joined) ? '' : '/';
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

  // A redirect would turn a POST into a GET and lose the body. It means a wrong URL.
  if (upstream.status >= 300 && upstream.status < 400) {
    return problem('Unexpected redirect from the server.', 'upstream_redirect', 502, { target: url });
  }

  const emptyBody = upstream.status === 204 || upstream.status === 205;
  const body = emptyBody ? null : await upstream.arrayBuffer();

  // Diagnostic: an upstream 404 with a non-JSON body means Django has no such URL (or Render is
  // serving something else). Views that say "not found" themselves return JSON and pass through.
  if (upstream.status === 404 && !(upstream.headers.get('content-type') || '').includes('application/json')) {
    return problem('Upstream 404 (no matching backend route)', 'upstream_404', 404, {
      target: url,
      method: req.method,
      upstream_content_type: upstream.headers.get('content-type'),
      upstream_render_routing: upstream.headers.get('x-render-routing'),
      upstream_body: body ? new TextDecoder().decode(body).slice(0, 300) : '',
    });
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

