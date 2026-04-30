# Repository Folder Structure

Complete layout of the monorepo once all layers are in place.

```
pf/                                         ← repo root
│
├── client/                                 ← Layer 0: React local admin viewer (existing)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── server/                                 ← Layer 1: Node.js local agent (existing, extended)
│   ├── src/
│   │   ├── server/
│   │   ├── common/
│   │   └── types/
│   ├── package.json
│   └── config.example.yaml
│
├── management/                             ← Layer 3: .NET Core Management API (new)
│   ├── PhoneFarm.sln
│   ├── PhoneFarm.Domain/
│   │   ├── Entities/
│   │   ├── Enums/
│   │   └── Interfaces/
│   ├── PhoneFarm.Infrastructure/
│   │   ├── Data/
│   │   │   ├── PhoneFarmDbContext.cs
│   │   │   ├── Configurations/
│   │   │   └── Migrations/             ← Layer 2: EF Core MSSQL migrations live here
│   │   ├── Repositories/
│   │   └── AgentProxy/
│   ├── PhoneFarm.Application/
│   │   ├── Devices/
│   │   ├── Accounts/
│   │   ├── Dashboard/
│   │   └── Auth/
│   └── PhoneFarm.API/
│       ├── Controllers/
│       ├── Hubs/
│       ├── Middleware/
│       ├── appsettings.json
│       └── Program.cs
│
├── ui/                                     ← Layer 4: Angular 21 web UI (new)
│   ├── src/
│   │   └── app/
│   │       ├── core/
│   │       ├── shared/
│   │       ├── layout/
│   │       └── features/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── angular.json
│   └── index.html                      ← Font Awesome CDN link goes here
│
└── docs/                                   ← Planning & architecture docs
    ├── ARCHITECTURE_PLAN.md
    ├── FOLDER_STRUCTURE.md
    └── layers/
        ├── LAYER_0_CLIENT.md
        ├── LAYER_1_AGENT.md
        ├── LAYER_2_DATABASE.md
        ├── LAYER_3_API.md
        └── LAYER_4_ANGULAR.md
```

## Notes

| Folder | Status | Layer |
|---|---|---|
| `client/` | Existing — no structural changes | Layer 0 |
| `server/` | Existing — add DB write service | Layer 1 |
| `management/` | New | Layers 2 (migrations) + 3 (API) |
| `ui/` | New | Layer 4 |
| `docs/` | Existing — planning docs added | — |

- The MSSQL database itself has no folder; its schema is managed entirely through EF Core migrations inside `management/PhoneFarm.Infrastructure/Data/Migrations/`.
- `management/` and `ui/` are independent — they can be opened as separate VS Code workspaces or added to a multi-root workspace.
