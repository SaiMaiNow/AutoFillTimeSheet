// Validate CSV file: only accept CSV with UTF-8 encoding
(function () {
  const input = document.getElementById("csvFile");
  const errorEl = document.getElementById("csvError");
  if (!input || !errorEl) return;

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
    input.value = "";
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  input.addEventListener("change", async function () {
    const file = input.files?.[0];
    if (!file) {
      clearError();
      return;
    }

    // Must be .csv
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showError("กรุณาเลือกเฉพาะไฟล์ CSV (.csv)");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      decoder.decode(buffer);
      clearError();
    } catch (e) {
      showError("ไฟล์ต้องเป็น CSV ที่เข้ารหัส UTF-8 เท่านั้น");
    }
  });
})();
