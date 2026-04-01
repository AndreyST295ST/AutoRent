# AutoRent

Full-stack car rental project:
- `Backend`: FastAPI + PostgreSQL + Alembic
- `Frontend`: static pages served by Nginx
- Docker Compose for local run

## Quick Start

1. Copy env file:
```bash
cp .env.example .env
```

2. Start project:
```bash
docker compose up -d --build
```

3. Open:
- Frontend: `http://localhost:${FRONTEND_PORT}`
- Backend API: `http://localhost:${BACKEND_PORT}/docs`

## Git Workflow

### Create repository locally
```bash
git init
git branch -M main
git add .
git commit -m "chore: initial project import"
```

### Connect GitHub and push
```bash
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

### Daily work
```bash
git checkout -b feature/<short-name>
git add .
git commit -m "feat: <what changed>"
git push -u origin feature/<short-name>
```

### Roll back to previous version

View history:
```bash
git log --oneline --graph --decorate
```

Safe rollback with commit (recommended):
```bash
git revert <COMMIT_HASH>
git push
```

Hard reset (use only if you understand consequences):
```bash
git reset --hard <COMMIT_HASH>
git push --force
```

### Mark stable versions
```bash
git tag -a v0.1.0 -m "Stable v0.1.0"
git push origin v0.1.0
```

## Security Note

Do not commit real secrets from `.env`.
If secrets were exposed before, rotate them (DB password, SMTP password, JWT secret).
