# AutoRent: docs -> implementation

## Scope
Matrix based on diagrams in `docs/Диаграммы` and current code state.

## Functional coverage
| Requirement from docs | Status | Implementation |
|---|---|---|
| User registration with inactive status | Done | `POST /api/v1/auth/register` -> creates `User`, `Client`, `ActivationToken` |
| Account activation by token (24h) | Done | `GET /api/v1/auth/activate?token=...`, token expiration in `Settings.ACTIVATION_TOKEN_EXPIRE_HOURS` |
| Login and JWT auth | Done | `POST /api/v1/auth/login` returns access token + user |
| Profile data management | Partial | `PUT /api/v1/users/{id}` + frontend profile page |
| Car catalog | Done | `GET /api/v1/cars/`, `GET /api/v1/cars/{id}` |
| Car availability check by dates | Done | `GET /api/v1/cars/available?start_date&end_date` |
| Booking creation with overlap check | Done | `POST /api/v1/bookings/` + overlap validation in `BookingService` |
| Booking lifecycle statuses | Done | `cancel/confirm/reject/pickup/return` endpoints |
| Rental document generation | Done (stub paths) | `POST /api/v1/bookings/{id}/generate-documents` |
| Client document upload | Done | `POST /api/v1/documents/upload` |
| Client document verification | Done | `POST /api/v1/documents/{client_id}/verify` |
| My bookings view | Done | `GET /api/v1/bookings/my` + frontend `MyBookings.html` |
| Admin basic operations (bookings/cars/users) | Partial | CRUD/status endpoints exist, UI scripts wired |
| Notifications (email/SMS workflows) | Partial | Endpoint flow and UI placeholders; no real mail/SMS dispatch yet |
| Payments / gateway integration | Not implemented | No payment models/services/routes |
| Reviews | Done | `Review` model + `GET/POST/PUT/DELETE /api/v1/reviews` |

## Architecture coverage
| Diagram intent | Status | Notes |
|---|---|---|
| Client UI + App server + PostgreSQL | Done | `Frontend` + `Backend` + `db` in Docker Compose |
| External SMTP | Partial | SMTP settings present, actual send flow not implemented |
| Document service / generation module | Partial | Generation endpoint stores file paths; no PDF rendering yet |
| Fleet manager / booking manager / auth manager | Done (monolith modules) | Implemented as services inside single FastAPI app |

## Known simplifications
- RBAC implemented via FastAPI dependencies for key sensitive routes (`cars`, `bookings`, `users`, `documents`).
- Booking document verification pre-check at booking time is simplified.
- Generated document files are stub paths, not actual PDFs.
- Notifications are UI/API-level, without production email/SMS queueing.
