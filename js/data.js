const APP_STORAGE_KEYS = {
  userInfo: "safetyMonth2026.userInfo",
  scores: "safetyMonth2026.scores",
  completedModules: "safetyMonth2026.completedModules",
  finishTime: "safetyMonth2026.finishTime",
  answerLog: "safetyMonth2026.answerLog"
};

const defaultScores = {
  hazardFind: 0,
  hazardMatch: 0,
  emergencySort: 0,
  quiz: 0,
  total: 0
};

const defaultCompletedModules = {
  hazardFind: false,
  hazardMatch: false,
  emergencySort: false,
  quiz: false
};

const defaultAnswerLog = {
  hazardFind: { foundCount: 0, total: 8, score: 0 },
  hazardMatch: { correct: 0, wrong: 0, totalRisk: 10, score: 0 },
  emergencySort: [],
  quiz: []
};

const modules = [
  {
    key: "hazardFind",
    page: "hazardFindPage",
    title: "火眼金睛查隐患",
    description: "在现场图片中点击你发现的隐患",
    maxScore: 30,
    icon: "查"
  },
  {
    key: "hazardMatch",
    page: "hazardMatchPage",
    title: "隐患消消乐",
    description: "从卡片中找出真正的安全隐患",
    maxScore: 20,
    icon: "消"
  },
  {
    key: "emergencySort",
    page: "emergencySortPage",
    title: "应急行动排序",
    description: "把应急处置步骤排成正确顺序",
    maxScore: 25,
    icon: "排"
  },
  {
    key: "quiz",
    page: "quizPage",
    title: "安全知识闯关",
    description: "完成安全月知识答题",
    maxScore: 25,
    icon: "答"
  }
];

const hazardFindPoints = [
  { id: 1, x: 67, y: 56, title: "安全通道被物料占用", text: "隐患：安全通道被物料占用。通道堵塞会影响人员通行和紧急疏散，应立即清理，保持通道畅通。" },
  { id: 2, x: 20, y: 49, title: "配电柜前堆放杂物", text: "隐患：配电柜前堆放杂物。配电柜前应保持足够操作和检修空间，禁止堆放物品。" },
  { id: 3, x: 8, y: 62, title: "灭火器被遮挡", text: "隐患：灭火器被遮挡。消防器材必须保持醒目、易取、无遮挡，确保紧急情况下可以快速使用。" },
  { id: 4, x: 45, y: 35, title: "员工未正确佩戴安全帽", text: "隐患：员工未正确佩戴安全帽。进入生产现场应按要求佩戴劳动防护用品。" },
  { id: 5, x: 40, y: 29, title: "设备防护罩打开运行", text: "隐患：设备防护罩打开时仍在运行。设备运行时防护装置不得随意拆除、打开或屏蔽。" },
  { id: 6, x: 74, y: 49, title: "安全光栅被物料遮挡", text: "隐患：安全光栅被遮挡。安全光栅是防止人员进入危险区域的重要保护装置，严禁遮挡、屏蔽或短接。" },
  { id: 7, x: 48, y: 80, title: "地面有油污未清理", text: "隐患：地面油污未及时清理。油污容易导致滑倒摔伤，应及时清理并设置警示。" },
  { id: 8, x: 86, y: 38, title: "叉车与行人混行", text: "隐患：叉车与行人混行。厂区应尽量实现人车分流，交叉区域应设置警示、减速和让行措施。" }
];

const hazardMatchCards = [
  ...[
    "急停按钮被胶带固定",
    "安全门被短接",
    "光栅被纸箱遮挡",
    "配电柜门未关闭",
    "消防通道堆放物料",
    "灭火器压力不足",
    "叉车转弯不鸣笛",
    "员工跨越输送线",
    "化学品瓶无标签",
    "地面油污未清理"
  ].map((text, index) => ({ id: `risk-${index}`, text, type: "risk" })),
  ...[
    "员工正确佩戴安全帽",
    "叉车司机系安全带",
    "安全通道保持畅通",
    "灭火器点检正常",
    "设备防护罩关闭",
    "危化品有清晰标签"
  ].map((text, index) => ({ id: `safe-${index}`, text, type: "safe" }))
];

