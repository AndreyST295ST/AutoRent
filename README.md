# AutoRent

Веб-приложение для аренды автомобилей с личным кабинетом клиента и административной панелью.

## Что реализовано

- Каталог автомобилей и просмотр доступных машин.
- Регистрация, активация аккаунта, вход по JWT.
- Создание и управление бронированиями.
- Загрузка и верификация документов клиента.
- Генерация пакета документов аренды (договор, акт, доверенность в PDF).
- Админ-панель для работы с автопарком, бронированиями, документами и пользователями.
- REST API на FastAPI и статический frontend через Nginx.

## Стек

- Backend: `FastAPI`, `SQLAlchemy (async)`, `PostgreSQL`, `Pydantic`, `WeasyPrint`, `Jinja2`.
- Frontend: HTML/CSS/JS (без сборщика), работа через REST.
- Инфраструктура: Docker Compose (`backend` + `frontend` + `db`, опционально `pgadmin`).

## Архитектура

- `frontend` отдает страницы и проксирует `/api/*` и `/uploads/*` в `backend` через Nginx.
- `backend` работает как REST API (`/api/v1/*`) и хранит сканы/сгенерированные документы в `uploads/`.
- `db` — PostgreSQL 15.

## Структура проекта

- `Backend/app` — FastAPI-приложение, роуты и сервисы.
- `Backend/models` — SQLAlchemy-модели (`User`, `Client`, `Car`, `Booking`, `ClientDocument`, `RentalDocument`, `Review`).
- `Backend/schemas` — Pydantic-схемы запросов/ответов.
- `Backend/app/templates/documents` — HTML-шаблоны PDF-документов.
- `Frontend/pages` — страницы интерфейса.
- `Frontend/assets/js` — клиентская логика и API-клиент.
- `docker/nginx/nginx.conf` — конфигурация Nginx (прокси API/uploads).
- `docker/postgres/init.sql` — начальная инициализация БД.
- `docs` — материалы анализа и проектирования.

## Быстрый запуск (рекомендуется)

1. Подготовить переменные окружения:
```bash
cp .env.example .env
```
Для PowerShell:
```powershell
Copy-Item .env.example .env
```

2. Запустить контейнеры:
```bash
docker compose up -d --build
```

3. Проверить, что сервисы поднялись:
```bash
docker compose ps
```

4. Проверить backend health:
```bash
curl http://localhost:8000/health
```
Если в `.env` указан `BACKEND_PORT=8001`, используй:
```bash
curl http://localhost:8001/health
```

## Доступ к сервисам

- Frontend: `http://localhost:${FRONTEND_PORT}` (по умолчанию часто `3000` в вашем `.env`).
- Backend OpenAPI: `http://localhost:${BACKEND_PORT}/docs`.
- Backend health: `http://localhost:${BACKEND_PORT}/health`.
- pgAdmin (опционально): `http://localhost:5050` (если включен профиль `dev`).

## Роли и доступ

- `client` — бронирование, документы, профиль, отзывы.
- `employee` — обработка бронирований, работа с документами и автопарком.
- `admin` — все права `employee` + управление пользователями.

Важно: вход в админ-панель (`/pages/Admin.html`) доступен только ролям `admin` и `employee`.

## Как получить доступ в админ-панель

1. Зарегистрировать пользователя через `/pages/Register.html`.
2. Активировать и назначить роль в БД:
```bash
docker compose exec db psql -U autorent_user -d autorent -c "UPDATE users SET role='admin', status='active' WHERE email='your@email.com';"
```
3. Войти через `/pages/Login.html` этим пользователем.

## Основные REST-маршруты

- Auth: `/api/v1/auth/*` (`register`, `login`, `activate`, `me`).
- Cars: `/api/v1/cars/*` (получение, создание, редактирование, статус, удаление).
- Bookings: `/api/v1/bookings/*` (создание, подтверждение, выдача, возврат, генерация документов).
- Documents: `/api/v1/documents/*` (загрузка, очередь проверки, карточка клиента, верификация, rental docs).
- Users: `/api/v1/users/*` (управление пользователями).
- Reviews: `/api/v1/reviews/*`.

## Особенности текущей реализации

- Таблицы БД создаются при старте backend через `Base.metadata.create_all`.
- Папка `Backend/migrations` пока не содержит набора миграций (Alembic как полноценный workflow еще не доведен).
- Документы аренды генерируются в `uploads/contracts`, `uploads/acts`, `uploads/power_of_attorney`.

## Запуск backend локально без Docker (опционально)

1. Перейти в `Backend`.
2. Создать виртуальное окружение и установить зависимости:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
3. Запустить API:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Контроль версий (Git) и публикация в GitHub

Локальный репозиторий уже инициализирован. Для публикации:

1. Создать пустой репозиторий на GitHub.
2. Привязать remote и отправить `main`:
```bash
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

Ежедневный процесс:
```bash
git checkout -b feature/<short-name>
git add .
git commit -m "feat: <описание>"
git push -u origin feature/<short-name>
```

Откат к предыдущей версии:

- Посмотреть историю:
```bash
git log --oneline --graph --decorate
```
- Безопасный откат:
```bash
git revert <COMMIT_HASH>
git push
```
- Жесткий откат (осторожно):
```bash
git reset --hard <COMMIT_HASH>
git push --force
```

## Полезные команды диагностики

- Логи всех сервисов:
```bash
docker compose logs -f
```
- Логи конкретного сервиса:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```
- Пересборка с нуля:
```bash
docker compose down
docker compose up -d --build
```

## Безопасность

- Не коммитьте реальные секреты в `.env`.
- Если секреты уже использовались в открытом виде, обязательно ротируйте:
  `SECRET_KEY`, SMTP пароли, пароли БД.
