import "server-only";
import { db } from "@/server/db";

export const userRepository = {
  findById(id: string) {
    return db.user.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  },

  create(data: { email: string; name?: string | null; passwordHash: string }) {
    return db.user.create({ data });
  },
};
