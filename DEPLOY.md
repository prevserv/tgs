# Deploy de ProduÃ§Ã£o

## 1. PrÃ©-requisitos
- Node.js 20+
- NPM 10+
- HTTPS no domÃ­nio (proxy reverso/plataforma)

## 2. ConfiguraÃ§Ã£o
1. Copie `.env.example` para `.env`.
2. Preencha:
- `DATABASE_URL` do PostgreSQL
- `DB_SSL` e `DB_SSL_REJECT_UNAUTHORIZED` conforme provedor (quando usar TLS)
- `NODE_ENV=production`
- `JWT_SECRET` forte (64+ chars)
- `CORS_ORIGINS` com os domÃ­nios reais do frontend
- `TRUST_PROXY` conforme infra

## 3. Banco e usuÃ¡rio admin
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

## 5. Checklist de validaÃ§Ã£o (smoke test)
1. `GET /health` retorna `{ ok: true }`.
2. Login com admin funciona.
3. `GET /me` retorna usuÃ¡rio autenticado.
4. Bater ponto IN/OUT funciona.
5. Admin lista usuÃ¡rios e altera status.
6. Admin lista/resolve alertas.
7. CORS bloqueia origem nÃ£o permitida.

## 6. OperaÃ§Ã£o recomendada
1. Rodar com gerenciador de processo (PM2/systemd/container).
2. Fazer backup periódico do banco PostgreSQL.
3. Rotacionar logs e monitorar `/health`.



