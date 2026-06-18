/* 强制时区为东八区，确保所有Date操作按北京时间处理 */
process.env.TZ = "Asia/Shanghai";

import http from "node:http";
import { readFileSync, existsSync, createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import PDFDocument from "pdfkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = normalize(join(__dirname, ".."));
const env = loadEnv(join(__dirname, ".env"));
// Render环境变量优先于.env文件
Object.keys(process.env).forEach(k => { if (process.env[k] !== undefined) env[k] = process.env[k]; });
const PORT = Number(process.env.PORT || env.PORT || 8788);
const APP_VERSION = "v2026.06.18-duration-ranking";
const ACTIVITY_END_AT = env.ACTIVITY_END_AT || "";
const FEISHU_BASE = "https://open.feishu.cn/open-apis";
const FEISHU_APP_TOKEN = cleanToken(env.FEISHU_APP_TOKEN);
const FEISHU_TABLE_ID = cleanToken(env.FEISHU_TABLE_ID);
const FONT_PATH = join(__dirname, "NotoSansCJKsc-Regular.otf");

let cachedToken = "";
let tokenExpireAt = 0;
const serverStartTime = new Date();

/* ========== 报告持久存储（服务端 reportId → 数据） ========== */
const reportStore = new Map();

/* ========== 字段映射 ========== */
const fieldNames = {
  name: "姓名",
  department: "部门",
  employeeId: "工号",
  hazardFind: "火眼金睛查隐患",
  hazardMatch: "隐患消消乐",
  emergencySort: "应急行动排序",
  quiz: "安全知识闯关",
  total: "总分",
  level: "等级",
  finishTime: "完成时间",
  durationSeconds: "用时秒数",
  submitTimePrecise: "提交时间精确",
  submitTimestamp: "提交时间戳",
  rankSortValue: "排名排序值",
  submitCount: "提交次数",
  deviceInfo: "设备信息",
  answerLogJson: "作答摘要JSON",
  reportId: "报告ID"
};

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const index = trimmed.indexOf("=");
      if (index === -1) return acc;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function cleanToken(value = "") {
  return String(value).trim().split("?")[0].split("#")[0];
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const byteLike = raw.split(",").every((part) => /^\d+$/.test(part.trim()));
    if (!byteLike) {
      throw new Error(`请求 JSON 解析失败，前缀：${JSON.stringify(raw.slice(0, 40))}`);
    }
    const restored = Buffer.from(raw.split(",").map((part) => Number(part.trim()))).toString("utf8");
    try {
      return JSON.parse(restored);
    } catch {
      throw new Error(`请求 JSON 解析失败，前缀：${JSON.stringify(raw.slice(0, 40))}`);
    }
  }
}

function requireConfig() {
  const missing = [];
  if (!env.FEISHU_APP_ID) missing.push("FEISHU_APP_ID");
  if (!env.FEISHU_APP_SECRET) missing.push("FEISHU_APP_SECRET");
  if (!FEISHU_APP_TOKEN) missing.push("FEISHU_APP_TOKEN");
  if (!FEISHU_TABLE_ID) missing.push("FEISHU_TABLE_ID");
  if (missing.length) {
    throw new Error(`缺少配置：${missing.join(", ")}`);
  }
}

async function getTenantToken() {
  requireConfig();
  if (cachedToken && Date.now() < tokenExpireAt) return cachedToken;
  const response = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 token 失败：${data.msg || data.code}`);
  }
  cachedToken = data.tenant_access_token;
  tokenExpireAt = Date.now() + Math.max(60, Number(data.expire || 7200) - 300) * 1000;
  return cachedToken;
}

async function feishu(path, options = {}) {
  const token = await getTenantToken();
  const response = await fetch(`${FEISHU_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`飞书接口返回非 JSON，HTTP ${response.status}，前缀：${JSON.stringify(text.slice(0, 80))}`);
  }
  if (data.code !== 0) {
    throw new Error(data.msg || `飞书接口错误：${data.code}`);
  }
  return data.data;
}

