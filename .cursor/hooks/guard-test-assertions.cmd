@echo off
rem PowerShell can pipe the hook payload here. The .sh association cannot.
set "BASH="
if exist "C:\Program Files\Git\bin\bash.exe" set "BASH=C:\Program Files\Git\bin\bash.exe"
if not defined BASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined BASH (
  echo guard-test-assertions: bash.exe not found 1>&2
  exit /b 1
)
"%BASH%" --noprofile --norc "%~dp0guard-test-assertions.sh"
exit /b %ERRORLEVEL%
