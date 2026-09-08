@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS with npm: https://nodejs.org/en/download/
  pause
  exit /b 1
)
node "%~dp0start.mjs" %*
exit /b %errorlevel%
