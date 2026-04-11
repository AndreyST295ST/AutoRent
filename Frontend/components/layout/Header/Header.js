/**
 * Header Component
 */
class Header {
  constructor() {
    this.element = null;
    this.user = null;
    this.init();
  }

  init() {
    this.element = document.querySelector('.header');
    if (!this.element) {
      this.render();
      document.body.insertBefore(this.element, document.body.firstChild);
    }
    this.attachEvents();
    this.loadUser();
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'header';
    this.element.setAttribute('role', 'banner');
    this.element.innerHTML = `
      <div class="container header__container">
        <a href="/" class="logo" aria-label="AutoRent главная страница">
          <span class="logo__icon" aria-hidden="true">&#128663;</span>
          <span class="logo__text">AutoRent</span>
        </a>

        <nav class="nav" id="mainNav" role="navigation" aria-label="Основная навигация">
          <a href="/pages/Catalog.html" class="nav__link">&#128203; Каталог</a>
          <a href="/pages/MyBookings.html" class="nav__link">&#128197; Бронирования</a>
          <a href="/pages/Profile.html" class="nav__link">&#128100; Профиль</a>
          <a href="/pages/Admin.html" class="nav__link nav__link--admin" style="display:none">&#9881; Админка</a>
        </nav>

        <div class="user-menu" id="userMenu" aria-live="polite"></div>

        <button
          class="btn btn--icon mobile-toggle"
          id="mobileToggle"
          aria-label="Меню"
          aria-expanded="false"
        >
          &#9776;
        </button>
      </div>
    `;
  }

  attachEvents() {
    const mobileToggle = this.element.querySelector('#mobileToggle');
    const nav = this.element.querySelector('#mainNav');

    if (mobileToggle && nav) {
      mobileToggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('nav--open');
        mobileToggle.setAttribute('aria-expanded', isOpen);
        mobileToggle.textContent = isOpen ? '\u2715' : '\u2630';
      });
    }
  }

  async loadUser() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.renderGuest();
        return;
      }

      // В реальном приложении здесь будет API запрос
      // const user = await api.get('/auth/me');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      
      if (user) {
        this.user = user;
        this.renderUser(user);
      } else {
        this.renderGuest();
      }
    } catch (error) {
      this.renderGuest();
    }
  }

  renderGuest() {
    const userMenu = this.element.querySelector('#userMenu');
    if (userMenu) {
      userMenu.innerHTML = `
        <div class="auth-buttons">
          <a href="/pages/Login.html" class="btn btn--outline btn--sm">Войти</a>
          <a href="/pages/Register.html" class="btn btn--primary btn--sm">Регистрация</a>
        </div>
      `;
    }
  }

  renderUser(user) {
    const userMenu = this.element.querySelector('#userMenu');
    const isAdmin = user.role === 'admin' || user.role === 'employee';
    
    if (userMenu) {
      userMenu.innerHTML = `
        <div class="user-info">
          <span class="user-name">${user.firstName || user.email}</span>
          <button class="btn btn--outline btn--sm" id="logoutBtn">Выйти</button>
        </div>
      `;

      const logoutBtn = userMenu.querySelector('#logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => this.logout());
      }

      // Show admin link
      if (isAdmin) {
        const adminLink = this.element.querySelector('.nav__link--admin');
        if (adminLink) {
          adminLink.style.display = 'block';
        }
      }
    }
  }

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/pages/Login.html';
  }

  updateNav(activePath) {
    const links = this.element.querySelectorAll('.nav__link');
    links.forEach(link => {
      if (link.getAttribute('href').includes(activePath)) {
        link.classList.add('nav__link--active');
      } else {
        link.classList.remove('nav__link--active');
      }
    });
  }
}

window.Header = Header;
export default Header;