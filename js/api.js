const API_BASE = window.location.protocol === "file:" ? "http://localhost:8788" : window.location.origin;

async function submitScoreToServer() {
  const payload = {
    userInfo: state.userInfo,
    scores: state.scores,
    completedModules: state.completedModules,
    finishTime: state.finishTime,
    answerLog: JSON.parse(JSON.stringify(state.answerLog || {}))
  };
  const response = await fetch(`${API_BASE}/api/submit-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) {
    if (data.error && data.error.includes("活动已结束")) {
      showToast("活动已结束，不能继续提交成绩");
    }
    throw new Error(data.error || "提交成绩失败");
  }
  /* 保存 reportId 到本地，供后续 PDF 使用 */
  if (data.reportId) {
    localStorage.setItem("safetyMonth2026.reportId", data.reportId);
  }
  return data.record;
}

async function fetchRankingFromServer() {
  const response = await fetch(`${API_BASE}/api/ranking`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "获取排行榜失败");
  return data.rows || [];
}

async function fetchMyRankFromServer(employeeId) {
  const response = await fetch(`${API_BASE}/api/my-rank?employeeId=${encodeURIComponent(employeeId)}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "获取个人排名失败");
  return data.row || null;
}
