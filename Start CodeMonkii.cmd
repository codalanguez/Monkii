@echo off
title CodeMonkii
cd /d "%~dp0"

rem where Ollama keeps its models on this machine
set OLLAMA_MODELS=%USERPROFILE%\.ollama\models

rem start Ollama if it isn't already running
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | find /I "ollama.exe" >nul
if errorlevel 1 (
    echo Starting Ollama...
    start "" /min ollama serve
    timeout /t 3 /nobreak >nul
)

echo Starting CodeMonkii at http://localhost:8113 ...
start "" http://localhost:8113
node server.js
