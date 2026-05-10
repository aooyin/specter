import { escapeHtml } from './utils.js';
import { getTranslation } from './i18n.js';

export function showErrorDialog(title: string, content: string) {
  const dialog = document.createElement('md-dialog');
  dialog.setAttribute('type', 'alert');
  dialog.innerHTML = `
    <div slot="headline">${escapeHtml(title)}</div>
    <div slot="content" class="error-dialog-content">
      <div class="terminal"><pre>${escapeHtml(content)}</pre></div>
    </div>
    <div slot="actions">
      <md-text-button class="error-dialog-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('.error-dialog-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
}
