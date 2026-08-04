# NeuroSync

**An open, ADHD-friendly task and time-awareness app—and an invitation to help build it.**

NeuroSync is an early-stage Expo app (currently branded `clarity.journal` in the app configuration) exploring how technology might adapt to an individual ADHD brain instead of asking every person to adapt to the same productivity system.

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
- There is not yet a committed open-source license. Please discuss licensing with the maintainer before assuming reuse rights beyond contributing to this repository.

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

## Run the project locally

### Prerequisites

- Node.js 22 and npm
- Go 1.26.5 or a compatible version
- PostgreSQL
- A Clerk application
- Access to the NeuroSync Sanity project, or your own Sanity project with the included schemas
- A Google AI API key only if working on AI-generated subtasks

### 1. Install the app

```bash
npm install
```

Create `.env.local` and provide the values needed for the part of the project you are running:

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

Never commit credentials. Ask the maintainer for development access, or point the hard-coded Sanity project configuration at your own project. For a physical phone, replace `localhost` with an API host the phone can reach.

### 2. Start the backend

Create a PostgreSQL database and apply `server/migrations/00001_initial_schema.sql`. Then set the server-only environment variables:

```dotenv
DATABASE_URL=postgres://...
CLERK_SECRET_KEY=...
```

Start the API from the server directory:

```bash
cd server
go run ./cmd/api
```

The API listens on port `8080` and exposes `/health` and `/ready` checks.

### 3. Start Expo

In another terminal, from the repository root:

```bash
npm start
```

You can also use:

```bash
npm run web
npm run ios
npm run android
```

Native commands require the appropriate local Apple or Android toolchain. Device networking and OAuth redirects may need platform-specific configuration.

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
