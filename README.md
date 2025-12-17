# DrivePurge AI Agent

DrivePurge AI is a professional-grade Google Drive optimization tool. It uses Gemini 3 Flash to intelligently audit your storage, identifying duplicates, oversized assets, and abandoned documents.

## 🚀 Quick Start

1. **Google Cloud Setup**:
   - Enable **Google Drive API** in your [Google Cloud Console](https://console.cloud.google.com/).
   - Create an **OAuth 2.0 Client ID** for a "Web Application".
   - Add your hosting domain to **Authorized JavaScript origins**.
   - Update `MASTER_CLIENT_ID` in `services/googleDriveService.ts`.

2. **Gemini API Setup**:
   - Obtain an API Key from [Google AI Studio](https://aistudio.google.com/).
   - Ensure `process.env.API_KEY` is configured in your hosting environment.

3. **Deploy**:
   - This app is built with native ES Modules and `importmaps`. It can be hosted on any static file server (GitHub Pages, Vercel, Netlify) without a build step.

## 🛠 Features

- **AI Auditing**: Reasoning-based file analysis (not just name matching).
- **Redundancy Detection**: Finds duplicate files across different folders.
- **Storage Health**: Detailed breakdowns of large and ancient files.
- **Batch Processing**: Secure, one-click trashing of identified clutter.

## 🔒 Security
DrivePurge AI operates entirely in the browser. File metadata is sent to Gemini for analysis, but file contents remain secure within your Google ecosystem. Only metadata (name, size, date) is processed by the AI.

## 💼 Business Use
This application is designed to be easily rebranded and repurposed for enterprise storage cleanup services or as a value-add for managed service providers (MSPs).
