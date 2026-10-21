const form = document.querySelector('#rut-form');
const rutInput = document.querySelector('#rut');
const submitButton = document.querySelector('#submit-button');
const message = document.querySelector('#form-message');
const resultPanel = document.querySelector('#result');
const trustCenterLink = document.querySelector('#trust-center-link');
const expiryNote = document.querySelector('#expiry-note');

function showMessage(text, kind) {
  message.textContent = text;
  message.className = `form-message visible ${kind}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const rut = rutInput.value.trim();
  resultPanel.hidden = true;
  message.className = 'form-message';
  if (!rut) {
    showMessage('Ingrese su RUT para continuar.', 'error');
    rutInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('.button-copy').textContent = 'Conectando…';
  showMessage('Generando el token de acceso y consultando al titular en OneTrust…', 'success');
  try {
    const response = await fetch('/api/data-subject-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 404 || data.providerStatus === 404) {
        throw new Error('RUT no encontrado.');
      }
      const stage = data.stage === 'generate_access_token' ? 'generar el token de acceso' : 'consultar el token del titular';
      throw new Error(`Error al ${stage}${data.providerStatus ? ` (HTTP ${data.providerStatus})` : ''}: ${data.error || 'verifique la configuración de OneTrust.'}`);
    }
    trustCenterLink.href = data.trustCenterUrl;
    expiryNote.textContent = data.expiryDate
      ? `Enlace de un solo uso. Válido hasta el ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.expiryDate))}.`
      : 'Por seguridad, este enlace es personal y de un solo uso.';
    resultPanel.hidden = false;
    showMessage('RUT validado correctamente.', 'success');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    const isNetworkError = error instanceof TypeError || error.name === 'AbortError';
    showMessage(
      isNetworkError
        ? 'No fue posible conectarse al servidor. Verifique que la API esté activa e inténtelo nuevamente.'
        : (error.message || 'Error de comunicación. Verifique su conexión e inténtelo nuevamente.'),
      'error',
    );
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('.button-copy').textContent = 'Continuar';
  }
});

rutInput.addEventListener('input', () => {
  if (message.classList.contains('error')) message.className = 'form-message';
});
