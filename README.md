# NeuroSync

NeuroSync is a task-management app built around task initiation, time awareness, and checking in when work feels difficult. It combines a React Native frontend, a Go API, and PostgreSQL, with Clerk for authentication and Gemini for contextual check-in suggestions.

The project is in active development. The core task and check-in flows are implemented, the database has been moved to Azure, and an Azure container has been created for the Go backend.

## Tech stack

| Layer | Technology | Role |
| --- | --- | --- |
| App | React Native 0.81, React 19, Expo SDK 54 | Shared app code for Android, iOS, and web |
| Language and navigation | TypeScript, Expo Router | Typed frontend code and file-based routes |
| UI | Tamagui, React Native styles, Reanimated | Themes, reusable components, and interactions |
| Authentication | Clerk | Sign-up, sign-in, Google sign-in integration, and API token verification |
| Backend | Go 1.26.5, standard-library `net/http` | HTTP API, validation, authorization, and application logic |
| Database | PostgreSQL, `pgx/v5` | Persistent user data and pooled database connections |
| Migrations | Goose, versioned SQL | Schema creation and incremental database changes |
| AI suggestions | Google Gemini API | Turn a free-text brain dump and check-in context into structured, actionable next-step options through the Go backend |
| Containers | Docker, Docker Compose | Backend image and local app/API/database/migration stack |
| Cloud | Microsoft Azure | Hosted database and container setup for the Go backend |
| Build configuration | Expo Application Services (EAS) | Android preview APK and production app-bundle profiles |
| Checks | Go testing, Node test runner, ESLint | Backend tests, frontend logic and integration checks, linting |

## What is implemented

| Area | Current functionality |
| --- | --- |
| Authentication | Sign-up and sign-in screens, Google sign-in integration, authenticated API requests, and server-side Clerk token verification |
| Tasks | Create, edit, complete, and delete tasks; save notes and time estimates |
| Focus sessions | Task timers, manual time entry, and persisted session records with estimated and actual time |
| Guided check-ins | Identify a blocker, describe what is happening, optionally add capacity/context, and choose or write a concrete next step |
| Brain-dump breakdown | Gemini uses the user's free-text brain dump, selected difficulties, and optional context to suggest three concrete next-step options with time estimates and explanations; server validation and preset fallbacks handle failed AI responses |
| Follow-ups | Record whether a strategy was attempted, whether the next step happened, helpfulness, and changes in self-reported stuckness |
| Insights | Summarize check-in patterns by blocker and support strategy, including follow-up rates and insufficient-data states |
| Settings | Persist theme and time-estimation preferences |
| Persistence | SQL migrations for users, settings, tasks, subtasks, sessions, check-ins, and check-in outcomes |
| API infrastructure | CORS configuration, user-scoped data access, database connection pooling, health and readiness endpoints |
| Deployment work | Database moved to Azure; Azure container created for the Go backend; multi-stage backend Docker image with a non-root runtime |

“Implemented” describes the current code and completed setup, rather than a claim that every platform or production scenario has been verified.

### Azure deployment progress

The recent infrastructure work moves the database to Azure and establishes an Azure container for the Go API. The backend image compiles a Linux binary in a Go build stage, then runs it in a smaller Alpine image on port `8080`. It supports a target architecture for container builds.

The deployment configuration connects these pieces:

- `DATABASE_URL` points the API at PostgreSQL. Database credentials stay on the server.
- `CLERK_SECRET_KEY` supports server-side authentication.
- `GOOGLE_GENERATIVE_AI_API_KEY` and `GEMINI_MODEL` configure suggestions.
- `ALLOWED_ORIGINS` controls which browser origins can call the API.
- `EXPO_PUBLIC_API_URL` points the frontend at the backend URL.
- `/health` reports that the HTTP server is responding; `/ready` also checks the database connection.

Schema migrations use a separate Goose runner; starting the API does not apply them automatically. The checked-in Compose stack uses local PostgreSQL for development. Azure resource provisioning and deployment automation are not currently defined in this repository.

## Why the check-in flow exists

A task list records what needs doing, but does not explain what is preventing someone from starting. NeuroSync's check-in asks the user to identify a blocker—difficulty starting, uncertainty about time, or shame—then turn that into one small action with a time boundary. A follow-up records what happened.

