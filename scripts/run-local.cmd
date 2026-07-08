@echo off
REM Runs the backend serving BOTH the API and the pre-built Angular dashboard
REM from a single origin (http://localhost:4000) — the same setup used in prod.
REM Build the dashboard first:  npm --prefix dashboard run build
cd /d "%~dp0..\backend"
set DATABASE_URL=postgres://atri:atri@localhost:5432/atri
set STATIC_DIR=%~dp0..\dashboard\dist\dashboard\browser
set PORT=4000
call npx tsx src/index.ts
