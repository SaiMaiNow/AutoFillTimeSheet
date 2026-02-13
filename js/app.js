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

// Thai public holidays by year (AD) and month (day numbers). Source: วันหยุดในปี 69 (พ.ศ. 2569)
const THAI_HOLIDAYS = {
  2026: {
    1: [1],              // วันขึ้นปีใหม่
    2: [17],             // วันตรุษจีน
    3: [3],              // วันมาฆบูชา
    4: [6, 13, 14, 15],  // วันจักรี, สงกรานต์
    5: [1, 4],           // วันแรงงาน, วันฉัตรมงคล
    6: [1, 3],           // ชดเชยวิสาขบูชา, วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดา
    7: [28, 29],         // วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว, วันอาสาฬหบูชา
    8: [12],             // วันแม่แห่งชาติ
    10: [13, 23],        // วันนวมินทรมหาราช, วันปิยมหาราช
    12: [7, 31],         // ชดเชยวันพ่อ (5 ธ.ค.), วันสิ้นปี
  },
};

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Parse a single CSV line (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let cell = "";
      while (i < line.length && line[i] !== '"') {
        cell += line[i];
        i++;
      }
      if (line[i] === '"') i++;
      result.push(cell.trim());
    } else {
      let end = line.indexOf(",", i);
      if (end === -1) end = line.length;
      result.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return result;
}

// Detect month and year from first row e.g. "January 2026" or "January (2026)" or ",,,January (2026),,,"
function detectMonthYearFromText(lineText) {
  const match = lineText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s*(?:\((\d{4})\)|(\d{4}))/i
  );
  if (!match) return null;
  const monthName = match[1];
  const year = parseInt(match[2] || match[3], 10);
  const month = MONTH_NAMES_EN.findIndex((m) => m.toLowerCase() === monthName.toLowerCase()) + 1;
  return month >= 1 ? { month, year } : null;
}

// Get working days in month (exclude Sat, Sun and Thai public holidays)
function getWorkingDays(yearAD, month) {
  const daysInMonth = new Date(yearAD, month, 0).getDate();
  const holidays = (THAI_HOLIDAYS[yearAD] && THAI_HOLIDAYS[yearAD][month]) || [];
  const holidaySet = new Set(holidays);
  const working = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(yearAD, month - 1, day).getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(day)) continue;
    working.push(day);
  }
  return working;
}

// Generate report: check CSV, parse month/year, match name row, show working days
(function () {
  const btn = document.getElementById("generateReport");
  const csvInput = document.getElementById("csvFile");
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const resultEl = document.getElementById("reportResult");

  if (!btn || !csvInput || !resultEl) return;

  function showResult(html, isError) {
    resultEl.innerHTML = html;
    resultEl.classList.remove("hidden");
    resultEl.classList.toggle("bg-red-50", isError);
    resultEl.classList.toggle("text-red-700", isError);
    resultEl.classList.toggle("bg-gray-50", !isError);
    resultEl.classList.toggle("text-gray-700", !isError);
  }

  btn.addEventListener("click", async function () {
    const file = csvInput.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      showResult("กรุณาเลือกไฟล์ CSV ก่อน", true);
      return;
    }

    let text;
    try {
      const buffer = await file.arrayBuffer();
      text = new TextDecoder("utf-8").decode(buffer);
    } catch (e) {
      showResult("อ่านไฟล์ CSV ไม่ได้", true);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      showResult("ไฟล์ CSV ว่าง", true);
      return;
    }

    // Detect month/year from first row (e.g. "สถิติการลา intern(January 2026)")
    const firstRowText = lines[0];
    const monthYear = detectMonthYearFromText(firstRowText);
    if (!monthYear) {
      showResult(
        "ไม่พบเดือน/ปี ในไฟล์ (ต้องมีรูปแบบเช่น January 2026 หรือ สถิติการลา intern(January 2026))",
        true
      );
      return;
    }

    const { month, year } = monthYear;
    const monthLabel = MONTH_NAMES_EN[month - 1] + " " + year;

    // Parse CSV rows; skip title row, next row is header
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      rows.push(parseCSVLine(lines[i]));
    }
    if (rows.length === 0) {
      showResult("ไม่มีแถวข้อมูลในไฟล์", true);
      return;
    }

    const header = rows[0];
    const fullNameCol = header.findIndex(
      (c) =>
        /full\s*name|ชื่อ|name/i.test(c) ||
        (c === "Full Name")
    );
    const nameCol = fullNameCol >= 0 ? fullNameCol : 0;

    const firstName = (firstNameInput && firstNameInput.value || "").trim();
    const lastName = (lastNameInput && lastNameInput.value || "").trim();
    const searchFullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (!searchFullName) {
      showResult("กรุณากรอกชื่อจริงและนามสกุล", true);
      return;
    }

    // Match row (normalize spaces for comparison)
    const normalize = (s) => String(s).replace(/\s+/g, " ").trim();
    let matchedRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      const cellName = normalize(rows[r][nameCol] || "");
      if (cellName === searchFullName || cellName.includes(searchFullName)) {
        matchedRowIndex = r + 1;
        break;
      }
    }
    if (matchedRowIndex < 0) {
      showResult(
        `ไม่พบแถวที่ตรงกับชื่อ "${searchFullName}" ในไฟล์ (ตรวจสอบการสะกดและรูปแบบชื่อ)`,
        true
      );
      return;
    }

    const workingDays = getWorkingDays(year, month);

    let html = `<p class="font-medium">เดือน/ปี ที่พบในไฟล์: ${monthLabel}</p>`;
    html += `<p>แถวที่ตรงกับชื่อของคุณ: แถวที่ ${matchedRowIndex} (แถวที่ 1 = หัวตาราง)</p>`;
    html += `<p class="mt-2">วันทำงาน (ไม่รวมเสาร์-อาทิตย์ และวันหยุดราชการ): ${workingDays.join(", ")}</p>`;
    html += `<p class="mt-1 text-gray-600">รวม ${workingDays.length} วัน</p>`;
    showResult(html, false);
  });
})();
