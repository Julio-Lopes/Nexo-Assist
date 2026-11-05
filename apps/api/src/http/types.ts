import type { User } from "@nexo/shared";

export interface AppEnv {
  Variables: {
    user: User;
    session: { id: string; startedAt: Date };
  };
}