import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

dotenv.config({ path: "../../apps/web/.env" });

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://dirework:password@localhost:5432/dirework",
  },
});
