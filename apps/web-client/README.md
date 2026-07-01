# Web Client

Frontend skeleton for the Jira-like polyglot microservices project. This app is a Next.js App Router dashboard that renders authenticated pages on the client and calls the NestJS API gateway for REST traffic.

## Prerequisites

- Node.js 18.18 or newer
- npm
- API gateway running at `NEXT_PUBLIC_API_GATEWAY_URL`
- Notification WebSocket endpoint running at `NEXT_PUBLIC_WS_URL` if realtime work is enabled later

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Default environment values:

```bash
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run test
```

## Structure

- `src/app` contains route groups for public auth and protected dashboard pages.
- `src/app/providers.tsx` is the client provider boundary for TanStack Query, theme, and Sonner.
- `src/lib/http.ts` is the only axios instance and points at the API gateway.
- `src/features/auth` is the reference feature shape for API, store, hooks, components, and types.
- `src/features/project`, `src/features/issue`, and `src/features/notification` mirror backend bounded contexts.
- `src/components/ui` contains generated shadcn/ui primitives only.
- `src/components/shared` contains the dashboard shell and route guard.

## Not Implemented Yet

- Kanban drag-and-drop behavior.
- Issue create/edit flows.
- Notification WebSocket to UI wiring.
- Full project/workspace management UI.
- Gateway routes for issues and notifications, if they are not yet exposed by the backend.
