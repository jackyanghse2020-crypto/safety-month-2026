let hazardMatchState = { clicked: new Set(), correct: 0, wrong: 0 };

function initHazardMatch() {
  hazardMatchState = { clicked: new Set(), correct: 0, wrong: 0 };
  state.answerLog.hazardMatch = { correct: 0, wrong: 0, totalRisk: 10, score: 0 };
  document.getElementById("hazardCards").innerHTML = shuffle(hazardMatchCards).map((card) => `
    <button class="hazard-card" type="button" data-id="${card.id}" data-type="${card.type}">
      ${card.text}
    </button>
  `).join("");
  updateHazardMatch();
}

function updateHazardMatch() {
  const score = Math.max(0, Math.min(20, hazardMatchState.correct * 2 - hazardMatchState.wrong));
  state.answerLog.hazardMatch = {
    correct: hazardMatchState.correct,
    wrong: hazardMatchState.wrong,
    totalRisk: 10,
    score
  };
  saveState();
  document.getElementById("hazardMatchProgress").textContent = `已消除隐患：${hazardMatchState.correct} / 10`;
  document.getElementById("hazardMatchScore").textContent = `当前得分：${score}分`;
  return score;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hazardCards").addEventListener("click", (event) => {
    const card = event.target.closest(".hazard-card");
    if (!card || hazardMatchState.clicked.has(card.dataset.id)) return;
    hazardMatchState.clicked.add(card.dataset.id);
    if (card.dataset.type === "risk") {
      hazardMatchState.correct += 1;
      card.classList.add("eliminated");
      card.textContent = "已消除：" + card.textContent.trim();
      const score = updateHazardMatch();
      if (hazardMatchState.correct === 10) {
        setModuleScore("hazardMatch", score);
        showModal("恭喜你完成本关！", `本关得分：${score}分`, () => showPage("menuPage"));
      }
    } else {
      hazardMatchState.wrong += 1;
      card.classList.add("wrong");
      updateHazardMatch();
      showToast("这是正确做法，不需要消除");
    }
  });
});
