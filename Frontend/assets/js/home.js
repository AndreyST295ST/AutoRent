document.addEventListener("DOMContentLoaded", async () => {
  const featuredCars = document.getElementById("featuredCars");
  const searchBtn = document.getElementById("searchBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const start = document.getElementById("searchStart")?.value || "";
      const end = document.getElementById("searchEnd")?.value || "";
      const brand = document.getElementById("searchBrand")?.value || "";
      if (!start || !end) {
        window.showAlert("warning", "Выберите даты аренды", "Ошибка поиска");
        return;
      }
      const params = new URLSearchParams({ start, end, brand });
      window.location.href = `/pages/Catalog.html?${params.toString()}`;
    });
  }

  if (!featuredCars || !window.carsAPI) return;

  const resolveAssetUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
    const normalized = url.startsWith("/") ? url : `/${url}`;
    try {
      const base = window.APP_CONFIG?.API_BASE_URL || "";
      if (base.startsWith("http")) return `${new URL(base).origin}${normalized}`;
    } catch (_) {}
    return normalized;
  };

  const getCarImageUrl = (car) => {
    if (Array.isArray(car.photo_urls) && car.photo_urls.length) {
      return resolveAssetUrl(car.photo_urls[0]);
    }
    return "/assets/images/logo.svg";
  };

  try {
    const cars = await window.carsAPI.getAll();
    const top = cars.slice(0, 4);
    featuredCars.innerHTML = top
      .map(
        (car) => `
      <article class="car-card">
        <div class="car-card__image">
          <img src="${getCarImageUrl(car)}" alt="${car.brand} ${car.model}" loading="lazy" />
        </div>
        <div class="car-card__body">
          <h3 class="car-card__title">${car.brand} ${car.model}</h3>
          <p>${car.year || ""}</p>
          <div class="car-card__footer">
            <span>${window.Utils.formatCurrency(car.price_per_day)} / сутки</span>
            <a class="btn btn--primary btn--sm" href="/pages/Booking.html?carId=${car.id}">Забронировать</a>
          </div>
        </div>
      </article>
    `
      )
      .join("");
  } catch (error) {
    featuredCars.innerHTML = `
      <div class="empty-state">
        <h3>Не удалось загрузить автомобили</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
});
