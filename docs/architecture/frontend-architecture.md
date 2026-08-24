# Frontend Architecture

## Purpose

Map implemented browser responsibilities to business capabilities.

- Next.js App Router owns page routes under `apps/web-client/src/app`.
- Feature modules under `src/features` own API clients, types, hooks, components, and narrowly scoped Zustand state.
- React Query fetches/refetches server state; Zustand stores authentication/session state and board filter UI state.
- Axios calls only `NEXT_PUBLIC_API_GATEWAY_URL`; request interception attaches the access token and one retry refreshes it with the HttpOnly cookie.
- Notification fetching polls every five seconds. Socket utility code is not an implemented delivery channel.

See [UI routes](../reference/routes.md) and [feature pages](../features/).
