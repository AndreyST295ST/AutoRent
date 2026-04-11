/**
 * BookingsTable Component (Admin)
 */
class BookingsTable {
  constructor(props = {}) {
    this.props = {
      bookings: [],
      onConfirm: null,
      onReject: null,
      onView: null,
      ...props
    };
    
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.getElementById('bookingsTable');
    if (this.element) {
      this.render();
    }
  }

  render() {
    if (!this.element) return;

    const tbody = this.element.querySelector('tbody');
    if (!tbody) return;

    if (this.props.bookings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 3rem;">
            Нет бронирований
          </td>
        </tr>
      `;
      return;
    }

    const statusLabels = {
      pending_review: 'Ожидает проверки',
      confirmed: 'Подтверждено',
      active: 'Активно',
      returned: 'Завершено',
      cancelled: 'Отменено'
    };

    const statusClasses = {
      pending_review: 'badge--pending',
      confirmed: 'badge--confirmed',
      active: 'badge--active',
      returned: 'badge--returned',
      cancelled: 'badge--cancelled'
    };

    tbody.innerHTML = this.props.bookings.map(booking => `
      <tr data-booking-id="${booking.id}">
        <td>#${booking.id}</td>
        <td>${booking.client?.firstName || '—'} ${booking.client?.lastName || ''}</td>
        <td>${booking.car?.brand || ''} ${booking.car?.model || ''}</td>
        <td>${this.formatDate(booking.startDate)} — ${this.formatDate(booking.endDate)}</td>
        <td>
          <span class="badge ${statusClasses[booking.status] || ''}">
            ${statusLabels[booking.status] || booking.status}
          </span>
        </td>
        <td>
          ${booking.status === 'pending_review' ? `
            <button class="btn btn--primary btn--sm" data-action="confirm" data-id="${booking.id}">
              \u2713 Подтвердить
            </button>
            <button class="btn btn--danger btn--sm" data-action="reject" data-id="${booking.id}">
              \u2715 Отклонить
            </button>
          ` : `
            <button class="btn btn--outline btn--sm" data-action="view" data-id="${booking.id}">
              Просмотр
            </button>
          `}
        </td>
        <td class="table-actions">
          <button class="btn btn--text btn--sm" data-action="view" data-id="${booking.id}">
            &#128196; Документы
          </button>
        </td>
      </tr>
    `).join('');

    this.attachEvents();
  }

  attachEvents() {
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        const id = e.target.getAttribute('data-id');
        
        if (action === 'confirm' && this.props.onConfirm) {
          this.props.onConfirm(id);
        } else if (action === 'reject' && this.props.onReject) {
          this.props.onReject(id);
        } else if (action === 'view' && this.props.onView) {
          this.props.onView(id);
        }
      });
    });
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  setBookings(bookings) {
    this.props.bookings = bookings;
    this.render();
  }

  getElement() {
    return this.element;
  }
}

window.BookingsTable = BookingsTable;
export default BookingsTable;