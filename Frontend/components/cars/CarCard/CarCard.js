/**
 * CarCard Component
 */
class CarCard {
  constructor(car, onBook) {
    this.car = car;
    this.onBook = onBook;
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.createElement('article');
    this.element.className = 'car-card';
    this.element.setAttribute('data-car-id', this.car.id);
    this.element.setAttribute('role', 'article');
    this.render();
    this.attachEvents();
  }

  render() {
    const statusLabels = {
      free: 'Свободен',
      rented: 'В аренде',
      maintenance: 'На обслуживании',
      retired: 'Списан'
    };

    const transmissionLabels = {
      manual: 'Механика',
      automatic: 'Автомат',
      cvt: 'Вариатор'
    };

    const fuelLabels = {
      petrol: 'Бензин',
      diesel: 'Дизель',
      electric: 'Электро',
      hybrid: 'Гибрид'
    };

    this.element.innerHTML = `
      <div class="car-card__image">
        <img src="${this.car.photos?.[0]?.photoUrl || '/assets/images/car-placeholder.jpg'}" 
             alt="${this.car.brand} ${this.car.model}" 
             loading="lazy" />
        <span class="car-card__badge car-card__badge--${this.car.status}">
          ${statusLabels[this.car.status] || this.car.status}
        </span>
      </div>
      
      <div class="car-card__body">
        <h3 class="car-card__title">${this.car.brand} ${this.car.model}</h3>
        
        <div class="car-card__specs">
          <span class="spec">&#128197; ${this.car.year}</span>
          <span class="spec">&#9881; ${transmissionLabels[this.car.transmission] || this.car.transmission}</span>
          <span class="spec">&#9981; ${fuelLabels[this.car.fuelType] || this.car.fuelType}</span>
          <span class="spec">&#128101; ${this.car.seats} мест</span>
        </div>
        
        <p class="car-card__description">${this.car.description || 'Комфортный автомобиль для ваших поездок'}</p>
        
        <div class="car-card__footer">
          <div class="car-card__price">
            <span class="price__value">${this.car.pricePerDay.toLocaleString('ru-RU')}</span>
            <span class="price__period">/ сутки</span>
          </div>
          <button 
            class="btn btn--primary btn--sm" 
            data-action="book"
            ${this.car.status !== 'free' ? 'disabled' : ''}
            aria-label="Забронировать ${this.car.brand} ${this.car.model}"
          >
            Забронировать
          </button>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const bookBtn = this.element.querySelector('[data-action="book"]');
    if (bookBtn && this.onBook) {
      bookBtn.addEventListener('click', () => {
        if (this.car.status === 'free') {
          this.onBook(this.car);
        }
      });
    }
  }

  getElement() {
    return this.element;
  }
}

window.CarCard = CarCard;
export default CarCard;