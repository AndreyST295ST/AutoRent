document.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab");
  const container = document.getElementById("bookingsContainer");
  const emptyState = document.getElementById("emptyState");
  const user = window.Utils.getCurrentUser();
  const clientId = user?.id || 1;
  let allBookings = [];

  function tabToStatuses(tab) {
    if (tab === "active") return ["confirmed", "active"];
    if (tab === "pending") return ["pending_review"];
    if (tab === "completed") return ["returned"];
    if (tab === "cancelled") return ["cancelled", "rejected"];
    return [];
  }

  function renderBookings(activeTab) {
    const statuses = tabToStatuses(activeTab);
    const items = allBookings.filter((b) => statuses.includes(b.status));
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
        <h3>Бронь #${booking.id}</h3>
        <p>Автомобиль ID: ${booking.car_id}</p>
        <p>Период: ${window.Utils.formatDate(booking.start_date)} - ${window.Utils.formatDate(
          booking.end_date
        )}</p>
        <p>Статус: ${booking.status}</p>
        <p>Сумма: ${window.Utils.formatCurrency(booking.total_price)}</p>
      </article>
    `
      )
      .join("");
  }

  try {
    allBookings = await window.bookingsAPI.getMy(clientId);
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
