# ADR 0005: Issue List Pagination and Filtering

## Status

Accepted — reflected in the implementation.

## Context

SEARCH-001 adds server-side filters and cursor pagination to `GET /api/projects/{projectId}/issues`, with a default page size of 25 and a maximum of 50. The endpoint is a client-facing contract that Gateway forwards unchanged to Issue Service.

Two web screens read the issue list, and both need every issue in their scope:

- **Board** shows every issue of the project, grouped into one column per status, and narrows the view with a text search over key and summary and a priority selector.
- **Backlog** shows the active sprint's issues, or every project issue when no sprint is active, and counts them.

**Roadmap** reads epics only and never requests the issue list.

A screen that renders only the first page of a paged response shows at most 25 issues and gives the user no sign that others exist. Offset pagination also shifts rows when issues are created between two page requests, which duplicates or skips items.

## Decision

### Contract

- `GET /api/projects/{projectId}/issues` accepts the optional query parameters `status`, `assigneeUserId`, `sprintId`, `q`, `limit` and `cursor` defined in [SEARCH-001](../product/requirements.md#search-001--filter-and-page-the-project-issue-list), and returns `200 { items, nextCursor }`. `items` keeps the Issue shape of the other Issue routes. `nextCursor` is a string, or `null` on the last page.
- Filters combine with AND. `q` is trimmed and matched with `summary ILIKE '%' || q || '%'`; `%`, `_` and `\` in `q` are escaped so they match literally. `status` is case-insensitive like the transition body.
- Issue Service validates every parameter in the application use case before the Project access check. An unknown parameter, a parameter given more than once, an invalid enum, UUID or limit, a blank `q` or one longer than 200 characters, and a malformed cursor each return `400 VALIDATION_ERROR` whose `details` names the parameter.
- Read permission is unchanged: the caller needs Project read access (ISSUE-001), and archived projects stay readable.
- Gateway forwards the raw query string to the internal route and validates nothing (dependency rule 3). `contracts/http/issue.schema.json#/$defs/issueList` requires `nextCursor`.

### Order and cursor

- Issues are ordered by `created_at DESC, id DESC`. Both columns are immutable, so editing an issue never moves it to another page.
- The next page is selected with the keyset condition `(created_at, id) < (cursorCreatedAt, cursorId)`. The repository reads `limit + 1` rows to decide whether a next page exists; there is no count query.
- The cursor is the base64url encoding of `<created_at>|<id>` for the last issue of the page. PostgreSQL formats `created_at` in UTC with microsecond precision (`to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`), because a JavaScript `Date` keeps only milliseconds and a truncated position would skip issues that differ below one millisecond.
- The cursor is opaque to clients and is neither signed nor bound to the filters. Decoding checks its shape, the timestamp's calendar validity and the UUID; any failure is `400 VALIDATION_ERROR` on `cursor`. A hand-made cursor can only choose a starting position inside a list the caller is already allowed to read.
- Guarantee: every issue that was committed before the first page request and still matches the filters appears exactly once while a client follows `nextCursor`. An issue created during the traversal sorts before the first page and appears when the client starts again from the first page. An issue whose filtered field changes during the traversal can be missed or appear once; it can never appear twice.

### Indexes

Migration `008_issue_list_indexes.sql` adds:

| Index | Serves |
| --- | --- |
| `(project_id, created_at, id)` | Unfiltered list and every cursor position |
| `(project_id, status, created_at, id)` | `status` |
| `(project_id, assignee_user_id, created_at, id)` | `assigneeUserId` |
| `(project_id, sprint_id, created_at, id)` | `sprintId` |
| GIN `summary gin_trgm_ops` | `q` substring match |

The migration creates the `pg_trgm` extension, which `postgres:16-alpine` ships as a trusted extension. Migrations run at startup as one multi-statement query, which rules out `CREATE INDEX CONCURRENTLY`; each index build blocks issue writes once while it runs.

### Backward compatibility

- The response keeps `items` and adds `nextCursor`. A request without parameters returns the first 25 issues instead of the whole project, so a client that ignores `nextCursor` sees a truncated list.
- The web client is the only consumer of this route and follows `nextCursor` in the same change. APIs are unversioned (see [API conventions](../api/conventions.md)), so there is no versioned route. During a deployment, a browser still running the earlier bundle shows at most 25 issues per screen until the page is reloaded.
- `(created_at, id)` newest-first gives the same order as descending issue number, because the number and `created_at` are both assigned in the creating transaction.

### Web client data loading

- `listIssues(projectId, filters)` requests pages with `limit=50` and follows `nextCursor` until it is `null`, then returns the complete list for those filters. React Query caches that list under `["issues", "list", projectId, filters]`, so existing invalidations of `["issues", "list", projectId]` refresh every filtered list.
- **Board** loads the complete unfiltered list. Grouping into status columns is presentation, not filtering. Text search and the priority selector stay in the browser over the complete list, because `q` does not match issue keys and there is no priority parameter; a hidden issue is always one the user filtered out.
- **Backlog** waits for the sprint list, then requests `sprintId=<active sprint>` when a sprint is active and the unfiltered list otherwise. The browser-side sprint filter is removed.
- **Roadmap** is unchanged because it does not read issues.
- If any page fails, the whole list query fails and the screen shows its existing retryable error. No screen renders a partial list.

## Alternatives

- Offset and limit. Rejected because creations between page requests shift offsets, which duplicates or skips issues, and deep offsets scan every earlier row.
- Return the whole list when no `limit` is given. Rejected because SEARCH-001 fixes the default at 25 and an unbounded response grows with the project.
- Render only the first page on Board and Backlog with a "load more" control. Rejected because a status column or the Backlog count would describe an arbitrary subset without saying so.
- One server query per Board status column. Rejected because the Board shows every status, so it triples the requests without reducing the data.
- Send the Board search box as `q`. Rejected because `q` matches summaries only, and searching by issue key would stop working.
- Sign or encrypt the cursor. Rejected because the cursor grants no access beyond the project the caller can already read.
- A `tsvector` index or an external search engine. Rejected because SEARCH-001 asks for a case-insensitive substring match on the summary.

## Consequences

Board and the no-sprint Backlog make one request per 50 issues when they load or refresh, one after another; a 1,000-issue project needs 20 requests. When that becomes slow, the next step is to page each Board column separately and show its own count. Transitions, creation and sprint completion invalidate the list and load it again.

Issue writes maintain four more B-tree indexes and one GIN index. A `q` shorter than three characters cannot use the trigram index and is checked against every issue of the project reached through the `project_id` indexes.

Sort options, priority and key filters, and notification pagination remain unimplemented.
