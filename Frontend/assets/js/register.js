document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const submitBtn = document.getElementById("submitBtn");
  const terms = document.getElementById("terms");
  const modal = document.getElementById("successModal");

  if (!form) return;

  if (terms && submitBtn) {
    terms.addEventListener("change", () => {
      submitBtn.disabled = !terms.checked;
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!firstName || !lastName || !email || !password) {
      window.Utils.showNotification("warning", "Заполните обязательные поля");
      return;
    }
    if (password !== confirmPassword) {
      window.Utils.showNotification("warning", "Пароли не совпадают");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Регистрация...";

    try {
      await window.authAPI.register({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password,
      });
      if (modal) {
        modal.style.display = "block";
      } else {
        window.Utils.showNotification("success", "Регистрация завершена");
        setTimeout(() => (window.location.href = "/pages/Login.html"), 1000);
      }
    } catch (error) {
      window.Utils.showNotification("error", error.message, "Ошибка регистрации");
      submitBtn.disabled = false;
      submitBtn.textContent = "Зарегистрироваться";
    }
  });
});

