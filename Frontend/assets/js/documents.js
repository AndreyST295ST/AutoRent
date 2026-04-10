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

  const statusContainer = document.getElementById("documentsStatus");
  const rentalContainer = document.getElementById("rentalDocuments");
  const uploadForm = document.getElementById("uploadForm");
  const passportInput = document.getElementById("passport");
  const licenseInput = document.getElementById("license");
  const passportPreview = document.getElementById("passportPreview");
  const licensePreview = document.getElementById("licensePreview");
  const MAX_FILES_PER_TYPE = 2;

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

  function extractUrls(doc, type) {
    const listKey = type === "passport" ? "passport_scan_urls" : "license_scan_urls";
    const legacyKey = type === "passport" ? "passport_scan_url" : "license_scan_url";

    const list = Array.isArray(doc?.[listKey]) ? doc[listKey].filter(Boolean) : [];
    if (list.length) return list;
    if (doc?.[legacyKey]) return [doc[legacyKey]];
    return [];
  }

  function renderFileList(container, files = [], title = "") {
    if (!container) return;
    if (!files.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = files
      .map((file) => {
        const label = typeof file === "string" ? file.split("/").pop() : file.name;
        return `<div class="file-preview__item">${title ? `${title}: ` : ""}${label}</div>`;
      })
      .join("");
  }

  function renderUploadedLinks(title, urls) {
    if (!urls.length) {
      return `<div class="file-preview"><div class="file-preview__item">${title}: не загружено</div></div>`;
    }

    return `
      <div class="file-preview">
        ${urls
          .map((url, index) => {
            const resolved = resolveAssetUrl(url);
            return `<a class="file-preview__item" href="${resolved}" target="_blank" rel="noopener noreferrer">${title} ${index + 1}</a>`;
          })
          .join("")}
      </div>
    `;
  }

  function validateSelectedFiles(passportFiles, licenseFiles) {
    if (passportFiles.length !== MAX_FILES_PER_TYPE || licenseFiles.length !== MAX_FILES_PER_TYPE) {
      window.Utils.showNotification(
        "warning",
        "Загрузите 2 фото паспорта и 2 фото водительского удостоверения"
      );
      return false;
    }
    return true;
  }

  async function loadStatus() {
    try {
      const doc = await window.documentsAPI.getMy();
      const verificationStatus = doc?.verification_status || doc?.status || "not_uploaded";
      const statusLabel = window.Utils.getDocumentStatusLabel(verificationStatus);
      const passportUrls = extractUrls(doc, "passport");
      const licenseUrls = extractUrls(doc, "license");

      statusContainer.innerHTML = `
        <div class="alert alert--info">
          Статус проверки: <strong>${statusLabel}</strong>
          ${doc?.verified_at ? `<br><small>Проверено: ${window.Utils.formatDate(doc.verified_at)}</small>` : ""}
          ${doc?.rejection_reason ? `<br><small>Причина отклонения: ${doc.rejection_reason}</small>` : ""}
        </div>
        ${renderUploadedLinks("Паспорт", passportUrls)}
        ${renderUploadedLinks("ВУ", licenseUrls)}
      `;
    } catch (error) {
      statusContainer.innerHTML = `<div class="alert alert--error">${error.message}</div>`;
    }
  }

  async function loadRentalDocs() {
    if (!rentalContainer) return;
    rentalContainer.innerHTML = "<p>Документы аренды появятся после подтверждения брони.</p>";
  }

  passportInput?.addEventListener("change", () => {
    renderFileList(passportPreview, Array.from(passportInput.files || []), "Паспорт");
  });

  licenseInput?.addEventListener("change", () => {
    renderFileList(licensePreview, Array.from(licenseInput.files || []), "ВУ");
  });

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const passportFiles = Array.from(passportInput?.files || []);
      const licenseFiles = Array.from(licenseInput?.files || []);

      if (!validateSelectedFiles(passportFiles, licenseFiles)) {
        return;
      }

      const formData = new FormData();
      passportFiles.forEach((file) => formData.append("passport", file));
      licenseFiles.forEach((file) => formData.append("license", file));

      try {
        await window.documentsAPI.upload(formData);
        window.Utils.showNotification("success", "Документы успешно загружены");
        uploadForm.reset();
        if (passportPreview) passportPreview.innerHTML = "";
        if (licensePreview) licensePreview.innerHTML = "";
        await loadStatus();
      } catch (error) {
        window.Utils.showNotification("error", error.message, "Ошибка загрузки");
      }
    });
  }

  await loadStatus();
  await loadRentalDocs();
});
