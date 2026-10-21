const apiHost = (process.env.ONETRUST_API_HOST || 'privacyupsociative-sandbox-11456.my.onetrust.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');
const apiBase = `https://${apiHost}`;

const preferenceCenterUrl = process.env.PREFERENCE_CENTER_URL ||
  'https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/ui/#/preferences/multipage/token/a6ac15c7-f085-41ba-97d3-7153714c87b5/<tokenid>';

const trustCenterUrl = process.env.TRUST_CENTER_URL ||
  'https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/trust-center-portal/#/64cab880-ec09-40e2-951c-929969ecca3f/07316747-cf81-470c-9bee-4dca303a3e25/token/<tokenid>';

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    const networkError = new Error(`Não foi possível conectar à OneTrust: ${error.message}`);
    networkError.status = 502;
    throw networkError;
  }

  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : {}; } catch { data = { message: body }; }

  if (!response.ok) {
    const details = data?.message || data?.error_description || data?.error || data?.detail || data?.errors;
    const safeDetails = typeof details === 'string' ? details : details ? JSON.stringify(details) : '';
    const error = new Error(safeDetails || `A OneTrust recusou a solicitação (HTTP ${response.status}).`);
    error.status = response.status;
    error.providerStatus = response.status;
    throw error;
  }

  return data;
}

async function getAccessToken() {
  const { ONETRUST_CLIENT_ID, ONETRUST_CLIENT_SECRET } = process.env;
  if (!ONETRUST_CLIENT_ID || !ONETRUST_CLIENT_SECRET) {
    const error = new Error('Configure ONETRUST_CLIENT_ID e ONETRUST_CLIENT_SECRET no Vercel.');
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

  if (!result.access_token) throw new Error('A resposta da OneTrust não incluiu access_token.');
  return result.access_token;
}

export async function createDataSubjectLinks(identifier) {
  const accessToken = await getAccessToken();
  const result = await requestJson(`${apiBase}/rest/api/consent/v4/datasubjects/linktokens`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, identifier, Accept: 'application/json' },
  });

  const token = result.token;
  if (!token) throw new Error('A resposta da OneTrust não incluiu o token do titular.');
  if (!preferenceCenterUrl.includes('<tokenid>')) {
    const error = new Error('PREFERENCE_CENTER_URL precisa conter o marcador <tokenid>.');
    error.status = 500;
    throw error;
  }
  if (!trustCenterUrl.includes('<tokenid>')) {
    const error = new Error('TRUST_CENTER_URL precisa conter o marcador <tokenid>.');
    error.status = 500;
    throw error;
  }

  const encodedToken = encodeURIComponent(token);
  return {
    token,
    preferenceUrl: preferenceCenterUrl.replace('<tokenid>', encodedToken),
    trustCenterUrl: trustCenterUrl.replace('<tokenid>', encodedToken),
    expiryDate: result.expiryDate || null,
  };
}

export { getAccessToken };
