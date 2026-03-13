import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

await migrate(db, { migrationsFolder });
console.log("Migrations applied successfully");
process.exit(0);
