# NeuroSync

**An open, ADHD-friendly task and time-awareness app—and an invitation to help build it.**

NeuroSync is an early-stage Expo app exploring how technology might adapt to an individual ADHD brain instead of asking every person to adapt to the same productivity system.

The goal is not to squeeze more output from people. It is to help each person discover what supports them, make their patterns easier to understand, and offer help that feels personal rather than prescriptive.

This project is in **early alpha**. The foundations work and the automated checks pass, but it is not yet ready for everyday production use. Contributors from engineering, design, accessibility, privacy, data science, and—especially—people with lived ADHD experience are welcome.

## The challenges we care about

NeuroSync is centered on six connected ADHD experiences:

- **Crossing the starting barrier** — making it easier to begin when a task feels distant, vague, heavy, or impossible to activate.
- **Staying connected to an intention** — supporting attention after the first step without demanding rigid or uninterrupted focus.
- **Recovering through difficult emotions** — helping people navigate frustration, avoidance, shame, overwhelm, and the emotional weight attached to action.
- **Working with changing capacity** — recognizing that energy, mental clarity, and exhaustion vary across people, days, and situations.
- **Breaking distraction loops** — creating gentle ways to notice and return from diversions, including automatic scrolling, without blame.
- **Developing a personal sense of time** — making invisible time more understandable through someone’s own estimates, experiences, and patterns.

These are focus areas, not predetermined features. ADHD is personal: the same prompt, timer, reminder, or workflow can help one person and frustrate another. NeuroSync should become adaptable enough for people to shape how it behaves, what it learns, when it intervenes, and when it stays quiet.

## What is working today

- Email/password and Google sign-in with Clerk
- A low-friction Today screen for quickly capturing tasks
- A small, randomized set of up to three open tasks to reduce choice overload
- Task creation, completion, notes, deletion, and optional estimates
- Three estimation styles: relative (`Quick / Medium / Long`), minute presets, or custom minutes
- A distraction-light focus timer with pause, resume, and completion review
- Manual time entry and corrections when a timer was forgotten or left running
- The option to exclude unusual sessions so they do not distort insights
- A Time Map showing typical session length, counted sessions, weekly time, and recent sessions
- Supportive estimate-versus-actual feedback designed around learning rather than failure
- Light and dark appearance settings
- An authenticated Go API for tasks and user settings, backed by PostgreSQL
- Sanity-backed task-session history while the backend migration is in progress
- Unit, integration, API contract, authentication, validation, and database-handler tests

## Known issues and current limitations

### iOS and Android are configured, but not yet verified end to end

The Expo project includes iOS and Android identifiers, icons, secure storage, and native Google OAuth configuration. However, there are no native end-to-end tests or documented release builds yet, so **iOS and Android should currently be treated as unverified—not as supported production platforms**.

The local API URL also points to `localhost`. That works for a browser running on the development computer, but a physical phone treats `localhost` as the phone itself. Native contributors must use an API address reachable from their simulator or device and verify Clerk redirect URLs for that platform.

Help is especially welcome with:

- iOS Simulator, Android Emulator, and physical-device test passes
- Native Google sign-in and deep-link verification
- Backgrounding and restoring active timers
- Responsive layouts, keyboard behavior, safe areas, and accessibility
- Repeatable preview/release builds and mobile end-to-end tests

### The data layer is mid-migration

Tasks and settings use the new Clerk-protected Go/PostgreSQL API. Task-session history still reads and writes directly to Sanity. This split makes local setup harder and is not the intended production architecture. Remaining writes should move behind authenticated server endpoints, and public clients should not require a Sanity write token.

### Subtasks are temporarily unavailable in the app

The old Sanity-based subtask UI has been disabled while an authenticated PostgreSQL subtask API is developed. Recent work includes the API contract, validation, ownership checks, and list endpoint. Connecting the Expo client and restoring manual and AI-assisted task breakdown is still open work.

### Notifications are not implemented

Task records contain alarm and notification fields, but the app does not yet request notification permission, schedule local or push notifications, or provide reminder controls.

