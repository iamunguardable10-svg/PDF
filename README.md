# TeamLoad

TeamLoad is a React + TypeScript web application for basketball and team-sport workload operations. The product connects coach planning, athlete availability, final attendance context, and player load monitoring.

> Current repository name: `PDF`. Product name used in the app: `TeamLoad`.

## Product focus

TeamLoad is not a generic PDF project. The app is currently a Coach OS / athlete companion for team sports.

Core workflow:

1. Coach creates teams and sessions.
2. Athletes report availability exceptions: expected, maybe, late, or out.
3. Coach reviews exceptions and final attendance.
4. Athletes submit player load via RPE x actual duration.
5. Coach monitors load, ACWR context, and risk signals.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router |
| Backend / Cloud | Supabase |
| Charts | Recharts |
| Scanner support | ZXing |
| AI support | Groq SDK |

## Main app modes

The app supports three stored modes:

- `coach`: coach/team operations workspace
- `athlete`: authenticated athlete/team companion flow
- `solo`: local individual athlete flow

The current mode is stored in local storage under `club_os_mode`. Several older local storage keys still use legacy names such as `fitfuel_*` and should be normalized in a later non-documentation cleanup.

## Local development

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

## Environment variables

Create a local `.env` from `.env.example`.

Required for cloud/auth mode:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional / feature-specific:

```bash
VITE_GROQ_API_KEY=
```

If Supabase variables are missing, the app intentionally falls back to local/demo behavior through `CLOUD_ENABLED`.

## Important documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — app structure, domains, routing, data model overview
- [`docs/SUPABASE_SECURITY_AUDIT.md`](docs/SUPABASE_SECURITY_AUDIT.md) — current database/security findings and safe remediation plan
- [`docs/HANDOFF_REPORT.md`](docs/HANDOFF_REPORT.md) — compact context report for other working chats/agents

## Development coordination rules

To avoid conflicts with parallel ChatGPT/GitHub work:

1. Do not work directly on `main`.
2. Use one branch per responsibility.
3. Avoid editing the same files from multiple chats at the same time.
4. Keep documentation/security work separate from UI and product feature branches.
5. Use pull requests as the synchronization point.

Current documentation branch:

```text
docs/project-stabilization-audit
```

## Known high-priority risks

1. Supabase has public tables with RLS disabled.
2. Some RLS policies are overly permissive.
3. Several `SECURITY DEFINER` functions are executable by public/authenticated roles.
4. Supabase migrations are currently not registered in the project history.
5. Product naming is inconsistent across repository/app/local storage keys.

Do not enable RLS blindly without policies. Enabling RLS without tested policies may break coach, athlete, attendance, and facility workflows.
