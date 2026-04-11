/**
 * AutoRent - Utility Functions
 */

// ===== Форматирование =====
export function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  return new Date(date).toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== Валидация =====
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone) {
  const re = /^\+7\s?\(?\d{3}\)?\s?\d{3}-\d{2}-\d{2}$/;
  return re.test(phone);
}

export function validatePassword(password) {
  if (password.length < 8) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// ===== Работа с датами =====
export function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1;
}

export function calculateRentalPrice(days, pricePerDay, services = {}) {
  const servicePrices = {
    insurance: 1000,
    gps: 300,
    childseat: 500,
    additionalDriver: 500
  };
  
  let total = days * pricePerDay;
  
  Object.entries(services).forEach(([key, value]) => {
    if (value && servicePrices[key]) {
      total += days * servicePrices[key];
    }
  });
  
  return total;
}

// ===== URL Parameters =====
export function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

export function setUrlParam(param, value) {
  const url = new URL(window.location);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
}

// ===== LocalStorage =====
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
};

// ===== Уведомления =====
export function showNotification(type, message, title = '') {
  const container = document.getElementById('alertContainer') || createAlertContainer();
  
  const alert = document.createElement('div');
  alert.className = `alert alert--${type}`;
  alert.setAttribute('role', 'alert');
  alert.innerHTML = `
    <span class="alert__icon">${getAlertIcon(type)}</span>
    <span class="alert__message">
      ${title ? `<strong>${title}</strong><br>` : ''}
      ${message}
    </span>
    <button class="alert__close" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  container.appendChild(alert);
  
  // Auto-close after 5 seconds
  setTimeout(() => alert.remove(), 5000);
}

function createAlertContainer() {
  const container = document.createElement('div');
  container.id = 'alertContainer';
  container.className = 'alert-container';
  document.body.appendChild(container);
  return container;
}

function getAlertIcon(type) {
  const icons = {
    success: '\u2705',
    error: '\u274C',
    warning: '\u26A0',
    info: '\u2139'
  };
  return icons[type] || icons.info;
}

// ===== Loader =====
export function showLoader(elementId = 'pageLoader') {
  const loader = document.getElementById(elementId);
  if (loader) loader.style.display = 'flex';
}

export function hideLoader(elementId = 'pageLoader') {
  const loader = document.getElementById(elementId);
  if (loader) loader.style.display = 'none';
}

// ===== Аутентификация =====
export function isAuthenticated() {
  return !!localStorage.getItem('user_data');
}

export function getCurrentUser() {
  const user = localStorage.getItem('user_data');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user) {
  localStorage.setItem('user_data', JSON.stringify(user));
}

export function clearUserData() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_data');
}

// Экспорт
window.utils = {
  formatCurrency,
  formatDate,
  formatDateTime,
  validateEmail,
  validatePhone,
  validatePassword,
  calculateDays,
  calculateRentalPrice,
  getUrlParam,
  setUrlParam,
  storage,
  showNotification,
  showLoader,
  hideLoader,
  isAuthenticated,
  getCurrentUser,
  setCurrentUser,
  clearUserData
};

export default window.utils;
