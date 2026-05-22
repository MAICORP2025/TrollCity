Gift Asset Diagnostic

Purpose
- Small diagnostic script to check gift animation/video asset availability and unresolved gift names.

Files created
- `scripts/check_gift_assets.mjs` — Node script that queries `gift_items` via Supabase PostgREST and checks candidate asset URLs.
- `diagnostic_outputs/gift_asset_report.json` — output file written by the script when run.

Environment
- Set these env vars in your terminal before running:

  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=your-anon-or-service-role-key
  ASSETS_BASE_URL=https://your-app.example.com   # optional; used to resolve relative /gift-animations paths

Run
```bash
node scripts/check_gift_assets.mjs
```

Notes
- The script does NOT modify any database records.
- It replicates the same animation URL resolution logic used by `src/lib/giftVisuals.ts` where possible.
- For relative paths it tries `ASSETS_BASE_URL` (if present) and Supabase origin as fallbacks.
- Review `diagnostic_outputs/gift_asset_report.json` for full per-gift detail and missing-file suggestions.

Next steps
- Run the script and share `diagnostic_outputs/gift_asset_report.json` if you want me to analyze missing files and generate a manifest of assets to add to `public/` or storage.
