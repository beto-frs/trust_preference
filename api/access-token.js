import { getAccessToken } from '../lib/onetrust.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    await getAccessToken();
    return res.status(200).json({ success: true, tokenType: 'Bearer', message: 'Token de acceso generado correctamente.' });
  } catch (error) {
    return res.status(error.status || 502).json({ stage: 'generate_access_token', error: error.message, providerStatus: error.providerStatus });
  }
}
