let quizState = { questions: [], index: 0, correct: 0, answered: false };

function initQuiz() {
  quizState = {
    questions: shuffle(quizQuestions).slice(0, 20),
    index: 0,
    correct: 0,
    answered: false
  };
  state.answerLog.quiz = [];
  saveState();
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const item = quizState.questions[quizState.index];
  quizState.answered = false;
  document.getElementById("quizProgress").textContent = `第 ${quizState.index + 1} / ${quizState.questions.length} 题`;
  document.getElementById("quizScore").textContent = `当前得分：${Math.round(quizState.correct * 1.25)}分`;
  document.getElementById("quizCategory").textContent = item.category;
  document.getElementById("quizQuestion").textContent = item.question;
  document.getElementById("quizFeedback").textContent = "";
  document.getElementById("nextQuizBtn").classList.add("hidden");
  document.getElementById("quizOptions").innerHTML = item.options.map((option, index) => `
    <button class="option-btn" type="button" data-index="${index}">${String.fromCharCode(65 + index)}. ${option}</button>
  `).join("");
}

function finishQuiz() {
  const score = Math.round(quizState.correct * 1.25);
  setModuleScore("quiz", score);
  showModal("安全知识闯关完成", `本关得分：${score}分`, () => showPage("menuPage"));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("quizOptions").addEventListener("click", (event) => {
    const button = event.target.closest(".option-btn");
    if (!button || quizState.answered) return;
    quizState.answered = true;
    const item = quizState.questions[quizState.index];
    const selected = Number(button.dataset.index);
    const buttons = [...document.querySelectorAll(".option-btn")];
    buttons.forEach((optionButton) => {
      const optionIndex = Number(optionButton.dataset.index);
      optionButton.disabled = true;
      if (optionIndex === item.answer) optionButton.classList.add("correct");
    });
    if (selected === item.answer) {
      quizState.correct += 1;
      document.getElementById("quizFeedback").textContent = `回答正确。${item.explanation}`;
    } else {
      button.classList.add("incorrect");
      document.getElementById("quizFeedback").textContent = `回答错误。正确答案：${String.fromCharCode(65 + item.answer)}。${item.explanation}`;
    }
    state.answerLog.quiz[quizState.index] = {
      category: item.category,
      selectedLabel: String.fromCharCode(65 + selected),
      isCorrect: selected === item.answer
    };
    saveState();
    document.getElementById("quizScore").textContent = `当前得分：${Math.round(quizState.correct * 1.25)}分`;
    document.getElementById("nextQuizBtn").textContent = quizState.index === quizState.questions.length - 1 ? "完成闯关" : "下一题";
    document.getElementById("nextQuizBtn").classList.remove("hidden");
  });

  document.getElementById("nextQuizBtn").addEventListener("click", () => {
    if (quizState.index === quizState.questions.length - 1) {
      finishQuiz();
      return;
    }
    quizState.index += 1;
    renderQuizQuestion();
  });
});
