/**
 * AutoRent - API client (global build).
 */

(function () {
  const config = window.APP_CONFIG || {
    API_BASE_URL:
      window.location.port === "5500"
        ? "http://localhost:8000/api/v1"
        : "/api/v1",
    TOKEN_KEY: "auth_token",
    USER_KEY: "user_data",
    STATUS: { UNAUTHORIZED: 401 },
  };

  class ApiClient {
    constructor() {
      this.baseURL = config.API_BASE_URL;
      this.token = null;
      this.csrfHeaderName = config.CSRF_HEADER_NAME || "X-CSRF-Token";
    }

    getToken() {
      return this.token;
    }

    setToken(token) {
      this.token = token || null;
    }

    clearToken() {
      this.token = null;
      localStorage.removeItem(config.TOKEN_KEY || "auth_token");
      localStorage.removeItem(config.USER_KEY || "user_data");
    }

    getCookie(name) {
      const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1");
      const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    }

    getHeaders(customHeaders = {}, method = "GET") {
      const headers = {
        Accept: "application/json",
        ...customHeaders,
      };

      if (!("Content-Type" in headers)) {
        headers["Content-Type"] = "application/json";
      }

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const unsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase());
      if (unsafeMethod && !headers[this.csrfHeaderName]) {
        const csrfToken = this.getCookie(config.CSRF_COOKIE_NAME || "csrf_token");
        if (csrfToken) {
          headers[this.csrfHeaderName] = csrfToken;
        }
      }

      return headers;
    }

    async handleResponse(response) {
      if (!response.ok) {
        let error = { detail: `\u041e\u0448\u0438\u0431\u043a\u0430 HTTP ${response.status}` };
        try {
          error = await response.json();
        } catch (e) {
          // ignore JSON parse errors
        }

        if (response.status === (config.STATUS?.UNAUTHORIZED || 401)) {
          this.clearToken();
        }

        throw new Error(this.formatErrorMessage(error, response.status));
      }

      if (response.status === 204) return null;
      return response.json();
    }

    formatErrorMessage(error, statusCode) {
      const fallback = `\u041e\u0448\u0438\u0431\u043a\u0430 HTTP ${statusCode}`;
      if (!error || error.detail === undefined || error.detail === null) {
        return fallback;
      }

      if (typeof error.detail === "string") {
        return error.detail;
      }

      if (Array.isArray(error.detail)) {
        const parts = error.detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (!item || typeof item !== "object") return "";
            const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
            const fieldName = field && field !== "body" ? `${this.translateFieldName(field)}: ` : "";
            return `${fieldName}${this.translateValidationMessage(item.msg || "")}`.trim();
          })
          .filter(Boolean);
        return parts.length ? parts.join("; ") : fallback;
      }

      return fallback;
    }

    translateFieldName(field) {
      const map = {
        email: "\u042d\u043b. \u043f\u043e\u0447\u0442\u0430",
        password: "\u041f\u0430\u0440\u043e\u043b\u044c",
        first_name: "\u0418\u043c\u044f",
        last_name: "\u0424\u0430\u043c\u0438\u043b\u0438\u044f",
        phone: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
        start_date: "\u0414\u0430\u0442\u0430 \u043d\u0430\u0447\u0430\u043b\u0430",
        end_date: "\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f",
        car_id: "\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c",
        status: "\u0421\u0442\u0430\u0442\u0443\u0441",
      };
      return map[field] || field;
    }

    translateValidationMessage(message) {
      const map = {
        "Field required": "\u041f\u043e\u043b\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e",
        "Input should be a valid string": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0441\u0442\u0440\u043e\u043a\u0443",
        "Input should be a valid integer": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0435 \u0446\u0435\u043b\u043e\u0435 \u0447\u0438\u0441\u043b\u043e",
        "Input should be a valid number": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0435 \u0447\u0438\u0441\u043b\u043e",
        "Input should be a valid boolean": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0434\u0430/\u043d\u0435\u0442",
        "Input should be a valid date": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0434\u0430\u0442\u0443",
        "Input should be a valid datetime": "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0434\u0430\u0442\u0443 \u0438 \u0432\u0440\u0435\u043c\u044f",
        "String should have at least 1 character": "\u041f\u043e\u043b\u0435 \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c",
      };
      return map[message] || message;
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const method = options.method || "GET";
      let response;
      try {
        response = await fetch(url, {
          ...options,
          credentials: "include",
          headers: this.getHeaders(options.headers || {}, method),
        });
      } catch (error) {
        const message = String(error?.message || "");
        if (
          message.includes("Failed to fetch") ||
          message.includes("NetworkError") ||
          message.includes("Load failed")
        ) {
          throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u043a \u0441\u0435\u0440\u0432\u0435\u0440\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.");
        }
        throw new Error("\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0435\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.");
      }
      return this.handleResponse(response);
    }

    withQuery(endpoint, params = {}) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          search.append(key, String(value));
        }
      });
      const query = search.toString();
      return query ? `${endpoint}?${query}` : endpoint;
    }

    get(endpoint, params = {}) {
      return this.request(this.withQuery(endpoint, params), { method: "GET" });
    }

    post(endpoint, data = {}) {
      return this.request(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
      });
    }

    put(endpoint, data = {}) {
      return this.request(endpoint, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    }

    patch(endpoint, data = {}) {
      return this.request(endpoint, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    }

    delete(endpoint) {
      return this.request(endpoint, { method: "DELETE" });
    }

    async upload(endpoint, formData) {
      const headers = this.getHeaders({}, "POST");
      delete headers["Content-Type"];
      let response;
      try {
        response = await fetch(`${this.baseURL}${endpoint}`, {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        });
      } catch (error) {
        const message = String(error?.message || "");
        if (
          message.includes("Failed to fetch") ||
          message.includes("NetworkError") ||
          message.includes("Load failed")
        ) {
          throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u043a \u0441\u0435\u0440\u0432\u0435\u0440\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.");
        }
        throw new Error("\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0435\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.");
      }
      return this.handleResponse(response);
    }
  }

  const api = new ApiClient();

  const authAPI = {
    register: (data) => api.post("/auth/register", data),
    login: (data) => api.post("/auth/login", data),
    activate: (token) => api.get("/auth/activate", { token }),
    resendActivation: (email) => api.post("/auth/resend-activation", { email }),
    logout: () => api.post("/auth/logout"),
    me: () => api.get("/auth/me"),
    updateProfile: (data) => api.put("/auth/profile", data),
    changePassword: (data) => api.post("/auth/change-password", data),
  };

  const carsAPI = {
    getAll: (params) => api.get("/cars/", params),
    getById: (id) => api.get(`/cars/${id}`),
    getAvailable: (startDate, endDate) =>
      api.get("/cars/available", { start_date: startDate, end_date: endDate }),
    create: (data) => api.post("/cars/", data),
    update: (id, data) => api.put(`/cars/${id}`, data),
    uploadPhotos: (id, files) => {
      const formData = new FormData();
      Array.from(files || []).forEach((file) => formData.append("photos", file));
      return api.upload(`/cars/${id}/photos`, formData);
    },
    delete: (id) => api.delete(`/cars/${id}`),
    updateStatus: (id, status) => api.patch(`/cars/${id}/status`, { status }),
  };

  const bookingsAPI = {
    getAll: (params) => api.get("/bookings/", params),
    getById: (id) => api.get(`/bookings/${id}`),
    create: (data) => api.post("/bookings/", data),
    cancel: (id) => api.post(`/bookings/${id}/cancel`),
    confirm: (id) => api.post(`/bookings/${id}/confirm`),
    reject: (id) => api.post(`/bookings/${id}/reject`),
    pickup: (id, data) => api.post(`/bookings/${id}/pickup`, data),
    return: (id, data) => api.post(`/bookings/${id}/return`, data),
    generateDocuments: (id) => api.post(`/bookings/${id}/generate-documents`),
    getMy: () => api.get("/bookings/my"),
  };

  const documentsAPI = {
    getMy: () => api.get("/documents/my"),
    getQueue: () => api.get("/documents/queue"),
    getClient: (clientId) => api.get(`/documents/client/${clientId}`),
    upload: (formData) => api.upload("/documents/upload", formData),
    getRental: (bookingId) => api.get(`/documents/rental/${bookingId}`),
    verify: (clientId, data) => api.post(`/documents/${clientId}/verify`, data),
  };

  const usersAPI = {
    getAll: () => api.get("/users/"),
    getById: (id) => api.get(`/users/${id}`),
    update: (id, data) => api.put(`/users/${id}`, data),
    updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  };

  window.api = api;
  window.authAPI = authAPI;
  window.carsAPI = carsAPI;
  window.bookingsAPI = bookingsAPI;
  window.documentsAPI = documentsAPI;
  window.usersAPI = usersAPI;
})();

