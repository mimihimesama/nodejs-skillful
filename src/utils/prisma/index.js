import { PrismaClient as gameDataClient } from "../../../prisma/game/generated/gameDataClient/index.js";
import { PrismaClient as userDataClient } from "../../../prisma/user/generated/userDataClient/index.js";

export const gamePrisma = new gameDataClient({
  log: ["query", "info", "warn", "error"],
  errorFormat: "pretty",
});

export const userPrisma = new userDataClient({
  log: ["query", "info", "warn", "error"],
  errorFormat: "pretty",
});
