import './material.js';
import { initBridge, spawnScript, getModuleDir as getBridgeModuleDir } from './bridge.js';
import { setModuleDir, migrateLocalStorage, cfgGet, cfgSet } from './cfg.js';
import { initDevice, refreshDevice, refreshKeyboxStatus } from './device.js';
import { initClock } from './clock.js';
import { initNetwork } from './network.js';
import { initTheme } from './theme.js';
import { initI18n } from './i18n.js';
import { loadContributors } from './contributors.js';
import { initRedirect } from './redirect.js';
import { escapeHtml } from './utils.js';
import { openRecentActivity, addEntry } from './history.js';
import { showToast } from './toast.js';
import { initTerminal, appendToOutput } from './terminal.js';

let devMode = false;
let friendlyNames = {};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initBridge();
    setModuleDir(getBridgeModuleDir());
    await migrateLocalStorage();
  } catch (e) {
    console.warn('Bridge init failed, running without module path:', e);
  }

  wireTopBarScroll();
  const savedTheme = await cfgGet('theme', 'dark') || 'dark';
  initTheme(savedTheme);
  wireNavigation();
  wireActions();
  wireKeyboxCard();
  wireRefreshButton();
  wireCustomKeybox();
  await initI18n();
  initClock();
  initNetwork();
  await initDevice();
  populateProviders();
  loadContributors();
  initRedirect();
  buildFriendlyNames();

  const savedDevMode = await cfgGet('dev_mode', 'false') || 'false';
  devMode = savedDevMode === 'true';
  const sw = document.getElementById('dev-mode-switch');
  if (sw) sw.selected = devMode;
  wireDevMode();
  initTerminal();
});

function wireTopBarScroll() {
  const topBar = document.getElementById('top-bar');
  const main = document.querySelector('main');
  if (!topBar || !main) return;
  main.addEventListener('scroll', () => {
    topBar.classList.toggle('top-bar--scrolled', main.scrollTop > 0);
  });
}

function wireNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const indicator = document.getElementById('nav-indicator');
  const pages = [
    document.getElementById('home-page'),
    document.getElementById('actions-page'),
    document.getElementById('advanced-page'),
    document.getElementById('settings-page'),
  ];

  function reposition(tab) {
    indicator.style.left = tab.offsetLeft + 'px';
    indicator.style.width = tab.offsetWidth + 'px';
  }

  requestAnimationFrame(() => {
    const active = document.querySelector('.nav-tab--active');
    if (active) reposition(active);
  });

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('nav-tab--active')) return;
      const oldTab = document.querySelector('.nav-tab--active');
      if (oldTab) {
        oldTab.classList.remove('nav-tab--active');
        oldTab.removeAttribute('aria-current');
        oldTab.querySelector('.nav-icon')?.classList.remove('nav-icon--filled');
      }
      tab.classList.add('nav-tab--active');
      tab.setAttribute('aria-current', 'page');
      tab.querySelector('.nav-icon')?.classList.add('nav-icon--filled');
      reposition(tab);
      const pageId = tab.dataset.page;
      pages.forEach((el) => { el.hidden = el.id !== pageId; });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-tab--active');
    if (active) reposition(active);
  });
}

function buildFriendlyNames() {
  document.querySelectorAll('.list-item[data-script]').forEach(item => {
    const scriptName = item.dataset.script;
    const headline = item.querySelector('.toggle-text[data-i18n]');
    if (headline) friendlyNames[scriptName] = headline.dataset.i18n;
  });
  window.__friendlyNames = friendlyNames;
}

function getFriendlyName(scriptName) {
  return friendlyNames[scriptName] || scriptName;
}

function wireDevMode() {
  const sw = document.getElementById('dev-mode-switch');
  if (!sw) return;
  sw.addEventListener('change', () => {
    devMode = sw.selected;
    cfgSet('dev_mode', sw.selected ? 'true' : 'false');
  });
}

