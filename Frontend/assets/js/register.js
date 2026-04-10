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
      const registerResponse = await window.authAPI.register({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password,
      });
      const needsActivation = Boolean(registerResponse?.activation_required);
      if (modal) {
        const title = modal.querySelector("#modalTitle");
        const text = modal.querySelector("p");
        if (title) {
          title.textContent = needsActivation ? "Подтвердите email" : "Регистрация успешна!";
        }
        if (text) {
          text.innerHTML = needsActivation
            ? "Аккаунт создан.<br>Мы отправили письмо для подтверждения на вашу почту."
            : "Ваш аккаунт создан и активирован.<br>Теперь можно войти в систему.";
        }
        modal.style.display = "flex";
        modal.classList.add("modal--visible");
      } else {
        window.Utils.showNotification(
          "success",
          needsActivation
            ? "Регистрация завершена. Подтвердите аккаунт через email."
            : "Регистрация завершена"
        );
        setTimeout(() => (window.location.href = "/pages/Login.html"), 1000);
      }
    } catch (error) {
      window.Utils.showNotification("error", error.message, "Ошибка регистрации");
      submitBtn.disabled = false;
      submitBtn.textContent = "Зарегистрироваться";
    }
  });
});
