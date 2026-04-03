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
        let error = { detail: `HTTP ${response.status}` };
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
      const fallback = `HTTP ${statusCode}`;
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
            const fieldName = field && field !== "body" ? `${field}: ` : "";
            return `${fieldName}${item.msg || ""}`.trim();
          })
          .filter(Boolean);
        return parts.length ? parts.join("; ") : fallback;
      }

      return fallback;
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const method = options.method || "GET";
      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: this.getHeaders(options.headers || {}, method),
      });
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
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });
      return this.handleResponse(response);
    }
  }

  const api = new ApiClient();

  const authAPI = {
    register: (data) => api.post("/auth/register", data),
    login: (data) => api.post("/auth/login", data),
    activate: (token) => api.get("/auth/activate", { token }),
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