function wireActions() {
  document.querySelectorAll('.list-item[data-script]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (item.disabled) return;
      const scriptName = item.dataset.script;
      const spinner = item.querySelector('.action-spinner');
      item.disabled = true;
      spinner?.classList.remove('hidden');
      try {
        if (devMode) {
          await runDevAction(scriptName, item, spinner);
        } else {
          await runSimpleAction(scriptName, item, spinner);
        }
      } catch (_e) {
        console.warn('Action error:', _e);
      } finally {
        item.disabled = false;
        spinner?.classList.add('hidden');
      }
    });
  });
}

async function runDevAction(scriptName, item, spinner) {
  const lines = [];
  const { getTranslation } = await import('./i18n.js');
  appendToOutput(`> ${scriptName}`);
  const dialog = document.createElement('md-dialog');
  dialog.innerHTML = `
    <div slot="headline">${scriptName}</div>
    <div slot="content"><div class="terminal"><pre id="live-output"></pre></div></div>
    <div slot="actions">
      <md-text-button class="dialog-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
  const pre = dialog.querySelector('#live-output');
  const child = spawnScript(scriptName, 'feature');
  child.stdout.on('data', line => {
    appendToOutput(line); lines.push(line);
    if (pre) pre.textContent += line + '\n';
    if (pre?.parentElement) pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
  });
  child.stderr.on('data', line => {
    appendToOutput(line, true); lines.push('[!] ' + line);
    if (pre) pre.textContent += '[!] ' + line + '\n';
    if (pre?.parentElement) pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
  });
  child.on('exit', (code) => {
    appendToOutput(`> ${scriptName} exited (code: ${code})`);
    addEntry(scriptName, lines.join('\n'));
  });
  child.on('error', err => {
    const msg = err.message || 'Unknown error';
    appendToOutput(`> Error: ${msg}`, true);
    addEntry(scriptName, msg);
  });
}

async function runSimpleAction(scriptName, item, spinner) {
  const { getTranslation } = await import('./i18n.js');
  const i18nKey = getFriendlyName(scriptName);
  const friendlyName = getTranslation(i18nKey) || i18nKey;
  const lines = [];
  appendToOutput(`> ${friendlyName}`);
  const dialog = document.getElementById('progress-dialog');
  const label = document.getElementById('progress-label');
  const text = document.getElementById('progress-text');
  if (label) label.textContent = friendlyName;
  if (text) text.textContent = getTranslation('simple_dialog_wait') || 'This may take a moment';
  dialog.show();
  const child = spawnScript(scriptName, 'feature');
  child.stdout.on('data', line => {
    appendToOutput(line); lines.push(line);
  });
  child.stderr.on('data', line => {
    appendToOutput(line, true); lines.push('[!] ' + line);
  });
  child.on('exit', (code) => {
    appendToOutput(`> ${friendlyName} exited (code: ${code})`);
    addEntry(scriptName, lines.join('\n'));
    dialog.close();
    if (code !== 0) {
      const errorMsg = lines.find(l => l.includes('Error')) || lines[lines.length - 1] || friendlyName;
      showToast(`${getTranslation('simple_toast_error') || 'Failed'}: ${errorMsg}`, {
        icon: 'error', type: 'error',
        action: getTranslation('simple_toast_view_details') || 'View Details',
        autoCloseDelay: 8000,
        onActionClick: () => {
          const errDialog = document.createElement('md-dialog');
          errDialog.innerHTML = `
            <div slot="headline">${getTranslation('error_dialog_title') || 'Error Details'}</div>
            <div slot="content"><div class="terminal"><pre>${escapeHtml(lines.join('\n'))}</pre></div></div>
            <div slot="actions">
              <md-text-button class="dialog-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
            </div>
          `;
          document.body.appendChild(errDialog);
          errDialog.querySelector('.dialog-close').addEventListener('click', () => errDialog.close());
          errDialog.addEventListener('close', () => document.body.removeChild(errDialog));
          errDialog.show();
        },
      });
    } else {
      showToast(getTranslation('toast_success') || 'Done', {
        icon: 'check_circle', type: 'success', autoCloseDelay: 3000,
      });
    }
  });
  child.on('error', err => {
    const msg = err.message || 'Unknown error';
    appendToOutput(`> Error: ${msg}`, true);
    addEntry(scriptName, msg);
    dialog.close();
    showToast(`${getTranslation('simple_toast_error') || 'Failed'}: ${friendlyName}`, {
      icon: 'error', type: 'error',
      action: getTranslation('simple_toast_view_details') || 'View Details',
      autoCloseDelay: 8000,
      onActionClick: () => {
        const errDialog = document.createElement('md-dialog');
        errDialog.innerHTML = `
          <div slot="headline">${getTranslation('error_dialog_title') || 'Error Details'}</div>
          <div slot="content"><div class="terminal"><pre>${escapeHtml(msg)}</pre></div></div>
          <div slot="actions">
            <md-text-button class="dialog-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
          </div>
        `;
        document.body.appendChild(errDialog);
        errDialog.querySelector('.dialog-close').addEventListener('click', () => errDialog.close());
        errDialog.addEventListener('close', () => document.body.removeChild(errDialog));
        errDialog.show();
      },
    });
  });
}

function wireRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await Promise.all([refreshDevice(), refreshKeyboxStatus()]);
    btn.disabled = false;
  });
}

function wireKeyboxCard() {
  const card = document.getElementById('keybox-card');
  if (!card) return;
  card.addEventListener('click', () => {
    const sw = document.getElementById('dev-mode-switch');
    openRecentActivity(sw ? sw.selected : false);
  });
}

const PROVIDERS_CACHE_KEY = 'kb_providers_cache';
const PROVIDERS_CACHE_TTL = 3600000;

function loadProviderCache() {
  try {
    const raw = localStorage.getItem(PROVIDERS_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp < PROVIDERS_CACHE_TTL) return data;
  } catch {}
  return null;
}

function saveProviderCache(sources) {
  try {
    localStorage.setItem(PROVIDERS_CACHE_KEY, JSON.stringify({ sources, timestamp: Date.now() }));
  } catch {}
}

function renderProviderOptions(select, sources) {
  while (select.children.length > 1) select.removeChild(select.lastChild);
  for (const s of sources) {
    const opt = document.createElement('md-select-option');
    opt.setAttribute('value', s);
    opt.innerHTML = `<div slot="headline">${s}</div>`;
    select.appendChild(opt);
  }
}

async function populateProviders() {
  const select = document.getElementById('kb-provider');
  if (!select) return;

  const saved = await cfgGet('kb_provider', 'auto') || 'auto';

  const cached = loadProviderCache();
  if (cached) {
    renderProviderOptions(select, cached.sources);
    select.value = saved;
  }

  if (!select._listenerAttached) {
    select.addEventListener('change', () => cfgSet('kb_provider', select.value));
    select._listenerAttached = true;
  }

  try {
    const res = await fetch('https://yuribin.netlify.app/key/catalog');
    if (res.ok) {
      const data = await res.json();
      const sources = [...new Set((data.entries || []).map(e => e.source))].sort();
      saveProviderCache(sources);
      renderProviderOptions(select, sources);
      select.value = localStorage.getItem('kb_provider_selected') || saved;
    }
  } catch {}
}

function wireCustomKeybox() {
  const btn = document.getElementById('custom-keybox-btn');
  if (!btn) return;
  btn.addEventListener('click', openCustomKeyboxDialog);
}

async function openCustomKeyboxDialog() {
  const { getTranslation } = await import('./i18n.js');
  const t = (key, fallback) => getTranslation(key) || fallback;

  const dialog = document.createElement('md-dialog');
  let selectedFile = null;

  dialog.innerHTML = `
    <div slot="headline">${t('custom_kb_title', 'Custom Keybox')}</div>
    <div slot="content">
      <div class="custom-kb-section">
        <md-icon>upload_file</md-icon>
        <p style="margin:8px 0 4px;font-size:0.875rem">${t('custom_kb_file', 'From File')}</p>
        <p style="margin:0 0 12px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant)">
          Select a keybox XML file from your device
        </p>
        <md-filled-tonal-button id="kb-file-btn">${t('custom_kb_browse', 'Browse Files')}</md-filled-tonal-button>
        <span id="kb-file-name" style="margin-left:8px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant)">
          ${t('custom_kb_no_file', 'No file selected')}
        </span>
        <input type="file" accept=".xml,.xml.bak" id="kb-file-input" style="display:none" />
      </div>
      <md-divider style="margin:16px 0"></md-divider>
      <div class="custom-kb-section">
        <md-icon>link</md-icon>
        <p style="margin:8px 0 4px;font-size:0.875rem">${t('custom_kb_url', 'From URL / Path')}</p>
        <p style="margin:0 0 12px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant)">
          Paste a download URL or device path
        </p>
        <md-outlined-text-field id="kb-url-input" style="width:100%" placeholder="https://example.com/keybox.xml or /sdcard/keybox.xml"></md-outlined-text-field>
      </div>
    </div>
    <div slot="actions">
      <md-text-button id="kb-clear">${t('custom_kb_clear', 'Clear')}</md-text-button>
      <md-text-button id="kb-cancel">${t('dialog_close', 'Close')}</md-text-button>
      <md-filled-tonal-button id="kb-apply">${t('custom_kb_apply', 'Apply')}</md-filled-tonal-button>
    </div>
  `;

  document.body.appendChild(dialog);

  const fileInput = dialog.querySelector('#kb-file-input');
  const fileBtn = dialog.querySelector('#kb-file-btn');
  const fileName = dialog.querySelector('#kb-file-name');
  const urlInput = dialog.querySelector('#kb-url-input');
  const clearBtn = dialog.querySelector('#kb-clear');
  const cancelBtn = dialog.querySelector('#kb-cancel');
  const applyBtn = dialog.querySelector('#kb-apply');

  fileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      selectedFile = fileInput.files[0];
      fileName.textContent = selectedFile.name;
    }
  });

  clearBtn.addEventListener('click', async () => {
    cfgSet('kb_custom_type', '');
    cfgSet('kb_custom_value', '');
    showToast(t('custom_kb_cleared', 'Custom keybox cleared'), { icon: 'info', type: 'info', autoCloseDelay: 2500 });
    dialog.close();
  });

  cancelBtn.addEventListener('click', () => dialog.close());

  applyBtn.addEventListener('click', async () => {
    const { exec } = await import('./bridge.js');

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        const b64 = btoa(content);
        try {
          await exec(`echo '${b64}' | base64 -d > /data/local/tmp/custom_keybox.xml 2>/dev/null`);
          cfgSet('kb_custom_type', 'file');
          cfgSet('kb_custom_value', '/data/local/tmp/custom_keybox.xml');
          showToast(t('custom_kb_applied', 'Custom keybox configured'), { icon: 'check_circle', type: 'success', autoCloseDelay: 2500 });
          dialog.close();
        } catch {
          showToast('Failed to write custom keybox', { icon: 'error', type: 'error', autoCloseDelay: 3000 });
        }
      };
      reader.readAsBinaryString(selectedFile);
    } else if (urlInput.value.trim()) {
      const val = urlInput.value.trim();
      const type = val.startsWith('http://') || val.startsWith('https://') ? 'url' : 'path';
      cfgSet('kb_custom_type', type);
      cfgSet('kb_custom_value', val);
      showToast(t('custom_kb_applied', 'Custom keybox configured'), { icon: 'check_circle', type: 'success', autoCloseDelay: 2500 });
      dialog.close();
    } else {
      showToast('Select a file or enter a URL/path', { icon: 'error', type: 'error', autoCloseDelay: 2500 });
    }
  });

  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
}
