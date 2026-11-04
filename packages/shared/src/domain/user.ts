import { z } from "zod";

export const USER_ROLES = ["employee", "analyst"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const SUPPORT_LEVELS = ["N1", "N2"] as const;
export const supportLevelSchema = z.enum(SUPPORT_LEVELS);
export type SupportLevel = z.infer<typeof supportLevelSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  role: userRoleSchema,
  department: z.string().min(1),
  /** Equipamento principal, usado pelo agent para aplicar artigos (ex.: Windows 10 x 11). */
  device: z.string().nullable(),
  /** Só para analistas. */
  supportLevel: supportLevelSchema.nullable(),
});
export type User = z.infer<typeof userSchema>;