import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

// Configure Better Auth
export const auth = betterAuth({
  database: new Database("./sqlite.db"),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [process.env.CLIENT_ORIGIN || "http://localhost:19006"],
});