function getLevel(total) {
  if (total >= 90) return "安全达人";
  if (total >= 80) return "安全标兵";
  if (total >= 60) return "合格参与";
  return "继续努力";
}

function toFeishuDate(dateText) {
  /* TZ=Asia/Shanghai 后，客户端传入的时间字符串被正确解析为东八区 */
  const date = dateText ? new Date(dateText.replace(/-/g, "/")) : new Date();
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function fromFeishuDate(value) {
  if (!value) return "";
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);
  /* 强制东八区输出，不依赖服务器TZ设置 */
  const cn = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const pad = (num) => String(num).padStart(2, "0");
  return `${cn.getFullYear()}-${pad(cn.getMonth() + 1)}-${pad(cn.getDate())} ${pad(cn.getHours())}:${pad(cn.getMinutes())}`;
}

function formatDateTimeMs(date) {
  /* 强制东八区输出，不依赖服务器TZ设置 */
  const cn = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const pad = (num, size = 2) => String(num).padStart(size, "0");
  return `${cn.getFullYear()}-${pad(cn.getMonth() + 1)}-${pad(cn.getDate())} ${pad(cn.getHours())}:${pad(cn.getMinutes())}:${pad(cn.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function normalizeRecord(record) {
  const fields = record.fields || {};
  return {
    recordId: record.record_id,
    name: fields[fieldNames.name] || "",
    department: fields[fieldNames.department] || "",
    employeeId: fields[fieldNames.employeeId] || "",
    hazardFind: Number(fields[fieldNames.hazardFind] || 0),
    hazardMatch: Number(fields[fieldNames.hazardMatch] || 0),
    emergencySort: Number(fields[fieldNames.emergencySort] || 0),
    quiz: Number(fields[fieldNames.quiz] || 0),
    total: Number(fields[fieldNames.total] || 0),
    level: fields[fieldNames.level] || "",
    finishTime: fromFeishuDate(fields[fieldNames.finishTime]),
    durationSeconds: Number(fields[fieldNames.durationSeconds] || 0),
    submitTimePrecise: fields[fieldNames.submitTimePrecise] || "",
    submitTimestamp: Number(fields[fieldNames.submitTimestamp] || 0),
    rankSortValue: Number(fields[fieldNames.rankSortValue] || 0),
    submitCount: Number(fields[fieldNames.submitCount] || 1)
  };
}

async function listAllRecords() {
  const rows = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ page_size: "500" });
    if (pageToken) query.set("page_token", pageToken);
    const data = await feishu(`/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records?${query}`);
    rows.push(...(data.items || []).map(normalizeRecord));
    pageToken = data.page_token || "";
  } while (pageToken);
  return rows;
}

/* ========== 排行榜规则（2026-06-18更新v2）==========
 * 1. 同一工号多次提交，只取第一次提交的成绩
 * 2. 总分降序排列（分数最高排第一）
 * 3. 相同分数，答题用时短的排前面（用时秒数升序）
 * 4. 相同分数且用时相同，并列排名
 * 5. 已有记录无用时数据(0)的，排在有数据记录之后
 */
function bestRows(records) {
  const best = new Map();
  for (const row of records) {
    const key = row.employeeId || `${row.name}-${row.department}`;
    const current = best.get(key);
    // 只取第一次提交（submitTimestamp 最小的）
    if (!current || Number(row.submitTimestamp || 0) < Number(current.submitTimestamp || 0)) {
      best.set(key, row);
    }
  }
  // 排序：总分降序 → 用时秒数升序（无用时数据的排后面）→ 提交时间升序（兜底）
  const sorted = [...best.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const da = Number(a.durationSeconds || 0);
    const db = Number(b.durationSeconds || 0);
    // 都有用时数据时，按用时升序（用时短排前）
    if (da > 0 && db > 0) return da - db;
    // 有数据的排前面，无数据的排后面
    if (da > 0 && db === 0) return -1;
    if (da === 0 && db > 0) return 1;
    // 都没用时数据，按提交时间升序（先提交的排前）
    return Number(a.submitTimestamp || 0) - Number(b.submitTimestamp || 0);
  });
  // 并列排名：同分且用时相同排名
  let prevRank = 0;
  return sorted.map((row, index) => {
    let rank = index + 1;
    if (index > 0 && row.total === sorted[index - 1].total && row.durationSeconds === sorted[index - 1].durationSeconds) {
      rank = prevRank;
    }
    prevRank = rank;
    return { ...row, rank };
  });
}

function checkActivityEnd() {
  if (!ACTIVITY_END_AT) return false;
  return Date.now() > new Date(ACTIVITY_END_AT).getTime();
}

async function submitScore(payload, userAgent) {
  if (checkActivityEnd()) {
    throw new Error("活动已结束，不能继续提交成绩");
  }
  const scores = payload.scores || {};
  const total = Number(scores.total || 0);
  const finishTime = payload.finishTime || "";
  const durationSeconds = Number(payload.durationSeconds || 0);
  const submittedAt = new Date();
  const submitTimestamp = submittedAt.getTime();
  const rankSortValue = total * 10000000000000 - submitTimestamp;

  /* 生成 reportId */
  const reportId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* 作答摘要JSON */
  const answerLogJson = payload.answerLog ? JSON.stringify(payload.answerLog) : "";

  const fields = {
    [fieldNames.name]: payload.userInfo?.name || "",
    [fieldNames.department]: payload.userInfo?.department || "",
    [fieldNames.employeeId]: payload.userInfo?.employeeId || "",
    [fieldNames.hazardFind]: Number(scores.hazardFind || 0),
    [fieldNames.hazardMatch]: Number(scores.hazardMatch || 0),
    [fieldNames.emergencySort]: Number(scores.emergencySort || 0),
    [fieldNames.quiz]: Number(scores.quiz || 0),
    [fieldNames.total]: total,
    [fieldNames.level]: getLevel(total),
    [fieldNames.finishTime]: finishTime ? toFeishuDate(finishTime) : submittedAt.getTime(),
    [fieldNames.durationSeconds]: durationSeconds,
    [fieldNames.submitTimePrecise]: formatDateTimeMs(submittedAt),
    [fieldNames.submitTimestamp]: submitTimestamp,
    [fieldNames.rankSortValue]: rankSortValue,
    [fieldNames.submitCount]: 1,
    [fieldNames.deviceInfo]: (userAgent || "").slice(0, 200)
  };

  /* answerLogJson 和 reportId 仅存服务端 reportStore（飞书表格无此字段时跳过） */

  const record = await feishu(`/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`, {
    method: "POST",
    body: JSON.stringify({ fields })
  });

  /* 服务端存储报告数据，供 PDF 生成使用 */
  const reportData = {
    userInfo: payload.userInfo || {},
    scores: { hazardFind: scores.hazardFind, hazardMatch: scores.hazardMatch, emergencySort: scores.emergencySort, quiz: scores.quiz, total },
    finishTime: finishTime || formatDateTimeMs(submittedAt),
    answerLog: payload.answerLog || {},
    reportId,
    submittedAt: formatDateTimeMs(submittedAt)
  };
  reportStore.set(reportId, reportData);
  /* 30 分钟后自动清理 */
  setTimeout(() => reportStore.delete(reportId), 30 * 60 * 1000);

  console.log(`[submit-score] user=${payload.userInfo?.name} total=${total} reportId=${reportId}`);

  return { record: normalizeRecord(record.record || record), reportId };
}

/* ========== PDF 生成 ========== */
function generatePdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const fontExists = existsSync(FONT_PATH);
      if (fontExists) doc.registerFont("CN", FONT_PATH);
      const font = fontExists ? "CN" : "Helvetica";

      const user = data.userInfo || {};
      const scores = data.scores || {};
      const total = Number(scores.total || 0);
      const log = data.answerLog || {};
      const finishTime = data.finishTime || "";

      let level;
      if (total >= 90) level = "安全达人";
      else if (total >= 80) level = "安全标兵";
      else if (total >= 60) level = "合格参与";
      else level = "继续努力";

      /* 标题 */
      doc.font(font).fontSize(20).text("安全生产月互动闯关成绩报告", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#666666").text("本报告仅展示个人作答过程摘要，不展示正确答案。", { align: "center" });
      doc.fillColor("#000000").moveDown(1);

      /* 参与者信息 */
      doc.fontSize(14).text("参与者信息");
      doc.moveDown(0.3);
      doc.fontSize(11);
      doc.text(`姓名：${user.name || "-"}`);
      doc.text(`部门：${user.department || "-"}`);
      doc.text(`工号：${user.employeeId || "-"}`);
      doc.text(`完成时间：${finishTime || "-"}`);
      if (data.reportId) {
        doc.fontSize(9).fillColor("#999999").text(`报告编号：${data.reportId}`);
        doc.fillColor("#000000");
      }
      doc.moveDown(1);

      /* 成绩汇总 */
      doc.fontSize(14).text("成绩汇总");
      doc.moveDown(0.3);
      doc.fontSize(11);
      const moduleMap = [
        { key: "hazardFind", name: "火眼金睛查隐患", max: 30 },
        { key: "hazardMatch", name: "隐患消消乐", max: 20 },
        { key: "emergencySort", name: "应急行动排序", max: 25 },
        { key: "quiz", name: "安全知识闯关", max: 25 }
      ];
      for (const m of moduleMap) {
        doc.text(`${m.name}：${scores[m.key] || 0} / ${m.max}`);
      }
      doc.moveDown(0.3);
      doc.fontSize(13).text(`总分：${total} / 100    等级：${level}`, { align: "center" });
      doc.moveDown(1);

      /* 作答过程摘要 */
      doc.fontSize(14).text("作答过程摘要");
      doc.moveDown(0.3);

      /* 火眼金睛 */
      doc.fontSize(12).text("一、火眼金睛查隐患");
      doc.fontSize(10);
      const hfLog = log.hazardFind || {};
      doc.text(`  已识别隐患点：${hfLog.foundCount || 0} / ${hfLog.total || 8}；本模块得分：${hfLog.score || scores.hazardFind || 0} 分`);
      doc.moveDown(0.5);

      /* 隐患消消乐 */
      doc.fontSize(12).text("二、隐患消消乐");
      doc.fontSize(10);
      const hmLog = log.hazardMatch || {};
      doc.text(`  正确消除：${hmLog.correct || 0} 项；误点正常项：${hmLog.wrong || 0} 项；本模块得分：${hmLog.score || scores.hazardMatch || 0} 分`);
      doc.moveDown(0.5);

      /* 应急排序 */
      doc.fontSize(12).text("三、应急行动排序");
      doc.fontSize(10);
      const esLog = log.emergencySort || [];
      if (esLog.length) {
        for (let i = 0; i < esLog.length; i++) {
          const s = esLog[i];
          doc.text(`  场景 ${i + 1}：位置正确 ${s.correctCount || 0} / ${s.totalSteps || 0}，得 ${s.score || 0} 分`);
        }
      } else {
        doc.text("  暂无记录");
      }
      doc.moveDown(0.5);

      /* 安全知识闯关 */
      doc.fontSize(12).text("四、安全知识闯关");
      doc.fontSize(10);
      const qLog = log.quiz || [];
      if (qLog.length) {
        doc.text(`  共作答 ${qLog.length} 题，答对 ${qLog.filter((q) => q.isCorrect).length} 题`);
        doc.moveDown(0.3);
        for (let i = 0; i < qLog.length; i++) {
          const q = qLog[i];
          const mark = q.isCorrect ? "\u2714" : "\u2718";
          doc.text(`  ${mark} 第 ${i + 1} 题 · ${q.category || "安全知识"} · 选择 ${q.selectedLabel || "-"} · ${q.isCorrect ? "正确" : "错误"}`);
        }
      } else {
        doc.text("  暂无记录");
      }

      doc.moveDown(1);
      doc.fontSize(9).fillColor("#999999").text("为保护活动公平性，请勿将个人报告截图或 PDF 用于传播答案。", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/* ========== 路由处理 ========== */
async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    /* ===== 健康检查（含版本号） ===== */
    if (req.method === "GET" && url.pathname === "/api/health") {
      let feishuStatus = "unknown";
      try { await getTenantToken(); feishuStatus = "ok"; } catch { feishuStatus = "error"; }
      return json(res, 200, {
        ok: true,
        message: feishuStatus === "ok" ? "飞书连接正常" : "飞书连接异常",
        version: APP_VERSION,
        time: formatDateTimeMs(new Date())
      });
    }

    /* ===== 诊断接口 ===== */
    if (req.method === "GET" && url.pathname === "/api/diagnostics") {
      let feishuStatus = "unknown";
      try { await getTenantToken(); feishuStatus = "ok"; } catch (e) { feishuStatus = `error: ${e.message}`; }
      const uptime = Date.now() - serverStartTime.getTime();
      return json(res, 200, {
        server: "ok",
        feishu: feishuStatus,
        env: env.FEISHU_APP_ID ? "configured" : "missing",
        version: APP_VERSION,
        uptime,
        activityEnded: checkActivityEnd(),
        reportStoreSize: reportStore.size,
        fontAvailable: existsSync(FONT_PATH)
      });
    }

    /* ===== 提交成绩 ===== */
    if (req.method === "POST" && url.pathname === "/api/submit-score") {
      if (checkActivityEnd()) {
        return json(res, 403, { ok: false, error: "活动已结束，不能继续提交成绩" });
      }
      const payload = await readBody(req);
      const result = await submitScore(payload, req.headers["user-agent"]);
      return json(res, 200, { ok: true, ...result });
    }

    /* ===== 排行榜 ===== */
    if (req.method === "GET" && url.pathname === "/api/ranking") {
      const rows = bestRows(await listAllRecords());
      return json(res, 200, { ok: true, rows: rows.slice(0, 100) });
    }

    /* ===== 个人排名 ===== */
    if (req.method === "GET" && url.pathname === "/api/my-rank") {
      const employeeId = url.searchParams.get("employeeId") || "";
      const rows = bestRows(await listAllRecords());
      const row = rows.find((item) => item.employeeId === employeeId);
      return json(res, 200, { ok: true, row: row || null });
    }

    /* ===== 创建报告（服务端存储 → 返回 reportId） ===== */
    if (req.method === "POST" && url.pathname === "/api/create-report") {
      const payload = await readBody(req);
      const reportId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      reportStore.set(reportId, {
        ...payload,
        reportId,
        storedAt: formatDateTimeMs(new Date())
      });
      /* 30 分钟后自动清理 */
      setTimeout(() => reportStore.delete(reportId), 30 * 60 * 1000);
      console.log(`[create-report] reportId=${reportId} user=${payload.userInfo?.name || "-"} total=${payload.scores?.total || 0}`);
      return json(res, 200, { ok: true, reportId });
    }

    /* ===== 获取报告数据 ===== */
    if (req.method === "GET" && url.pathname.startsWith("/api/report/") && !url.pathname.endsWith("/pdf")) {
      const reportId = url.pathname.split("/api/report/")[1];
      const data = reportStore.get(reportId);
      if (!data) return json(res, 404, { ok: false, error: "报告不存在或已过期" });
      return json(res, 200, { ok: true, data });
    }

    /* ===== 获取报告 PDF（通过 reportId） ===== */
    if (req.method === "GET" && url.pathname.match(/^\/api\/report\/[^/]+\/pdf$/)) {
      const reportId = url.pathname.split("/api/report/")[1].replace("/pdf", "");
      const data = reportStore.get(reportId);
      if (!data) return json(res, 404, { ok: false, error: "报告不存在或已过期" });

      const pdfBuf = await generatePdf(data);
      const userName = (data.userInfo?.name || "participants").replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `SafetyReport-${userName}-${reportId}-${ts}.pdf`;

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": pdfBuf.length,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      res.end(pdfBuf);
      return;
    }

    /* ===== PDF 生成：AJAX create-pdf（兼容旧客户端） ===== */
    if (req.method === "POST" && url.pathname === "/api/create-pdf") {
      let payload;
      const contentType = (req.headers["content-type"] || "").toLowerCase();

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8");
        const params = new URLSearchParams(raw);
        const reportDataStr = params.get("reportData") || "";
        try { payload = JSON.parse(reportDataStr); } catch { payload = {}; }
      } else {
        payload = await readBody(req);
        if (payload.reportData && typeof payload.reportData === "string") {
          try { payload = JSON.parse(payload.reportData); } catch {}
        }
      }
      console.log(`[create-pdf] user=${payload.userInfo?.name || "-"} total=${payload.scores?.total || 0}`);

      const pdfBuf = await generatePdf(payload);
      const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const pdfFilename = `report-${nonce}.pdf`;
      const pdfDir = join(publicDir, "reports");
      mkdirSync(pdfDir, { recursive: true });
      const pdfPath = join(pdfDir, pdfFilename);
      writeFileSync(pdfPath, pdfBuf);
      console.log(`[create-pdf] saved ${pdfFilename} size=${pdfBuf.length}`);

      return json(res, 200, { ok: true, url: `/reports/${pdfFilename}` });
    }

    /* ===== 报告暂存（兼容旧客户端） ===== */
    if (req.method === "POST" && url.pathname === "/api/store-report") {
      const payload = await readBody(req);
      const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      reportStore.set(key, payload);
      setTimeout(() => reportStore.delete(key), 5 * 60 * 1000);
      return json(res, 200, { ok: true, key });
    }

    /* ===== PDF 生成 GET（兼容旧客户端） ===== */
    if (req.method === "GET" && url.pathname === "/api/generate-pdf") {
      const key = url.searchParams.get("key") || "";
      const storedData = key ? reportStore.get(key) : null;
      const payload = storedData || {};

      const pdfBuf = await generatePdf(payload);
      const userName = payload.userInfo?.name || "participants";
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `SafetyReport-${userName}-${ts}.pdf`;

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": pdfBuf.length,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      });
      res.end(pdfBuf);
      return;
    }

    /* ===== PDF 生成 POST（兼容旧客户端） ===== */
    if (req.method === "POST" && url.pathname === "/api/generate-pdf") {
      let payload;
      const contentType = (req.headers["content-type"] || "").toLowerCase();

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8");
        const params = new URLSearchParams(raw);
        const reportDataStr = params.get("reportData") || "";
        try { payload = JSON.parse(reportDataStr); } catch { payload = {}; }
      } else {
        payload = await readBody(req);
        if (payload.reportData && typeof payload.reportData === "string") {
          try { payload = JSON.parse(payload.reportData); } catch {}
        }
      }

      const pdfBuf = await generatePdf(payload);
      const userName = payload.userInfo?.name || "participants";
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const nonce = Math.random().toString(36).slice(2, 8);
      const filename = `SafetyReport-${userName}-${ts}-${nonce}.pdf`;

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": pdfBuf.length,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      res.end(pdfBuf);
      return;
    }

    /* ===== 静态文件 ===== */
    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }
    return json(res, 404, { ok: false, error: "接口不存在" });
  } catch (error) {
    console.error(`[ERROR] ${req.method} ${url.pathname}: ${error.message}`);
    return json(res, 500, { ok: false, error: error.message });
  }
}

function serveStatic(pathname, res) {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const requestedForCheck = requested.replace(/\\/g, "/");

  /* 安全拦截：禁止访问 /server/ 目录和隐藏文件 */
  if (requestedForCheck.startsWith("/server/") || requestedForCheck.split("/").some((part) => part.startsWith("."))) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const filePath = normalize(join(publicDir, requested));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const mimeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf"
  };
  const mime = mimeMap[extname(filePath).toLowerCase()] || "application/octet-stream";

  const ext = extname(filePath).toLowerCase();
  const noCacheExts = [".html", ".js", ".css", ".pdf"];
  const headers = { "Content-Type": mime };
  if (noCacheExts.includes(ext)) {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  } else {
    headers["Cache-Control"] = "public, max-age=3600";
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

http.createServer(handle).listen(PORT, () => {
  console.log(`[safety-month-v2] Server listening on http://localhost:${PORT} | version=${APP_VERSION}`);
});
