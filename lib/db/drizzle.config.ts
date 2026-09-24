import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Barras normais: o glob do drizzle-kit não aceita caminho com barra invertida (Windows).
const here = (p: string) => path.join(__dirname, p).split(path.sep).join("/");

export default defineConfig({
  schema: here("./src/schema/index.ts"),
  dialect: "postgresql",
  // Histórico versionado de DDL: `pnpm --filter db generate` cria a migração;
  // `pnpm --filter db migrate` aplica em ordem. `push` fica só para dev.
  out: here("./migrations"),
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
