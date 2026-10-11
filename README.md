# Audiobooker

Online audiobook production studio. Phase 2 adds source upload, parsing, and chapter reading.

## Requirements

- Node.js 20.19+ (or 22+)
- MySQL 8+
- Cloudflare R2 bucket for source files

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Set `DATABASE_URL`, generate `AUTH_SECRET`, and fill the `R2_*` values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. Install dependencies, generate the Prisma client, and run migrations:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, create a project, then upload and parse an EPUB or TXT file.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

Included: authentication, project CRUD, R2 source upload, EPUB/TXT/PDF parsing, chapter list and read-only chapter text.

Not included: TTS, audio preview, exports, or billing.