const emergencyScenarios = [
  {
    title: "场景一：初期火灾处置",
    question: "发现初期火灾时，正确的处置顺序是什么？",
    steps: [
      "发现火情，立即大声呼喊提醒周围人员",
      "按下附近手动火灾报警按钮或拨打报警电话",
      "判断火势是否可控，确保自身安全",
      "使用灭火器对准火焰根部灭火",
      "组织人员沿疏散路线撤离",
      "到紧急集合点集合并清点人数"
    ],
    explanation: "发生火灾时，应同时关注报警、疏散和初期灭火。灭火必须以确保自身安全为前提。"
  },
  {
    title: "场景二：人员触电处置",
    question: "发现有人触电时，正确的处置顺序是什么？",
    steps: [
      "立即切断电源",
      "在无法断电时，使用绝缘物将人员与电源分离",
      "确认现场环境安全",
      "呼叫周围人员并拨打急救电话",
      "检查伤者意识和呼吸",
      "必要时进行心肺复苏并等待救援"
    ],
    explanation: "触电事故施救时，第一原则是先断电，不能直接用手拉人，防止施救者二次触电。"
  },
  {
    title: "场景三：机械伤害处置",
    question: "发生机械夹伤或卷入风险时，正确的处置顺序是什么？",
    steps: [
      "立即按下急停按钮",
      "呼喊求助并通知现场负责人",
      "禁止盲目拉拽伤者",
      "对设备进行断电或能量隔离",
      "联系专业救援或维修人员协助处置",
      "根据伤情进行急救并拨打急救电话"
    ],
    explanation: "机械伤害现场不能盲目拉拽伤者，应先停机、隔离能量，再组织救援。"
  }
];

const sampleLeaderboard = [
  { name: "李明", department: "生产部", employeeId: "P018", total: 96, finishTime: "2026-06-06 09:18" },
  { name: "王芳", department: "EHS部", employeeId: "E006", total: 94, finishTime: "2026-06-06 09:31" },
  { name: "赵强", department: "设备部", employeeId: "D022", total: 91, finishTime: "2026-06-06 10:02" },
  { name: "陈静", department: "质量部", employeeId: "Q011", total: 86, finishTime: "2026-06-06 10:24" },
  { name: "周伟", department: "设施部", employeeId: "F036", total: 82, finishTime: "2026-06-06 11:06" },
  { name: "刘洋", department: "RDC", employeeId: "R009", total: 76, finishTime: "2026-06-06 11:42" },
  { name: "孙娜", department: "FI&IT", employeeId: "F027", total: 68, finishTime: "2026-06-06 12:15" },
  { name: "吴磊", department: "PA", employeeId: "PA031", total: 54, finishTime: "2026-06-06 12:40" }
];

