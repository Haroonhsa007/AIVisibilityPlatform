# AI Visibility frontend

Angular 22 standalone dashboard. All six assessment views use the Flask API: dashboard, profile creation, profile detail, queries, opportunity chart, and recommendations. App source contains no mock business data.

## Run

Use Node 22.22.3+, 24.15+, or 26+ and npm. Chrome/Chromium is required for the Jasmine/Karma tests.

```sh
cd frontend
npm ci
npm run start:proxy
```

Open http://localhost:4200. Routes: `/`, `/profiles/new`, and `/profiles/:profileUuid/{queries,chart,recommendations}`. A profile detail URL without a child redirects to `queries`; unknown URLs show the 404 page. Each feature route loads lazily. Start the backend first. The proxy targets http://127.0.0.1:5000 and can be overridden with API_PROXY_TARGET. The direct npm start / ng serve command retains the contract's http://localhost:5000 environment.

## Verify

```sh
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
npm run lint
```

If Chrome is not on the usual executable path, set `CHROME_BIN`. On macOS:

```sh
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test -- --watch=false --browsers=ChromeHeadless
```

Jasmine/Karma is the only test runner. All API tests use `provideHttpClientTesting()` and `HttpTestingController`, so no live backend or LLM is contacted. Coverage includes request methods, URLs, filters, payloads, nullable responses, mapped errors, terminal polling and destruction/unsubscription; theme persistence, Cloudlet lifecycle and Reactive Forms controls are also covered. `karma.conf.cjs` rewrites Karma's `/base/media/` font URLs to Angular's `/media/` asset route without making a proxy request.

## API and environments

`src/environments/environment.ts` uses `http://localhost:5000`; services append `/api/v1`. The backend must allow the development frontend origin. Production builds replace it with `environment.prod.ts`, whose empty base URL makes requests to same-origin `/api/v1`.

The production host must proxy `/api/v1` to Flask and fall back to `index.html` for SPA routes. The nginx/container implementation is included in Dockerfile and nginx.conf. Root docker-compose.yml serves the full stack. Serve the application at the origin root (`<base href="/">`).

All HTTP lives in `core/services`; the error interceptor translates transport errors into `AppError` and shows one error toast. Consumers should use RxJS `catchError` to store that error in view state and offer retry. Services do not substitute fixture data on failure. ESLint prevents importing `HttpClient` outside the service folder and rejects explicit `any`.

Models preserve the OpenAPI field names, status unions, nulls, and `required` lists exactly. Properties omitted from an OpenAPI `required` list are optional in TypeScript, including the page/list envelopes; consumers should handle `items ?? []` and absent pagination values. `ApiErrorEnvelope.error.details` allows unknown values; only string field messages are copied into `AppError.fieldErrors`.

`PipelineService.pollRun(runUuid, destroyRef?)` polls immediately and every two seconds. It includes the terminal response (`completed`, `partial`, or `failed`) before completing. Pass the calling component's injected `DestroyRef` to stop when the route is destroyed, or use AsyncPipe/`takeUntilDestroyed` on the consumer. Without a caller ref it uses the service lifetime; unsubscribing always cancels its timer and in-flight request. Errors terminate the stream and remain available to `catchError`.

## UI foundation

Tailwind 4 uses the official PostCSS integration. `tailwind.config.mjs` sets `darkMode: 'class'` and maps the architecture's CSS variables to utilities. The exact light/dark and chart colors are in `src/styles.css`; components contain no hex values. Inter is bundled through `@fontsource/inter`, with no CDN dependency. The pre-paint script in `index.html` and `ThemeService` share the same storage key, preventing a flash of the wrong theme. System preference changes are followed while system mode is selected; denied localStorage does not break theme switching.

The header has monitor/sun/moon theme buttons with accessible names and pressed states. The desktop sidebar starts at 1024px; smaller screens use a CDK overlay drawer with focus trapping, Escape/backdrop dismissal and focus restoration. Skip navigation, visible focus rings and reduced-motion styling are included.

UI equivalents for the assessment's Material widgets are standalone OnPush components in `shared/ui`: button, card, badge, removable chip, skeleton, spinner, empty/error states, native-range slider, native select, paginator, routed tabs, and a native radio toggle group. Slider/select/toggle implement typed `ControlValueAccessor` for Reactive Forms, including disabled/touched state and immediate programmatic resets. Routed tabs are navigation links with `aria-current`, rather than in-page tab roles.

Icons use [`@ng-icons/core`](https://ng-icons.github.io/ng-icons/docs/installation/) and the Heroicons outline set, registered per component. Only referenced icons ship. There are no remote icon requests.

Per the Director's follow-up, notifications use [`@cloudlet/toast`](https://cloudlet.dev/toaster/docs) instead of the original custom CDK toast implementation. `ToastService` owns one Cloudlet controller and exposes `success`, `error`, `info`, `dismiss`, and readonly snapshot/count signals. A zero duration makes a notification persistent. Cloudlet owns stacking, dismissal, visible-time timers, polite announcements, keyboard interaction and reduced-motion behavior. The stack opens into Cloudlet's notification panel; it does not render multiple independent toast cards.

Cloudlet currently supplies a React renderer. The small Angular `toast-outlet` adapter contains its React 19 root, synchronizes the theme and unmounts with Angular. The renderer loads through Angular's idle-deferred outlet and Cloudlet's own lazy renderer, keeping it out of the initial bundle. Its required React CommonJS entrypoints are explicitly allowed in `angular.json`; the rest of the app stays Angular. CSS variables bridge Cloudlet's colors, font and 8px radius to the platform tokens. Renderer unmount pauses notifications; controller disposal clears them. Notification time pauses while hidden, unfocused, hovered or being read, according to Cloudlet's policy.

`ng2-charts` renders the score chart with blue/orange/unknown token colors, full query tooltips, a table fallback, and a horizontal tablet layout. All three child tabs refresh after a terminal run. CSV export fetches every filtered page before downloading and guards formula injection. Root README.md documents the complete product and Docker startup.

Setup references: [Angular CLI](https://angular.dev/tools/cli/setup-local), [Tailwind Angular integration](https://tailwindcss.com/docs/installation/framework-guides/angular).

Production Docker: from the repository root run `docker compose up --build -d --wait`, then open http://localhost:4200. Route animations use Angular Router View Transitions (140ms) and skip reduced-motion users; test routers omit this feature so tests are animation-free. The light muted/control-border tokens were adjusted for AA contrast during T09.

The dashboard keeps its last successful overview in memory for up to 30 seconds when navigating back. Successful profile creation, run start/completion, or recheck invalidates it. Expired snapshots refresh once on entry while the existing content stays visible; failed refreshes offer retry. Equivalent query-filter URLs do not refetch, and query/fragment-only navigation skips the full-page transition. Profile detail includes a back arrow to the dashboard. Dropdowns use borderless native controls with local chevrons and keyboard focus rings.

## Guided walkthrough

See the [ten-minute frontend/backend explanation](../docs/WALKTHROUGH.md), [captioned product recording](../docs/media/platform-walkthrough.mp4), and [Loom narration](../docs/LOOM_SCRIPT.md). The recording uses an isolated fake-provider stack and is separate from any live-provider setup.
