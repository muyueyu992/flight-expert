/* ============================================
   航班管家供应商助手 — AI 客户端
   ============================================ */

const EXPERT_PROMPT = `你是航班管家平台的供应商运营专家，8年一线运营经验，精通出退改、航变、申诉、结算、政策投放。

## 内化框架（不在回答中复述，仅用于思考）

四级排查（不进单/异常下线）：店铺在线→接口状态→政策优势→配置自查
五级时限速查：15分/30分/1H/2H/6H+
三级升级：自查→微信群艾特小智→联系对接人
渠道分流：具体订单→会话 / 系统政策→微信群 / 投诉→后台建单

运价类型时限：BFD/BNFD/BZTG/GVIP=30分 | F001/F002/FLCP/GSPE=24H内1H,24H外航前24H | F001S=24H内1H,24H外2H | FLCPS=24H内1H,24H外4H

## 回答铁律

1. 简洁至上：先给结论一句话，再分点列依据，禁止写长篇分析
2. 数字精确：金额、分钟、百分比不模糊
3. 责任明确：谁承担损失/风险
4. 风险必提：超时、罚款、红线不能漏
5. 不确定不瞎猜：给确认渠道
6. 知识库最高优先级，冲突时以知识库为准
7. 知识库未覆盖标注"行业参考，以实际为准"`;

// ---- 流程模式严格规则 ----
const STRICT_RULES = `回答规则：
1. 严格只根据知识库参考内容作答，不得引用外部知识或行业经验
2. 知识库中有明确答案的，直接引用并标注来源
3. 知识库覆盖了部分内容但不完整的，只描述知识库已有的部分，不自行补充
4. 知识库完全没有覆盖的，直接回复"知识库未覆盖此流程，请联系对接人或发微信群确认"
5. 涉及操作步骤分步说明，涉及时限/金额务必准确`;

class AIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async _call(model, messages) {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.3 })
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(`智谱 API 错误 (${resp.status}): ${JSON.stringify(data.error || data)}`);
    }
    return data.choices[0].message.content;
  }

  async ask(question, context, history = []) {
    const isProcess = question.includes('流程');
    const intent = isProcess ? null : classifyQueryIntent(question);

    let systemPrompt;

    if (isProcess) {
      // ---- 流程模式：严格按文档回答 ----
      systemPrompt = `你是航班管家平台的供应商运营助手，精通国内机票供应商的后台操作、政策投放、出票、改期、退票、航变、申诉、结算、接口对接等全部业务流程。

${STRICT_RULES}

知识库参考内容：
${context}`;
    } else {
      // ---- 专家模式：诊断框架 + 结构化输出 ----
      const intentGuide = this._intentGuidance(intent);
      systemPrompt = `${EXPERT_PROMPT}

${intentGuide}

知识库参考内容：
${context}`;
    }

    // 构建消息数组，包含历史对话
    const messages = [{ role: 'system', content: systemPrompt }];

    // 注入最近 N 轮历史
    const recentHistory = history.slice(-8); // 最近4轮问答
    for (const turn of recentHistory) {
      messages.push(turn);
    }

    messages.push({ role: 'user', content: question });

    return this._call('glm-4-flash', messages);
  }

  // 根据意图返回针对性的输出引导
  _intentGuidance(intent) {
    const guides = {
      troubleshoot: '问题类型：排查。简要列出原因→操作→升级路径。',
      time_limit: '问题类型：时限。列出时限→超时后果。',
      penalty: '问题类型：处罚。列出违规行为→罚款金额→申诉空间。',
      comparison: '问题类型：对比。分维度简要对比。',
      how_to: '问题类型：操作指南。分步说明。',
      amount: '问题类型：费用。列出计算规则→承担方。',
      policy: '问题类型：政策。结合运价类型和投放规则简要回答。',
      factual: '问题类型：知识查询。直接简洁回答。',
    };
    return guides[intent] || guides.factual;
  }
}
