/**
 * Loader Component
 */
class Loader {
  constructor(props = {}) {
    this.props = {
      size: 'md',
      text: '',
      fullPage: false,
      ...props
    };
    
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.render();
  }

  render() {
    const { size, text, fullPage } = this.props;
    
    if (fullPage) {
      this.element.className = 'loader-overlay';
      this.element.innerHTML = `
        <span class="loader loader--lg"></span>
        ${text ? `<span class="loader-overlay__text">${text}</span>` : ''}
      `;
    } else {
      this.element.className = `loader loader--${size}`;
      if (text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'loader-inline';
        wrapper.innerHTML = `
          <span class="loader loader--${size}"></span>
          <span>${text}</span>
        `;
        this.element = wrapper;
      }
    }
  }

  show() {
    if (!this.element.parentNode) {
      document.body.appendChild(this.element);
    }
  }

  hide() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  setText(text) {
    this.props.text = text;
    const textEl = this.element.querySelector('.loader-overlay__text');
    if (textEl) {
      textEl.textContent = text;
    }
  }

  getElement() {
    return this.element;
  }
}

/**
 * Show full page loader
 */
function showLoader(text = 'Загрузка...') {
  const loader = new Loader({ fullPage: true, text });
  loader.show();
  return loader;
}

/**
 * Hide all loaders
 */
function hideLoader() {
  const loaders = document.querySelectorAll('.loader-overlay');
  loaders.forEach(loader => loader.remove());
}

window.Loader = Loader;
window.showLoader = showLoader;
window.hideLoader = hideLoader;
export { Loader, showLoader, hideLoader };
export default Loader;