// Aggiornamenti in tempo reale dal server (Server-Sent Events su /api/events): quando una sfida cambia stato
// (nuovo invito, accettata, giocata, conclusa) le schermate aperte si ricaricano da sole e, se l'utente le ha
// permesse, arriva una notifica del browser. Le notifiche arrivano finché il gioco è aperto (anche in un'altra
// scheda o ridotto a icona); a gioco chiuso no.

export interface LiveNotice {
  duelId: string;
  title: string;
  body: string;
}

interface DuelEvent {
  type: 'duel';
  duelId: string;
  notify?: { title: string; body: string };
}

class LiveStore {
  /** Cresce a ogni cambiamento: le schermate lo leggono in un $effect per ricaricare. */
  version = $state(0);
  /** Avviso dentro il gioco (quando la pagina è in primo piano). */
  notice: LiveNotice | null = $state(null);
  permission: NotificationPermission | 'unsupported' = $state(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
}

export const live = new LiveStore();

const NOTICE_MS = 6000;
let source: EventSource | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let openDuel: (duelId: string) => void = () => {};

function bump(): void {
  live.version++;
}

function showNotice(notice: LiveNotice): void {
  if (noticeTimer) clearTimeout(noticeTimer);
  live.notice = notice;
  noticeTimer = setTimeout(() => (live.notice = null), NOTICE_MS);
}

async function showBrowserNotification(notice: LiveNotice): Promise<void> {
  const options: NotificationOptions = {
    body: notice.body,
    tag: `duel-${notice.duelId}`,
    icon: '/icons/icon.svg',
    data: { duelId: notice.duelId },
  };
  // Android accetta solo le notifiche del service worker; altrove va bene anche quella diretta
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (registration) {
    await registration.showNotification(notice.title, options);
    return;
  }
  const notification = new Notification(notice.title, options);
  notification.onclick = () => {
    window.focus();
    openDuel(notice.duelId);
    notification.close();
  };
}

function handle(event: DuelEvent): void {
  bump();
  if (!event.notify) return;
  const notice = { duelId: event.duelId, ...event.notify };
  if (document.visibilityState === 'visible') {
    showNotice(notice);
  } else if (live.permission === 'granted') {
    showBrowserNotification(notice).catch((err) => console.error('Notifica non mostrata', err));
  }
}

/** Da chiamare una volta, a sessione verificata. `onOpenDuel`: cosa fare quando si tocca una notifica. */
export function connectLive(onOpenDuel: (duelId: string) => void): void {
  openDuel = onOpenDuel;
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/events');
  let dropped = false;
  source.onmessage = (message) => {
    try {
      handle(JSON.parse(message.data) as DuelEvent);
    } catch (err) {
      console.error('Evento non valido', err);
    }
  };
  // Dopo una caduta (rete, riavvio del server) l'EventSource si ricollega da solo: ricarica per non perdere nulla
  source.onerror = () => (dropped = true);
  source.onopen = () => {
    if (dropped) bump();
    dropped = false;
  };

  // Tornando sulla pagina si ricarica comunque (i telefoni sospendono la connessione in background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bump();
  });

  // Tocco su una notifica mostrata dal service worker
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<{ type?: string; duelId?: string }>) => {
    if (event.data?.type === 'open-duel' && event.data.duelId) openDuel(event.data.duelId);
  });
}

export function dismissNotice(): void {
  live.notice = null;
}

/** Chiede il permesso per le notifiche del browser (va chiamato da un tocco dell'utente). */
export async function enableNotifications(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  live.permission = await Notification.requestPermission();
}
