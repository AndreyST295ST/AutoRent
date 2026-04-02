/**
 * AutoRent - Main JavaScript
 * Global UI helpers and header behavior.
 */

(function () {
  const APP_CONFIG = {
    API_BASE_URL:
      window.location.port === "5500"
        ? "http://localhost:8000/api/v1"
        : "/api/v1",
    TOKEN_KEY: "auth_token",
    USER_KEY: "user_data",
    DEBUG: false,
  };

  const Utils = {
    formatDate(date, options = {}) {
      const defaultOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
      return new Date(date).toLocaleDateString("ru-RU", { ...defaultOptions, ...options });
    },

    formatCurrency(amount) {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        minimumFractionDigits: 0,
      }).format(Number(amount || 0));
    },

    isAuthenticated() {
      return !!localStorage.getItem(APP_CONFIG.TOKEN_KEY);
    },

    getCurrentUser() {
      const user = localStorage.getItem(APP_CONFIG.USER_KEY);
      return user ? JSON.parse(user) : null;
    },

    setCurrentUser(user) {
      localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
    },

    setToken(token) {
      localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
    },

    clearUserData() {
      localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
      localStorage.removeItem(APP_CONFIG.USER_KEY);
    },

    showNotification(type, message, title = "") {
      const container =
        document.getElementById("alertContainer") || this._createAlertContainer();
      const alert = document.createElement("div");
      alert.className = `alert alert--${type}`;
      alert.setAttribute("role", "alert");
      alert.innerHTML = `
        <span class="alert__message">
          ${title ? `<strong>${title}</strong><br>` : ""}
          ${message}
        </span>
        <button class="alert__close" onclick="this.parentElement.remove()">&times;</button>
      `;
      container.appendChild(alert);
      setTimeout(() => alert.remove(), 5000);
    },

    _createAlertContainer() {
      const container = document.createElement("div");
      container.id = "alertContainer";
      container.className = "alert-container";
      document.body.appendChild(container);
      return container;
    },
  };

  class Header {
    constructor() {
      this.element = document.querySelector(".header");
      this.userMenu = document.getElementById("userMenu");
      this.mobileToggle = document.getElementById("mobileToggle");
      this.nav = document.getElementById("mainNav");
      this.init();
    }

    init() {
      if (!this.element) return;
      this.loadUser();
      this.attachEvents();
      this.updateActiveNav();
    }

    attachEvents() {
      if (this.mobileToggle && this.nav) {
        this.mobileToggle.addEventListener("click", () => {
          const isOpen = this.nav.classList.toggle("nav--open");
          this.mobileToggle.setAttribute("aria-expanded", String(isOpen));
          this.mobileToggle.textContent = isOpen ? "x" : "≡";
        });
      }
    }

    loadUser() {
      if (!this.userMenu) return;
      const user = Utils.getCurrentUser();
      if (user && Utils.isAuthenticated()) {
        this.renderUser(user);
      } else {
        this.renderGuest();
      }
    }

    renderGuest() {
      this.userMenu.innerHTML = `
        <div class="auth-buttons">
          <a href="/pages/Login.html" class="btn btn--outline btn--sm">Войти</a>
          <a href="/pages/Register.html" class="btn btn--primary btn--sm">Регистрация</a>
        </div>
      `;
    }

    renderUser(user) {
      const name = user.first_name || user.firstName || user.email;
      const isAdmin = user.role === "admin" || user.role === "employee";
      this.userMenu.innerHTML = `
        <div class="user-info">
          <span class="user-name">${name}</span>
          <button class="btn btn--outline btn--sm" id="logoutBtn">Выйти</button>
        </div>
      `;

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          Utils.clearUserData();
          window.location.href = "/pages/Login.html";
        });
      }

      if (isAdmin) {
        const adminLink = document.querySelector(".nav__link--admin");
        if (adminLink) adminLink.style.display = "block";
      }
    }

    updateActiveNav() {
      const currentPath = window.location.pathname;
      document.querySelectorAll(".nav__link").forEach((link) => {
        const href = link.getAttribute("href");
        if (href && currentPath.includes(href.split("/").pop())) {
          link.classList.add("nav__link--active");
        } else {
          link.classList.remove("nav__link--active");
        }
      });
    }
  }

  function initAlerts() {
    document.querySelectorAll(".alert__close").forEach((btn) => {
      btn.addEventListener("click", function () {
        const alert = this.closest(".alert");
        if (alert) alert.remove();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    new Header();
    const yearElement = document.getElementById("currentYear");
    if (yearElement) {
      yearElement.textContent = String(new Date().getFullYear());
    }
    initAlerts();
  });

  window.APP_CONFIG = APP_CONFIG;
  window.Utils = Utils;
  window.showAlert = function (type, message, title) {
    Utils.showNotification(type, message, title || "");
  };
})();
