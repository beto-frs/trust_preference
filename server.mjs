import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Load local configuration before reading process.env. Existing environment
// variables take precedence, which is useful for production deployments.
try {
  const envFile = await readFile(join(root, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#')) continue;
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const key = entry.slice(0, separator).trim();
    let value = entry.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const port = Number(process.env.PORT || 3000);
const apiHost = (process.env.ONETRUST_API_HOST || 'privacyupsociative-sandbox-11456.my.onetrust.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
const preferenceCenterUrl = process.env.PREFERENCE_CENTER_URL || 'https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/ui/#/preferences/multipage/token/a6ac15c7-f085-41ba-97d3-7153714c87b5/<tokenid>';
const trustCenterUrl = process.env.TRUST_CENTER_URL || 'https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/trust-center-portal/#/64cab880-ec09-40e2-951c-929969ecca3f/07316747-cf81-470c-9bee-4dca303a3e25/token/<tokenid>';
const apiBase = `https://${apiHost}`;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': contentTypes['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    const networkError = new Error(`No fue posible conectarse a OneTrust: ${error.message}`);
    networkError.status = 502;
    networkError.code = 'UPSTREAM_UNAVAILABLE';
    throw networkError;
  }
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : {}; } catch { data = { message: body }; }
  if (!response.ok) {
    const details = data?.message || data?.error_description || data?.error || data?.detail || data?.errors;
    const safeDetails = typeof details === 'string' ? details : details ? JSON.stringify(details) : '';
    const error = new Error(safeDetails || `OneTrust rechazó la solicitud (HTTP ${response.status}) sin informar detalles.`);
    error.status = response.status;
    error.providerStatus = response.status;
    throw error;
  }
  return data;
}

async function getAccessToken() {
  const { ONETRUST_CLIENT_ID, ONETRUST_CLIENT_SECRET } = process.env;
  if (!ONETRUST_CLIENT_ID || !ONETRUST_CLIENT_SECRET) {
    const error = new Error('Configure ONETRUST_CLIENT_ID y ONETRUST_CLIENT_SECRET en el servidor.');
    error.status = 503;
    throw error;
  }
  const basicCredentials = Buffer.from(`${ONETRUST_CLIENT_ID}:${ONETRUST_CLIENT_SECRET}`).toString('base64');
  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  const result = await requestJson(`${apiBase}/api/access/v1/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicCredentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!result.access_token) throw new Error('La respuesta de OneTrust no incluyó access_token.');
  return result.access_token;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/access-token') {
    try {
      await getAccessToken();
      return json(res, 200, { success: true, tokenType: 'Bearer', message: 'Token de acceso generado correctamente.' });
    } catch (error) {
      return json(res, error.status || 502, { stage: 'generate_access_token', error: error.message, providerStatus: error.providerStatus });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/data-subject-token') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'Corpo JSON inválido.' }); }
    const identifier = String(payload.rut || '').trim();
    if (!identifier) return json(res, 400, { error: 'Ingrese el RUT del titular.' });
    let stage = 'generate_access_token';
    try {
      const accessToken = await getAccessToken();
      stage = 'get_data_subject_token';
      const result = await requestJson(`${apiBase}/rest/api/consent/v4/datasubjects/linktokens`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, identifier, Accept: 'application/json' },
      });
      const token = result.token;
      if (!token) throw new Error('La respuesta de OneTrust no incluyó el token del titular.');
      if (!preferenceCenterUrl.includes('<tokenid>')) {
        const error = new Error('PREFERENCE_CENTER_URL debe contener el marcador <tokenid>.');
        error.status = 500;
        throw error;
      }
      if (!trustCenterUrl.includes('<tokenid>')) {
        const error = new Error('TRUST_CENTER_URL debe contener el marcador <tokenid>.');
        error.status = 500;
        throw error;
      }
      return json(res, 200, {
        success: true,
        token,
        preferenceUrl: preferenceCenterUrl.replace('<tokenid>', encodeURIComponent(token)),
        trustCenterUrl: trustCenterUrl.replace('<tokenid>', encodeURIComponent(token)),
        expiryDate: result.expiryDate || null,
      });
    } catch (error) {
      return json(res, error.status || 502, { stage, error: error.message, providerStatus: error.providerStatus });
    }
  }

  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = normalize(join(root, 'public', requested));
  if (!file.startsWith(join(root, 'public'))) return json(res, 403, { error: 'Acesso negado.' });
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    json(res, 404, { error: 'Archivo no encontrado.' });
  }
});

server.listen(port, () => console.log(`Aplicação disponível em http://localhost:${port}`));
