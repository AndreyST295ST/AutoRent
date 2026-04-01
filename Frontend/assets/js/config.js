/**
 * AutoRent - optional config shim for global scripts.
 */

window.APP_CONFIG = window.APP_CONFIG || {
  API_BASE_URL:
    window.location.port === "5500" || window.location.port === "3000"
      ? "http://localhost:8000/api/v1"
      : "/api/v1",
  STORAGE_KEYS: {
    AUTH_TOKEN: "auth_token",
    USER_DATA: "user_data",
    BOOKING_DRAFT: "booking_draft",
  },
  STATUS: {
    SUCCESS: [200, 201, 204],
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVER_ERROR: 500,
  },
};
