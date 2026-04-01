/**
 * Modal Component
 */
class Modal {
  constructor(props = {}) {
    this.props = {
      id: 'modal',
      title: '',
      content: '',
      footer: '',
      size: 'md',
      visible: false,
      showClose: true,
      onClose: null,
      closeOnOverlay: true,
      closeOnEscape: true,
      ...props
    };
    
    this.element = null;
    this.isOpen = false;
    this.previousActiveElement = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.render();
    this.attachEvents();
    document.body.appendChild(this.element);
  }

  render() {
    const { id, title, content, footer, size, visible, showClose } = this.props;
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;

    this.element.innerHTML = `
      <div 
        class="modal ${visible ? 'modal--visible' : ''}" 
        id="${id}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${titleId}"
        aria-describedby="${descriptionId}"
        data-component="modal"
        style="${visible ? '' : 'display:none'}"
      >
        <div class="modal__overlay" data-modal-close tabindex="-1"></div>
        
        <div class="modal__content modal__content--${size}">
          ${showClose ? `
            <button 
              class="modal__close" 
              data-modal-close 
              aria-label="Закрыть модальное окно"
              type="button"
            >
              &times;
            </button>
          ` : ''}
          
          ${title ? `
            <div class="modal__header">
              <h2 id="${titleId}" class="modal__title">${title}</h2>
            </div>
          ` : ''}
          
          <div class="modal__body" id="${descriptionId}">
            ${content}
          </div>
          
          ${footer ? `
            <div class="modal__footer">
              ${footer}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.overlay = this.element.querySelector('.modal__overlay');
    this.closeButtons = this.element.querySelectorAll('[data-modal-close]');
    this.content = this.element.querySelector('.modal__content');
  }

  attachEvents() {
    // Close on overlay click
    if (this.props.closeOnOverlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    // Close on button click
    this.closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Close on Escape
    if (this.props.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }
  }

  open() {
    this.previousActiveElement = document.activeElement;
    this.isOpen = true;
    this.element.style.display = 'flex';
    
    // Trigger reflow for animation
    setTimeout(() => {
      this.element.classList.add('modal--visible');
    }, 10);

    // Focus trap
    const focusable = this.content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
      focusable[0].focus();
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    if (this.props.onOpen) {
      this.props.onOpen();
    }
  }

  close() {
    this.isOpen = false;
    this.element.classList.remove('modal--visible');
    
    setTimeout(() => {
      this.element.style.display = 'none';
      
      // Restore focus
      if (this.previousActiveElement) {
        this.previousActiveElement.focus();
      }

      // Restore body scroll
      document.body.style.overflow = '';
    }, 300);

    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setContent(content) {
    this.props.content = content;
    const body = this.element.querySelector('.modal__body');
    if (body) {
      body.innerHTML = content;
    }
  }

  setTitle(title) {
    this.props.title = title;
    const titleEl = this.element.querySelector('.modal__title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  setFooter(footer) {
    this.props.footer = footer;
    let footerEl = this.element.querySelector('.modal__footer');
    
    if (footer) {
      if (!footerEl) {
        footerEl = document.createElement('div');
        footerEl.className = 'modal__footer';
        this.element.querySelector('.modal__content').appendChild(footerEl);
      }
      footerEl.innerHTML = footer;
    } else if (footerEl) {
      footerEl.remove();
    }
  }

  getElement() {
    return this.element;
  }
}

window.Modal = Modal;
export default Modal;