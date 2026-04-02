# AutoRent

AutoRent — веб-приложение для аренды автомобилей.

## Что реализовано
- Регистрация, активация и вход пользователей.
- Вход администратора (`admin/admin`).
- Каталог автомобилей и бронирования.
- Админ-панель: автомобили, пользователи, заявки, документы.
- Загрузка нескольких фото автомобиля из админки.

## Стек
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL.
- Frontend: HTML/CSS/JS + Nginx.
- Запуск: Docker Compose.

## Быстрый запуск
1. Подготовить `.env` (если его нет):
```bash
cp .env.example .env
```
PowerShell:
```powershell
Copy-Item .env.example .env
```

2. Запустить сервисы:
```bash
docker compose up -d --build
```

3. Проверить статус:
```bash
docker compose ps
```

## Адреса
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8001`
- Swagger: `http://localhost:8001/docs`
- Health: `http://localhost:8001/health`

## Демо-доступ
- Администратор:
  - Логин: `admin`
  - Пароль: `admin`

## Как проверить перед показом
1. Войти как админ на `http://localhost:3000/pages/Login.html`.
2. Открыть `http://localhost:3000/pages/Admin.html`.
3. Добавить автомобиль и загрузить фото.
4. Зарегистрировать нового пользователя через `http://localhost:3000/pages/Register.html` и войти им.

## Полезные команды
Логи:
```bash
docker compose logs -f
```

Перезапуск:
```bash
docker compose up -d --build
```

Остановка:
```bash
docker compose down
```
