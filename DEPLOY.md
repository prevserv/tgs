# Deploy de Produção

## 1. Pré-requisitos
- Node.js 20+
- NPM 10+
- HTTPS no domínio (proxy reverso/plataforma)

## 2. Configuração
1. Copie `.env.example` para `.env`.
2. Preencha:
- `NODE_ENV=production`
- `JWT_SECRET` forte (64+ chars)
- `CORS_ORIGINS` com os domínios reais do frontend
- `TRUST_PROXY` conforme infra

## 3. Banco e usuário admin
1. Rodar migrations:
```bash
npm run migrate
```
2. Criar admin inicial:
```bash
npm run create:admin
```

## 4. Subir API
```bash
npm ci --omit=dev
npm run start:prod
```

## 5. Checklist de validação (smoke test)
1. `GET /health` retorna `{ ok: true }`.
2. Login com admin funciona.
3. `GET /me` retorna usuário autenticado.
4. Bater ponto IN/OUT funciona.
5. Admin lista usuários e altera status.
6. Admin lista/resolve alertas.
7. CORS bloqueia origem não permitida.

## 6. Operação recomendada
1. Rodar com gerenciador de processo (PM2/systemd/container).
2. Fazer backup periódico de `src/db/app.db`.
3. Rotacionar logs e monitorar `/health`.
