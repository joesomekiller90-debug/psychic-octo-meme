import { Icon } from '../icons';
import { store } from '../store';

const TONE_ICON = { good: 'sparkle', bad: 'alert', info: 'info', level: 'star' } as const;

export function Toasts() {
  const toasts = store.toasts;
  return (
    <div class="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div class={`toast toast-${t.tone}`} key={t.id}>
          <span class="toast-icon">
            <Icon name={t.icon ?? TONE_ICON[t.tone]} size={20} />
          </span>
          <div class="toast-main">
            <div class="toast-title">{t.title}</div>
            {t.body && <div class="toast-body">{t.body}</div>}
            {t.action && (
              <button
                type="button"
                class="toast-action"
                onClick={() => {
                  t.action!.run();
                  store.dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button type="button" class="icon-btn icon-btn-sm" aria-label="Dismiss" onClick={() => store.dismissToast(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
