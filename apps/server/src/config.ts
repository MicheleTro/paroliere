import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Firma del cookie di sessione del gioco (almeno 32 caratteri). */
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Portale whoru: emette i token di accesso (decisione whoru #24) e pubblica la chiave in /.well-known/jwks.json. */
  PORTAL_URL: z.string().url().default('https://slothymic.com'),
  /** Identificatore di questo servizio nel registro del portale: deve coincidere con `aud` del token. */
  SERVICE_ID: z.string().min(1).default('paroliere'),
  /** Solo sviluppo: abilita /api/auth/dev per entrare senza portale. Ignorato in produzione. */
  DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === 'true' && process.env.NODE_ENV !== 'production'),
});

export const config = envSchema.parse(process.env);
export const portalUrl = config.PORTAL_URL.replace(/\/+$/, '');
/** Dove mandare chi non ha una sessione: il portale lo fa entrare e lo riporta qui. */
export const loginUrl = `${portalUrl}/launch/${config.SERVICE_ID}`;
export const isProduction = process.env.NODE_ENV === 'production';
