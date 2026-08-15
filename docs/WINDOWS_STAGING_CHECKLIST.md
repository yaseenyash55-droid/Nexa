# Windows Staging Checklist

Run these commands from the Nexa project root in PowerShell.

## 1. Configure secrets

```powershell
Copy-Item .env.example .env
notepad .env
```

Set unique values for `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `MFA_ENCRYPTION_KEY`. Keep `.env` out of Git and ZIP files.

Generate independent random secrets:

```powershell
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
([BitConverter]::ToString($bytes)).Replace('-', '')
$rng.Dispose()
```

Run that command separately for each secret.

## 2. Rebuild the Oracle schema

```powershell
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/01_reset.sql'
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/02_schema.sql'
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/03_seed.sql'
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/05_security_privacy_migrations.sql'
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/04_verification.sql'
sqlplus NEXA_USER@localhost:1521/FREEPDB1 '@database/verification_realtime.sql'
```

Stop if any command reports an Oracle error. Do not treat a skipped query as a pass.

## 3. Verify the application

```powershell
npm ci
npm run typecheck
npm run test
npm run build
npm audit --omit=dev --audit-level=high
```

## 4. Start local staging

```powershell
npm run dev
```

Open `http://localhost:5173`. Keep ports `4000` and `1521` blocked from the public internet.

## 5. Publication gate

Do not publish until every `NOT RUN` or `BLOCKED` item in `artifacts/release-hardening-report.md` is resolved with real execution evidence.