### Other early-alpha gaps

- Active timer state is held in memory and is not reliably recovered after the app process closes.
- Automated checks cover core logic and API behavior, but not full user journeys on web or mobile.
- Journal, mood, energy, focus, and “wall of awful” data models exist in Sanity, but their user-facing experience has not been built.

## What is being worked on now

The current development direction, reflected in the recent commit history, is:

1. Moving user data from direct Sanity access to an authenticated Go/PostgreSQL backend.
2. Completing secure, user-owned subtask CRUD and reconnecting it to the Expo app.
3. Preserving the ADHD-friendly task, timer, and time-insight experience during that migration.
4. Improving reliability, security, test coverage, and cross-platform readiness.

## Where contributors can make a difference

The areas below are invitations, not feature specifications. Contributors are encouraged to question the current approach, bring ideas from their own experience, prototype unexpected solutions, and help discover what personalization should mean in practice.

### Make it faster and more reliable

- Measure and improve startup, navigation, list rendering, and network performance.
- Add caching, optimistic updates, offline-friendly behavior, and clear recovery states.
- Persist and restore active timers safely across backgrounding and app restarts.
- Remove duplicate or legacy data paths as the backend migration is completed.
- Add web, iOS, and Android end-to-end coverage.

### Explore personalized ADHD support

There is no finished blueprint for these experiences. Some open spaces contributors might explore include:

- What could help a particular person cross their starting barrier?
- How might the app support sustained attention or a gentle return after focus drifts?
- Could it respond differently when frustration, overwhelm, avoidance, or shame is present?
- How might it learn a person’s changing energy and mental capacity without turning those patterns into judgment?
- What could interrupt a scrolling or distraction loop without becoming another unwanted interruption?
- How might someone develop a more realistic, personal relationship with time?

Medication support, energy or attention “crash” awareness, notifications, task breakdown, reflection, and pattern discovery are all possible directions—not assigned solutions. Contributors should have room to imagine different approaches, especially approaches the project has not considered yet.

Whatever form an idea takes, personalization should remain central. People should be able to influence what the app notices, how it responds, which language it uses, how much structure it provides, and whether a feature is active at all.

### Improve design, accessibility, privacy, and safety

- Test with ADHD users and turn feedback into focused, respectful improvements.
- Improve screen-reader labels, focus order, contrast, reduced-motion support, touch targets, and cognitive accessibility.
- Create clear consent, export, retention, and deletion controls for sensitive personal data.
- Threat-model authentication, API authorization, analytics, AI features, and health-adjacent data.
- Help define language that is encouraging without being patronizing or overly clinical.

Small fixes are valuable too: tests, loading and error states, documentation, performance profiling, copy improvements, and reproducible bug reports all help.

## Project shape

| Area | Technology | Current responsibility |
| --- | --- | --- |
| App | Expo, React Native, Expo Router, Tamagui | Web, iOS, and Android interface |
| Authentication | Clerk | Sessions, email/password, and Google sign-in |
| API | Go `net/http` | Authenticated tasks, settings, and in-progress subtasks |
| Primary database | PostgreSQL | Users, settings, tasks, subtasks, and planned task sessions |
| Transitional data store | Sanity | Task-session history and legacy schemas during migration |
| AI experiment | Google Gemini through the AI SDK | ADHD-aware task decomposition prototype |

## Contributor quick start

The app depends on Clerk and transitional Sanity data hosted outside Docker. Ask the maintainer for development credentials before starting. Never commit credentials or use production secrets locally.

