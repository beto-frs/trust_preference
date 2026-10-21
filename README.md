# Centro de Preferências Salcobrand

Interface para solicitar o token mágico OneTrust de um titular identificado pelo RUT e abrir o Centro de Preferências.

## Executar

Requer Node.js 20 ou superior. O servidor carrega automaticamente o arquivo `.env` na raiz do projeto. Abra esse arquivo e preencha as credenciais de API OneTrust:

```env
PORT=3000
ONETRUST_API_HOST=privacyupsociative-sandbox-11456.my.onetrust.com
PREFERENCE_CENTER_URL=https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/ui/#/preferences/multipage/token/a6ac15c7-f085-41ba-97d3-7153714c87b5/<tokenid>
TRUST_CENTER_URL=https://privacyupsociative-privacy-sandbox-11456.my.onetrust.com/trust-center-portal/#/64cab880-ec09-40e2-951c-929969ecca3f/07316747-cf81-470c-9bee-4dca303a3e25/token/<tokenid>
ONETRUST_CLIENT_ID=seu-client-id
ONETRUST_CLIENT_SECRET=seu-client-secret
```

`PREFERENCE_CENTER_URL` é o link-base do centro. Mantenha `<tokenid>` no final: o servidor substitui esse marcador pelo token retornado para o RUT. `ONETRUST_API_HOST` define o host das chamadas de API. Salve o arquivo e execute `npm start` no terminal. Abra `http://localhost:3000`. O `.env` já está no `.gitignore`; mantenha-o privado. Variáveis definidas no ambiente do sistema têm precedência sobre as do arquivo.

## Publicar no Vercel

O projeto já possui funções serverless em `api/`, compatíveis com o Vercel. Ao importar o repositório no painel do Vercel, use:

- Framework Preset: `Other`
- Build Command: `npm install`
- Output Directory: deixe vazio

Cadastre as mesmas variáveis do bloco acima em **Settings → Environment Variables**. Após o deploy, valide `https://seu-projeto.vercel.app/api/health`, que deve retornar `{"ok":true}`.

As rotas `/api/data-subject-token` e `/api/access-token` executam no backend do Vercel, mantendo as credenciais OneTrust fora do navegador.

## Fluxo OneTrust

1. `POST /api/access/v1/oauth/token` com `grant_type=client_credentials` em `application/x-www-form-urlencoded` e `client_id:client_secret` no cabeçalho `Authorization: Basic`.
2. `GET /rest/api/consent/v4/datasubjects/linktokens` com o RUT no cabeçalho `identifier` e o access token como Bearer.
3. O campo `token` retornado pela OneTrust é inserido no link de preferências e no link do Centro de Confiança para gerar os dois botões de acesso com o mesmo token.

Os detalhes dos endpoints e esquemas foram consultados no MCP OneTrust Developer Portal. As credenciais permanecem no servidor e não são enviadas ao navegador. O RUT é encaminhado à OneTrust para localizar o titular; não é registrado pela aplicação.
# trust_preference
