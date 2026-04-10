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

  const links = document.querySelectorAll(".profile-nav__link");
  const sections = document.querySelectorAll(".profile-section");
  const MAX_DOC_FILES_PER_TYPE = 2;

  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");

  if (firstName) firstName.value = user.first_name || user.firstName || "";
  if (lastName) lastName.value = user.last_name || user.lastName || "";
  if (email) email.value = user.email || "";
  if (phone) phone.value = user.phone || "";

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;

      links.forEach((l) => l.classList.remove("profile-nav__link--active"));
      link.classList.add("profile-nav__link--active");

      sections.forEach((s) => {
        s.style.display = s.id === section ? "block" : "none";
      });
    });
  });

  const personalForm = document.getElementById("personalForm");
  if (personalForm) {
    personalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        first_name: document.getElementById("firstName")?.value.trim() || "",
        last_name: document.getElementById("lastName")?.value.trim() || "",
        phone: document.getElementById("phone")?.value.trim() || "",
      };

      try {
        const current = window.Utils.getCurrentUser();
        const userId = current?.id;
        if (userId) {
          const updated = await window.usersAPI.update(userId, payload);
          window.Utils.setCurrentUser(updated);
        }
        window.Utils.showNotification("success", "Профиль обновлен");
      } catch (error) {
        window.Utils.showNotification("error", error.message, "Ошибка обновления");
      }
    });
  }

  const docsForm = document.getElementById("documentsForm");
  if (docsForm) {
    docsForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const passportFiles = Array.from(document.getElementById("passport")?.files || []);
      const licenseFiles = Array.from(document.getElementById("license")?.files || []);

      if (
        passportFiles.length !== MAX_DOC_FILES_PER_TYPE ||
        licenseFiles.length !== MAX_DOC_FILES_PER_TYPE
      ) {
        window.Utils.showNotification(
          "warning",
          "Загрузите 2 фото паспорта и 2 фото водительского удостоверения"
        );
        return;
      }

      const formData = new FormData();
      passportFiles.forEach((file) => formData.append("passport", file));
      licenseFiles.forEach((file) => formData.append("license", file));

      try {
        await window.documentsAPI.upload(formData);
        window.Utils.showNotification("success", "Документы отправлены на проверку");
        docsForm.reset();
      } catch (error) {
        window.Utils.showNotification("error", error.message, "Ошибка загрузки");
      }
    });
  }
});
