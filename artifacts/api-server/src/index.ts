import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
// Import ESTÁTICO: import() dinâmico quebrava o bundle do esbuild (a API
// morria ao subir com "Class2 is not a constructor").
import { autoReleaseDueEvents } from "./lib/evaluation-release.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Liberação automática da avaliação no dia seguinte ao evento (ver
// lib/evaluation-release.ts): ao subir e a cada 30 min. A tela do avaliador
// também libera na hora em que abre — isto só tira os eventos do "Aguardando
// RH" nas telas de gestão sem esperar alguém abrir a avaliação.
const releaseTick = () => {
  autoReleaseDueEvents()
    .then(ids => { if (ids.length) logger.info({ eventIds: ids }, "Avaliação liberada (dia seguinte ao evento)"); })
    .catch(err => logger.error({ err }, "Falha na liberação automática da avaliação"));
};
setTimeout(releaseTick, 15_000).unref();
setInterval(releaseTick, 30 * 60_000).unref();

// Autoscale derruba instâncias com SIGTERM: fecha o servidor e devolve as
// conexões do pool em vez de morrer com transação aberta.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
