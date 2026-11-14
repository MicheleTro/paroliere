import type { Notifications } from './challenges.js';
import type { Me } from './plays.js';
import { DAY_NAMES, type WeekOverview } from './week.js';

// Le notizie non sono salvate: si ricavano dallo stato (la griglia di oggi, gli inviti, le sfide da giocare, le
// richieste di amicizia, gli aiuti). Così non possono diventare incoerenti.

export type NewsAction = { kind: 'day'; day: number } | { kind: 'challenges' } | { kind: 'portal' };

export interface NewsItem {
  key: string;
  mark: string;
  text: string;
  /** Cosa fa il pulsante "Vai"; senza azione la notizia è solo informativa. */
  action?: NewsAction;
  /** Conta nel segnalino del campanello. */
  badge: boolean;
}

export function buildNews(me: Me | undefined, week: WeekOverview | undefined, notifications: Notifications | undefined): NewsItem[] {
  const list: NewsItem[] = [];
  const today = week?.days[week.todayIndex];
  if (week && today && (today.state === 'open' || today.state === 'in_progress')) {
    list.push({
      key: 'day',
      mark: '!',
      text: `Griglia di ${DAY_NAMES[week.todayIndex]!.toLowerCase()}: ${today.preset?.name ?? 'nuova'}`,
      action: { kind: 'day', day: week.todayIndex },
      badge: true,
    });
  }
  const recover = week ? week.days.filter((d) => d.state === 'recover').length : 0;
  if (recover > 0) {
    list.push({ key: 'recover', mark: '!', text: `${recover} ${recover === 1 ? 'griglia da recuperare' : 'griglie da recuperare'}`, badge: false });
  }
  if (me?.duelsUnlocked && notifications) {
    if (notifications.invites > 0) {
      list.push({
        key: 'invites',
        mark: '⚔',
        text: `${notifications.invites} ${notifications.invites === 1 ? 'invito di sfida' : 'inviti di sfida'}`,
        action: { kind: 'challenges' },
        badge: true,
      });
    }
    if (notifications.toPlay > 0) {
      list.push({
        key: 'toplay',
        mark: '⚔',
        text: `${notifications.toPlay} ${notifications.toPlay === 1 ? 'sfida da giocare' : 'sfide da giocare'}`,
        action: { kind: 'challenges' },
        badge: true,
      });
    }
    const requests = notifications.friendRequests ?? 0;
    if (requests > 0) {
      list.push({
        key: 'friends',
        mark: '+',
        text: `${requests} ${requests === 1 ? 'richiesta di amicizia' : 'richieste di amicizia'}`,
        action: { kind: 'portal' },
        badge: true,
      });
    }
  }
  if (me && me.helps > 0) {
    list.push({ key: 'helps', mark: '+', text: `Hai ${me.helps} ${me.helps === 1 ? 'aiuto' : 'aiuti'} da +10 secondi`, badge: false });
  }
  return list;
}
