/**
 * pt-BR date/time formatting shared by the sync UI (outbox cards, sync status bar).
 */

/** "dd/mm HH:MM" from an ISO string, used where the source is a stored timestamp. */
export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** "HH:MM" from a Date, used where the source is already a live Date value. */
export function formatTime(date: Date | null | undefined): string {
  if (!date) return 'Nunca';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
