# NeuroSync Docker development

The Docker development stack includes Expo, the Go API, PostgreSQL, and a Goose migration runner. Clerk remains a hosted development service.

## Start

```bash
cp .env.example .env.local
```

Add the required development credentials to `.env.local`, start Docker Desktop, then run:

```bash
docker compose --env-file .env.local up --build
```

- Expo: [http://localhost:8081](http://localhost:8081)
- API health: [http://localhost:8080/health](http://localhost:8080/health)
- API readiness: [http://localhost:8080/ready](http://localhost:8080/ready)

## Stop

```bash
docker compose --env-file .env.local down
```

This keeps the PostgreSQL volume. Adding `--volumes` permanently deletes the local Docker database.

See the root [README.md](README.md#contributor-quick-start) for environment variables, logs, migrations, native-device networking, troubleshooting, and the non-Docker setup.
