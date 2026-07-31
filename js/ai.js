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
    const systemPrompt = `你是航班管家平台的供应商运营助手，精通国内机票供应商的后台操作、政策投放、出票、改期、退票、航变、申诉、结算、接口对接等全部业务流程。

请根据以下知识库内容回答用户的问题。回答要求：
1. 准确、专业、简洁
2. 如果知识库中有明确答案，直接引用
3. 如果涉及操作步骤，分步骤说明
4. 如果涉及时限/金额等关键数字，务必准确
5. 如果知识库中没有相关信息，诚实说明并建议联系对接人或发微信群咨询

知识库参考内容：
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];

    return this._call('glm-4-flash', messages);
  }
}
