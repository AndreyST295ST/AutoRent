document.addEventListener("DOMContentLoaded", async () => {
  const buildLoginRedirectUrl = () => {
    const next = encodeURIComponent(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    return `/pages/Login.html?next=${next}`;
  };

  const ensureAuthorizedUser = async () => {
    const localUser = window.Utils.getCurrentUser();
    if (localUser) {
      return localUser;
    }

    try {
      if (window.authAPI?.me) {
        const remoteUser = await window.authAPI.me();
        window.Utils.setCurrentUser(remoteUser);
        return remoteUser;
      }
    } catch (_) {
      // ignore and redirect to login below
    }

    window.location.href = buildLoginRedirectUrl();
    return null;
  };

  const user = await ensureAuthorizedUser();
  if (!user) {
    return;
  }

  const tabs = document.querySelectorAll(".tab");
  const container = document.getElementById("bookingsContainer");
  const emptyState = document.getElementById("emptyState");
  let allBookings = [];
  let carsById = new Map();

  const STATUS_LABELS = {
    pending_review: "\u041d\u0430 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0438\u0438",
    confirmed: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430",
    active: "\u0410\u043a\u0442\u0438\u0432\u043d\u0430",
    returned: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
    cancelled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430",
    rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430",
  };

  function tabToStatuses(tab) {
    if (tab === "active") return ["confirmed", "active"];
    if (tab === "pending") return ["pending_review"];
    if (tab === "completed") return ["returned"];
    if (tab === "cancelled") return ["cancelled", "rejected"];
    return [];
  }

  function getCarLabel(carId) {
    const car = carsById.get(Number(carId));
    if (!car) return `\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c #${carId}`;
    const parts = [car.brand, car.model].filter(Boolean);
    return parts.length ? parts.join(" ") : `\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c #${carId}`;
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function renderBookings(activeTab) {
    const statuses = tabToStatuses(activeTab);
    const items = allBookings.filter((booking) => statuses.includes(booking.status));

    if (!items.length) {
      container.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    container.innerHTML = items
      .map(
        (booking) => `
      <article class="card">
        <h3>\u0411\u0440\u043e\u043d\u044c #${booking.id}</h3>
        <p>\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c: ${getCarLabel(booking.car_id)}</p>
        <p>\u041f\u0435\u0440\u0438\u043e\u0434: ${window.Utils.formatDate(booking.start_date)} - ${window.Utils.formatDate(
          booking.end_date
        )}</p>
        <p>\u0421\u0442\u0430\u0442\u0443\u0441: ${getStatusLabel(booking.status)}</p>
        <p>\u0421\u0443\u043c\u043c\u0430: ${window.Utils.formatCurrency(booking.total_price)}</p>
      </article>
    `
      )
      .join("");
  }

  try {
    const [bookings, cars] = await Promise.all([
      window.bookingsAPI.getMy(),
      window.carsAPI.getAll(),
    ]);

    allBookings = Array.isArray(bookings) ? bookings : [];
    carsById = new Map(
      (Array.isArray(cars) ? cars : []).map((car) => [Number(car.id), car])
    );

    renderBookings("active");
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("tab--active");
        t.setAttribute("aria-selected", "false");
      });

      tab.classList.add("tab--active");
      tab.setAttribute("aria-selected", "true");
      renderBookings(tab.dataset.tab);
    });
  });
});
