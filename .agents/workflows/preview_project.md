---
description: How to start the preview server
---

# Preview Project

Follow these steps to start the development server and preview the project.

1. Ensure dependencies are installed (`npm install`).
2. Update the session PATH if Node is not in the global environment:
   ```powershell
   $env:PATH += ";C:\Program Files\nodejs"
   ```
3. Start the development server:
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" run dev
   ```
4. Open the local URL in your browser:
   - [http://localhost:9002](http://localhost:9002)
