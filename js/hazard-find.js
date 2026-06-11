const HAZARD_FIND_LIMIT_SECONDS = 180;

let hazardFindState = {
  found: new Set(),
  remaining: HAZARD_FIND_LIMIT_SECONDS,
  timerId: null,
  settled: false
};

function initHazardFind() {
  clearHazardFindTimer();
  hazardFindState = {
    found: new Set(),
    remaining: HAZARD_FIND_LIMIT_SECONDS,
    timerId: null,
    settled: false
  };
  state.answerLog.hazardFind = { foundCount: 0, total: hazardFindPoints.length, score: 0 };
  const layer = document.getElementById("hazardHotspots");
  layer.innerHTML = hazardFindPoints.map((point) => `
    <button class="hotspot" type="button" style="left:${point.x}%; top:${point.y}%;" data-id="${point.id}" aria-label="${point.title}"></button>
  `).join("");
  const finishBtn = document.getElementById("hazardFindFinishBtn");
  finishBtn.disabled = true;
  finishBtn.textContent = "计时中，结算后返回活动菜单";
  updateHazardFind();
  startHazardFindTimer();
}

function updateHazardFind() {
  const foundCount = hazardFindState.found.size;
  const score = Math.round(foundCount * 3.75);
  state.answerLog.hazardFind = {
    foundCount,
    total: hazardFindPoints.length,
    score,
    timeUsedSeconds: HAZARD_FIND_LIMIT_SECONDS - hazardFindState.remaining
  };
  saveState();
  document.getElementById("hazardFindProgress").textContent = `已发现：${foundCount} / ${hazardFindPoints.length}`;
  document.getElementById("hazardFindTimer").textContent = `剩余时间：${formatHazardFindTime(hazardFindState.remaining)}`;
  document.getElementById("hazardFindScore").textContent = `当前得分：${score}分`;
}

function startHazardFindTimer() {
  hazardFindState.timerId = setInterval(() => {
    if (hazardFindState.settled) {
      clearHazardFindTimer();
      return;
    }
    hazardFindState.remaining = Math.max(0, hazardFindState.remaining - 1);
    updateHazardFind();
    if (hazardFindState.remaining === 0) {
      settleHazardFind("时间到，已自动结算");
    }
  }, 1000);
}

function clearHazardFindTimer() {
  if (hazardFindState.timerId) {
    clearInterval(hazardFindState.timerId);
  }
}

function formatHazardFindTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function settleHazardFind(title = "本关已结算", skipModal = false) {
  if (hazardFindState.settled) return;
  hazardFindState.settled = true;
  clearHazardFindTimer();
  updateHazardFind();

  const foundCount = hazardFindState.found.size;
  const score = Math.round(foundCount * 3.75);
  setModuleScore("hazardFind", score);

  const finishBtn = document.getElementById("hazardFindFinishBtn");
  finishBtn.disabled = false;
  finishBtn.textContent = "进入下一环节";

  if (!skipModal) {
    showModal(
      title,
      `本关发现 ${foundCount} / ${hazardFindPoints.length} 处隐患，得 ${score} 分。未满八个也可以继续进入下一环节，正确答案将在活动结束后统一公布。`
    );
  }
}

function canLeaveHazardFind() {
  const page = document.getElementById("hazardFindPage");
  return !page?.classList.contains("active") || hazardFindState.settled;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hazardFindFinishBtn").addEventListener("click", () => {
    if (!hazardFindState.settled) {
      showToast("本关正在计时，时间到或找满 8 处后即可进入下一环节");
      return;
    }
    showPage("menuPage");
  });

  document.getElementById("hazardHotspots").addEventListener("click", (event) => {
    const button = event.target.closest(".hotspot");
    if (!button || hazardFindState.settled) return;
    const id = Number(button.dataset.id);
    const point = hazardFindPoints.find((item) => item.id === id);
    if (hazardFindState.found.has(id)) {
      showModal(point.title, point.text);
      return;
    }
    hazardFindState.found.add(id);
    button.classList.add("found");
    updateHazardFind();
    const done = hazardFindState.found.size === hazardFindPoints.length;
    showModal(done ? "恭喜你完成本关！" : point.title, point.text, () => {
      if (done) {
        settleHazardFind("恭喜你完成本关！", true);
      }
    });
  });
});