const quizQuestions = [
  { question: "2026年安全生产月主题是？", options: ["安全第一，预防为主", "人人讲安全，个个会应急——排查整治风险隐患", "消除事故隐患，筑牢安全防线", "生命至上，安全发展"], answer: 1, explanation: "2026年全国安全生产月主题为“人人讲安全，个个会应急——排查整治风险隐患”。", category: "安全生产月" },
  { question: "发现安全隐患后，正确做法是？", options: ["先不管，等别人处理", "拍照发朋友圈", "及时报告并推动整改", "只要自己小心就行"], answer: 2, explanation: "发现隐患后应及时报告，并推动整改闭环。", category: "隐患排查" },
  { question: "消防通道被物料堵塞，属于什么问题？", options: ["现场5S问题，不影响安全", "安全隐患，影响紧急疏散", "正常现象", "只影响美观"], answer: 1, explanation: "消防通道堵塞会影响人员疏散和应急救援。", category: "隐患排查" },
  { question: "使用灭火器时，应主要对准哪里？", options: ["火焰上方", "火焰根部", "烟雾处", "墙面"], answer: 1, explanation: "灭火器应对准火焰根部喷射。", category: "灭火器使用" },
  { question: "发现初期火灾时，以下哪项做法不正确？", options: ["立即报警", "呼喊提醒周围人员", "确保自身安全后尝试初期灭火", "独自冲入浓烟区域灭火"], answer: 3, explanation: "不得盲目进入浓烟区域，灭火必须以确保自身安全为前提。", category: "疏散逃生" },
  { question: "进入生产现场，劳动防护用品应如何使用？", options: ["觉得麻烦可以不戴", "只在检查时佩戴", "按岗位风险正确佩戴", "只戴安全帽就够了"], answer: 2, explanation: "劳动防护用品应根据岗位风险正确佩戴和使用。", category: "隐患排查" },
  { question: "设备安全门被短接后，最大的风险是？", options: ["设备运行更快", "设备更省电", "人员进入危险区时设备仍可能运行", "设备更容易清洁"], answer: 2, explanation: "安全门被短接后，人员进入危险区域时设备可能仍然运行。", category: "机械安全" },
  { question: "急停按钮的作用是？", options: ["代替正常停机按钮", "紧急情况下快速停止危险动作", "用来启动设备", "用来调节速度"], answer: 1, explanation: "急停按钮用于紧急情况下快速停止危险动作。", category: "机械安全" },
  { question: "安全光栅被遮挡或屏蔽，可能造成什么后果？", options: ["设备更安全", "系统无法可靠发现人员进入危险区", "提高生产效率", "降低噪声"], answer: 1, explanation: "安全光栅被遮挡或屏蔽后，会降低人员进入危险区时的保护能力。", category: "机械安全" },
  { question: "设备复位按钮的正确理解是？", options: ["复位就是启动", "复位后设备必须自动运行", "复位是解除安全触发，进入待机或允许状态", "复位可以代替安全检查"], answer: 2, explanation: "复位不等于启动，复位只是解除安全触发，使系统进入待机或允许状态。", category: "机械安全" },
  { question: "双手按钮的主要安全目的是什么？", options: ["让员工操作更快", "让双手离开危险区", "减少按钮数量", "方便单手操作"], answer: 1, explanation: "双手按钮的核心目的，是确保操作人员双手离开危险区。", category: "机械安全" },
  { question: "叉车作业时，行人应该怎么做？", options: ["从叉车前方快速穿过", "站在叉车盲区等待", "与叉车保持安全距离，注意避让", "靠近叉车拍照"], answer: 2, explanation: "行人应与叉车保持安全距离，避免进入盲区。", category: "交通安全" },
  { question: "配电柜前方为什么不能堆放物品？", options: ["影响美观", "影响操作、检修和应急处置", "会占用仓库空间", "没有原因"], answer: 1, explanation: "配电柜前应保持足够的操作、检修和应急处置空间。", category: "隐患排查" },
  { question: "地面油污未及时清理，主要风险是？", options: ["滑倒摔伤", "空气变好", "设备更稳定", "增加照明"], answer: 0, explanation: "地面油污容易导致人员滑倒摔伤。", category: "隐患排查" },
  { question: "化学品容器没有标签，主要问题是？", options: ["不方便摆放", "无法识别物质和风险", "颜色不好看", "占用空间"], answer: 1, explanation: "化学品无标签会导致人员无法识别物质名称、危险性和防护要求。", category: "隐患排查" },
  { question: "发现有人触电时，首先应该？", options: ["直接用手拉开", "立即切断电源", "给他喝水", "移动设备继续生产"], answer: 1, explanation: "触电施救第一步是切断电源，不能直接用手拉人。", category: "应急处置" },
  { question: "机械伤害现场，以下哪项做法不正确？", options: ["立即急停", "呼救并报告", "盲目拉拽被夹人员", "隔离设备能量"], answer: 2, explanation: "机械夹伤或卷入事故中，不得盲目拉拽伤者。", category: "机械安全" },
  { question: "灭火器被遮挡时，正确做法是？", options: ["不影响使用", "立即清理遮挡物，保持易取", "用时再找", "放到角落里"], answer: 1, explanation: "灭火器应保持醒目、易取、无遮挡。", category: "灭火器使用" },
  { question: "员工参与隐患排查的意义是？", options: ["只是完成任务", "发现并消除身边风险，防止事故发生", "增加工作负担", "只为了检查好看"], answer: 1, explanation: "员工参与隐患排查，是把风险控制在事故发生之前。", category: "隐患排查" },
  { question: "安全生产中，“人人讲安全”意味着？", options: ["只有EHS部门负责安全", "只有班组长负责安全", "每个人都要关注、发现、报告和控制风险", "只在安全月关注安全"], answer: 2, explanation: "安全不是某一个部门的事，每个人都应参与风险识别和控制。", category: "安全生产月" },
  { question: "行人通过厂区道路时，正确做法是？", options: ["戴耳机、看手机快速通过", "观察左右车辆，走人行通道或斑马线", "从车辆前方突然穿过", "在叉车通道内停留聊天"], answer: 1, explanation: "厂区道路通行应走规定路线，注意观察车辆，避免分心。", category: "交通安全" },
  { question: "厂区叉车作业区域，行人最应该注意什么？", options: ["只要叉车速度慢就可以靠近", "避开叉车盲区，与叉车保持安全距离", "可以站在叉车后方等待", "可以从货叉下方穿过"], answer: 1, explanation: "叉车存在盲区和转弯风险，行人应保持距离，避免进入盲区。", category: "交通安全" },
  { question: "雨天或夜间上下班骑行，以下哪项更安全？", options: ["戴好头盔，减速慢行，穿反光衣或使用灯光", "为了赶时间快速骑行", "打伞单手骑车", "戴耳机听音乐骑行"], answer: 0, explanation: "雨天、夜间能见度差，应佩戴头盔、降低速度、提高可见性。", category: "交通安全" },
  { question: "发生交通事故后，正确做法是？", options: ["立即争论责任", "先确保自身安全，必要时报警，并报告部门主管或公司EHS", "直接离开现场", "只在微信群里说一下"], answer: 1, explanation: "交通事故后应先确保人身安全，必要时报警，并按公司要求报告。", category: "交通安全" },
  { question: "夏季高温作业时，正确做法是？", options: ["多喝水，注意休息，发现不适及时报告", "忍一忍就过去了", "为了凉快不佩戴劳动防护用品", "只喝冰饮料，不需要休息"], answer: 0, explanation: "高温作业应注意补水、休息和身体异常信号，防止中暑。", category: "夏季安全" },
  { question: "发现同事疑似中暑，以下做法正确的是？", options: ["让其继续工作观察一下", "将其转移到阴凉通风处，补水降温，并及时报告或求助", "立即让其剧烈运动出汗", "只给他一杯热水"], answer: 1, explanation: "疑似中暑应及时转移至阴凉通风处，采取降温措施，并根据情况求助。", category: "夏季安全" },
  { question: "夏季雷雨、大风天气出行，正确做法是？", options: ["靠近广告牌、大树或临时构筑物避风", "提前关注天气预警，避开积水和高风险区域", "骑车时速度越快越好", "在积水区域冒险通行"], answer: 1, explanation: "特殊天气应提前关注预警，避开积水、临时构筑物、大树等高风险区域。", category: "夏季安全" },
  { question: "夏季使用电气设备时，以下哪项是错误做法？", options: ["不私拉乱接电线", "发现插座发热及时报告", "多个大功率设备共用一个插排", "保持电气设备周围通风散热"], answer: 2, explanation: "多个大功率设备共用一个插排，容易造成过载发热甚至引发火灾。", category: "夏季安全" },
  { question: "使用干粉灭火器的一般口诀是？", options: ["提、拔、握、压", "看、想、等、跑", "推、拉、撞、踢", "摇、拍、扔、跑"], answer: 0, explanation: "常见灭火器使用口诀是“提、拔、握、压”。", category: "灭火器使用" },
  { question: "使用灭火器时，人与火源一般保持多少距离较合适？", options: ["0.1米以内", "1.5至2米左右", "10米以上", "越近越好"], answer: 1, explanation: "使用灭火器时一般保持约1.5至2米距离，并根据现场情况确保自身安全。", category: "灭火器使用" },
  { question: "使用灭火器时，应站在什么位置？", options: ["下风口", "上风口或侧上风方向", "火源正中间", "烟雾最浓的位置"], answer: 1, explanation: "灭火时应尽量站在上风口或侧上风方向，避免烟气和火焰伤害。", category: "灭火器使用" },
  { question: "关于初期灭火，以下说法正确的是？", options: ["任何火灾都必须自己扑灭", "火势失控时应立即撤离并报警", "浓烟很大也要冲进去灭火", "灭火时不用考虑逃生路线"], answer: 1, explanation: "初期灭火必须以自身安全为前提，火势失控时应立即撤离并报警。", category: "灭火器使用" },
  { question: "火灾疏散逃生时，正确做法是？", options: ["乘坐电梯快速下楼", "沿疏散指示标志和安全出口方向撤离", "返回工位拿个人物品", "躲在厕所里等待"], answer: 1, explanation: "火灾疏散时应沿疏散指示标志和安全出口方向撤离，不得乘坐电梯。", category: "疏散逃生" },
  { question: "疏散过程中遇到浓烟时，正确做法是？", options: ["直立快速奔跑", "低姿前进，尽量减少吸入烟气", "大声喊叫吸入空气", "打开所有门窗后再走"], answer: 1, explanation: "浓烟中应低姿前进，减少吸入有毒烟气。", category: "疏散逃生" },
  { question: "到达紧急集合点后，正确做法是？", options: ["自行离开回家", "等待清点人数，听从现场指挥", "返回现场查看情况", "拍视频发朋友圈"], answer: 1, explanation: "到达集合点后应配合清点人数，听从现场统一指挥。", category: "疏散逃生" },
  { question: "发现安全出口被堵塞，正确做法是？", options: ["与自己无关", "立即报告并推动清理整改", "等检查时再说", "临时绕路即可，不需要处理"], answer: 1, explanation: "安全出口堵塞会严重影响逃生，应立即报告并整改。", category: "疏散逃生" }
];
