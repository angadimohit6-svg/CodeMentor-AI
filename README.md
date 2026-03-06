<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/040ed1e9-9962-46d0-aa34-f191d8772963

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` in your [.env.local](.env.local) (or `.env`) to your Gemini API key. Vite only exposes variables starting with `VITE_` to client code, so the frontend uses this value.
3. Run the app:
   `npm run dev`
