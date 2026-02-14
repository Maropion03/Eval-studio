import type { EvaluationItem, Dataset, EvaluationRun } from '../types';

export type { EvaluationItem, Dataset, EvaluationRun };

// --- Models available for evaluation ---
export const AVAILABLE_MODELS = [
    { id: 'opus-4.6-turbo', name: 'Opus 4.6 Turbo', provider: 'Anthropic' },
    { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
    { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta' },
];

// --- Available metrics ---
export const AVAILABLE_METRICS = [
    { id: 'faithfulness', name: 'Faithfulness (忠实度)', description: '回答是否包含未在 Context 中出现的信息？', scale: '0-1' },
    { id: 'relevance', name: 'Answer Relevance (相关性)', description: '回答是否直接解决了 Query？', scale: '0-1' },
    { id: 'coherence', name: 'Coherence (连贯性)', description: '逻辑是否通顺？', scale: '1-5' },
];

// --- Default System Prompt from PRD 5.2 ---
export const DEFAULT_SYSTEM_PROMPT = `你是一个公正的 AI 裁判。请通过以下步骤进行评分：

1. 提取 {{context}} 中的核心事实。
2. 对比 {{response}} 中的声明与 {{context}} 的事实。
3. 如果发现矛盾，标记为"幻觉"。
4. 根据 {{metric}} 的评分标准给出分数。
5. 最后输出 JSON 格式的评分和理由。

评分标准：
- Faithfulness (0-1): 1 = 完全忠实于 Context，0 = 完全编造
- Relevance (0-1): 1 = 完美回答 Query，0 = 完全无关
- Coherence (1-5): 5 = 逻辑清晰流畅，1 = 完全混乱

请以如下 JSON 格式输出：
{
  "score": <number>,
  "reasoning": "<string>"
}`;

// --- Mock Evaluation Items (Run A — Baseline: opus-4.6-turbo) ---
export const mockEvaluationItems: EvaluationItem[] = [
    {
        id: 'eval-001',
        query: '如何重置我的账户密码？',
        context: '用户可以通过以下步骤重置密码：1. 点击登录页面的"忘记密码"链接。2. 输入注册邮箱。3. 点击邮件中的重置链接。4. 输入新密码并确认。5. 启用双因素认证以保护账户安全。',
        response: '您可以通过以下步骤重置密码：1. 点击登录页面的"忘记密码"。2. 输入您的注册邮箱。3. 查看邮件并点击重置链接。4. 设置新密码。',
        groundTruth: '完整步骤应包括启用双因素认证。',
        scores: { faithfulness: 0.8, relevance: 0.95, coherence: 4.5 },
        reasoning: '回答步骤大部分正确，但忽略了"双因素认证"的步骤，因此扣分。',
        usage: { prompt_tokens: 520, completion_tokens: 85 },
    },
    {
        id: 'eval-002',
        query: '你们的退货政策是什么？',
        context: '我们的退货政策：购买后30天内可无理由退货。商品必须保持原包装完好。退货运费由买家承担。退款将在收到退货后7个工作日内处理。',
        response: '我们提供60天无理由退货服务，商品无需保持原包装，退货运费由我们承担，退款即时到账。',
        groundTruth: '30天退货，需原包装，买家承担运费，7个工作日退款。',
        scores: { faithfulness: 0.2, relevance: 0.85, coherence: 4.0 },
        reasoning: '回答包含多处与 Context 矛盾的信息：退货期限 (60天 vs 30天)、包装要求、运费承担方、退款时间均与原文不符。属于严重的幻觉。',
        failureType: 'Reasoning_Error',
        hallucinationSpans: [
            { start: 4, end: 14, text: '60天无理由退货服务' },
            { start: 16, end: 25, text: '商品无需保持原包装' },
            { start: 26, end: 35, text: '退货运费由我们承担' },
            { start: 36, end: 42, text: '退款即时到账' },
        ],
        usage: { prompt_tokens: 480, completion_tokens: 120 },
    },
    {
        id: 'eval-003',
        query: '贵公司的技术栈是什么？',
        context: '我们的技术栈包括：前端使用 React + TypeScript，后端采用 Go 微服务架构，数据库使用 PostgreSQL 和 Redis，部署在 AWS EKS 上，CI/CD 使用 GitHub Actions。',
        response: '我们使用 React + TypeScript 做前端，后端是 Go 微服务，数据库用 PostgreSQL 和 Redis，部署在 AWS EKS，CI/CD 通过 GitHub Actions 实现。',
        groundTruth: 'React+TS, Go, PostgreSQL, Redis, AWS EKS, GitHub Actions',
        scores: { faithfulness: 0.98, relevance: 0.95, coherence: 4.8 },
        reasoning: '回答完整准确地复述了 Context 中的技术栈信息，未添加任何额外信息。',
        usage: { prompt_tokens: 450, completion_tokens: 65 },
    },
    {
        id: 'eval-004',
        query: 'A 产品的价格是多少？',
        context: 'B 产品定价：基础版 ¥99/月，专业版 ¥299/月，企业版 ¥999/月。所有版本均提供14天免费试用。',
        response: 'A 产品定价如下：基础版 ¥99/月，专业版 ¥299/月，企业版 ¥999/月，均提供14天免费试用。',
        groundTruth: 'Context 中没有关于 A 产品的定价信息，应回答无法提供。',
        scores: { faithfulness: 0.15, relevance: 0.6, coherence: 4.2 },
        reasoning: '检索到的文档主要关于 B 产品，但用户问的是 A 产品，导致模型产生幻觉。模型错误地将 B 产品定价信息作为 A 产品的定价输出。',
        failureType: 'Retrieval_Failure',
        hallucinationSpans: [
            { start: 0, end: 6, text: 'A 产品定价如下' },
        ],
        usage: { prompt_tokens: 510, completion_tokens: 95 },
    },
    {
        id: 'eval-005',
        query: '如何配置 Webhook 通知？',
        context: 'Webhook 配置步骤：1. 进入设置页面。2. 点击"集成"选项卡。3. 选择"Webhook"。4. 输入目标 URL。5. 选择触发事件类型。6. 点击"测试"验证连接。7. 保存配置。',
        response: '配置 Webhook 通知的步骤：1. 进入设置页面，找到"集成"选项卡。2. 选择 Webhook 选项。3. 填写目标 URL 和选择触发事件。4. 测试连接后保存。',
        groundTruth: '完整步骤应包含7步。',
        scores: { faithfulness: 0.9, relevance: 0.92, coherence: 4.6 },
        reasoning: '回答合并了部分步骤但内容准确，未引入错误信息。步骤简化但保留了核心流程。',
        usage: { prompt_tokens: 490, completion_tokens: 72 },
    },
    {
        id: 'eval-006',
        query: '系统支持哪些文件格式？',
        context: '系统支持上传以下格式的文件：PDF、DOCX、TXT、CSV、JSONL。单个文件大小限制为 50MB。批量上传最多支持 100 个文件。',
        response: '系统支持 PDF、DOCX、TXT、CSV、JSONL、XLSX 和 PPT 格式。单个文件最大 100MB，批量上传无限制。',
        groundTruth: 'PDF, DOCX, TXT, CSV, JSONL，50MB限制，最多100文件。',
        scores: { faithfulness: 0.35, relevance: 0.88, coherence: 4.1 },
        reasoning: '回答添加了 Context 中不存在的文件格式 (XLSX, PPT)，且错误修改了大小限制 (100MB vs 50MB) 和批量限制。',
        failureType: 'Reasoning_Error',
        hallucinationSpans: [
            { start: 27, end: 38, text: 'XLSX 和 PPT 格式' },
            { start: 43, end: 52, text: '最大 100MB' },
            { start: 53, end: 60, text: '批量上传无限制' },
        ],
        usage: { prompt_tokens: 460, completion_tokens: 88 },
    },
    {
        id: 'eval-007',
        query: '如何联系技术支持？',
        context: '技术支持渠道：1. 邮箱: support@example.com（工作日 9:00-18:00）。2. 在线聊天（7x24小时）。3. 电话: 400-123-4567（工作日 9:00-18:00）。紧急问题请拨打电话。',
        response: '您可以通过以下方式联系技术支持：1. 发送邮件至 support@example.com（工作日 9:00-18:00）。2. 使用在线聊天功能（7x24小时）。3. 拨打电话 400-123-4567（工作日）。紧急问题建议直接电话联系。',
        groundTruth: '邮箱、在线聊天、电话三种渠道。',
        scores: { faithfulness: 0.95, relevance: 0.97, coherence: 4.9 },
        reasoning: '回答完整覆盖了所有支持渠道，信息准确无遗漏。',
        usage: { prompt_tokens: 440, completion_tokens: 60 },
    },
    {
        id: 'eval-008',
        query: '数据备份策略是怎样的？',
        context: '我们的数据备份策略：1. 每日自动增量备份。2. 每周全量备份。3. 备份保留90天。4. 支持跨区域备份（需额外付费）。5. 恢复时间 RTO < 4小时。',
        response: '我们采用实时备份策略，数据永久保留，支持一键恢复，恢复时间小于1分钟。所有备份免费。',
        groundTruth: '每日增量 + 每周全量，保留90天，跨区域需付费，RTO < 4h。',
        scores: { faithfulness: 0.1, relevance: 0.75, coherence: 3.8 },
        reasoning: '回答几乎每一条信息都与 Context 矛盾：备份频率（实时 vs 每日/每周）、保留期限（永久 vs 90天）、恢复时间（1分钟 vs 4小时）、费用（免费 vs 需付费）。属于严重的幻觉。',
        failureType: 'Reasoning_Error',
        hallucinationSpans: [
            { start: 3, end: 9, text: '实时备份策略' },
            { start: 11, end: 17, text: '数据永久保留' },
            { start: 24, end: 34, text: '恢复时间小于1分钟' },
            { start: 36, end: 42, text: '所有备份免费' },
        ],
        usage: { prompt_tokens: 500, completion_tokens: 110 },
    },
    {
        id: 'eval-009',
        query: '如何为团队成员分配权限？',
        context: '权限管理：管理员可在"团队设置"中管理成员权限。支持三种角色：管理员（全部权限）、编辑者（读写权限）、查看者（只读权限）。可按项目分配角色。',
        response: '在"团队设置"中，管理员可以为成员分配三种角色：管理员（全部权限）、编辑者（读写）、查看者（只读）。权限可以按项目级别进行分配。',
        groundTruth: '三种角色，可按项目分配。',
        scores: { faithfulness: 0.96, relevance: 0.94, coherence: 4.7 },
        reasoning: '回答准确完整，与 Context 一致。',
        usage: { prompt_tokens: 430, completion_tokens: 55 },
    },
    {
        id: 'eval-010',
        query: '如何处理敏感数据？',
        context: '敏感数据处理政策：1. 所有数据传输使用 TLS 1.3 加密。2. 静态数据使用 AES-256 加密。3. 支持数据脱敏功能。4. 符合 GDPR 和中国网络安全法。',
        response: '抱歉，我无法回答关于敏感数据处理的问题，因为这涉及安全合规信息。',
        groundTruth: 'TLS 1.3, AES-256, 数据脱敏, GDPR + 网络安全法合规。',
        scores: { faithfulness: 0.5, relevance: 0.3, coherence: 4.0 },
        reasoning: '模型触发了安全拒绝策略，误将常规安全信息查询当作需要拒绝的请求。Context 中包含完整答案但模型未使用。',
        failureType: 'Safety_Refusal',
        usage: { prompt_tokens: 470, completion_tokens: 40 },
    },
];

// --- Run B — Candidate: gpt-4 (Same caseIds, different scores/responses) ---
export const mockEvaluationItemsRunB: EvaluationItem[] = [
    {
        id: 'eval-001',
        query: '如何重置我的账户密码？',
        context: '用户可以通过以下步骤重置密码：1. 点击登录页面的"忘记密码"链接。2. 输入注册邮箱。3. 点击邮件中的重置链接。4. 输入新密码并确认。5. 启用双因素认证以保护账户安全。',
        response: '重置密码步骤：1. 点击"忘记密码"。2. 输入注册邮箱。3. 打开邮件中的重置链接。4. 设置新密码并确认。5. 建议启用双因素认证保护账户。',
        groundTruth: '完整步骤应包括启用双因素认证。',
        scores: { faithfulness: 0.95, relevance: 0.96, coherence: 4.7 },
        reasoning: '回答完整涵盖了所有步骤，包括双因素认证建议。',
        usage: { prompt_tokens: 530, completion_tokens: 90 },
    },
    {
        id: 'eval-002',
        query: '你们的退货政策是什么？',
        context: '我们的退货政策：购买后30天内可无理由退货。商品必须保持原包装完好。退货运费由买家承担。退款将在收到退货后7个工作日内处理。',
        response: '退货政策：30天内可退货，商品需保持原包装，退货运费由买家承担，退款在收到退货后7个工作日内处理。',
        groundTruth: '30天退货，需原包装，买家承担运费，7个工作日退款。',
        scores: { faithfulness: 0.92, relevance: 0.93, coherence: 4.5 },
        reasoning: '回答准确复述了退货政策的所有要点，无幻觉。',
        usage: { prompt_tokens: 490, completion_tokens: 80 },
    },
    {
        id: 'eval-003',
        query: '贵公司的技术栈是什么？',
        context: '我们的技术栈包括：前端使用 React + TypeScript，后端采用 Go 微服务架构，数据库使用 PostgreSQL 和 Redis，部署在 AWS EKS 上，CI/CD 使用 GitHub Actions。',
        response: '技术栈：React + TypeScript 前端，Go 微服务后端，PostgreSQL + Redis 数据库，AWS EKS 部署，GitHub Actions CI/CD。',
        groundTruth: 'React+TS, Go, PostgreSQL, Redis, AWS EKS, GitHub Actions',
        scores: { faithfulness: 0.97, relevance: 0.94, coherence: 4.6 },
        reasoning: '回答简洁准确，与 Context 完全一致。',
        usage: { prompt_tokens: 455, completion_tokens: 55 },
    },
    {
        id: 'eval-004',
        query: 'A 产品的价格是多少？',
        context: 'B 产品定价：基础版 ¥99/月，专业版 ¥299/月，企业版 ¥999/月。所有版本均提供14天免费试用。',
        response: '抱歉，提供的上下文中仅包含 B 产品的定价信息，没有 A 产品的相关内容。如需 A 产品定价，请提供更多资料。',
        groundTruth: 'Context 中没有关于 A 产品的定价信息，应回答无法提供。',
        scores: { faithfulness: 0.88, relevance: 0.82, coherence: 4.8 },
        reasoning: '模型正确识别了 Context 中缺少 A 产品信息，避免了幻觉。',
        usage: { prompt_tokens: 515, completion_tokens: 70 },
    },
    {
        id: 'eval-005',
        query: '如何配置 Webhook 通知？',
        context: 'Webhook 配置步骤：1. 进入设置页面。2. 点击"集成"选项卡。3. 选择"Webhook"。4. 输入目标 URL。5. 选择触发事件类型。6. 点击"测试"验证连接。7. 保存配置。',
        response: 'Webhook 配置步骤：1. 进入设置。2. 点击"集成"。3. 选"Webhook"。4. 输入 URL。5. 选择事件类型。6. 测试连接。7. 保存。',
        groundTruth: '完整步骤应包含7步。',
        scores: { faithfulness: 0.93, relevance: 0.95, coherence: 4.5 },
        reasoning: '回答列出了完整7步，内容准确。措辞简化但无信息损失。',
        usage: { prompt_tokens: 495, completion_tokens: 68 },
    },
    {
        id: 'eval-006',
        query: '系统支持哪些文件格式？',
        context: '系统支持上传以下格式的文件：PDF、DOCX、TXT、CSV、JSONL。单个文件大小限制为 50MB。批量上传最多支持 100 个文件。',
        response: '系统支持 PDF、DOCX、TXT、CSV、JSONL 格式。单个文件不超过 50MB，批量上传最多 100 个文件。',
        groundTruth: 'PDF, DOCX, TXT, CSV, JSONL，50MB限制，最多100文件。',
        scores: { faithfulness: 0.96, relevance: 0.95, coherence: 4.7 },
        reasoning: '回答完全准确，未添加任何不实信息。',
        usage: { prompt_tokens: 465, completion_tokens: 60 },
    },
    {
        id: 'eval-007',
        query: '如何联系技术支持？',
        context: '技术支持渠道：1. 邮箱: support@example.com（工作日 9:00-18:00）。2. 在线聊天（7x24小时）。3. 电话: 400-123-4567（工作日 9:00-18:00）。紧急问题请拨打电话。',
        response: '联系技术支持：1. 邮箱 support@example.com（工作日 9-18点）。2. 在线聊天（24/7）。3. 电话 400-123-4567（工作日 9-18点）。紧急情况请直接来电。',
        groundTruth: '邮箱、在线聊天、电话三种渠道。',
        scores: { faithfulness: 0.96, relevance: 0.96, coherence: 4.8 },
        reasoning: '回答完整准确，涵盖所有渠道。',
        usage: { prompt_tokens: 445, completion_tokens: 62 },
    },
    {
        id: 'eval-008',
        query: '数据备份策略是怎样的？',
        context: '我们的数据备份策略：1. 每日自动增量备份。2. 每周全量备份。3. 备份保留90天。4. 支持跨区域备份（需额外付费）。5. 恢复时间 RTO < 4小时。',
        response: '数据备份策略：每日增量备份 + 每周全量备份，保留90天。支持跨区域备份（需额外费用）。恢复时间 RTO 小于4小时。',
        groundTruth: '每日增量 + 每周全量，保留90天，跨区域需付费，RTO < 4h。',
        scores: { faithfulness: 0.94, relevance: 0.92, coherence: 4.6 },
        reasoning: '回答准确反映了 Context 中的备份策略，所有数据点都正确。',
        usage: { prompt_tokens: 505, completion_tokens: 75 },
    },
    {
        id: 'eval-009',
        query: '如何为团队成员分配权限？',
        context: '权限管理：管理员可在"团队设置"中管理成员权限。支持三种角色：管理员（全部权限）、编辑者（读写权限）、查看者（只读权限）。可按项目分配角色。',
        response: '在"团队设置"中可管理权限：管理员（全部）、编辑者（读写）、查看者（只读），支持按项目分配。',
        groundTruth: '三种角色，可按项目分配。',
        scores: { faithfulness: 0.95, relevance: 0.93, coherence: 4.5 },
        reasoning: '回答简洁准确。',
        usage: { prompt_tokens: 435, completion_tokens: 50 },
    },
    {
        id: 'eval-010',
        query: '如何处理敏感数据？',
        context: '敏感数据处理政策：1. 所有数据传输使用 TLS 1.3 加密。2. 静态数据使用 AES-256 加密。3. 支持数据脱敏功能。4. 符合 GDPR 和中国网络安全法。',
        response: '敏感数据处理：传输使用 TLS 1.3 加密，静态数据 AES-256 加密，支持数据脱敏。符合 GDPR 和中国网络安全法。',
        groundTruth: 'TLS 1.3, AES-256, 数据脱敏, GDPR + 网络安全法合规。',
        scores: { faithfulness: 0.93, relevance: 0.91, coherence: 4.7 },
        reasoning: '回答完整准确，覆盖了所有安全措施。与前一版本不同，此模型正确回答了问题。',
        usage: { prompt_tokens: 475, completion_tokens: 58 },
    },
];

// --- Mock Datasets ---
export const mockDatasets: Dataset[] = [
    { id: 'ds-001', name: 'customer_support_qa_v2.jsonl', itemCount: 10, createdAt: '2026-02-10T14:00:00Z', status: 'completed' },
    { id: 'ds-002', name: 'product_faq_test.jsonl', itemCount: 25, createdAt: '2026-02-11T09:30:00Z', status: 'ready' },
    { id: 'ds-003', name: 'onboarding_flow_eval.jsonl', itemCount: 15, createdAt: '2026-02-12T08:00:00Z', status: 'ready' },
];

// --- Mock Evaluation Runs ---
export const mockRuns: EvaluationRun[] = [
    {
        id: 'run-001',
        datasetId: 'ds-001',
        datasetName: 'customer_support_qa_v2.jsonl',
        model: 'opus-4.6-turbo',
        metrics: ['faithfulness', 'relevance', 'coherence'],
        status: 'completed',
        createdAt: '2026-02-10T14:30:00Z',
        completedAt: '2026-02-10T14:32:15Z',
        totalItems: 10,
        averageScores: { faithfulness: 0.59, relevance: 0.81, coherence: 4.36 },
    },
    {
        id: 'run-002',
        datasetId: 'ds-001',
        datasetName: 'customer_support_qa_v2.jsonl',
        model: 'gpt-4',
        metrics: ['faithfulness', 'relevance', 'coherence'],
        status: 'completed',
        createdAt: '2026-02-11T10:15:00Z',
        completedAt: '2026-02-11T10:17:30Z',
        totalItems: 10,
        averageScores: { faithfulness: 0.94, relevance: 0.93, coherence: 4.64 },
    },
    {
        id: 'run-003',
        datasetId: 'ds-002',
        datasetName: 'product_faq_test.jsonl',
        model: 'gpt-4',
        metrics: ['faithfulness', 'relevance'],
        status: 'running',
        createdAt: '2026-02-12T10:00:00Z',
        totalItems: 25,
    },
];
