document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const navLinks = document.querySelectorAll(".nav__link[data-section]");
  const sections = document.querySelectorAll(".admin-section");

  const els = {
    recentTable: document.querySelector("#recentBookingsTable tbody"),
    bookingsTable: document.querySelector("#bookingsTable tbody"),
    carsTable: document.querySelector("#carsTable tbody"),
    usersTable: document.querySelector("#usersTable tbody"),
    docsQueueTable: document.querySelector("#docsQueueTable tbody"),
    rentalDocsTable: document.querySelector("#rentalDocsTable tbody"),
    bookingStatusFilter: $("statusFilter"),
    applyBookingsFilterBtn: $("applyFilter"),
    carStatusFilter: $("carStatusFilter"),
    carSort: $("carSort"),
    resetCarFiltersBtn: $("resetCarFilters"),
    addCarBtn: $("addCarBtn"),
    carModal: $("carModal"),
    carModalTitle: $("carModalTitle"),
    carForm: $("carForm"),
    carId: $("carId"),
    clientDocsModal: $("clientDocsModal"),
    clientDocsModalTitle: $("clientDocsModalTitle"),
    clientDocsModalBody: $("clientDocsModalBody"),
  };

  const me = window.Utils.getCurrentUser();
  const isEmployeeOrAdmin = me && (me.role === "admin" || me.role === "employee");
  const isAdmin = me && me.role === "admin";

  if (!isEmployeeOrAdmin) {
    window.Utils.showNotification("warning", "Доступ к админ-панели только для сотрудников");
    window.location.href = "/pages/Login.html";
    return;
  }

  const state = {
    cars: [],
    bookings: [],
    users: [],
    documents: [],
    rentalDocs: [],
    clientEntities: {},
    ui: { bookingStatus: "all", carStatus: "all", carSort: "id_desc" },
  };

  const STATUS_LABELS = {
    pending_review: "На проверке",
    confirmed: "Подтверждена",
    active: "Активна",
    returned: "Завершена",
    cancelled: "Отменена",
    rejected: "Отклонена",
    free: "Свободен",
    rented: "В аренде",
    maintenance: "На обслуживании",
    retired: "Списан",
    pending: "Ожидает",
    verified: "Проверен",
    not_uploaded: "Не загружены",
    prepared: "Подготовлен",
    blocked: "Заблокирован",
    inactive: "Не активен",
  };

  const STATUS_BADGES = {
    pending_review: "badge badge--pending",
    confirmed: "badge badge--confirmed",
    active: "badge badge--active",
    returned: "badge badge--returned",
    cancelled: "badge badge--cancelled",
    rejected: "badge badge--cancelled",
    free: "badge badge--free",
    rented: "badge badge--rented",
    maintenance: "badge badge--rented",
    retired: "badge badge--cancelled",
    pending: "badge badge--pending",
    verified: "badge badge--active",
    not_uploaded: "badge badge--returned",
    prepared: "badge badge--active",
    blocked: "badge badge--cancelled",
    inactive: "badge badge--returned",
  };

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status || "-";
    return `<span class="${STATUS_BADGES[status] || "badge"}">${label}</span>`;
  }

  function switchSection(sectionId) {
    sections.forEach((s) => {
      s.style.display = s.id === sectionId ? "block" : "none";
    });
    navLinks.forEach((link) => {
      link.classList.toggle("nav__link--active", link.dataset.section === sectionId);
    });
  }

  function byCarId(id) {
    return state.cars.find((c) => Number(c.id) === Number(id)) || null;
  }

  function byClientEntity(clientId) {
    return state.clientEntities[Number(clientId)] || null;
  }

  function byClientUser(clientId) {
    return byClientEntity(clientId)?.user || null;
  }

  function formatSafeDate(value) {
    return value ? window.Utils.formatDate(value) : "-";
  }

  async function loadData() {
    const usersPromise = isAdmin ? window.usersAPI.getAll().catch(() => []) : Promise.resolve([]);
    const [cars, bookings, users, docsQueue] = await Promise.all([
      window.carsAPI.getAll(),
      window.bookingsAPI.getAll(),
      usersPromise,
      window.documentsAPI.getQueue().catch(() => []),
    ]);

    state.cars = cars || [];
    state.bookings = bookings || [];
    state.users = users || [];
    state.clientEntities = {};

    (docsQueue || []).forEach((doc) => {
      if (doc?.client) state.clientEntities[Number(doc.client.client_id)] = doc.client;
    });

    const clientIds = [...new Set(state.bookings.map((b) => Number(b.client_id)).filter(Boolean))];
    await Promise.all(
      clientIds.map((id) =>
        window.documentsAPI
          .getClient(id)
          .then((entity) => {
            state.clientEntities[Number(id)] = entity;
          })
          .catch(() => null)
      )
    );

    const byClient = new Map((docsQueue || []).map((d) => [Number(d.client_id), d]));
    const missingDocs = clientIds.filter((id) => !byClient.has(id)).map((id) => ({ client_id: id, verification_status: "not_uploaded" }));
    state.documents = [...(docsQueue || []), ...missingDocs];

    const rentalDocs = await Promise.all(
      state.bookings.map((b) => window.documentsAPI.getRental(b.id).catch(() => null))
    );
    state.rentalDocs = rentalDocs.filter(Boolean);
  }
  function filteredBookings() {
    const items = [...state.bookings];
    const status = state.ui.bookingStatus;
    return (status && status !== "all" ? items.filter((b) => b.status === status) : items).sort((a, b) => Number(b.id) - Number(a.id));
  }

  function filteredCars() {
    let items = [...state.cars];
    if (state.ui.carStatus && state.ui.carStatus !== "all") {
      items = items.filter((c) => c.status === state.ui.carStatus);
    }

    const key = state.ui.carSort || "id_desc";
    items.sort((a, b) => {
      if (key === "id_asc") return Number(a.id) - Number(b.id);
      if (key === "brand_asc") return String(a.brand || "").localeCompare(String(b.brand || ""), "ru");
      if (key === "brand_desc") return String(b.brand || "").localeCompare(String(a.brand || ""), "ru");
      if (key === "price_asc") return Number(a.price_per_day || 0) - Number(b.price_per_day || 0);
      if (key === "price_desc") return Number(b.price_per_day || 0) - Number(a.price_per_day || 0);
      if (key === "year_asc") return Number(a.year || 0) - Number(b.year || 0);
      if (key === "year_desc") return Number(b.year || 0) - Number(a.year || 0);
      return Number(b.id) - Number(a.id);
    });

    return items;
  }

  function renderDashboard() {
    $("activeBookings").textContent = String(state.bookings.filter((b) => b.status === "active" || b.status === "confirmed").length);
    $("pendingBookings").textContent = String(state.bookings.filter((b) => b.status === "pending_review").length);
    $("availableCars").textContent = String(state.cars.filter((c) => c.status === "free").length);
    const revenue = state.bookings.filter((b) => b.status === "returned").reduce((s, b) => s + Number(b.total_price || 0), 0);
    $("totalRevenue").textContent = window.Utils.formatCurrency(revenue);

    if (!els.recentTable) return;
    const recent = [...state.bookings].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6);
    els.recentTable.innerHTML = recent
      .map((b) => {
        const u = byClientUser(b.client_id);
        const c = byCarId(b.car_id);
        return `<tr>
          <td>${b.id}</td>
          <td>${u ? `${u.first_name} ${u.last_name}` : `#${b.client_id}`}</td>
          <td>${c ? `${c.brand} ${c.model}` : `#${b.car_id}`}</td>
          <td>${window.Utils.formatDate(b.start_date)} - ${window.Utils.formatDate(b.end_date)}</td>
          <td>${statusBadge(b.status)}</td>
          <td><button class="btn btn--outline btn--sm" data-action="open-bookings">Открыть</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderCars() {
    if (!els.carsTable) return;
    const rows = filteredCars();
    if (!rows.length) {
      els.carsTable.innerHTML = '<tr><td colspan="7" class="text-center">По выбранным фильтрам автомобили не найдены</td></tr>';
      return;
    }
    els.carsTable.innerHTML = rows
      .map((c) => `<tr>
        <td>${c.id}</td>
        <td>${c.brand} ${c.model}</td>
        <td>${c.license_plate || "-"}</td>
        <td>${c.year || "-"}</td>
        <td>${window.Utils.formatCurrency(c.price_per_day)}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="display:flex; gap:.35rem; flex-wrap:wrap;">
          <button class="btn btn--outline btn--sm" data-action="edit-car" data-id="${c.id}">Редактировать</button>
          <button class="btn btn--outline btn--sm" data-action="toggle-car-status" data-id="${c.id}">${c.status === "free" ? "В обслуживание" : "В свободные"}</button>
          <button class="btn btn--outline btn--sm" data-action="delete-car" data-id="${c.id}">Удалить</button>
        </td>
      </tr>`)
      .join("");
  }

  function renderBookings() {
    if (!els.bookingsTable) return;
    const rows = filteredBookings();
    if (!rows.length) {
      els.bookingsTable.innerHTML = '<tr><td colspan="7" class="text-center">Заявки с выбранным статусом не найдены</td></tr>';
      return;
    }
    els.bookingsTable.innerHTML = rows
      .map((b) => {
        const u = byClientUser(b.client_id);
        const c = byCarId(b.car_id);
        const doc = state.documents.find((d) => Number(d.client_id) === Number(b.client_id));
        const docStatus = doc?.verification_status || doc?.status || "not_uploaded";
        return `<tr>
          <td>${b.id}</td>
          <td>${u ? `${u.first_name} ${u.last_name}` : `#${b.client_id}`}</td>
          <td>${c ? `${c.brand} ${c.model}` : `#${b.car_id}`}</td>
          <td>${window.Utils.formatDate(b.start_date)} - ${window.Utils.formatDate(b.end_date)}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${statusBadge(docStatus)}</td>
          <td style="display:flex; gap:.35rem; flex-wrap:wrap;">
            <button class="btn btn--outline btn--sm" data-action="booking-confirm" data-id="${b.id}">Подтв.</button>
            <button class="btn btn--outline btn--sm" data-action="booking-reject" data-id="${b.id}">Отклонить</button>
            <button class="btn btn--outline btn--sm" data-action="booking-pickup" data-id="${b.id}">Выдать</button>
            <button class="btn btn--outline btn--sm" data-action="booking-return" data-id="${b.id}">Возврат</button>
            <button class="btn btn--outline btn--sm" data-action="booking-generate-docs" data-id="${b.id}">Подг. доки</button>
            <button class="btn btn--outline btn--sm" data-action="booking-print-docs" data-id="${b.id}">Печать</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function renderDocuments() {
    if (els.docsQueueTable) {
      els.docsQueueTable.innerHTML = state.documents
        .map((d) => {
          const u = byClientUser(d.client_id);
          const name = u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : `#${d.client_id}`;
          const st = d.verification_status || d.status || "not_uploaded";
          return `<tr>
            <td>${d.client_id}</td>
            <td>${name}</td>
            <td>${statusBadge(st)}</td>
            <td>${formatSafeDate(d.uploaded_at)}</td>
            <td style="display:flex; gap:.35rem; flex-wrap:wrap;">
              <button class="btn btn--outline btn--sm" data-action="doc-open-client" data-id="${d.client_id}">Карточка</button>
              <button class="btn btn--outline btn--sm" data-action="doc-open-passport" data-id="${d.client_id}" ${d.passport_scan_url ? "" : "disabled"}>Паспорт</button>
              <button class="btn btn--outline btn--sm" data-action="doc-open-license" data-id="${d.client_id}" ${d.license_scan_url ? "" : "disabled"}>ВУ</button>
              <button class="btn btn--outline btn--sm" data-action="doc-verify" data-id="${d.client_id}" ${st !== "not_uploaded" ? "" : "disabled"}>Подтвердить</button>
              <button class="btn btn--outline btn--sm" data-action="doc-reject" data-id="${d.client_id}" ${st !== "not_uploaded" ? "" : "disabled"}>Отклонить</button>
            </td>
          </tr>`;
        })
        .join("");
    }

    if (els.rentalDocsTable) {
      els.rentalDocsTable.innerHTML = state.bookings
        .map((b) => {
          const c = byCarId(b.car_id);
          const hasDoc = state.rentalDocs.some((d) => Number(d.booking_id) === Number(b.id));
          return `<tr>
            <td>${b.id}</td>
            <td>${c ? `${c.brand} ${c.model}` : `#${b.car_id}`}</td>
            <td>${statusBadge(hasDoc ? "prepared" : "pending")}</td>
            <td style="display:flex; gap:.35rem; flex-wrap:wrap;">
              <button class="btn btn--outline btn--sm" data-action="booking-generate-docs" data-id="${b.id}">Подготовить</button>
              <button class="btn btn--outline btn--sm" data-action="booking-print-docs" data-id="${b.id}">Печать</button>
            </td>
          </tr>`;
        })
        .join("");
    }
  }

  function renderUsers() {
    if (!els.usersTable) return;
    if (!isAdmin) {
      els.usersTable.innerHTML = '<tr><td colspan="7" class="text-center">Управление пользователями доступно только администратору</td></tr>';
      return;
    }
    els.usersTable.innerHTML = state.users
      .map((u) => `<tr>
        <td>${u.id}</td>
        <td>${u.first_name} ${u.last_name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${statusBadge(u.status)}</td>
        <td>${window.Utils.formatDate(u.created_at || new Date().toISOString())}</td>
        <td><button class="btn btn--outline btn--sm" data-action="user-toggle-status" data-id="${u.id}">${u.status === "active" ? "Блокировать" : "Активировать"}</button></td>
      </tr>`)
      .join("");
  }

  function renderAll() {
    renderDashboard();
    renderCars();
    renderBookings();
    renderDocuments();
    renderUsers();
  }
  function resolveDocumentUrl(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
    const normalized = url.startsWith("/") ? url : `/${url}`;
    try {
      const base = window.APP_CONFIG?.API_BASE_URL || "";
      if (base.startsWith("http")) return `${new URL(base).origin}${normalized}`;
    } catch (_) {}
    return normalized;
  }

  function openClientDocsModal(title, html) {
    if (!els.clientDocsModal || !els.clientDocsModalTitle || !els.clientDocsModalBody) return;
    els.clientDocsModalTitle.textContent = title;
    els.clientDocsModalBody.innerHTML = html;
    els.clientDocsModal.style.display = "flex";
    els.clientDocsModal.classList.add("modal--visible");
  }

  function closeClientDocsModal() {
    if (!els.clientDocsModal || !els.clientDocsModalBody) return;
    els.clientDocsModal.classList.remove("modal--visible");
    els.clientDocsModal.style.display = "none";
    els.clientDocsModalBody.innerHTML = "";
  }

  function openCarModal(car) {
    if (!els.carModal) return;
    els.carModal.style.display = "flex";
    els.carModal.classList.add("modal--visible");
    els.carModalTitle.textContent = car ? "Редактировать автомобиль" : "Добавить автомобиль";
    els.carId.value = car ? String(car.id) : "";
    $("carBrand").value = car?.brand || "";
    $("carModel").value = car?.model || "";
    $("carYear").value = car?.year || "";
    $("carPlate").value = car?.license_plate || "";
    $("carPrice").value = car?.price_per_day || "";
    $("carStatus").value = car?.status || "free";
    $("carTransmission").value = car?.transmission || "";
    $("carFuel").value = car?.fuel_type || "";
    $("carSeats").value = car?.seats || "";
    $("carDescription").value = car?.description || "";
  }

  function closeCarModal() {
    if (!els.carModal || !els.carForm) return;
    els.carModal.classList.remove("modal--visible");
    els.carModal.style.display = "none";
    els.carForm.reset();
    els.carId.value = "";
  }

  async function openDocumentViewer(clientId, type) {
    const doc = state.documents.find((d) => Number(d.client_id) === Number(clientId));
    if (!doc) return window.Utils.showNotification("warning", "Документы клиента не найдены");
    const key = type === "passport" ? "passport_scan_url" : "license_scan_url";
    const url = doc[key];
    if (!url) return window.Utils.showNotification("warning", "Файл документа не загружен");
    const resolved = resolveDocumentUrl(url);
    const title = type === "passport" ? `Паспорт клиента #${clientId}` : `Водительское удостоверение клиента #${clientId}`;
    const html = /\.pdf(\?|$)/i.test(String(resolved))
      ? `<iframe class="doc-preview doc-preview--pdf" src="${resolved}" title="${title}"></iframe>`
      : `<img class="doc-preview doc-preview--image" src="${resolved}" alt="${title}" />`;
    openClientDocsModal(title, `${html}<p style="margin-top:1rem;"><a class="btn btn--outline btn--sm" href="${resolved}" target="_blank" rel="noopener noreferrer">Открыть в новой вкладке</a></p>`);
  }

  async function openClientCard(clientId) {
    let entity = byClientEntity(clientId);
    try {
      entity = await window.documentsAPI.getClient(clientId);
      state.clientEntities[Number(clientId)] = entity;
    } catch (_) {}
    if (!entity) return window.Utils.showNotification("warning", "Карточка клиента пока недоступна");

    const user = entity.user || {};
    const docs = entity.documents || {};
    const bookings = Array.isArray(entity.bookings) ? entity.bookings : [];
    openClientDocsModal(
      `Клиент #${clientId}`,
      `<div class="client-card-grid">
        <div class="client-card-block">
          <h4>Профиль клиента</h4>
          <div class="client-card-row"><span>ФИО</span><strong>${user.full_name || "-"}</strong></div>
          <div class="client-card-row"><span>Email</span><span>${user.email || "-"}</span></div>
          <div class="client-card-row"><span>Телефон</span><span>${user.phone || "-"}</span></div>
          <div class="client-card-row"><span>Статус</span><span>${statusBadge(user.status || "inactive")}</span></div>
        </div>
        <div class="client-card-block">
          <h4>Документы</h4>
          <div class="client-card-row"><span>Проверка</span><span>${statusBadge(docs.verification_status || "not_uploaded")}</span></div>
          <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.75rem;">
            <button class="btn btn--outline btn--sm" data-action="doc-open-passport" data-id="${clientId}" ${docs.passport_scan_url ? "" : "disabled"}>Паспорт</button>
            <button class="btn btn--outline btn--sm" data-action="doc-open-license" data-id="${clientId}" ${docs.license_scan_url ? "" : "disabled"}>Вод. удостоверение</button>
          </div>
        </div>
      </div>
      <div class="client-card-block" style="margin-top:1rem;">
        <h4>Последние бронирования</h4>
        ${bookings.length ? `<ul>${bookings.slice(0,8).map((b)=>`<li>#${b.id} (${formatSafeDate(b.start_date)} - ${formatSafeDate(b.end_date)}), ${STATUS_LABELS[b.status] || b.status}</li>`).join("")}</ul>` : "<p>Бронирования отсутствуют</p>"}
      </div>`
    );
  }

  async function refreshAfterAction() {
    await loadData();
    renderAll();
  }

  els.addCarBtn?.addEventListener("click", () => openCarModal(null));
  els.applyBookingsFilterBtn?.addEventListener("click", () => {
    state.ui.bookingStatus = els.bookingStatusFilter?.value || "all";
    renderBookings();
  });
  els.bookingStatusFilter?.addEventListener("change", () => {
    state.ui.bookingStatus = els.bookingStatusFilter.value || "all";
    renderBookings();
  });
  els.carStatusFilter?.addEventListener("change", () => {
    state.ui.carStatus = els.carStatusFilter.value || "all";
    renderCars();
  });
  els.carSort?.addEventListener("change", () => {
    state.ui.carSort = els.carSort.value || "id_desc";
    renderCars();
  });
  els.resetCarFiltersBtn?.addEventListener("click", () => {
    state.ui.carStatus = "all";
    state.ui.carSort = "id_desc";
    if (els.carStatusFilter) els.carStatusFilter.value = "all";
    if (els.carSort) els.carSort.value = "id_desc";
    renderCars();
  });

  els.carModal?.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeCarModal));
  els.carModal?.querySelector(".modal__overlay")?.addEventListener("click", closeCarModal);
  els.clientDocsModal?.querySelectorAll("[data-close-client-docs]").forEach((btn) => btn.addEventListener("click", closeClientDocsModal));
  els.clientDocsModal?.querySelector(".modal__overlay")?.addEventListener("click", closeClientDocsModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (els.carModal?.classList.contains("modal--visible")) closeCarModal();
    if (els.clientDocsModal?.classList.contains("modal--visible")) closeClientDocsModal();
  });
  els.carForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      brand: $("carBrand").value.trim(),
      model: $("carModel").value.trim(),
      year: Number($("carYear").value || 0) || null,
      license_plate: $("carPlate").value.trim(),
      price_per_day: Number($("carPrice").value || 0),
      status: $("carStatus").value,
      transmission: $("carTransmission").value || null,
      fuel_type: $("carFuel").value || null,
      seats: Number($("carSeats").value || 0) || null,
      description: $("carDescription").value.trim(),
    };

    try {
      const editingId = els.carId.value ? Number(els.carId.value) : null;
      if (editingId) {
        await window.carsAPI.update(editingId, payload);
      } else {
        await window.carsAPI.create(payload);
      }
      await refreshAfterAction();
      closeCarModal();
      window.Utils.showNotification("success", "Автомобиль сохранен");
    } catch (error) {
      window.Utils.showNotification("error", error.message, "Ошибка сохранения авто");
    }
  });

  document.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");
    const id = Number(target.getAttribute("data-id"));

    try {
      if (action === "open-bookings") return switchSection("bookings");
      if (action === "edit-car") {
        return openCarModal(state.cars.find((c) => Number(c.id) === id));
      }
      if (action === "toggle-car-status") {
        const car = state.cars.find((c) => Number(c.id) === id);
        await window.carsAPI.updateStatus(id, car?.status === "free" ? "maintenance" : "free");
      }
      if (action === "delete-car") {
        if (!confirm(`Удалить автомобиль #${id}?`)) return;
        await window.carsAPI.delete(id);
      }
      if (action === "booking-confirm") await window.bookingsAPI.confirm(id);
      if (action === "booking-reject") await window.bookingsAPI.reject(id);
      if (action === "booking-pickup") await window.bookingsAPI.pickup(id, {});
      if (action === "booking-return") await window.bookingsAPI.return(id, {});
      if (action === "booking-generate-docs") {
        await window.bookingsAPI.generateDocuments(id);
        window.Utils.showNotification("success", `Пакет документов для брони #${id} подготовлен`);
      }
      if (action === "booking-print-docs") {
        const existing = state.rentalDocs.find((d) => Number(d.booking_id) === id);
        if (!existing) {
          const generated = await window.bookingsAPI.generateDocuments(id);
          if (generated) state.rentalDocs.push(generated);
        }
        const booking = state.bookings.find((b) => Number(b.id) === id);
        const car = booking ? byCarId(booking.car_id) : null;
        const user = booking ? byClientUser(booking.client_id) : null;
        const docs = state.rentalDocs.find((d) => Number(d.booking_id) === id);
        const printHtml = `<html><head><title>Rental Docs #${id}</title></head><body style="font-family:Arial,sans-serif;padding:24px;">
          <h1>Пакет документов аренды</h1>
          <p><strong>Бронь:</strong> #${id}</p>
          <p><strong>Клиент:</strong> ${user ? `${user.first_name} ${user.last_name}` : "-"}</p>
          <p><strong>Автомобиль:</strong> ${car ? `${car.brand} ${car.model}` : "-"}</p>
          <ul><li>Договор: ${docs?.contract_path || "не подготовлен"}</li><li>Акт: ${docs?.act_path || "не подготовлен"}</li><li>Доверенность: ${docs?.power_of_attorney_path || "не подготовлен"}</li></ul>
        </body></html>`;
        const w = window.open("", "_blank");
        if (w) {
          w.document.open();
          w.document.write(printHtml);
          w.document.close();
          w.focus();
          w.print();
        }
      }
      if (action === "doc-open-client") return openClientCard(id);
      if (action === "doc-open-passport") return openDocumentViewer(id, "passport");
      if (action === "doc-open-license") return openDocumentViewer(id, "license");
      if (action === "doc-verify") {
        await window.documentsAPI.verify(id, { status: "verified", rejection_reason: null });
        window.Utils.showNotification("success", `Документы клиента #${id} подтверждены`);
      }
      if (action === "doc-reject") {
        const reason = prompt("Причина отклонения документов:", "Некорректные данные") || "Отклонено";
        await window.documentsAPI.verify(id, { status: "rejected", rejection_reason: reason });
        window.Utils.showNotification("warning", `Документы клиента #${id} отклонены`);
      }
      if (action === "user-toggle-status") {
        if (!isAdmin) {
          window.Utils.showNotification("warning", "Только администратор может изменять статус пользователей");
          return;
        }
        const user = state.users.find((u) => Number(u.id) === id);
        const next = user?.status === "active" ? "blocked" : "active";
        await window.usersAPI.updateStatus(id, next);
      }

      await refreshAfterAction();
    } catch (error) {
      window.Utils.showNotification("error", error.message, "Операция не выполнена");
    }
  });

  try {
    await loadData();
    renderAll();
    switchSection("dashboard");
  } catch (error) {
    window.Utils.showNotification("error", error.message, "Ошибка загрузки админ-панели");
  }
});