You can still contribute tests, documentation, utilities, backend handlers, and many UI improvements without service credentials. Install the dependencies and run the checks in [Check your changes](#check-your-changes) to begin.

### Option A: Docker setup (recommended)

This starts Expo, the Go API, PostgreSQL, and all pending database migrations. You only need:

- Git
- Docker Desktop with its engine running
- NeuroSync development credentials for the complete signed-in experience

#### 1. Fork and clone

Fork the repository on GitHub, then run:

```bash
git clone https://github.com/<your-github-username>/neurosync.git
cd neurosync
git remote add upstream https://github.com/zsaghir/neurosync.git
git checkout -b feature/your-idea
```

#### 2. Create your local environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and add the development Clerk and Sanity credentials. Leave the provided PostgreSQL values unchanged unless their ports conflict with another local service.

For a physical phone, change `EXPO_PUBLIC_API_URL` to `http://<your-computer-LAN-IP>:8080`. For Android Emulator, use `http://10.0.2.2:8080`.

#### 3. Start the complete local stack

```bash
docker compose --env-file .env.local up --build
```

On the first run, Docker will:

1. Download and start PostgreSQL.
2. Wait for the database to become healthy.
3. Build the Goose migration image and apply pending migrations.
4. Build and start the Go API.
5. Wait for the API health check.
6. Start Expo on port `8081`.

Open [http://localhost:8081](http://localhost:8081). The API is available at [http://localhost:8080/health](http://localhost:8080/health).

#### 4. Useful Docker commands

Run the stack in the background:

```bash
docker compose --env-file .env.local up --build --detach
```

Follow logs or inspect a single service:

```bash
docker compose --env-file .env.local logs --follow
docker compose --env-file .env.local logs --follow api
docker compose --env-file .env.local logs --follow migrate
```

Check migration status or apply newly added migrations:

```bash
docker compose --env-file .env.local run --rm migrate status
docker compose --env-file .env.local run --rm migrate up
```

Rebuild after changing Go code or a Dockerfile:

```bash
docker compose --env-file .env.local up --build
```

Stop the stack while keeping database data:

```bash
docker compose --env-file .env.local down
```

To deliberately erase the local Docker database and start fresh, add `--volumes`. This permanently removes the local container data:

```bash
docker compose --env-file .env.local down --volumes
```

React Native changes are mounted into the Expo container and should refresh without rebuilding. Xcode and Android Studio still run on the host computer for native development.

### Option B: run every service manually

Use this path when developing without Docker or debugging an individual service.

#### What you need

- Git
- Node.js 22 and npm
- Go 1.26.5, as declared in `server/go.mod`, or a compatible version
- PostgreSQL and its `createdb` and `psql` command-line tools
- Xcode for iOS development or Android Studio for Android development
- Development credentials for Clerk and Sanity
- A Google AI API key only when working on AI-generated subtasks

Check the main tools before continuing:

```bash
node --version
npm --version
go version
psql --version
```

#### 1. Fork, clone, and create a branch

Fork the repository on GitHub, then run:

```bash
git clone https://github.com/<your-github-username>/neurosync.git
cd neurosync
git remote add upstream https://github.com/zsaghir/neurosync.git
git checkout -b feature/your-idea
```

#### 2. Install the app dependencies

From the repository root:

```bash
npm install
```

#### 3. Configure the Expo app

Copy the maintained template:

```bash
cp .env.example .env.local
```

Then fill in the credentials in `.env.local`. The relevant app variables are:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:8080
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_CLERK_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME=
EXPO_PUBLIC_SANITY_WRITE_TOKEN=
GOOGLE_GENERATIVE_AI_API_KEY=
```

Fill in the credentials supplied by the maintainer. The public Clerk key must belong to the same Clerk application as the server’s secret key.

The API address depends on where Expo runs:

| Target | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Web on the same computer | `http://localhost:8080` |
| iOS Simulator | `http://localhost:8080` |
| Android Emulator | `http://10.0.2.2:8080` |
| Physical phone | `http://<your-computer-LAN-IP>:8080` |

After changing `.env.local`, restart Expo so it loads the new values. A physical phone and development computer must be able to reach each other on the network.

If you use your own Sanity project instead of the shared development project, deploy the included schemas and replace the Sanity project ID and dataset in `lib/sanity/client.ts`, `sanity/sanity.config.ts`, and `sanity/sanity.cli.ts`.

#### 4. Create and migrate the local database

The migration files contain separate `Up` and `Down` sections, so run them with Goose rather than passing the SQL files directly to `psql`.

Install Goose, create the database, and apply every pending migration:

```bash
go install github.com/pressly/goose/v3/cmd/goose@v3.27.3
createdb neurosync
goose -dir server/migrations postgres "postgres://localhost/neurosync?sslmode=disable" up
```

If your PostgreSQL installation uses a different username, password, host, or port, update the connection URL accordingly.

#### 5. Configure and start the Go API

Copy the server template and add the Clerk secret:

```bash
cp server/.env.example server/.env.local
```

The resulting `server/.env.local` contains:

```dotenv
DATABASE_URL=postgres://localhost/neurosync?sslmode=disable
CLERK_SECRET_KEY=
```

In your first terminal, start the backend:

```bash
cd server
set -a
source .env.local
set +a
go run ./cmd/api
```

The API listens on port `8080`. In another terminal, confirm it is running:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

The responses should be `healthy` and `ready`.

#### 6. Start Expo

Keep the Go API running. Open a second terminal, return to the repository root, and run:

```bash
npm start
```

From the Expo prompt, press `w` for web, `i` for iOS Simulator, or `a` for Android Emulator. You can also start a platform directly:

```bash
npm run web
npm run ios
npm run android
```

Sign in, create a task, start a focus session, save it, and open the Time Map to confirm the main data flow works. Native Google sign-in may also require the correct redirect URLs in the Clerk and Google development applications.

#### 7. Optional: run Sanity Studio

You only need the Studio when working on transitional Sanity data or schemas:

```bash
cd sanity
npm install
npm run dev
```

### Common setup problems

- **Docker cannot connect to its engine** — open Docker Desktop and wait until it reports that Docker is running.
- **Port `5432`, `8080`, or `8081` is already in use** — change `POSTGRES_PORT`, `API_PORT`, or `EXPO_PORT` in `.env.local`.
- **The `migrate` service fails** — inspect it with `docker compose --env-file .env.local logs migrate`; the API will intentionally wait until migrations succeed.
- **“Missing Clerk publishable key”** — check the root `.env.local`, then restart Expo.
- **The app cannot load tasks** — confirm the Go API is running and that `EXPO_PUBLIC_API_URL` is reachable from your chosen device.
- **`401 Unauthorized`** — confirm the Expo publishable key and Go server secret key belong to the same Clerk application.
- **`ready` returns an error** — confirm PostgreSQL is running, the database exists, and `DATABASE_URL` is correct.
- **Task sessions or Time Map fail** — confirm the Sanity project, dataset, and development token are configured.
- **Web requests are blocked** — use Expo web at `http://localhost:8081`, which is the development origin currently allowed by the Go API.

## Check your changes

Before opening a pull request, run:

```bash
npm test
npm run lint
npx tsc --noEmit
cd server && go test ./...
```

If Go cannot write to its default build cache in a restricted environment, point `GOCACHE` to a writable temporary directory.

## How to contribute

1. Open or comment on an issue before a large change. Describe the experience you want to improve and your perspective; you do not need to arrive with a fully designed solution.
2. Fork the repository and create a focused branch.
3. Keep the change small enough to review and add tests for new behavior.
4. Test the platforms you touched and state exactly what you did—and did not—verify.
5. Open a pull request explaining the user problem, your approach, screenshots for UI changes, and any data or security impact.

For health-adjacent ideas such as medication tracking or crash prediction, include a short privacy and safety note in the proposal. These features should support personal reflection rather than offer medical advice, diagnosis, or certainty.

If you are unsure where to start, a native test pass, a performance trace, an accessibility audit, or one well-documented bug is a genuinely useful contribution.

## The kind of community we want

NeuroSync should be built *with* neurodivergent people, not merely for them. Lived experience is expertise, and different experiences may lead to entirely different ideas. Questions are welcome, experiments are encouraged, smaller contributions count, and feedback should be specific, kind, and free of shame.

If that sounds like a project you want to help shape, please open an issue, share an idea, or send a pull request.

## License

NeuroSync is available under the [Apache License 2.0](LICENSE). Third-party dependencies remain subject to their respective licenses.
