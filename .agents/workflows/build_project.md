---
description: How to install dependencies and build the project
---

# Build Project

Follow these steps to prepare the project for production.

1. Ensure Node.js (>= 20) is installed.
2. Update the session PATH if Node is not in the global environment:
   ```powershell
   $env:PATH += ";C:\Program Files\nodejs"
   ```
3. Install dependencies:
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" install
   ```
4. Build the project:
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" run build
   ```
