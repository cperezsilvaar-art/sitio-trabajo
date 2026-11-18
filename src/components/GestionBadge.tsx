import { GESTION_STATUS_LABEL, GESTION_STATUS_STYLE, type GestionStatus } from '../lib/types';
import { cx } from './ui';

export function GestionBadge({ status }: { status: GestionStatus }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', GESTION_STATUS_STYLE[status])}>{GESTION_STATUS_LABEL[status]}</span>;
}
