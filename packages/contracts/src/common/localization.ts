import { z } from 'zod';

export const LocalizedTextSchema = z.object({
  en: z.string(),
  ru: z.string(),
}).catchall(z.string());
