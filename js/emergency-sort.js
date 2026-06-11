let emergencyState = { index: 0, scenarioScores: [], selected: [], shuffled: [] };

function initEmergencySort() {
  emergencyState = { index: 0, scenarioScores: [], selected: [], shuffled: [] };
  state.answerLog.emergencySort = [];
  saveState();
  renderEmergencyScenario();
}

function renderEmergencyScenario() {
  const scenario = emergencyScenarios[emergencyState.index];
  emergencyState.selected = [];
  emergencyState.shuffled = shuffle(scenario.steps.map((text, index) => ({ text, index })));
  document.getElementById("scenarioTitle").textContent = scenario.title;
  document.getElementById("scenarioQuestion").textContent = scenario.question;
  document.getElementById("sortFeedback").textContent = "";
  document.getElementById("emergencyProgress").textContent = `场景 ${emergencyState.index + 1} / ${emergencyScenarios.length}`;
  renderStepLists();
  updateEmergencyScore();
}

function renderStepLists() {
  document.getElementById("answerZone").innerHTML = emergencyState.selected.map((item, index) => `
    <button class="answer-step" type="button" data-answer="${index}">${index + 1}. ${item.text}</button>
  `).join("");
  document.getElementById("stepList").innerHTML = emergencyState.shuffled.map((item) => `
    <button class="step-btn" type="button" data-step="${item.index}" ${emergencyState.selected.some((selected) => selected.index === item.index) ? "disabled" : ""}>
      ${item.text}
    </button>
  `).join("");
}

function updateEmergencyScore() {
  const score = emergencyState.scenarioScores.reduce((sum, item) => sum + item, 0)
    + (emergencyState.scenarioScores.length === emergencyScenarios.length ? 1 : 0);
  document.getElementById("emergencyScore").textContent = `当前得分：${score}分`;
  return score;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stepList").addEventListener("click", (event) => {
    const button = event.target.closest(".step-btn");
    if (!button) return;
    const item = emergencyState.shuffled.find((step) => step.index === Number(button.dataset.step));
    emergencyState.selected.push(item);
    renderStepLists();
  });

  document.getElementById("answerZone").addEventListener("click", (event) => {
    const button = event.target.closest(".answer-step");
    if (!button) return;
    emergencyState.selected.splice(Number(button.dataset.answer), 1);
    renderStepLists();
  });

  document.getElementById("resetSortBtn").addEventListener("click", () => {
    emergencyState.selected = [];
    document.getElementById("sortFeedback").textContent = "";
    renderStepLists();
  });

  document.getElementById("checkSortBtn").addEventListener("click", () => {
    const scenario = emergencyScenarios[emergencyState.index];
    if (emergencyState.selected.length !== scenario.steps.length) {
      document.getElementById("sortFeedback").textContent = "请先完成全部步骤排序。";
      return;
    }
    const correctCount = emergencyState.selected.filter((item, index) => item.index === index).length;
    const scenarioScore = Math.round((correctCount / scenario.steps.length) * 8);
    emergencyState.scenarioScores[emergencyState.index] = scenarioScore;
    state.answerLog.emergencySort[emergencyState.index] = {
      scenario: scenario.title,
      selectedOrder: emergencyState.selected.map((item) => item.index + 1),
      correctCount,
      totalSteps: scenario.steps.length,
      score: scenarioScore
    };
    saveState();
    const score = updateEmergencyScore();
    const correctAnswer = scenario.steps.map((step, index) => `${index + 1}. ${step}`).join("；");
    showModal(
      "本场景已结算",
      `本场景位置正确 ${correctCount} / ${scenario.steps.length}，得 ${scenarioScore} 分。正确顺序：${correctAnswer}。${scenario.explanation}`,
      () => {
      if (emergencyState.index < emergencyScenarios.length - 1) {
        emergencyState.index += 1;
        renderEmergencyScenario();
      } else {
        setModuleScore("emergencySort", score);
        showPage("menuPage");
      }
    });
  });
});
