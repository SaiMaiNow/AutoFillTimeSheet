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

const MONTH_NAMES_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// Map leave code to หมายเหตุ label for print form
const LEAVE_CODE_TO_LABEL = {
  "PL1": "ลากิจทั้งวัน",
  "PL0.5M": "ลากิจครึ่งวันเช้า",
  "PL0.5A": "ลากิจครึ่งวันบ่าย",
  "SL1": "ลาป่วยทั้งวัน",
  "SL0.5M": "ลาป่วยครึ่งวันเช้า",
  "SL0.5A": "ลาป่วยครึ่งวันบ่าย",
  "ขาด": "ขาด",
};

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

function detectMonthYearFromText(lineText) {
  lineText = String(lineText || "").trim();
  const match = lineText.match(
    /(January|February|Febuary|March|April|May|June|July|August|September|October|November|December)\s*(?:\(\s*(\d{4})\s*\)|(\d{4}))/i
  );
  if (!match) return null;
  let monthName = match[1];
  if (monthName.toLowerCase() === "febuary") monthName = "February";
  const year = parseInt(match[2] || match[3], 10);
  const month = MONTH_NAMES_EN.findIndex((m) => m.toLowerCase() === monthName.toLowerCase()) + 1;
  return month >= 1 ? { month, year } : null;
}

// Leave code rules: Thai description -> code (ตัวหนังสือเริ่มต้น + ระยะเวลา). "ขาด" = Absent.
const LEAVE_CODE_RULES = [
  { pattern: /ลาป่วย\s*ทั้งวัน|SL\s*1|SL1/i, code: "SL1" },
  { pattern: /ลาป่วย\s*ครึ่งวันเช้า|SL\s*0\.5\s*M|SL0\.5M/i, code: "SL0.5M" },
  { pattern: /ลาป่วย\s*ครึ่งวันบ่าย|SL\s*0\.5\s*A|SL0\.5A/i, code: "SL0.5A" },
  { pattern: /ลากิจ\s*ทั้งวัน|PL\s*1|PL1/i, code: "PL1" },
  { pattern: /ลากิจ\s*ครึ่งวันเช้า|PL\s*0\.5\s*M|PL0\.5M/i, code: "PL0.5M" },
  { pattern: /ลากิจ\s*ครึ่งวันบ่าย|PL\s*0\.5\s*A|PL0\.5A/i, code: "PL0.5A" },
  { pattern: /ขาด/i, code: "ขาด" },
];

