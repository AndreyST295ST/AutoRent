/**
 * Alert Component
 */
class Alert {
  constructor(props = {}) {
    this.props = {
      type: 'info',
      message: '',
      title: '',
      dismissible: true,
      duration: 5000,
      onClose: null,
      ...props
    };
    
    this.element = null;
    this.timeout = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.render();
    this.attachEvents();
    
    if (this.props.duration && this.props.duration > 0) {
      this.timeout = setTimeout(() => this.close(), this.props.duration);
    }
  }

  render() {
    const { type, message, title, dismissible } = this.props;
    
    const icons = {
      info: '\u2139',
      success: '\u2705',
      warning: '\u26A0',
      error: '\u274C'
    };

    this.element.className = `alert alert--${type}`;
    this.element.setAttribute('role', 'alert');
    this.element.setAttribute('aria-live', 'polite');
    
    this.element.innerHTML = `
      <span class="alert__icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="alert__message">
        ${title ? `<span class="alert__title">${title}</span>` : ''}
        ${message}
      </span>
      ${dismissible ? `
        <button 
          class="alert__close" 
          aria-label="Закрыть уведомление"
          type="button"
        >
          &times;
        </button>
      ` : ''}
    `;
  }

  attachEvents() {
    const closeBtn = this.element.querySelector('.alert__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  close() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    this.element.style.animation = 'slideOut 0.3s ease forwards';
    
    setTimeout(() => {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      
      if (this.props.onClose) {
        this.props.onClose();
      }
    }, 300);
  }

  setMessage(message) {
    this.props.message = message;
    const messageEl = this.element.querySelector('.alert__message');
    if (messageEl) {
      messageEl.innerHTML = message;
    }
  }

  getElement() {
    return this.element;
  }
}

/**
 * Show alert in container
 */
function showAlert(type, message, title = '', duration = 5000) {
  let container = document.getElementById('alertContainer');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'alertContainer';
    container.className = 'alert-container';
    container.setAttribute('aria-live', 'assertive');
    document.body.appendChild(container);
  }

  const alert = new Alert({ type, message, title, duration });
  container.appendChild(alert.getElement());

  return alert;
}

window.Alert = Alert;
window.showAlert = showAlert;
export { Alert, showAlert };
export default Alert;