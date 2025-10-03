/* eslint-disable */
(function () {
  const DEFAULT_SETTINGS = {
    lastProvider: 'google',
    lastSourceLang: 'auto',
    lastTargetLang: 'zh',
    libretranslateBaseUrl: 'https://libretranslate.com',
    mymemoryEmail: '',
    themeMode: 'system',
    tencent_SID: '',
    tencent_SKEY: ''
  };

  const HISTORY_DOC_ID = 'rubick-translator/history';
  const SETTINGS_DOC_ID = 'rubick-translator/settings';
  const HISTORY_MAX = 30;

  function isChinese(text) { return /[\u3400-\u9FBF]/.test(text); }

  async function readDoc(id) {
    try { return await rubick.db.get(id); } catch (e) { return null; }
  }

  async function writeDoc(id, updater) {
    const existing = await readDoc(id);
    const base = existing ? { ...existing } : { _id: id };
    const next = await Promise.resolve(updater(base));
    return rubick.db.put(next);
  }

  function withTimeout(promise, ms, signal) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timeout')), ms);
    });
    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      timeout
    ]);
  }

  async function translateWithLibreTranslate({ text, source, target, baseUrl }) {
    const url = (baseUrl || DEFAULT_SETTINGS.libretranslateBaseUrl || '').replace(/\/$/, '') + '/translate';
    const controller = new AbortController();
    const body = {
      q: text,
      source: source || 'auto',
      target,
      format: 'text'
    };
    const req = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(r => r.json());
    const data = await withTimeout(req, 12000, controller.signal);
    const translated = data?.translatedText || data?.translated_text || '';
    const detectedSource = data?.detectedLanguage?.language || data?.detected_source_language || (source === 'auto' ? (isChinese(text) ? 'zh' : 'en') : source);
    return { translated, detectedSource };
  }

  async function translateWithMyMemory({ text, source, target, email }) {
    const params = new URLSearchParams();
    params.set('q', text);
    params.set('langpair', `${source || 'auto'}|${target}`);
    if (email) params.set('de', email);
    const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
    const controller = new AbortController();
    const req = fetch(url, { signal: controller.signal }).then(r => r.json());
    const data = await withTimeout(req, 12000, controller.signal);
    const translated = data?.responseData?.translatedText || '';
    const detectedSource = (source === 'auto' ? (data?.responseData?.detectedLanguage || (isChinese(text) ? 'zh' : 'en')) : source);
    return { translated, detectedSource };
  }

  async function translateWithGoogle({ text, source, target }) {
    // Public Google endpoint (no key), works well in Electron renderer
    const params = new URLSearchParams();
    params.set('client', 'gtx');
    params.set('sl', source || 'auto');
    params.set('tl', target);
    params.set('dt', 't');
    params.set('q', text);
    const url = `https://google-translate-proxy.tantu.com/translate_a/single?${params.toString()}`;
    const controller = new AbortController();
    const req = fetch(url, { signal: controller.signal }).then(r => r.json());
    const data = await withTimeout(req, 12000, controller.signal);
    // Expected shape: [[ [translated, original, ...], ... ], null, detectedSource, ...]
    const sentences = Array.isArray(data?.[0]) ? data[0] : [];
    const translated = sentences.map(s => (Array.isArray(s) ? (s[0] || '') : '')).join('');
    const detectedSource = (source === 'auto' ? (data?.[2] || (isChinese(text) ? 'zh' : 'en')) : source);
    return { translated, detectedSource };
  }

  async function translateWithTencent({ text, source, target }) {
    const sid = await readDoc(SETTINGS_DOC_ID)?.tencent_SID;
    const skey = await readDoc(SETTINGS_DOC_ID)?.tencent_SKEY;

    if (!sid || !skey) {
      throw new Error("密钥配置错误!");
    }

    const clientCofig = {
      credential: { sid, skey },
      region: "ap-beijing",
      profile: {
        httpProfile: { endpoint: "tmt.tencentcloudapi.com" }
      }
    };

    const tencentCilent = new TmtClient(clientCofig);

    const controller = new AbortController();
    const params = {
      "SourceText": text,
      "Source": source || "auto",
      "Target": target || "zh",
      "ProjectId": 0
    };

    const req = tencentCilent.TextTranslate(params);
    const data = await withTimeout(req,15000,controller.signal);

    const translated = data ?. TargetText || "";

        const detectedSource = (source === 'auto' ? (data?.[2] || (isChinese(text) ? 'zh' : 'en')) : source);
    // const detected_source_language = source === "auto" ? (data?.Source || (isChinese(text)? "zh" : "en")) : Source;

    return { translated, detectedSource };
  }

  async function ensureDefaults() {
    const settingsDoc = await readDoc(SETTINGS_DOC_ID);
    if (!settingsDoc) {
      await rubick.db.put({ _id: SETTINGS_DOC_ID, ...DEFAULT_SETTINGS });
    }
    const historyDoc = await readDoc(HISTORY_DOC_ID);
    if (!historyDoc) {
      await rubick.db.put({ _id: HISTORY_DOC_ID, items: [] });
    }
  }

  async function getSettings() {
    const doc = await readDoc(SETTINGS_DOC_ID);
    return { ...DEFAULT_SETTINGS, ...(doc || {}) };
  }

  async function updateSettings(partial) {
    await writeDoc(SETTINGS_DOC_ID, (doc) => ({ ...doc, ...partial }));
    return getSettings();
  }

  async function addHistory(entry) {
    await writeDoc(HISTORY_DOC_ID, (doc) => {
      const items = Array.isArray(doc.items) ? doc.items.slice() : [];
      items.unshift({ ...entry, ts: Date.now() });
      if (items.length > HISTORY_MAX) items.length = HISTORY_MAX;
      return { ...doc, items };
    });
  }

  async function getHistory() {
    const doc = await readDoc(HISTORY_DOC_ID);
    return (doc && Array.isArray(doc.items)) ? doc.items : [];
  }

  async function clearHistory() {
    await writeDoc(HISTORY_DOC_ID, (doc) => ({ ...doc, items: [] }));
  }

  function toast(message) {
    try { rubick.showNotification(String(message || '')); } catch (_) { }
  }

  let readyResolver;
  const readyPromise = new Promise((resolve) => { readyResolver = resolve; });

  rubick.onPluginReady(async () => {
    try { await ensureDefaults(); } catch (_) { }
    if (readyResolver) readyResolver(true);
  });

  function setSubInputValue(value) {
    try { return rubick.setSubInputValue(String(value ?? '')); } catch (_) { return false; }
  }

  function bindSubInput(onChange, placeholder) {
    try {
      return rubick.setSubInput(({ text }) => {
        try { onChange && onChange({ text }); } catch (_) { }
      }, String(placeholder || ''));
    } catch (_) { return false; }
  }

  async function translate({ text, provider, source, target }) {
    const settings = await getSettings();
    const cleanText = String(text || '').trim();
    if (!cleanText) return { translated: '', detectedSource: source || 'auto' };
    const useProvider = provider || settings.lastProvider || 'libretranslate';
    let result = { translated: '', detectedSource: source || 'auto' };
    switch (useProvider) {
      case "libretranslate":
        result = await translateWithLibreTranslate({
          text: cleanText,
          source: source || 'auto',
          target: target || (isChinese(cleanText) ? 'en' : 'zh'),
          baseUrl: settings.libretranslateBaseUrl
        });
        break;
      case "mymemory":
        result = await translateWithMyMemory({
          text: cleanText,
          source: source || 'auto',
          target: target || (isChinese(cleanText) ? 'en' : 'zh'),
          email: settings.mymemoryEmail
        });
        break;
      case "google":
        result = await translateWithGoogle({
          text: cleanText,
          source: source || 'auto',
          target: target || (isChinese(cleanText) ? 'en' : 'zh')
        });
        break;
      case "tencent":
        result = await translateWithTencent({
          text : cleanText,
          source: source || "auto",
          target: target || (isChinese(cleanText) ? "en" : "zh")
        })
        break;
      default:
        throw new Error('Unsupported provider');
        break;
    }
    // if (useProvider === 'libretranslate') {
    //   result = await translateWithLibreTranslate({
    //     text: cleanText,
    //     source: source || 'auto',
    //     target: target || (isChinese(cleanText) ? 'en' : 'zh'),
    //     baseUrl: settings.libretranslateBaseUrl
    //   });
    // } else if (useProvider === 'mymemory') {
    //   result = await translateWithMyMemory({
    //     text: cleanText,
    //     source: source || 'auto',
    //     target: target || (isChinese(cleanText) ? 'en' : 'zh'),
    //     email: settings.mymemoryEmail
    //   });
    // } else if (useProvider === 'google') {
    //   result = await translateWithGoogle({
    //     text: cleanText,
    //     source: source || 'auto',
    //     target: target || (isChinese(cleanText) ? 'en' : 'zh')
    //   });
    // } else {
    //   throw new Error('Unsupported provider');
    // }
    await addHistory({
      text: cleanText,
      translated: result.translated,
      provider: useProvider,
      source: source || 'auto',
      target: target,
      detectedSource: result.detectedSource
    });
    return result;
  }

  window.rubickTranslator = {
    ready: () => readyPromise,
    init: async () => ({ settings: await getSettings(), history: await getHistory() }),
    translate,
    updateSettings,
    getHistory,
    clearHistory,
    toast,
    bindSubInput,
    setSubInputValue
  };
})();
