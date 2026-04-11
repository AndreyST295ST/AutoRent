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
    CSRF_COOKIE_NAME: "csrf_token",
    CSRF_HEADER_NAME: "X-CSRF-Token",
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

    getTransmissionLabel(value) {
      const labels = {
        automatic: "\u0410\u0432\u0442\u043e\u043c\u0430\u0442",
        manual: "\u041c\u0435\u0445\u0430\u043d\u0438\u043a\u0430",
        cvt: "\u0412\u0430\u0440\u0438\u0430\u0442\u043e\u0440",
        robot: "\u0420\u043e\u0431\u043e\u0442",
      };
      return labels[value] || value || "-";
    },

    getFuelLabel(value) {
      const labels = {
        petrol: "\u0411\u0435\u043d\u0437\u0438\u043d",
        diesel: "\u0414\u0438\u0437\u0435\u043b\u044c",
        electric: "\u042d\u043b\u0435\u043a\u0442\u0440\u043e",
        hybrid: "\u0413\u0438\u0431\u0440\u0438\u0434",
        gas: "\u0413\u0430\u0437",
      };
      return labels[value] || value || "-";
    },

    getCarStatusLabel(value) {
      const labels = {
        free: "\u0421\u0432\u043e\u0431\u043e\u0434\u0435\u043d",
        rented: "\u0412 \u0430\u0440\u0435\u043d\u0434\u0435",
        maintenance: "\u041d\u0430 \u043e\u0431\u0441\u043b\u0443\u0436\u0438\u0432\u0430\u043d\u0438\u0438",
        retired: "\u0421\u043f\u0438\u0441\u0430\u043d",
      };
      return labels[value] || value || "-";
    },

    getDocumentStatusLabel(value) {
      const labels = {
        pending: "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
        verified: "\u041f\u0440\u043e\u0432\u0435\u0440\u0435\u043d\u043e",
        rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e",
        not_uploaded: "\u041d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b",
      };
      return labels[value] || value || "-";
    },

    isAuthenticated() {
      return !!localStorage.getItem(APP_CONFIG.USER_KEY);
    },

    getCurrentUser() {
      const user = localStorage.getItem(APP_CONFIG.USER_KEY);
      return user ? JSON.parse(user) : null;
    },

    setCurrentUser(user) {
      localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
    },

    setToken(token) {
      if (!token) {
        localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
        return;
      }
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
      this.ensureMobileToggle();
      this.loadUser();
      this.attachEvents();
      this.updateActiveNav();
    }

    ensureMobileToggle() {
      if (!this.nav || this.mobileToggle) return;
      const container = this.element.querySelector(".header__container");
      if (!container) return;

      if (!this.nav.id) {
        this.nav.id = "mainNav";
      }

      const button = document.createElement("button");
      button.className = "btn btn--icon mobile-toggle";
      button.id = "mobileToggleAuto";
      button.type = "button";
      button.setAttribute("aria-label", "Меню");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", this.nav.id);
      button.textContent = "\u2630";

      container.appendChild(button);
      this.mobileToggle = button;
    }

    closeMobileNav() {
      if (!this.nav || !this.mobileToggle) return;
      this.element?.classList.remove("header--mobile-open");
      this.nav.classList.remove("nav--open");
      this.mobileToggle.setAttribute("aria-expanded", "false");
      this.mobileToggle.textContent = "\u2630";
    }

    attachEvents() {
      if (this.mobileToggle && this.nav) {
        this.mobileToggle.addEventListener("click", () => {
          const isOpen = this.element?.classList.toggle("header--mobile-open");
          this.nav.classList.toggle("nav--open", Boolean(isOpen));
          this.mobileToggle.setAttribute("aria-expanded", String(isOpen));
          this.mobileToggle.textContent = isOpen ? "\u2715" : "\u2630";
        });

        this.nav.querySelectorAll("a").forEach((link) => {
          link.addEventListener("click", () => this.closeMobileNav());
        });

        window.addEventListener("resize", () => {
          if (window.innerWidth >= 768) this.closeMobileNav();
        });
      }
    }

    loadUser() {
      if (!this.userMenu) return;
      const user = Utils.getCurrentUser();
      if (user && Utils.isAuthenticated()) {
        this.renderUser(user);
      } else {
        this.restoreSessionFromCookie();
      }
    }

    async restoreSessionFromCookie() {
      if (!window.authAPI?.me) {
        this.renderGuest();
        return;
      }
      try {
        const user = await window.authAPI.me();
        Utils.setCurrentUser(user);
        this.renderUser(user);
      } catch (_) {
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
        logoutBtn.addEventListener("click", async () => {
          try {
            if (window.authAPI?.logout) {
              await window.authAPI.logout();
            }
          } catch (_) {
            // ignore network errors during logout cleanup
          } finally {
            Utils.clearUserData();
            window.location.href = "/pages/Login.html";
          }
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
