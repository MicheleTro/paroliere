import { and, asc, eq, gt, sql } from 'drizzle-orm';

import type { db } from '../db/client.js';
import * as schema from '../db/schema.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ItemRow = typeof schema.itemDefinitions.$inferSelect;
type LedgerReason = (typeof schema.itemLedgerReasonEnum.enumValues)[number];

/** Aiuto: dieci secondi in più su una griglia. Si guadagna completando un ciclo di serie da 10 giorni. */
export const AIUTO_10S = 'aiuto-10s';

export class NotEnoughItemsError extends Error {
  constructor(itemId: string) {
    super(`Oggetto non disponibile: ${itemId}`);
  }
}

/** Millisecondi in più concessi dall'oggetto, se il suo effetto è di tempo extra. */
export function extraTimeMs(item: Pick<ItemRow, 'effect'>): number {
  return item.effect.type === 'extra_time' ? item.effect.ms : 0;
}

export async function getItemDefinition(tx: Pick<Tx, 'select'>, itemId: string): Promise<ItemRow> {
  const [row] = await tx.select().from(schema.itemDefinitions).where(eq(schema.itemDefinitions.id, itemId));
  if (!row) throw new Error(`Oggetto "${itemId}" non presente nel catalogo`);
  return row;
}

/**
 * Accredita oggetti a un giocatore, rispettando il limite di accumulo, e lo registra nel registro. Restituisce
 * quanti ne ha davvero ricevuti (può essere meno di `quantity`, o zero, se il limite è raggiunto).
 */
export async function grantItem(
  tx: Tx,
  userId: string,
  itemId: string,
  quantity: number,
  reason: LedgerReason,
  options: { playId?: string; note?: string } = {},
): Promise<number> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError(`grantItem: quantità non valida (${quantity})`);
  const item = await getItemDefinition(tx, itemId);

  await tx.insert(schema.userItems).values({ userId, itemId, quantity: 0 }).onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(schema.userItems)
    .where(and(eq(schema.userItems.userId, userId), eq(schema.userItems.itemId, itemId)))
    .for('update');

  const current = row!.quantity;
  const target = item.maxStack === null ? current + quantity : Math.min(item.maxStack, current + quantity);
  const granted = target - current;
  if (granted <= 0) return 0;

  await tx
    .update(schema.userItems)
    .set({ quantity: target })
    .where(and(eq(schema.userItems.userId, userId), eq(schema.userItems.itemId, itemId)));
  await tx.insert(schema.itemLedger).values({ userId, itemId, delta: granted, reason, playId: options.playId, note: options.note });
  return granted;
}

/** Spende un oggetto in modo atomico (non scende mai sotto zero). Lancia `NotEnoughItemsError` se non ce n'è. */
export async function spendItem(
  tx: Tx,
  userId: string,
  itemId: string,
  options: { playId?: string; note?: string } = {},
): Promise<ItemRow> {
  const item = await getItemDefinition(tx, itemId);
  const spent = await tx
    .update(schema.userItems)
    .set({ quantity: sql`${schema.userItems.quantity} - 1` })
    .where(and(eq(schema.userItems.userId, userId), eq(schema.userItems.itemId, itemId), gt(schema.userItems.quantity, 0)))
    .returning({ quantity: schema.userItems.quantity });
  if (spent.length === 0) throw new NotEnoughItemsError(itemId);
  await tx
    .insert(schema.itemLedger)
    .values({ userId, itemId, delta: -1, reason: 'used', playId: options.playId, note: options.note });
  return item;
}

export interface InventoryEntry {
  itemId: string;
  name: string;
  description: string;
  kind: string;
  quantity: number;
}

/** Oggetti posseduti da un giocatore (solo quelli con quantità > 0). */
export async function getInventory(userId: string, reader: Pick<Tx, 'select'>): Promise<InventoryEntry[]> {
  const rows = await reader
    .select({
      itemId: schema.userItems.itemId,
      quantity: schema.userItems.quantity,
      name: schema.itemDefinitions.name,
      description: schema.itemDefinitions.description,
      kind: schema.itemDefinitions.kind,
    })
    .from(schema.userItems)
    .innerJoin(schema.itemDefinitions, eq(schema.itemDefinitions.id, schema.userItems.itemId))
    .where(and(eq(schema.userItems.userId, userId), gt(schema.userItems.quantity, 0)))
    .orderBy(asc(schema.itemDefinitions.name));
  return rows;
}

export async function itemQuantity(userId: string, itemId: string, reader: Pick<Tx, 'select'>): Promise<number> {
  const [row] = await reader
    .select({ quantity: schema.userItems.quantity })
    .from(schema.userItems)
    .where(and(eq(schema.userItems.userId, userId), eq(schema.userItems.itemId, itemId)));
  return row?.quantity ?? 0;
}
