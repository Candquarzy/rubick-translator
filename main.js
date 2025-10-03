    const RT = window.rubickTranslator;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    let systemListenerAttached = false;
    let onSystemChange = null;

    function resolveTheme(mode) {
      if (mode === 'dark' || mode === 'light') return mode;
      return (prefersDark && prefersDark.matches) ? 'dark' : 'light';
    }

    function applyTheme(mode) {
      const finalMode = resolveTheme(mode);
      document.documentElement.setAttribute('data-theme', finalMode);
      try { document.documentElement.style.colorScheme = finalMode; } catch {}
      if (mode === 'system') {
        attachSystemListener();
      } else {
        detachSystemListener();
      }
    }

    function attachSystemListener() {
      if (!prefersDark || systemListenerAttached) return;
      onSystemChange = () => applyTheme('system');
      prefersDark.addEventListener('change', onSystemChange);
      systemListenerAttached = true;
    }

    function detachSystemListener() {
      if (!prefersDark || !systemListenerAttached) return;
      prefersDark.removeEventListener('change', onSystemChange);
      systemListenerAttached = false;
    }
    const LANGS = [
      { code: 'auto', name: '自动' },
      { code: 'zh', name: '中文' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'es', name: 'Español' },
      { code: 'ru', name: 'Русский' },
      { code: 'ar', name: 'العربية' },
      { code: 'pt', name: 'Português' },
      { code: 'it', name: 'Italiano' },
      { code: 'hi', name: 'हिन्दी' }
    ];

    function fillSelect(select, options, value) {
      select.innerHTML = '';
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.code; o.textContent = opt.name; select.appendChild(o);
      }
      if (value) select.value = value;
    }

    function isChinese(text) { return /[\u3400-\u9FBF]/.test(text); }

    async function renderHistory() {
      const list = document.getElementById('historyList');
      list.innerHTML = '';
      const items = await RT.getHistory();
      if (!items || items.length === 0) {
        const div = document.createElement('div');
        div.className = 'hint';
        div.textContent = '暂无历史记录';
        list.appendChild(div);
        return;
      }
      for (const item of items) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<div>${item.text ? item.text.slice(0, 120) : ''}</div><small>${item.source} → ${item.target} · ${item.provider}</small>`;
        div.addEventListener('click', () => {
          const inp = document.getElementById('input');
          const out = document.getElementById('output');
          document.getElementById('provider').value = item.provider;
          document.getElementById('sourceLang').value = item.source;
          document.getElementById('targetLang').value = item.target;
          inp.value = item.text;
          out.value = item.translated || '';
          RT.setSubInputValue(item.text);
        });
        list.appendChild(div);
      }
    }

    async function doTranslate(trigger = 'manual') {
      const inp = document.getElementById('input');
      const out = document.getElementById('output');
      const provider = document.getElementById('provider').value;
      let source = document.getElementById('sourceLang').value;
      let target = document.getElementById('targetLang').value;
      const text = inp.value.trim();
      if (!text) { out.value = ''; return; }
      if (source === target && source !== 'auto') { out.value = text; return; }
      if (source === 'auto') target = target || (isChinese(text) ? 'en' : 'zh');
      try {
        const res = await RT.translate({ text, provider, source, target });
        out.value = res.translated || '';
        if (res.detectedSource && document.getElementById('sourceLang').value === 'auto') {
          document.getElementById('sourceLang').value = res.detectedSource;
        }
        await renderHistory();
      } catch (e) {
        out.value = '';
      }
    }

    function bindEvents() {
      document.getElementById('doTranslate').addEventListener('click', () => doTranslate('manual'));
      document.getElementById('copyResult').addEventListener('click', async () => {
        const out = document.getElementById('output').value;
        if (!out) return;
        try { await navigator.clipboard.writeText(out); RT.toast('已复制'); } catch { RT.toast('复制失败'); }
      });
      document.getElementById('swapLang').addEventListener('click', async () => {
        const s = document.getElementById('sourceLang');
        const t = document.getElementById('targetLang');
        const temp = s.value; s.value = t.value; t.value = temp;
        await RT.updateSettings({ lastSourceLang: s.value, lastTargetLang: t.value });
        doTranslate('swap');
      });
      document.getElementById('provider').addEventListener('change', async (e) => {
        await RT.updateSettings({ lastProvider: e.target.value });
        doTranslate('provider-change');
      });
      document.getElementById('sourceLang').addEventListener('change', async (e) => {
        await RT.updateSettings({ lastSourceLang: e.target.value });
        doTranslate('source-change');
      });
      document.getElementById('targetLang').addEventListener('change', async (e) => {
        await RT.updateSettings({ lastTargetLang: e.target.value });
        doTranslate('target-change');
      });
      document.getElementById('ltBaseUrl').addEventListener('change', (e) => {
        RT.updateSettings({ libretranslateBaseUrl: e.target.value || '' });
      });
      document.getElementById('mmEmail').addEventListener('change', (e) => {
        RT.updateSettings({ mymemoryEmail: e.target.value || '' });
      });
      document.getElementById('clearHistory').addEventListener('click', async () => {
        await RT.clearHistory();
        renderHistory();
      });
      document.getElementById('themeMode').addEventListener('change', async (e) => {
        const val = e.target.value;
        await RT.updateSettings({ themeMode: val });
        applyTheme(val);
      });
      const inputEl = document.getElementById('input');
      let debounceTimer;
      inputEl.addEventListener('input', (e) => {
        RT.setSubInputValue(e.target.value);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => doTranslate('typing'), 350);
      });
    }

    async function bootstrap() {
      await RT.ready();
      const state = await RT.init();
      // Theme
      const themeMode = state?.settings?.themeMode || 'system';
      document.getElementById('themeMode').value = themeMode;
      applyTheme(themeMode);
      fillSelect(document.getElementById('sourceLang'), LANGS, state?.settings?.lastSourceLang || 'auto');
      fillSelect(document.getElementById('targetLang'), LANGS.filter(l => l.code !== 'auto'), state?.settings?.lastTargetLang || 'zh');
      document.getElementById('provider').value = state?.settings?.lastProvider || 'google';
      document.getElementById('ltBaseUrl').value = state?.settings?.libretranslateBaseUrl || 'https://libretranslate.com';
      document.getElementById('mmEmail').value = state?.settings?.mymemoryEmail || '';

      RT.bindSubInput(async ({ text }) => {
        const inp = document.getElementById('input');
        inp.value = text || '';
        if (text && text.trim()) doTranslate('sub-input');
      }, '输入待翻译文本…');

      bindEvents();
      renderHistory();
    }

    window.addEventListener('DOMContentLoaded', bootstrap);