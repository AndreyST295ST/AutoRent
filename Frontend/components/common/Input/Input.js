/**
 * Input Component
 * @param {Object} props - Свойства input
 */
class Input {
  constructor(props = {}) {
    this.props = {
      id: '',
      name: '',
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      disabled: false,
      readonly: false,
      value: '',
      minLength: null,
      maxLength: null,
      pattern: null,
      hint: '',
      error: '',
      onChange: null,
      onBlur: null,
      ...props
    };
    
    this.element = null;
    this.groupElement = null;
    this.errorElement = null;
    this.init();
  }

  init() {
    this.groupElement = document.createElement('div');
    this.groupElement.className = 'form__group';
    this.groupElement.setAttribute('data-component', 'input-group');
    
    this.render();
    this.attachEvents();
  }

  render() {
    const { 
      id, name, type, label, placeholder, required, disabled, readonly,
      value, minLength, maxLength, pattern, hint, error 
    } = this.props;

    const hintId = hint ? `${id}-hint` : '';
    const errorId = error ? `${id}Error` : '';

    this.groupElement.innerHTML = `
      <label for="${id}" class="form__label">
        ${label}
        ${required ? '<span class="required" aria-hidden="true">*</span>' : ''}
      </label>
      
      <input 
        type="${type}" 
        id="${id}" 
        name="${name}"
        class="input ${error ? 'input--error' : ''}"
        placeholder="${placeholder || ''}"
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        ${readonly ? 'readonly' : ''}
        ${value ? `value="${value}"` : ''}
        ${minLength ? `minlength="${minLength}"` : ''}
        ${maxLength ? `maxlength="${maxLength}"` : ''}
        ${pattern ? `pattern="${pattern}"` : ''}
        aria-required="${required}"
        aria-invalid="${error ? 'true' : 'false'}"
        aria-describedby="${error ? errorId : hintId}"
      />
      
      ${hint ? `<span id="${hintId}" class="hint">${hint}</span>` : ''}
      ${error ? `<span id="${errorId}" class="error" role="alert" aria-live="polite">${error}</span>` : ''}
    `;

    this.element = this.groupElement.querySelector('input');
    this.errorElement = this.groupElement.querySelector('.error');
  }

  attachEvents() {
    if (this.props.onChange) {
      this.element.addEventListener('input', (e) => {
        this.props.onChange(e.target.value, e);
      });
    }

    if (this.props.onBlur) {
      this.element.addEventListener('blur', (e) => {
        this.props.onBlur(e.target.value, e);
      });
    }
  }

  setValue(value) {
    this.props.value = value;
    this.element.value = value;
  }

  getValue() {
    return this.element.value;
  }

  setError(error) {
    this.props.error = error;
    
    if (error) {
      if (!this.errorElement) {
        this.errorElement = document.createElement('span');
        this.errorElement.className = 'error';
        this.errorElement.setAttribute('role', 'alert');
        this.errorElement.setAttribute('aria-live', 'polite');
        this.errorElement.id = `${this.props.id}Error`;
        this.groupElement.appendChild(this.errorElement);
      }
      this.errorElement.textContent = error;
      this.element.classList.add('input--error');
      this.element.setAttribute('aria-invalid', 'true');
    } else {
      if (this.errorElement) {
        this.errorElement.textContent = '';
      }
      this.element.classList.remove('input--error');
      this.element.setAttribute('aria-invalid', 'false');
    }
  }

  clearError() {
    this.setError('');
  }

  setDisabled(disabled) {
    this.props.disabled = disabled;
    this.element.disabled = disabled;
  }

  getElement() {
    return this.element;
  }

  getGroupElement() {
    return this.groupElement;
  }
}

window.Input = Input;
export default Input;