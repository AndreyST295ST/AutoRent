// booking.js

document.addEventListener('DOMContentLoaded', () => {
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const services = document.querySelectorAll('input[name="service"]');
  const terms = document.getElementById('terms');
  const rules = document.getElementById('rules');
  const submitBtn = document.getElementById('submitBooking');
  
  const BASE_PRICE = parseFloat(document.querySelector('[data-price-per-day]')?.dataset.pricePerDay || 0);
  const SERVICE_PRICES = {
    insurance: 1000,
    gps: 300,
    childseat: 500,
    driver: 500
  };

  // Set minimum dates
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  startDate.min = now.toISOString().slice(0, 16);
  
  // Calculate total price
  function calculateTotal() {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    
    if (!start || !end || end <= start) return 0;
    
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    let total = days * BASE_PRICE;
    
    // Add services
    services.forEach(service => {
      if (service.checked) {
        total += days * SERVICE_PRICES[service.value];
      }
    });
    
    return total;
  }

  // Update UI
  function updateSummary() {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const days = start && end && end > start 
      ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) 
      : 0;
    
    document.getElementById('daysCount').textContent = days;
    document.getElementById('rentalTotal').textContent = 
      (days * BASE_PRICE).toLocaleString('ru-RU') + ' ₽';
    document.getElementById('grandTotal').textContent = 
      calculateTotal().toLocaleString('ru-RU') + ' ₽';
    
    // Update services list
    const servicesList = document.getElementById('servicesList');
    servicesList.innerHTML = '';
    services.forEach(service => {
      if (service.checked) {
        const row = document.createElement('div');
        row.className = 'price-row';
        row.innerHTML = `
          <span>${service.closest('label').querySelector('strong').textContent}</span>
          <span>+${(days * SERVICE_PRICES[service.value]).toLocaleString('ru-RU')} ₽</span>
        `;
        servicesList.appendChild(row);
      }
    });
    
    // Enable/disable submit
    submitBtn.disabled = !startDate.value || !endDate.value || !terms.checked || !rules.checked;
  }

  // Event listeners
  [startDate, endDate, terms, rules].forEach(el => {
    el.addEventListener('change', updateSummary);
  });
  
  services.forEach(service => {
    service.addEventListener('change', updateSummary);
  });

  // Form submission
  document.getElementById('submitBooking').addEventListener('click', async () => {
    if (!validateForm()) return;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Обработка...';
    
    try {
      const carIdElement = document.querySelector('[data-car-id]');
      const response = await api.post('/api/v1/bookings', {
        carId: carIdElement ? carIdElement.dataset.carId : null,
        startDate: startDate.value,
        endDate: endDate.value,
        additionalServices: {
          insurance: document.querySelector('[value="insurance"]').checked,
          gps: document.querySelector('[value="gps"]').checked,
          childseat: document.querySelector('[value="childseat"]').checked,
          additionalDriver: document.querySelector('[value="driver"]').checked
        }
      });
      
      // Show success modal
      document.getElementById('bookingNumber').textContent = response.bookingId;
      document.getElementById('successModal').style.display = 'flex';
      
    } catch (error) {
      showAlert('error', error.message || 'Ошибка создания бронирования');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Оформить бронирование';
    }
  });

  // Validation
  function validateForm() {
    let valid = true;
    
    if (!startDate.value) {
      showError('startDate', 'Выберите дату начала');
      valid = false;
    }
    if (!endDate.value) {
      showError('endDate', 'Выберите дату окончания');
      valid = false;
    }
    if (startDate.value && endDate.value && new Date(endDate.value) <= new Date(startDate.value)) {
      showError('endDate', 'Дата окончания должна быть позже даты начала');
      valid = false;
    }
    
    return valid;
  }

  function showError(fieldId, message) {
    const errorEl = document.getElementById(fieldId + 'Error');
    if (errorEl) {
      errorEl.textContent = message;
      document.getElementById(fieldId).classList.add('input--error');
    }
  }

  // Initial update
  updateSummary();
});

// Modal helpers
function closeModal() {
  document.getElementById('successModal').style.display = 'none';
}

window.onclick = (e) => {
  if (e.target.classList.contains('modal__overlay')) {
    closeModal();
  }
};