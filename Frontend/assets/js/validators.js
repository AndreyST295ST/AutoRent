/**
 * AutoRent - Form Validators
 * Validation functions for all forms in the application
 */

import { validateEmail, validatePhone, validatePassword } from './utils.js';

/**
 * Validation rules
 */
export const validationRules = {
  email: {
    required: true,
    validator: validateEmail,
    message: 'Введите корректный email адрес'
  },
  phone: {
    required: true,
    validator: validatePhone,
    message: 'Введите номер в формате +7 (XXX) XXX-XX-XX'
  },
  password: {
    required: true,
    minLength: 8,
    validator: validatePassword,
    message: 'Пароль должен содержать минимум 8 символов, буквы и цифры'
  },
  firstName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Имя должно содержать от 2 до 50 символов'
  },
  lastName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Фамилия должна содержать от 2 до 50 символов'
  },
  date: {
    required: true,
    validator: (value) => !isNaN(new Date(value).getTime()),
    message: 'Введите корректную дату'
  }
};

/**
 * Form Validator Class
 */
export class FormValidator {
  constructor(formElement, rules = {}) {
    this.form = formElement;
    this.rules = rules;
    this.errors = {};
    this.init();
  }

  init() {
    if (!this.form) return;
    
    this.attachEvents();
  }

  attachEvents() {
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('blur', (e) => {
        this.validateField(e.target);
      });
      
      input.addEventListener('input', (e) => {
        this.clearError(e.target);
      });
    });

    this.form.addEventListener('submit', (e) => {
      if (!this.validate()) {
        e.preventDefault();
      }
    });
  }

  validateField(field) {
    const name = field.name || field.id;
    const value = field.value.trim();
    const rule = this.rules[name];

    if (!rule) return true;

    // Check required
    if (rule.required && !value) {
      this.showError(field, rule.message || 'Это поле обязательно для заполнения');
      return false;
    }

    // Skip validation if empty and not required
    if (!value && !rule.required) {
      this.clearError(field);
      return true;
    }

    // Check min length
    if (rule.minLength && value.length < rule.minLength) {
      this.showError(field, `Минимум ${rule.minLength} символов`);
      return false;
    }

    // Check max length
    if (rule.maxLength && value.length > rule.maxLength) {
      this.showError(field, `Максимум ${rule.maxLength} символов`);
      return false;
    }

    // Custom validator
    if (rule.validator && typeof rule.validator === 'function') {
      const result = rule.validator(value);
      
      if (typeof result === 'boolean' && !result) {
        this.showError(field, rule.message);
        return false;
      }
      
      if (typeof result === 'object' && !result.isValid) {
        this.showError(field, result.errors.join(', '));
        return false;
      }
    }

    this.clearError(field);
    return true;
  }

  validate() {
    this.errors = {};
    let isValid = true;

    const fields = this.form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  }

  showError(field, message) {
    const name = field.name || field.id;
    this.errors[name] = message;

    // Add error class to field
    field.classList.add('input--error');
    field.setAttribute('aria-invalid', 'true');

    // Find or create error element
    let errorEl = field.parentNode.querySelector('.error');
    
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'error';
      errorEl.setAttribute('role', 'alert');
      errorEl.id = `${name}Error`;
      field.parentNode.appendChild(errorEl);
    }

    errorEl.textContent = message;
    field.setAttribute('aria-describedby', errorEl.id);
  }

  clearError(field) {
    const name = field.name || field.id;
    delete this.errors[name];

    field.classList.remove('input--error');
    field.setAttribute('aria-invalid', 'false');

    const errorEl = field.parentNode.querySelector('.error');
    if (errorEl) {
      errorEl.textContent = '';
    }
  }

  clearAllErrors() {
    this.errors = {};
    const errorEls = this.form.querySelectorAll('.error');
    const inputs = this.form.querySelectorAll('.input--error');

    errorEls.forEach(el => el.textContent = '');
    inputs.forEach(input => {
      input.classList.remove('input--error');
      input.setAttribute('aria-invalid', 'false');
    });
  }

  getErrors() {
    return this.errors;
  }

  hasErrors() {
    return Object.keys(this.errors).length > 0;
  }
}

/**
 * Login Form Validator
 */
export class LoginValidator extends FormValidator {
  constructor(formElement) {
    super(formElement, {
      email: validationRules.email,
      password: validationRules.password
    });
  }
}

/**
 * Register Form Validator
 */
export class RegisterValidator extends FormValidator {
  constructor(formElement) {
    super(formElement, {
      firstName: validationRules.firstName,
      lastName: validationRules.lastName,
      email: validationRules.email,
      phone: validationRules.phone,
      password: validationRules.password,
      confirmPassword: {
        required: true,
        validator: (value) => {
          const password = formElement.querySelector('#password')?.value;
          return value === password;
        },
        message: 'Пароли не совпадают'
      }
    });
  }
}

/**
 * Booking Form Validator
 */
export class BookingValidator extends FormValidator {
  constructor(formElement) {
    super(formElement, {
      startDate: validationRules.date,
      endDate: validationRules.date,
      terms: {
        required: true,
        validator: (value) => value === true,
        message: 'Необходимо принять условия аренды'
      }
    });
  }

  validateField(field) {
    const result = super.validateField(field);
    
    // Additional validation for dates
    if (field.id === 'startDate' || field.id === 'endDate') {
      this.validateDates();
    }
    
    return result;
  }

  validateDates() {
    const startDate = this.form.querySelector('#startDate');
    const endDate = this.form.querySelector('#endDate');
    
    if (!startDate || !endDate) return true;
    
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    
    if (start && end && end <= start) {
      this.showError(endDate, 'Дата окончания должна быть позже даты начала');
      return false;
    }
    
    this.clearError(endDate);
    return true;
  }
}

/**
 * Profile Form Validator
 */
export class ProfileValidator extends FormValidator {
  constructor(formElement) {
    super(formElement, {
      firstName: validationRules.firstName,
      lastName: validationRules.lastName,
      email: validationRules.email,
      phone: validationRules.phone
    });
  }
}

/**
 * Document Upload Validator
 */
export class DocumentValidator extends FormValidator {
  constructor(formElement) {
    super(formElement, {
      passport: {
        required: true,
        validator: (file) => {
          if (!file) return false;
          const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
          const maxSize = 5 * 1024 * 1024; // 5MB
          return validTypes.includes(file.type) && file.size <= maxSize;
        },
        message: 'Загрузите файл (JPG, PNG, PDF) размером до 5MB'
      },
      license: {
        required: true,
        validator: (file) => {
          if (!file) return false;
          const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
          const maxSize = 5 * 1024 * 1024; // 5MB
          return validTypes.includes(file.type) && file.size <= maxSize;
        },
        message: 'Загрузите файл (JPG, PNG, PDF) размером до 5MB'
      }
    });
  }
}

// Export default validators
export default {
  FormValidator,
  LoginValidator,
  RegisterValidator,
  BookingValidator,
  ProfileValidator,
  DocumentValidator,
  validationRules
};