The design draws on established approaches used in ADHD support: making plans explicit, breaking large tasks into manageable steps, and building organization and time-management skills. NIMH describes these approaches in its [ADHD guidance](https://www.nimh.nih.gov/health/publications/attention-deficit-hyperactivity-disorder-what-you-need-to-know). This is the rationale for the flow, not evidence that NeuroSync's particular check-in has been clinically validated.

In practical terms, the check-in is intended to:

- Make the immediate obstacle explicit before choosing an action.
- Reduce an open-ended task to a specific starting point.
- Give the attempt a clear time boundary.
- Collect follow-up observations so users can review which approaches they found helpful.

Insights describe personal, self-reported patterns. They do not establish that a strategy caused an improvement.

### Brain dumps and the Gemini API

The user can write an unstructured brain dump about what is happening, what feels difficult, or what is competing for their attention. The Gemini API uses that text and the check-in context to suggest manageable ways to start.

1. The app collects the brain dump, selected blocker, and specific difficulties, with optional context such as current capacity, sleep, and basic needs.
2. It sends an authenticated request to the Go backend at `/v1/check-in-suggestions`. If the check-in is linked to a task, the backend can include its title.
3. Gemini returns three structured options. Each includes a support strategy, title, concrete next step, planned duration, and a short explanation of why that action may help.
4. The user chooses an option or writes their own next step. The saved check-in and later follow-up feed the insights view.

For example, a brain dump about an overwhelming assignment and an unclear starting point could lead to an option such as opening the assignment instructions and writing down the first requirement for five minutes. This illustrates the intended output; suggestions vary with the input.

The current flow breaks the situation down into next-step choices. It does not automatically convert every item in a brain dump into saved tasks or a full subtask plan. Responses are validated on the server, with retries and built-in fallback suggestions if AI personalization fails. The backend also includes crisis-language handling.

The raw brain dump is temporary suggestion context and is not persisted as part of the check-in record. It can be sent to Gemini, along with relevant context and a task title, to generate suggestions. Selected actions and follow-up outcomes are stored in PostgreSQL. AI credentials are server-only.

## Current gaps

- **Subtasks:** database schema and backend groundwork exist, but the subtask handler is not mounted in the active API and the frontend does not fetch subtasks.
- **Reminders:** task records contain alarm and notification fields; those fields alone do not represent a complete notification-delivery feature.
- **Deployment automation:** Azure setup has been performed, but reproducible infrastructure definitions and a deployment pipeline are not checked in.
- **Release verification:** EAS profiles exist; app-store publication and full cross-platform release validation are not established by those profiles.

## Contributor quick start

### Docker development

Install Docker with Compose. From the repository root, create a local environment file if you do not already have one:

```bash
cp .env.example .env.local
```

Fill in the Clerk publishable and secret keys, the Gemini API key, and the Google OAuth values needed for your sign-in platform. Use the root `.env.example` as the configuration reference. Values prefixed with `EXPO_PUBLIC_` are visible to the client; never put server secrets in them.

Start the stack:

```bash
docker compose --env-file .env.local up --build
```

Compose starts PostgreSQL, applies migrations, starts the Go API, and runs the Expo development server.

| Service | Local address |
| --- | --- |
| Expo | http://localhost:8081 |
| API health | http://localhost:8080/health |
| API readiness | http://localhost:8080/ready |

For a physical device, set `EXPO_PUBLIC_API_URL` to your computer's reachable LAN address on port `8080`. On the Android emulator, the host is typically `10.0.2.2`. `localhost` on a phone refers to the phone itself.

Useful commands:

```bash
# Inspect backend and migration output.
docker compose --env-file .env.local logs api migrate

# Apply newly added migrations to the local database.
docker compose --env-file .env.local run --rm migrate

# Stop the stack while keeping the local database volume.
docker compose --env-file .env.local down
```

If readiness fails, check database connectivity and migration output. For browser CORS errors, ensure `ALLOWED_ORIGINS` includes the exact frontend origin. Restart Expo after changing public environment variables.

### Run Expo outside Docker

You can keep the API and database in Docker while running Expo on your machine. Install Node.js 22 or newer, then run:

```bash
docker compose --env-file .env.local up --build database migrate api
```

In a separate terminal at the repository root:

```bash
npm ci
npm start
```

Use `npm run web`, `npm run android`, or `npm run ios` for platform-specific development. Native builds require the corresponding Android or iOS development tools.

To run the Go backend directly, install the Go version specified in `server/go.mod`, provide a migrated PostgreSQL database, and export `DATABASE_URL`, `CLERK_SECRET_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and the relevant optional configuration into the process environment. The Go server does not automatically load `.env.local`.

```bash
cd server
go run ./cmd/api
```

## Checks

From the repository root:

```bash
npm test
npm run lint
```

For the backend:

```bash
cd server
go test ./...
```

Database integration tests require `TEST_DATABASE_URL` pointing to a separate test database and otherwise skip. Live Gemini tests are opt-in with `RUN_GEMINI_LIVE_TEST=1` and require provider credentials.

## Repository layout

```text
app/                 Expo Router screens: auth, tasks, focus, check-ins, insights
components/          Shared UI, task sheets, and the guided check-in flow
context/             App theme, modal, and active-timer state
hooks/               Timer and task-session hooks
lib/                 API clients, insight helpers, time utilities, safety checks
server/cmd/api/      Go server entry point, routes, CORS, database setup
server/internal/     Authentication and feature handlers
server/migrations/   Versioned SQL migrations and schema smoke checks
tests/               Frontend logic and integration checks
compose.yaml         Local app, API, database, and migration services
```

## License

NeuroSync is available under the [Apache License 2.0](LICENSE). Third-party dependencies remain subject to their respective licenses.
