const state = {
  userInfo: loadJSON(APP_STORAGE_KEYS.userInfo, { name: "", department: "", employeeId: "" }),
  scores: loadJSON(APP_STORAGE_KEYS.scores, { ...defaultScores }),
  completedModules: loadJSON(APP_STORAGE_KEYS.completedModules, { ...defaultCompletedModules }),
  answerLog: loadJSON(APP_STORAGE_KEYS.answerLog, structuredClone(defaultAnswerLog)),
  finishTime: localStorage.getItem(APP_STORAGE_KEYS.finishTime) || "",
  rankType: "company",
  rankingRows: []
};

function loadJSON(key, fallback) {
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) };
  } catch {
    return { ...fallback };
  }
}

function saveState() {
  state.scores.total = Object.keys(defaultCompletedModules).reduce((sum, key) => sum + Number(state.scores[key] || 0), 0);
  localStorage.setItem(APP_STORAGE_KEYS.userInfo, JSON.stringify(state.userInfo));
  localStorage.setItem(APP_STORAGE_KEYS.scores, JSON.stringify(state.scores));
  localStorage.setItem(APP_STORAGE_KEYS.completedModules, JSON.stringify(state.completedModules));
  localStorage.setItem(APP_STORAGE_KEYS.answerLog, JSON.stringify(state.answerLog));
  if (state.finishTime) {
    localStorage.setItem(APP_STORAGE_KEYS.finishTime, state.finishTime);
  } else {
    localStorage.removeItem(APP_STORAGE_KEYS.finishTime);
  }
}

function setModuleScore(key, score) {
  state.scores[key] = Math.max(0, Math.round(score));
  state.completedModules[key] = true;
  if (Object.values(state.completedModules).every(Boolean)) {
    state.finishTime = formatDateTime(new Date());
  }
  saveState();
  if (Object.values(state.completedModules).every(Boolean)) {
    syncScoreToServer();
  }
  renderMenu();
}

function isUserInfoComplete(userInfo = state.userInfo) {
  return Boolean(
    userInfo.name?.trim().length >= 2
    && userInfo.department?.trim()
    && /^\d{4}$/.test(userInfo.employeeId?.trim() || "")
  );
}

async function syncScoreToServer() {
  if (typeof submitScoreToServer !== "function") return;
  try {
    await submitScoreToServer();
    showToast("成绩已同步到飞书排行榜");
  } catch (error) {
    console.warn(error);
    if (error.message && error.message.includes("活动已结束")) {
      showToast("活动已结束，成绩仅保存在本机");
    } else {
      showToast("成绩已保存在本机，飞书同步失败，请联系管理员");
    }
  }
}

