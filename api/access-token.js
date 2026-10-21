import { getAccessToken } from '../lib/onetrust.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    await getAccessToken();
    return res.status(200).json({ success: true, tokenType: 'Bearer', message: 'Access token gerado com sucesso.' });
  } catch (error) {
    return res.status(error.status || 502).json({ stage: 'generate_access_token', error: error.message, providerStatus: error.providerStatus });
  }
}
