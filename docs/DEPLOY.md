# Deploying Eval Studio v2 (Vercel frontend + Render backend)

The frontend is a static Vite build on **Vercel**. The backend is a persistent
**FastAPI** process on **Render** (it needs a long-lived process for SSE streaming
and the in-process run engine — serverless won't work). The browser calls
relative `/api/*`, and Vercel **rewrites** those to the Render backend, so the
session cookie stays first-party (no CORS / third-party-cookie issues).

```
browser ──/api/*──▶ Vercel (rewrite) ──▶ Render FastAPI ──▶ Postgres
        ◀── static frontend ──┘
```

---

## 1 · Backend → Render

1. Push this repo (the `render.yaml` Blueprint + `backend/requirements.txt` must be on the branch you deploy, normally `main`).
2. Render Dashboard → **New → Blueprint** → connect this GitHub repo → **Apply**.
   Render creates the Postgres database **and** the `eval-studio-api` web service,
   and wires `DATABASE_URL` automatically.
3. Open **eval-studio-api → Environment** and set the provider key(s) (marked
   `sync: false` in the Blueprint, so they're never in git):
   - `SILICONFLOW_API_KEY` (and/or `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`)
4. Make sure `JUDGE_MODEL` / `WRITER_MODEL` are models your key actually serves
   (default `deepseek-ai/DeepSeek-V3`). The candidate models offered in the New
   Run wizard must also exist on your provider, or those trials fall back to the
   rule-only judge.
5. The service boots with: `alembic upgrade head` → load the 140 starter cases →
   `uvicorn`. When **Live**, copy its URL, e.g. `https://eval-studio-api-xxxx.onrender.com`.

> Render free tier sleeps after ~15 min idle (first request cold-starts ~30–50 s),
> and the free Postgres expires after 90 days — both fine for a demo.
> Keep the service at **1 instance** (the SSE bus + background tasks are in-process).
>
> To run **keyless** instead (no key, deterministic demo), set `MOCK_LLM=1`.

---

## 2 · Wire the frontend → backend (Vercel rewrite)

Add a `rewrites` block to `vercel.json`, replacing the host with your Render URL:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://eval-studio-api-xxxx.onrender.com/api/:path*" },
    { "source": "/health",     "destination": "https://eval-studio-api-xxxx.onrender.com/health" }
  ]
}
```

Commit + push to `main`. Vercel redeploys and now proxies `/api` to Render.
No `VITE_API_BASE` needed — the frontend keeps calling relative `/api`.

---

## 3 · Verify

- `https://<your-vercel-domain>/health` → `{"ok": true}` (proxied to Render).
- Open the app → **New Run** lists the 4 starter datasets (real data from the DB).
- Run a small experiment → trials stream on the live page → Decision Book renders.

If `/api` calls fail, the frontend falls back to mock/demo data — so a broken
rewrite or a sleeping backend degrades gracefully rather than white-screening.

---

## Notes

- **Deployment Protection**: if Vercel "Vercel Authentication" is on, deployment
  URLs show a login wall. Project → Settings → Deployment Protection to make the
  production site public.
- **Real cost**: with `MOCK_LLM=0`, every trial is a real candidate + judge call.
  Keep runs small; `DEFAULT_MAX_TRIALS` caps cases per run at 40.
