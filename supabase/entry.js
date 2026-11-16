// @ts-nocheck
/* Supabase Edge Function entry. scripts/build-edge.cjs bundles this with the school rules into one pasteable file. */
import postgres from 'npm:postgres@3.4.4';
import { Buffer } from 'node:buffer';
globalThis.Buffer = Buffer;

const { createApi } = require('../backend/core.cjs');
const { postgresStore } = require('../backend/postgres-store.cjs');

const env = k => Deno.env.get(k) || '';
// Pages allowed to talk to this server. Add more in the ALLOWED_ORIGINS secret, comma separated.
const origins = ['https://sarahbarlis09.github.io', ...env('ALLOWED_ORIGINS').split(',').map(x => x.trim()).filter(Boolean)];
const sql = postgres(env('SUPABASE_DB_URL'), { max: 3, prepare: false, idle_timeout: 20 });
const api = createApi(postgresStore(sql), {
  cookies: false,
  adminKey: env('ADMIN_KEY'),
  originOk: req => !req.headers.origin || origins.includes(req.headers.origin)
});

const cors = origin => origins.includes(origin) ? {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-eces-token, x-eces-device, x-filename, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
} : { 'Vary': 'Origin' };

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  const url = new URL(request.url);
  const at = url.pathname.indexOf('/api/');
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const ip = (headers['x-forwarded-for'] || '').split(',')[0].trim() || headers['cf-connecting-ip'] || 'unknown';
  const body = request.method === 'POST' ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);
  const r = await api.handle({ method: request.method, path: at < 0 ? url.pathname : url.pathname.slice(at), headers, ip, body });
  return new Response(r.body, {
    status: r.status,
    headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...cors(origin), ...r.headers }
  });
});
