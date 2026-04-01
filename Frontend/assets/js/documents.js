document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.getElementById("documentsStatus");
  const rentalContainer = document.getElementById("rentalDocuments");
  const uploadForm = document.getElementById("uploadForm");
  const user = window.Utils.getCurrentUser();
  const clientId = user?.id || 1;

  async function loadStatus() {
    try {
      const doc = await window.documentsAPI.getMy(clientId);
      statusContainer.innerHTML = `
        <div class="alert alert--info">
          Статус: <strong>${doc.verification_status || doc.status || "not_uploaded"}</strong>
        </div>
      `;
    } catch (error) {
      statusContainer.innerHTML = `<div class="alert alert--error">${error.message}</div>`;
    }
  }

  async function loadRentalDocs() {
    if (!rentalContainer) return;
    rentalContainer.innerHTML = "<p>Документы аренды появятся после подтверждения брони.</p>";
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const passport = document.getElementById("passport").files[0];
      const license = document.getElementById("license").files[0];
      if (!passport || !license) {
        window.Utils.showNotification("warning", "Выберите файлы документов");
        return;
      }
      const formData = new FormData();
      formData.append("passport", passport);
      formData.append("license", license);
      formData.append("client_id", String(clientId));
      try {
        await window.documentsAPI.upload(formData);
        window.Utils.showNotification("success", "Документы успешно загружены");
        await loadStatus();
      } catch (error) {
        window.Utils.showNotification("error", error.message, "Ошибка загрузки");
      }
    });
  }

  await loadStatus();
  await loadRentalDocs();
});
