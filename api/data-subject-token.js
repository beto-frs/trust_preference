import { createDataSubjectLinks } from '../lib/onetrust.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const identifier = String(req.body?.rut || '').trim();
  if (!identifier) return res.status(400).json({ error: 'Ingrese el RUT del titular.' });

  try {
    const links = await createDataSubjectLinks(identifier);
    return res.status(200).json({ success: true, ...links });
  } catch (error) {
    const stage = error.message?.includes('access_token') || error.message?.includes('credenciais') || error.message?.includes('CLIENT')
      ? 'generate_access_token'
      : 'get_data_subject_token';
    return res.status(error.status || 502).json({ stage, error: error.message, providerStatus: error.providerStatus });
  }
}
