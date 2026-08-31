import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { audioManager } from '../../audio/AudioManager';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  block,
  className = '',
  onClick,
  onMouseEnter,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={cls}
      onClick={(e) => {
        audioManager.unlock();
        audioManager.play('uiClick', { volume: 0.45 });
        onClick?.(e);
      }}
      onMouseEnter={(e) => {
        audioManager.play('uiHover', { volume: 0.25 });
        onMouseEnter?.(e);
      }}
      {...rest}
    />
  );
}

export function Panel({
  title,
  actions,
  children,
  className = '',
  bracket,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bracket?: boolean;
}) {
  return (
    <section className={`panel ${bracket ? 'bracket' : ''} ${className}`}>
      {(title || actions) && (
        <header className="panel__header">
          <h3 className="panel__title">{title}</h3>
          {actions}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Chip({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'amber' | 'jade' | 'rust' | 'cyan' | 'locked';
  children: ReactNode;
}) {
  return <span className={`chip ${tone !== 'default' ? `chip--${tone}` : ''}`}>{children}</span>;
}

export function Meter({
  value,
  max = 1,
  tone = 'default',
  className = '',
}: {
  value: number;
  max?: number;
  tone?: 'default' | 'danger' | 'warn' | 'amber';
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className={`meter ${tone !== 'default' ? `meter--${tone}` : ''} ${className}`}>
      <div className="meter__fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

export function StarIcon({ filled, large }: { filled: boolean; large?: boolean }) {
  return (
    <svg
      className={`star ${filled ? 'star--on' : ''} ${large ? 'star--lg' : ''}`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.6 6.1 20.7l1.2-6.5L2.5 9.6l6.6-.9z" strokeLinejoin="round" />
    </svg>
  );
}

export function Stars({ value, max = 3, large }: { value: number; max?: number; large?: boolean }) {
  return (
    <span className="stars" role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} filled={i < value} large={large} />
      ))}
    </span>
  );
}

export function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

/** Keeps a tooltip fully on screen; 10px of breathing room at the edges. */
const TOOLTIP_MARGIN = 10;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  // The bubble is centred on its trigger, which pushes it off screen for
  // anything near an edge — the first deployment card, for instance. The app
  // clips overflow, so that reads as a chopped-off panel. Nudge it back inside
  // after layout, before the browser paints.
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!open || !el) return;
    el.style.transform = 'translateX(-50%)';
    const rect = el.getBoundingClientRect();
    let shift = 0;
    if (rect.left < TOOLTIP_MARGIN) {
      shift = TOOLTIP_MARGIN - rect.left;
    } else if (rect.right > window.innerWidth - TOOLTIP_MARGIN) {
      shift = window.innerWidth - TOOLTIP_MARGIN - rect.right;
    }
    if (shift !== 0) el.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`;
  }, [open, content]);

  return (
    <span
      className="tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="tip__bubble" ref={bubbleRef}>
          {content}
        </span>
      )}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Panel title={title} bracket actions={onClose ? <Button size="sm" variant="ghost" onClick={onClose}>Close</Button> : undefined}>
          {children}
          {footer && <div className="modal__footer">{footer}</div>}
        </Panel>
      </div>
    </div>
  );
}

export function AmberBadge({ amount, delta }: { amount: number; delta?: number }) {
  return (
    <span className="amber-badge" title="Amber — permanent progression currency">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path
          d="M12 2.4 20 7.6v8.8L12 21.6 4 16.4V7.6z"
          fill="var(--amber)"
          stroke="var(--amber-deep)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M12 6.4 16.6 9.4v5.2L12 17.6 7.4 14.6V9.4z" fill="rgba(255,255,255,0.35)" />
      </svg>
      <span className="amber-badge__value">{amount.toLocaleString()}</span>
      {delta !== undefined && delta > 0 && <span className="amber-badge__delta">+{delta}</span>}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
