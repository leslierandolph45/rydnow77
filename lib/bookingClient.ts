// lib/bookingClient.ts — browser-side wrapper around the /api/booking/* routes.
// Pass in the page's authHeaders() so the Authorization header reaches the backend.

export type ApiResult<T = any> = { ok: boolean; status: number; data: T | null; error: string };

async function call<T = any>(
  url: string,
  method: 'POST' | 'PATCH',
  headers: Record<string, string>,
  body: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    const error = res.ok ? null : data?.error || data?.message || data?.detail || `Request failed (${res.status})`;
    return { ok: res.ok, status: res.status, data, error };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Connection error. Check your internet and try again.' };
  }
}

// ─── Booking API Functions ───

export const createBooking = (
  headers: Record<string, string>,
  payload: Record<string, unknown>
) =>
  call('/api/booking/create/', 'POST', headers, payload);

export const verifyPayment = (
  headers: Record<string, string>,
  bookingId: string,
  reference?: string
) =>
  call('/api/booking/verify-payment/', 'POST', headers, { bookingId, reference });

export const requestDispatch = (
  headers: Record<string, string>,
  bookingId: string
) =>
  call('/api/booking/assign/', 'POST', headers, { bookingId });

export const setBookingStatus = (
  headers: Record<string, string>,
  bookingId: string,
  status: string
) =>
  call('/api/booking/update-status/', 'PATCH', headers, { bookingId, status });



