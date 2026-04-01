/**
 * BookingForm Component
 */
class BookingForm {
  constructor(props = {}) {
    this.props = {
      car: null,
      onSubmit: null,
      ...props
    };
    
    this.element = null;
    this.formData = {
      startDate: '',
      endDate: '',
      services: {
        insurance: false,
        gps: false,
        childseat: false,
        additionalDriver: false
      },
      termsAccepted: false,
      rulesAccepted: false
    };
    
    this.SERVICE_PRICES = {
      insurance: 1000,
      gps: 300,
      childseat: 500,
      additionalDriver: 500
    };
    
    this.init();
  }

  init() {
    this.element = document.querySelector('.booking__form');
    if (this.element) {
      this.attachEvents();
      this.calculateTotal();
    }
  }

  attachEvents() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const services = document.querySelectorAll('input[name="service"]');
    const terms = document.getElementById('terms');
    const rules = document.getElementById('rules');
    const submitBtn = document.getElementById('submitBooking');

    if (startDate) {
      startDate.addEventListener('change', () => this.validateDates());
    }

    if (endDate) {
      endDate.addEventListener('change', () => this.validateDates());
    }

    services.forEach(service => {
      service.addEventListener('change', () => {
        this.formData.services[service.value] = service.checked;
        this.calculateTotal();
      });
    });

    if (terms) {
      terms.addEventListener('change', (e) => {
        this.formData.termsAccepted = e.target.checked;
        this.updateSubmitButton();
      });
    }

    if (rules) {
      rules.addEventListener('change', (e) => {
        this.formData.rulesAccepted = e.target.checked;
        this.updateSubmitButton();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submit());
    }
  }

  validateDates() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (!startDate || !endDate) return true;

    const start = new Date(startDate.value);
    const end = new Date(endDate.value);

    if (end <= start) {
      this.showError('endDate', 'Дата окончания должна быть позже даты начала');
      return false;
    }

    this.clearError('startDate');
    this.clearError('endDate');
    this.calculateTotal();
    return true;
  }

  calculateTotal() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (!startDate?.value || !endDate?.value) return;

    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    let total = days * this.props.car.pricePerDay;

    // Update days count
    const daysEl = document.getElementById('daysCount');
    if (daysEl) daysEl.textContent = days;

    // Update rental total
    const rentalTotal = document.getElementById('rentalTotal');
    if (rentalTotal) {
      rentalTotal.textContent = (days * this.props.car.pricePerDay).toLocaleString('ru-RU') + ' ₽';
    }

    // Update services
    const servicesList = document.getElementById('servicesList');
    if (servicesList) {
      servicesList.innerHTML = '';
      Object.entries(this.formData.services).forEach(([key, value]) => {
        if (value) {
          const serviceTotal = days * this.SERVICE_PRICES[key];
          total += serviceTotal;
          servicesList.innerHTML += `
            <div class="price-row">
              <span>${this.getServiceName(key)}</span>
              <span>+${serviceTotal.toLocaleString('ru-RU')} ₽</span>
            </div>
          `;
        }
      });
    }

    // Update grand total
    const grandTotal = document.getElementById('grandTotal');
    if (grandTotal) {
      grandTotal.textContent = total.toLocaleString('ru-RU') + ' ₽';
    }

    this.updateSubmitButton();
  }

  getServiceName(key) {
    const names = {
      insurance: 'Расширенная страховка',
      gps: 'GPS-навигатор',
      childseat: 'Детское кресло',
      additionalDriver: 'Доп. водитель'
    };
    return names[key] || key;
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('submitBooking');
    if (submitBtn) {
      const isValid = this.formData.startDate && 
                      this.formData.endDate && 
                      this.formData.termsAccepted && 
                      this.formData.rulesAccepted;
      submitBtn.disabled = !isValid;
    }
  }

  showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);
    
    if (errorEl) {
      errorEl.textContent = message;
    }
    if (inputEl) {
      inputEl.classList.add('input--error');
    }
  }

  clearError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);
    
    if (errorEl) {
      errorEl.textContent = '';
    }
    if (inputEl) {
      inputEl.classList.remove('input--error');
    }
  }

  async submit() {
    if (!this.validateDates()) return;

    if (!this.formData.termsAccepted || !this.formData.rulesAccepted) {
      showAlert('error', 'Примите условия аренды');
      return;
    }

    const submitBtn = document.getElementById('submitBooking');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn__loader"></span> Обработка...';
    }

    try {
      const bookingData = {
        carId: this.props.car.id,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        additionalServices: this.formData.services
      };

      if (this.props.onSubmit) {
        await this.props.onSubmit(bookingData);
      }
    } catch (error) {
      showAlert('error', error.message || 'Ошибка создания бронирования');
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить бронирование';
      }
    }
  }

  setCar(car) {
    this.props.car = car;
    this.calculateTotal();
  }
}

window.BookingForm = BookingForm;
export default BookingForm;