# Admin dashboard

Internal UI at `/admin`. It has its own root layout and stylesheet (`src/styles/admin.css`); nothing from the public site's styles is loaded, and the public pages are untouched. Sign-in, sessions and `requireAdmin()` are described in `AUTH.md`.

## Structure

| Piece | File |
|---|---|
| Root layout (noindex, admin CSS only) | `src/app/(admin)/layout.tsx` |
| Login (the only open page) | `src/app/(admin)/admin/login/page.tsx` |
| Protected layout: `requireAdmin()`, then the chrome | `src/app/(admin)/admin/(console)/layout.tsx` |
| Overview | `(console)/page.tsx`, data from `src/lib/server/dashboard.ts` |
| Submissions | `(console)/submissions/page.tsx` |
| Loading state (skeleton) / error state | `(console)/loading.tsx`, `(console)/error.tsx` |
| Sidebar, top bar, account menu, mobile menu | `src/components/admin/AdminChrome.tsx` |
| Breadcrumbs (built from the address) | `src/components/admin/Breadcrumbs.tsx` |
| Toasts | `src/components/admin/Toaster.tsx` |
| Button with pending state and optional confirm | `src/components/admin/SubmitButton.tsx` |

## Overview page

Four totals: services, published case studies, published blog posts, unread (`status = 'new'`) submissions (the last links to the filtered list). Below: the 5 newest submissions (message cut to 110 characters) and the 8 most recently updated content rows across services, case studies, blog posts, site settings and media. Both lists have an empty state. All numbers come from one server-side query set (`getDashboard()`), which is only called after `requireAdmin()`; the layout and the page each check the session, and signed-out requests are redirected before any data is read.

"Recent content updates" currently shows the seeded rows (all dated at seed time) because no editor writes content yet; it fills in as the editors arrive.

## Behaviour

- **Sidebar:** current page marked (`aria-current`), new-submissions badge, content and site sections listed as disabled "Soon" until their editors exist (they are not links). Becomes a slide-in menu under 760 px (burger button, scrim, Escape and navigation close it).
- **Account menu:** name, e-mail, role, link to the public site, sign out (a server action with the CSRF origin check).
- **Toasts:** `useToast()` from `Toaster.tsx` for client code. Server actions redirect with a notice **code** (`?n=status`, `?n=deleted`); the provider shows the matching text, removes the parameter from the address and refreshes the layout counts. Unknown codes show nothing, so an address cannot display arbitrary text.
- **Loading / error / empty:** `loading.tsx` skeleton, `error.tsx` with "Try again" (only an error reference is shown; details stay in the server log), empty states on the overview lists and on filtered submissions.
- **Accessibility:** landmarks and labels, visible focus, `aria-live` toasts, `prefers-reduced-motion` respected.

## Adding a page

1. Create it under `src/app/(admin)/admin/(console)/`; call `requireAdmin()` first in the page and in every action it uses.
2. Add the link to `GROUPS` in `AdminChrome.tsx` and a label to `LABELS` in `Breadcrumbs.tsx`.
3. For action feedback add a code to `NOTICES` in `Toaster.tsx` and redirect with `?n=<code>`.

## Tests

`dash-test.mjs` (30 checks, passing): signed-out HTML has no dashboard data; every total equals the database; recent lists order and limits; sidebar and breadcrumbs follow navigation; account menu; toast after an action, address cleaned, badge refreshed, unknown code ignored; empty states; unknown address is a plain 404; mobile menu opens and closes, no horizontal scroll; sign out; no console errors. The earlier admin test (28 checks) passes with the new layout.
