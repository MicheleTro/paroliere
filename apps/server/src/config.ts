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
  /** Token con cui questo servizio chiama le API amici del portale (stesso valore di SERVICE_TOKEN_PAROLIERE sul portale). */
  PORTAL_SERVICE_TOKEN: z.string().min(32).optional(),
  /** Solo sviluppo: abilita /api/auth/dev per entrare senza portale. Ignorato in produzione. */
  DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === 'true' && process.env.NODE_ENV !== 'production'),
});

export const config = envSchema.parse(process.env);
export const portalUrl = config.PORTAL_URL.replace(/\/+$/, '');
/**
 * Dove mandare chi non ha una sessione: il portale lo fa entrare e lo riporta qui. Con DEV_LOGIN (solo sviluppo)
 * si entra invece come utente di prova, senza uscire dal sito locale.
 */
export const loginUrl = config.DEV_LOGIN ? '/api/auth/dev?user=dev' : `${portalUrl}/launch/${config.SERVICE_ID}`;
export const isProduction = process.env.NODE_ENV === 'production';
