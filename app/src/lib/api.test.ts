import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError } from './api';

/* When the front end is deployed without an API (the Vercel case: only
 * app/dist is served, with a catch-all rewrite to index.html), every call
 * lands on static hosting. A POST gets 405 because static files accept only
 * GET/HEAD, and a GET gets index.html where JSON was expected. Neither status
 * tells a visitor anything actionable, so both must be translated. */

function mockFetch(status: number, body: string, ok = false) {
  return vi.fn().mockResolvedValue({
    status,
    ok,
    text: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/* The wording differs depending on whether VITE_API_BASE was set at build
 * time, so these assert the shape both branches must satisfy rather than one
 * branch's exact sentence — the test must not depend on the developer's own
 * .env.local. */
describe('static-host responses are explained, not passed through', () => {
  it('translates a 405 POST instead of surfacing the bare status', async () => {
    vi.stubGlobal('fetch', mockFetch(405, 'Method Not Allowed'));
    await expect(api.founding.waitlist.create({ email: 'a@b.com' })).rejects.toThrow(ApiError);
    await expect(api.founding.waitlist.create({ email: 'a@b.com' })).rejects.toThrow(
      /No API is (configured|reachable)/,
    );
  });

  it('translates an HTML body where JSON was expected', async () => {
    vi.stubGlobal('fetch', mockFetch(404, '<!doctype html><html><body>app</body></html>'));
    await expect(api.genomes.list()).rejects.toThrow(/No API is (configured|reachable)/);
  });

  it('names VITE_API_BASE so the fix is obvious either way', async () => {
    vi.stubGlobal('fetch', mockFetch(405, ''));
    await expect(api.genomes.list()).rejects.toThrow(/VITE_API_BASE/);
  });

  it('does not mistake a plain-text 405 for HTML, or vice versa', async () => {
    vi.stubGlobal('fetch', mockFetch(500, '<html>gateway error</html>'));
    await expect(api.genomes.list()).rejects.toThrow(/No API is (configured|reachable)/);
  });
});

describe('real API errors are still surfaced verbatim', () => {
  it('does not swallow a genuine refusal from the control plane', async () => {
    // A 409 gate refusal must reach the user with the server's own reason —
    // translating it would hide the exact thing this product exists to show.
    vi.stubGlobal(
      'fetch',
      mockFetch(409, JSON.stringify({ error: 'REFUSED', reason: 'Engine 00 gate refused: evidence grade A/B required.' })),
    );
    await expect(api.genomes.list()).rejects.toThrow(/Engine 00 gate refused/);
  });

  it('passes through a JSON 404 from a real server', async () => {
    vi.stubGlobal('fetch', mockFetch(404, JSON.stringify({ reason: 'Genome not found' })));
    await expect(api.genomes.get('missing')).rejects.toThrow(/Genome not found/);
  });

  it('leaves successful responses untouched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify([{ id: 'g1', code: 'G-01' }]),
    }));
    await expect(api.genomes.list()).resolves.toEqual([{ id: 'g1', code: 'G-01' }]);
  });
});