function normalizeLeaveCode(cellValue) {
  const s = String(cellValue || "").trim();
  if (!s) return "";
  for (const { pattern, code } of LEAVE_CODE_RULES) {
    if (pattern.test(s)) return code;
  }
  return s;
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

// Random time in 7:00–8:30 (minutes 420–510), return "HH:MM"
function randomTimeIn() {
  const min = 420 + Math.floor(Math.random() * 91); // 7:00–8:30
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

// Fill print form (#printform) with report data (inputs normalized for PDF)
function fillPrintForm(month, yearAD, fullName, studentId, leaveByDay, workingDays, useRandomTime) {
  fullName = String(fullName || "").trim();
  studentId = String(studentId || "").trim();
  const yearBE = yearAD + 543;
  const leaveMap = {};
  leaveByDay.forEach(({ day, code }) => { leaveMap[day] = code; });

  const printMonthEl = document.getElementById("printMonth");
  const printNameEl = document.getElementById("printName");
  const printIdEl = document.getElementById("printId");
  const tbody = document.getElementById("timesheetBody");
  const sumPresentEl = document.getElementById("sumPresent");
  const sumPersonalEl = document.getElementById("sumPersonal");
  const sumSickEl = document.getElementById("sumSick");
  const sumAbsentEl = document.getElementById("sumAbsent");

  if (printMonthEl) printMonthEl.textContent = MONTH_NAMES_TH[month - 1] + " " + yearBE;
  if (printNameEl) printNameEl.textContent = fullName;
  if (printIdEl) printIdEl.textContent = studentId;

  let countPresent = 0;
  let countPersonal = 0;
  let countSick = 0;
  let countAbsent = 0;

  // Only working days (no Sat/Sun, no public holidays) - ใส่แค่วันที่มาได้
  const rows = [];
  const sortedWorking = [...workingDays].sort((a, b) => a - b);
  for (const day of sortedWorking) {
    const dateStr = day + "/" + month + "/" + yearBE;
    const code = leaveMap[day];
    let remark = "";
    let timeIn = "";
    let timeOut = "";
    if (useRandomTime) {
      // Full-day leave (ลากิจทั้งวัน, ลาป่วยทั้งวัน) or absent: do not fill time in/out
      if (code === "PL1" || code === "SL1" || code === "ขาด") {
        timeIn = "";
        timeOut = "";
      } else if (code === "PL0.5M" || code === "SL0.5M") {
        timeIn = "12:00";
        timeOut = "18:00";
      } else if (code === "PL0.5A" || code === "SL0.5A") {
        timeIn = randomTimeIn();
        timeOut = "12:00";
      } else {
        timeIn = randomTimeIn();
        timeOut = "18:00";
      }
    }
    if (code) {
      remark = LEAVE_CODE_TO_LABEL[code] || code;
      if (code === "ขาด") countAbsent += 1;
      else if (/^PL/.test(code)) countPersonal += code === "PL1" ? 1 : 0.5;
      else if (/^SL/.test(code)) countSick += code === "SL1" ? 1 : 0.5;
    } else {
      countPresent += 1;
    }
    rows.push(
      "<tr><td class=\"border border-black py-1 px-1\">" + dateStr +
      "</td><td class=\"border border-black py-1 px-1\">" + timeIn + "</td><td class=\"border border-black py-1 px-1\">" + timeOut + "</td>" +
      "<td class=\"border border-black py-1 px-1\">" + remark + "</td></tr>"
    );
  }
  if (tbody) tbody.innerHTML = rows.join("");

  const fmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1));
  if (sumPresentEl) sumPresentEl.textContent = fmt(countPresent);
  if (sumPersonalEl) sumPersonalEl.textContent = fmt(countPersonal);
  if (sumSickEl) sumSickEl.textContent = fmt(countSick);
  if (sumAbsentEl) sumAbsentEl.textContent = fmt(countAbsent);
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

    // Normalize whole file before parse (trim and consistent line endings)
    text = text.trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      showResult("ไฟล์ CSV ว่าง", true);
      return;
    }

    // Detect month/year from first row (e.g. "สถิติการลา intern(January 2026)" or ",,,Febuary(2026 ),,,,")
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

    // Parse CSV rows; skip title row, next row is header (each line already trimmed)
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
    const dataRow = rows[matchedRowIndex - 1];
    const studentId = ((document.getElementById("numberId") && document.getElementById("numberId").value) || "").trim();

    // Day columns: header cells "1".."31"
    const dayCols = [];
    for (let i = 0; i < header.length; i++) {
      const h = String(header[i]).trim();
      if (/^\d{1,2}$/.test(h)) {
        const d = parseInt(h, 10);
        if (d >= 1 && d <= 31) dayCols.push({ day: d, colIndex: i });
      }
    }

    // Apply leave code rules to the matched row (แถวชื่อที่เจอ)
    const leaveByDay = [];
    for (const { day, colIndex } of dayCols) {
      const raw = (dataRow[colIndex] || "").trim();
      if (!raw) continue;
      const code = normalizeLeaveCode(raw);
      leaveByDay.push({ day, raw, code });
    }

    const useRandomTime = document.getElementById("randomTimeCheck") && document.getElementById("randomTimeCheck").checked;
    fillPrintForm(month, year, searchFullName, studentId, leaveByDay, workingDays, useRandomTime);
    const printform = document.getElementById("printform");
    const reportResult = document.getElementById("reportResult");
    if (reportResult) {
      reportResult.classList.add("hidden");
      reportResult.innerHTML = "";
    }
    if (printform) {
      const prevTitle = document.title;
      document.title = searchFullName;
      window.print();
      setTimeout(function () { document.title = prevTitle; }, 1000);
    }
  });
})();
