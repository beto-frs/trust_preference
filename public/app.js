const form = document.querySelector('#rut-form');
const rutInput = document.querySelector('#rut');
const submitButton = document.querySelector('#submit-button');
const message = document.querySelector('#form-message');
const resultPanel = document.querySelector('#result');
const link = document.querySelector('#preference-link');
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
    showMessage('Informe seu RUT para continuar.', 'error');
    rutInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('.button-copy').textContent = 'Conectando…';
  showMessage('Gerando access token e consultando o titular na OneTrust…', 'success');
  try {
    const response = await fetch('/api/data-subject-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut }),
    });
    const data = await response.json();
    if (!response.ok) {
      const stage = data.stage === 'generate_access_token' ? 'gerar o access token' : 'consultar o token do titular';
      throw new Error(`Falha ao ${stage}${data.providerStatus ? ` (HTTP ${data.providerStatus})` : ''}: ${data.error || 'verifique a configuração OneTrust.'}`);
    }
    link.href = data.preferenceUrl;
    trustCenterLink.href = data.trustCenterUrl;
    expiryNote.textContent = data.expiryDate
      ? `Link de uso único. Válido até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.expiryDate))}.`
      : 'Por segurança, este link é pessoal e de uso único.';
    resultPanel.hidden = false;
    showMessage('RUT validado com sucesso.', 'success');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    const isNetworkError = error instanceof TypeError || error.name === 'AbortError';
    showMessage(
      isNetworkError
        ? 'Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente.'
        : (error.message || 'Falha de comunicação. Verifique a conexão e tente novamente.'),
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
