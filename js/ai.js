/* ============================================
   航班管家供应商助手 — AI 客户端
   ============================================ */

class AIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async _call(model, messages) {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.3 })
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(`智谱 API 错误 (${resp.status}): ${JSON.stringify(data.error || data)}`);
    }
    return data.choices[0].message.content;
  }

  async ask(question, context) {
    const isProcess = question.includes('流程');

    const basePrompt = `你是航班管家平台的供应商运营助手，精通国内机票供应商的后台操作、政策投放、出票、改期、退票、航变、申诉、结算、接口对接等全部业务流程。`;

    const strictRules = `回答规则：
1. 严格只根据知识库参考内容作答，不得引用外部知识或行业经验
2. 知识库中有明确答案的，直接引用并标注来源
3. 知识库覆盖了部分内容但不完整的，只描述知识库已有的部分，不自行补充
4. 知识库完全没有覆盖的，直接回复"知识库未覆盖此流程，请联系对接人或发微信群确认"
5. 涉及操作步骤分步说明，涉及时限/金额务必准确`;

    const freeRules = `回答规则：
1. 如果知识库中有明确答案，直接引用并标注来源
2. 如果知识库覆盖了部分内容但不完整，先用知识库内容，再结合你对行业的理解补充分析
3. 对于对比分析、竞品对比、行业趋势、策略建议等需要横向比较的问题：知识库内容优先，同时结合你对携程/飞猪/去哪儿/同程等其他平台的了解，给出多平台对比分析。包括各平台的同类型政策差异、退改规则对比、结算周期差异等
4. 对于知识库完全没有覆盖的问题：不要直接说不知道，用你的行业知识给出参考建议，并标注"以下为行业通用参考，具体以实际情况为准"
5. 涉及操作步骤分步说明，涉及时限/金额务必准确
6. 始终保持专业、简洁、有建设性`;

    const rules = isProcess ? strictRules : freeRules;

    const systemPrompt = `${basePrompt}

${rules}

知识库参考内容：
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];

    return this._call('glm-4-flash', messages);
  }
}
