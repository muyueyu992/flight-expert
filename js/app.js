/* ============================================
   航班管家供应商助手 — App
   ============================================ */

const DEFAULT_KEY = '35219dd3b6f441a5873d6d0c28b1de4e.r8Lb9LtVYFUa2U1j';

const App = {
  api: null,
  history: [],

  async init() {
    const s = JSON.parse(localStorage.getItem('fe_settings') || '{}');
    const key = s.apiKey || DEFAULT_KEY;
    this.api = new AIClient(key);
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
    this._sending = true;
    input.value = '';
    $('#sendBtn').disabled = true;

    this.addMsg('user', q);
    const thinking = this.addMsg('assistant', '<div class="thinking"><span></span><span></span><span></span></div>', true);

    try {
      const results = searchKnowledge(q);
      let context = '';
      if (results.length) {
        context = results.map((r, i) =>
          `【${i+1}】分类：${r.cat}\n问题：${r.q}\n答案：${r.a}`
        ).join('\n\n');
      } else {
        context = '知识库中未直接匹配到相关内容。请根据你的专业知识尽量回答，并建议用户联系对接人或发微信群确认。';
      }

      const answer = await this.api.ask(q, context);
      thinking.innerHTML = this.renderAnswer(answer);
      this.scrollBottom();
    } catch (e) {
      thinking.innerHTML = `<div class="err">出错了：${this.esc(e.message)}</div>`;
    }

    this._sending = false;
    $('#sendBtn').disabled = false;
    input.focus();
  },

  renderAnswer(text) {
    let html = this.esc(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/(\d+[、.])/g, '<br>$1');
    html = html.replace(/^<br>/, '');
    html = html.replace(/【(.+?)】/g, '<span class="ref-tag">$1</span>');
    return `<div class="answer-text">${html}</div>`;
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
    this.api = new AIClient(DEFAULT_KEY);
    $('#apiKeyInput').value = '';
    alert('已恢复默认 Key');
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
