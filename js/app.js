/* ============================================
   航班管家供应商助手 — App
   ============================================ */

const App = {
  api: null,
  history: [],

  async init() {
    const s = JSON.parse(localStorage.getItem('fe_settings') || '{}');
    this.api = s.apiKey ? new AIClient(s.apiKey) : null;
    this.bind();
    this.renderWelcome();
  },

  bind() {
    $('#sendBtn').addEventListener('click', () => this.send());
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    $('#clearBtn').addEventListener('click', () => this.clearHistory());
    $('#settingsBtn').addEventListener('click', () => this.toggleSettings());
    $('#closeSettingsBtn').addEventListener('click', () => this.toggleSettings());
    $('#saveKeyBtn').addEventListener('click', () => this.saveKey());
    $('#resetKeyBtn').addEventListener('click', () => this.resetKey());
  },

  renderWelcome() {
    const cats = [...new Set(KNOWLEDGE_BASE.map(k => k.cat))];
    $('#chatList').innerHTML = `
      <div class="msg welcome">
        <div class="welcome-icon">✈️</div>
        <h2>航班管家供应商运营助手</h2>
        <p>我是你的AI助手，精通国内机票供应商的后台操作、政策投放、出票退改、申诉结算等全部流程。</p>
        <p class="welcome-hint">直接输入你的问题，我会从知识库中为你找到答案：</p>
        <div class="quick-tags">
          ${cats.map(c => `<button class="quick-tag" data-cat="${c}">${c}</button>`).join('')}
        </div>
      </div>
    `;
    $$('.quick-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        $('#chatInput').value = `关于「${btn.dataset.cat}」，常见问题有哪些？`;
        this.send();
      });
    });
  },

  async send() {
    const input = $('#chatInput');
    const q = input.value.trim();
    if (!q || this._sending) return;
    if (!this.api) { this.toggleSettings(); return; }
    this._sending = true;
    input.value = '';
    $('#sendBtn').disabled = true;

    this.addMsg('user', q);
    const thinking = this.addMsg('assistant', '<div class="thinking"><span></span><span></span><span></span></div>', true);

    try {
      const isProcess = q.includes('流程');
      let context = '';

      if (isProcess) {
        // 流程模式：检索知识库，排除技术/接口类条目
        let results = searchKnowledge(q).filter(r => r.cat !== '接口');
        if (results.length) {
          context = results.map((r, i) =>
            `【${i+1}】分类：${r.cat}\n问题：${r.q}\n答案：${r.a}`
          ).join('\n\n');
        } else {
          context = '知识库中未直接匹配到相关内容。请根据你的专业知识尽量回答，并建议用户联系对接人或发微信群确认。';
        }
      }
      // 专家模式：不取知识库，context 留空，纯靠专家理解回答

      const answer = await this.api.ask(q, context, this.history);
      thinking.innerHTML = this.renderAnswer(answer);
      this.scrollBottom();

      // 记录对话历史（保留最近10轮）
      this.history.push({ role: 'user', content: q });
      this.history.push({ role: 'assistant', content: answer });
      if (this.history.length > 20) {
        this.history = this.history.slice(-20);
      }
    } catch (e) {
      thinking.innerHTML = `<div class="err">出错了：${this.esc(e.message)}</div>`;
    }

    this._sending = false;
    $('#sendBtn').disabled = false;
    input.focus();
  },

  renderAnswer(text) {
    // 按双换行拆成段落
    const paragraphs = text.split(/\n\n+/);

    let html = paragraphs.map(p => {
      p = this.esc(p.trim());
      if (!p) return '';

      // Bold
      p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // Section header: ### xxx 或 ## xxx
      if (/^#{2,3}\s/.test(p)) {
        const title = p.replace(/^#{2,3}\s+/, '');
        return `<div class="ans-section">${title}</div>`;
      }

      // Bullet items: - xxx 或 • xxx
      if (/^[-•]\s/.test(p)) {
        const items = p.split(/\n/).filter(Boolean);
        return '<ul class="ans-list">' + items.map(item =>
          `<li>${item.replace(/^[-•]\s+/, '')}</li>`
        ).join('') + '</ul>';
      }

      // 纯数字行列表：每行都是 "1、xxx" — 用 <ol>
      const lines = p.split(/\n/);
      if (lines.length >= 2 && lines.every(l => /^\d+[\.、]/.test(l.trim()))) {
        return '<ol class="ans-list">' + lines.map(l =>
          `<li>${l.replace(/^\d+[\.、]\s*/, '')}</li>`
        ).join('') + '</ol>';
      }

      // 按「换行+数字前缀」拆成编号条目块，解决 1、2、3 挤在一起的问题
      const blocks = p.split(/\n(?=\d+[\.、])/);
      if (blocks.length > 1) {
        return blocks.map(b => this._renderNumberedBlock(b)).join('');
      }

      // 单块但以数字开头：带标题的条目
      if (/^\d+[\.、]/.test(p)) {
        return this._renderNumberedBlock(p);
      }

      // 普通段落
      p = p.replace(/\n/g, '<br>');
      return `<p>${p}</p>`;
    }).join('');

    // 参考标签
    html = html.replace(/【(.+?)】/g, '<span class="ref-tag">$1</span>');

    return `<div class="answer-text">${html}</div>`;
  },

  // 编号条目："1、标题\n内容内容" → 标题行 + 内容区
  _renderNumberedBlock(text) {
    const idx = text.indexOf('\n');
    if (idx > 0) {
      const heading = text.substring(0, idx);
      const body = text.substring(idx + 1).replace(/\n/g, '<br>');
      return `<div class="ans-item"><div class="ans-item-heading">${heading}</div><div class="ans-item-body">${body}</div></div>`;
    }
    // 只有标题，没内容
    return `<div class="ans-item-heading" style="margin-top:12px">${text}</div>`;
  },

  addMsg(role, content, isHtml = false) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    if (isHtml) {
      div.innerHTML = content;
    } else {
      div.innerHTML = `<div class="msg-content">${this.esc(content)}</div>`;
    }
    $('#chatList').appendChild(div);
    this.scrollBottom();
    return div;
  },

  clearHistory() {
    $('#chatList').innerHTML = '';
    this.history = [];
    this.renderWelcome();
  },

  scrollBottom() {
    const area = $('#chatArea');
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 100);
  },

  toggleSettings() {
    $('#settingsOverlay').classList.toggle('on');
  },

  saveKey() {
    const key = $('#apiKeyInput').value.trim();
    if (!key) { alert('请输入 API Key'); return; }
    localStorage.setItem('fe_settings', JSON.stringify({ apiKey: key }));
    this.api = new AIClient(key);
    alert('Key 已保存');
    this.toggleSettings();
  },

  resetKey() {
    localStorage.removeItem('fe_settings');
    this.api = null;
    $('#apiKeyInput').value = '';
    alert('Key 已清除，请重新设置');
    this.toggleSettings();
  },

  esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