function resetAll() {
  Object.values(APP_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  state.userInfo = { name: "", department: "", employeeId: "" };
  state.scores = { ...defaultScores };
  state.completedModules = { ...defaultCompletedModules };
  state.answerLog = structuredClone(defaultAnswerLog);
  state.finishTime = "";
  document.getElementById("userForm").reset();
  renderMenu();
  showPage("homePage");
}

function formatDateTime(date) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
  document.getElementById("backBtn").classList.toggle("hidden", pageId === "homePage");
  if (pageId === "menuPage") renderMenu();
  if (pageId === "resultPage") renderResults();
  if (pageId === "rankingPage") renderRanking();
  if (pageId === "reportPage") renderReport();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.showPage = showPage;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showModal(title, text, onClose) {
  const modal = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalText").textContent = text;
  modal.classList.remove("hidden");
  const closeBtn = document.getElementById("modalCloseBtn");
  closeBtn.onclick = () => {
    modal.classList.add("hidden");
    if (onClose) onClose();
  };
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function renderMenu() {
  const total = Object.keys(defaultCompletedModules).reduce((sum, key) => sum + Number(state.scores[key] || 0), 0);
  state.scores.total = total;
  document.getElementById("welcomeText").textContent = state.userInfo.name
    ? `${state.userInfo.name}，欢迎进入安全月闯关活动`
    : "欢迎进入安全月闯关活动";
  document.getElementById("totalScoreMini").textContent = total;
  document.getElementById("doneCountMini").textContent = `${Object.values(state.completedModules).filter(Boolean).length}/4`;

  const grid = document.getElementById("moduleGrid");
  grid.innerHTML = modules.map((item) => {
    const done = state.completedModules[item.key];
    const score = state.scores[item.key] || 0;
    return `
      <button class="module-card" type="button" data-module="${item.key}" data-page="${item.page}">
        <span class="module-icon">${item.icon}</span>
        <span>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <small>分值：${item.maxScore}分</small>
          ${done ? `<div class="module-status">已完成，得分 ${score} 分，可重新挑战</div>` : ""}
        </span>
      </button>
    `;
  }).join("");

  document.getElementById("resultEntryBtn").classList.toggle("hidden", !Object.values(state.completedModules).every(Boolean));
}

function renderResults() {
  const user = state.userInfo;
  const total = state.scores.total || 0;
  const levelInfo = getLevelInfo(total);
  const circumference = 2 * Math.PI * 52;
  document.getElementById("resultUserInfo").innerHTML = `
    <div><span>姓名</span><strong>${user.name || "-"}</strong></div>
    <div><span>部门</span><strong>${user.department || "-"}</strong></div>
    <div><span>工号</span><strong>${user.employeeId || "-"}</strong></div>
  `;
  document.getElementById("resultHero").className = `result-hero ${levelInfo.className}`;
  document.getElementById("levelIcon").innerHTML = levelInfo.icon;
  document.getElementById("levelMessage").textContent = levelInfo.message;
  document.getElementById("resultList").innerHTML = modules.map((item) => `
    <div class="result-row">
      <div>
        <span>${item.title}</span>
        <div class="result-bar"><i style="width:${Math.min(100, Math.round(((state.scores[item.key] || 0) / item.maxScore) * 100))}%"></i></div>
      </div>
      <strong>${state.scores[item.key] || 0} / ${item.maxScore}</strong>
    </div>
  `).join("");
  document.getElementById("finalTotal").textContent = total;
  document.getElementById("finalLevel").textContent = levelInfo.title;
  document.getElementById("scoreRingFill").style.strokeDasharray = `${circumference}`;
  document.getElementById("scoreRingFill").style.strokeDashoffset = `${circumference * (1 - Math.min(100, total) / 100)}`;
  document.getElementById("finishTime").textContent = `完成时间：${state.finishTime || formatDateTime(new Date())}`;
}

function renderReport() {
  const user = state.userInfo;
  const total = state.scores.total || 0;
  const levelInfo = getLevelInfo(total);
  document.getElementById("reportUserBlock").innerHTML = `
    <h3>参与者信息</h3>
    <div class="report-grid">
      <span>姓名：${user.name || "-"}</span>
      <span>部门：${user.department || "-"}</span>
      <span>工号：${user.employeeId || "-"}</span>
      <span>完成时间：${state.finishTime || "-"}</span>
    </div>
  `;
  document.getElementById("reportScoreBlock").innerHTML = `
    <h3>成绩汇总</h3>
    <div class="report-total">${total} / 100 · ${levelInfo.title}</div>
    ${modules.map((item) => `<div class="report-row"><span>${item.title}</span><strong>${state.scores[item.key] || 0} / ${item.maxScore}</strong></div>`).join("")}
  `;
  const log = state.answerLog || structuredClone(defaultAnswerLog);
  document.getElementById("reportProcessBlock").innerHTML = `
    <h3>作答过程摘要</h3>
    <div class="report-subblock">
      <strong>火眼金睛查隐患</strong>
      <p>已识别隐患点：${log.hazardFind?.foundCount || 0} / ${log.hazardFind?.total || 8}；本模块得分：${log.hazardFind?.score || state.scores.hazardFind || 0} 分。</p>
    </div>
    <div class="report-subblock">
      <strong>隐患消消乐</strong>
      <p>正确消除：${log.hazardMatch?.correct || 0} 项；误点正常项：${log.hazardMatch?.wrong || 0} 项；本模块得分：${log.hazardMatch?.score || state.scores.hazardMatch || 0} 分。</p>
    </div>
    <div class="report-subblock">
      <strong>应急行动排序</strong>
      ${(log.emergencySort || []).length ? log.emergencySort.map((item, index) => `<p>场景 ${index + 1}：位置正确 ${item.correctCount} / ${item.totalSteps}，得 ${item.score} 分。已记录参与者提交顺序编号，不展示正确顺序。</p>`).join("") : "<p>暂无记录。</p>"}
    </div>
    <div class="report-subblock">
      <strong>安全知识闯关</strong>
      ${(log.quiz || []).length ? `<p>共作答 ${log.quiz.length} 题，答对 ${log.quiz.filter((item) => item.isCorrect).length} 题。以下仅显示题号、分类、所选项序号和判定，不展示题干、选项内容或正确答案。</p>
      <ol class="report-quiz-list">
        ${log.quiz.map((item, index) => `<li>第 ${index + 1} 题 · ${item.category || "安全知识"} · 选择 ${item.selectedLabel} · ${item.isCorrect ? "正确" : "错误"}</li>`).join("")}
      </ol>` : "<p>暂无记录。</p>"}
    </div>
  `;
}

function buildReportPayload() {
  return {
    userInfo: { name: state.userInfo.name, department: state.userInfo.department, employeeId: state.userInfo.employeeId },
    scores: { hazardFind: state.scores.hazardFind, hazardMatch: state.scores.hazardMatch, emergencySort: state.scores.emergencySort, quiz: state.scores.quiz, total: state.scores.total },
    finishTime: state.finishTime,
    answerLog: JSON.parse(JSON.stringify(state.answerLog || {}))
  };
}

async function saveReportAsPdf() {
  const button = document.getElementById("printReportBtn");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "正在准备 PDF...";
  showToast("正在准备 PDF，请稍候");

  try {
    const payload = buildReportPayload();
    console.log("[PDF] buildReportPayload total:", payload.scores?.total, "user:", payload.userInfo?.name);

    /* 方案0（最优）：使用服务端 reportId 生成 PDF */
    const reportId = localStorage.getItem("safetyMonth2026.reportId");
    if (reportId) {
      try {
        const pdfUrl = `/api/report/${reportId}/pdf?t=${Date.now()}`;
        showToast("PDF 已生成，正在打开...");
        window.location.href = pdfUrl;
        return;
      } catch (e) {
        console.warn("[PDF] reportId方式失败，降级:", e);
      }
    }

    /* 方案1（首选）：AJAX生成PDF → 获取唯一文件URL → 跳转 */
    try {
      const resp = await fetch("/api/create-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.ok && data.url) {
        showToast("PDF 已生成，正在打开...");
        window.location.href = data.url;
        return;
      }
    } catch (ajaxErr) {
      console.warn("[PDF] AJAX方式失败，尝试form POST:", ajaxErr);
    }

    /* 方案2（备选）：先存储报告到服务端 → 通过 key 生成 PDF */
    try {
      const storeResp = await fetch("/api/store-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const storeData = await storeResp.json();
      if (storeData.ok && storeData.key) {
        const pdfUrl = `/api/generate-pdf?key=${storeData.key}&t=${Date.now()}`;
        showToast("PDF 已生成，正在打开...");
        window.location.href = pdfUrl;
        return;
      }
    } catch (e) {
      console.warn("[PDF] store-report方式失败:", e);
    }

    /* 方案3（兜底）：form POST直接跳转generate-pdf */
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/generate-pdf?t=" + Date.now();
    form.style.display = "none";
    form.setAttribute("accept-charset", "UTF-8");

    const hiddenField = document.createElement("input");
    hiddenField.type = "hidden";
    hiddenField.name = "reportData";
    hiddenField.value = JSON.stringify(payload);
    form.appendChild(hiddenField);
    document.body.appendChild(form);

    /* 同时准备回退链接 */
    const fallbackLink = document.getElementById("pdfFallbackLink");
    if (fallbackLink) {
      fallbackLink.textContent = "如果 PDF 未自动打开，请点击此处";
      fallbackLink.style.display = "block";
    }

    showToast("正在生成 PDF...");
    form.submit();
  } catch (err) {
    console.warn("[PDF] Error:", err);
    showToast("PDF 生成失败，请截图保存成绩页");
    button.disabled = false;
    button.textContent = originalText;
    window.print();
  }
}

function getLeaderboardRows() {
  const rows = [...sampleLeaderboard];
  if (state.userInfo.name && state.scores.total > 0) {
    rows.push({
      name: state.userInfo.name,
      department: state.userInfo.department,
      employeeId: state.userInfo.employeeId,
      total: state.scores.total,
      finishTime: state.finishTime || formatDateTime(new Date()),
      isCurrent: true
    });
  }
  return rows
    .sort((a, b) => b.total - a.total || String(a.finishTime).localeCompare(String(b.finishTime)))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function renderRanking() {
  let rows = getLeaderboardRows();
  let sourceText = "本地示例榜单";
  if (typeof fetchRankingFromServer === "function") {
    try {
      const remoteRows = await fetchRankingFromServer();
      if (remoteRows.length) {
        rows = remoteRows.map((row) => ({
          name: row.name,
          department: row.department,
          employeeId: row.employeeId,
          total: Number(row.total || 0),
          finishTime: row.finishTime,
          rank: row.rank,
          isCurrent: row.employeeId && row.employeeId === state.userInfo.employeeId
        }));
        sourceText = "飞书实时榜单";
      }
    } catch (error) {
      console.warn(error);
      sourceText = "飞书暂不可用，显示本地示例";
    }
  }
  state.rankingRows = rows;
  renderRankingRows(sourceText);
}

function renderRankingRows(sourceText = "飞书实时榜单") {
  const rows = state.rankingRows.length ? state.rankingRows : getLeaderboardRows();
  const current = rows.find((row) => row.isCurrent);
  const departmentRows = state.userInfo.department
    ? rows.filter((row) => row.department === state.userInfo.department)
      .map((row, index) => ({ ...row, departmentRank: index + 1 }))
    : [];
  const currentDept = departmentRows.find((row) => row.isCurrent);
  const displayRows = state.rankType === "department" ? departmentRows : rows;

  document.querySelectorAll(".rank-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.rankType === state.rankType);
  });
  document.getElementById("rankSummary").innerHTML = current
    ? `
      <div>
        <span>我的公司排名</span>
        <strong>第 ${current.rank} 名</strong>
      </div>
      <div>
        <span>我的部门排名</span>
        <strong>${currentDept ? `第 ${currentDept.departmentRank} 名` : "暂无"}</strong>
      </div>
    `
    : `
      <div>
        <span>我的公司排名</span>
        <strong>未完成</strong>
      </div>
      <div>
        <span>我的部门排名</span>
        <strong>未完成</strong>
      </div>
    `;
  const scopeText = state.rankType === "department" && state.userInfo.department
    ? `${state.userInfo.department}部门榜`
    : "公司总榜";
  document.querySelector("#rankingPage .section-head p").textContent = `${sourceText} · ${scopeText}。按总分从高到低排序，同分时按提交时间先后排序。`;
  document.getElementById("rankingList").innerHTML = displayRows.length ? displayRows.map((row) => `
    <div class="ranking-row ${row.isCurrent ? "current" : ""}">
      <span class="rank-no">${state.rankType === "department" ? row.departmentRank : row.rank}</span>
      <div>
        <strong>${row.name}</strong>
        <small>${row.department} · ${row.employeeId}</small>
      </div>
      <em>${row.total}</em>
    </div>
  `).join("") : `<div class="empty-rank">当前部门暂无排行榜数据</div>`;
}

function getLevelInfo(total) {
  if (total >= 90) {
    return {
      title: "安全达人",
      className: "level-master",
      message: "表现优秀，隐患识别和应急处置能力都很扎实。",
      icon: `<svg viewBox="0 0 96 96" role="img" aria-label="奖杯"><path d="M28 16h40v14c0 19-8 31-20 36-12-5-20-17-20-36V16z" fill="currentColor"/><path d="M28 24H14c0 14 6 24 18 27M68 24h14c0 14-6 24-18 27" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M43 66h10v12h18v8H25v-8h18z" fill="currentColor"/><path d="M48 26l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff"/></svg>`
    };
  }
  if (total >= 80) {
    return {
      title: "安全标兵",
      className: "level-elite",
      message: "成绩很好，继续保持现场风险识别的敏感度。",
      icon: `<svg viewBox="0 0 96 96" role="img" aria-label="盾牌"><path d="M48 8l30 12v24c0 22-13 37-30 45-17-8-30-23-30-45V20z" fill="currentColor"/><path d="M34 48l10 10 20-27" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };
  }
  if (total >= 60) {
    return {
      title: "合格参与",
      className: "level-pass",
      message: "已达到活动合格线，建议复盘薄弱模块再冲高分。",
      icon: `<svg viewBox="0 0 96 96" role="img" aria-label="合格徽章"><circle cx="48" cy="48" r="34" fill="currentColor"/><path d="M31 50l12 12 24-31" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 76l-6 14 18-6M70 76l6 14-18-6" fill="currentColor"/></svg>`
    };
  }
  return {
    title: "继续努力",
    className: "level-try",
    message: "还没有达到 60 分合格线，建议重新挑战并重点学习错题。",
    icon: `<svg viewBox="0 0 96 96" role="img" aria-label="继续努力"><path d="M48 10l38 68H10z" fill="currentColor"/><path d="M48 34v20" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="48" cy="66" r="5" fill="#fff"/></svg>`
  };
}

document.addEventListener("DOMContentLoaded", () => {
  /* data-go 按钮：touchend + click 双绑定，修复微信浏览器点击延迟 */
  let lastTapTime = 0;
  document.querySelectorAll("[data-go]").forEach((button) => {
    const handler = () => {
      const now = Date.now();
      if (now - lastTapTime < 300) return;
      lastTapTime = now;
      showPage(button.dataset.go);
    };
    button.addEventListener("touchend", (e) => { e.preventDefault(); handler(); }, { passive: false });
    button.addEventListener("click", handler);
  });

  document.getElementById("backBtn").addEventListener("click", () => {
    if (typeof canLeaveHazardFind === "function" && !canLeaveHazardFind()) {
      showToast("本关正在计时，时间到或找满 8 处后即可进入下一环节");
      return;
    }
    showPage("menuPage");
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    showModal("清除记录", "确定要清除记录并重新开始吗？", resetAll);
  });
  document.getElementById("resultEntryBtn").addEventListener("click", () => showPage("resultPage"));
  document.getElementById("rankingEntryBtn").addEventListener("click", () => showPage("rankingPage"));
  document.querySelectorAll(".rank-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.rankType = button.dataset.rankType;
      renderRankingRows();
    });
  });
  document.getElementById("restartBtn").addEventListener("click", () => {
    state.scores = { ...defaultScores };
    state.completedModules = { ...defaultCompletedModules };
    state.finishTime = "";
    saveState();
    renderMenu();
    showPage("menuPage");
  });
  document.getElementById("screenshotTipBtn").addEventListener("click", () => {
    showModal("截图提示", "请使用手机截图保存你的成绩单，并提交给部门安全员。");
  });
  document.getElementById("reportEntryBtn").addEventListener("click", () => showPage("reportPage"));
  document.getElementById("printReportBtn").addEventListener("click", saveReportAsPdf);

  document.getElementById("userForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.userInfo = {
      name: form.get("name").trim(),
      department: form.get("department"),
      employeeId: form.get("employeeId").trim()
    };
    if (!isUserInfoComplete(state.userInfo)) {
      showToast("请填写真实姓名、部门和4位数字工号后再进入活动");
      return;
    }
    saveState();
    renderMenu();
    showPage("menuPage");
  });

  document.getElementById("moduleGrid").addEventListener("click", (event) => {
    const card = event.target.closest(".module-card");
    if (!card) return;
    if (!isUserInfoComplete()) {
      showToast("请先完整填写员工信息");
      showPage("infoPage");
      return;
    }
    if (card.dataset.module === "hazardFind") initHazardFind();
    if (card.dataset.module === "hazardMatch") initHazardMatch();
    if (card.dataset.module === "emergencySort") initEmergencySort();
    if (card.dataset.module === "quiz") initQuiz();
    showPage(card.dataset.page);
  });

  document.getElementById("userName").value = state.userInfo.name;
  document.getElementById("department").value = state.userInfo.department;
  document.getElementById("employeeId").value = state.userInfo.employeeId;
  renderMenu();
});
