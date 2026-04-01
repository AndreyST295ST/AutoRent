/**
 * Button Component
 * @param {Object} props - Свойства кнопки
 * @param {string} props.text - Текст кнопки
 * @param {string} props.variant - Вариант (primary, secondary, outline, danger, text)
 * @param {string} props.size - Размер (sm, md, lg)
 * @param {boolean} props.disabled - Отключена ли кнопка
 * @param {boolean} props.loading - Состояние загрузки
 * @param {string} props.type - Тип кнопки (button, submit, reset)
 * @param {Function} props.onClick - Обработчик клика
 * @param {string} props.ariaLabel - ARIA метка для доступности
 */
class Button {
  constructor(props = {}) {
    this.props = {
      text: 'Кнопка',
      variant: 'primary',
      size: 'md',
      disabled: false,
      loading: false,
      type: 'button',
      onClick: null,
      ariaLabel: null,
      ...props
    };
    
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.createElement('button');
    this.render();
    this.attachEvents();
  }

  render() {
    const { text, variant, size, disabled, loading, type, ariaLabel } = this.props;
    
    this.element.className = `btn btn--${variant} btn--${size}`;
    this.element.type = type;
    this.element.disabled = disabled || loading;
    
    if (ariaLabel) {
      this.element.setAttribute('aria-label', ariaLabel);
    }
    
    if (loading) {
      this.element.setAttribute('aria-busy', 'true');
      this.element.innerHTML = `
        <span class="btn__loader" aria-hidden="true"></span>
        <span class="btn__loading-text">${text}</span>
      `;
    } else {
      this.element.textContent = text;
    }
  }

  attachEvents() {
    if (this.props.onClick && typeof this.props.onClick === 'function') {
      this.element.addEventListener('click', (e) => {
        if (!this.props.disabled && !this.props.loading) {
          this.props.onClick(e);
        }
      });
    }
  }

  setText(text) {
    this.props.text = text;
    if (!this.props.loading) {
      this.element.textContent = text;
    }
  }

  setLoading(loading) {
    this.props.loading = loading;
    this.render();
  }

  setDisabled(disabled) {
    this.props.disabled = disabled;
    this.element.disabled = disabled;
  }

  getElement() {
    return this.element;
  }
}

// Export for use in other components
window.Button = Button;
export default Button;