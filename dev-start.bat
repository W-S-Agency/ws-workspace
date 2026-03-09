@echo off
title WS Workspace Dev (v0.6.0)
cd /d "%~dp0"

echo === Patching SDK ===
node scripts\patch-sdk.js

echo === Starting WS Workspace Dev ===
bun run electron:dev

pause
