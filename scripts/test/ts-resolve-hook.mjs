// Hooks de módulo para rodar o TypeScript do projeto direto no `node --test`,
// sem build. O código-fonte segue a convenção do bundler (esbuild/tsc), que o
// ESM do Node não entende sozinho:
//
// resolve:
//   - "./x.js"   → no disco só existe "./x.ts";
//   - "./x"      → sem extensão (resolve para "./x.ts");
//   - "./schema" → import de diretório (resolve para "./schema/index.ts").
//   Só entra em ação quando a resolução padrão falha e o especificador é relativo.
//
// load:
//   A remoção de tipos nativa do Node (strip-only) não aceita parameter
//   properties (`constructor(public x)`) nem imports de tipo sem `type`
//   (`import { ObjectAclPolicy }`), que existem nas rotas. Por isso os .ts do
//   projeto passam pelo mesmo esbuild do build de produção (devDependency do
//   api-server), com a mesma semântica do bundle.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const requireFromApi = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
let esbuildPromise;
function getEsbuild() {
  esbuildPromise ??= import(pathToFileURL(requireFromApi.resolve("esbuild")).href).then(m => m.default ?? m);
  return esbuildPromise;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!isRelative) throw err;
    const candidates = [];
    if (specifier.endsWith(".js")) {
      candidates.push(specifier.slice(0, -3) + ".ts");
    } else if (!/\.[cm]?[jt]s$/.test(specifier) && !specifier.endsWith(".json")) {
      candidates.push(specifier + ".ts", specifier + "/index.ts");
    }
    for (const candidate of candidates) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // tenta o próximo candidato
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".ts") && !url.includes("/node_modules/")) {
    const filename = fileURLToPath(url);
    const esbuild = await getEsbuild();
    const { code } = await esbuild.transform(await readFile(filename, "utf8"), {
      loader: "ts",
      format: "esm",
      target: "node22",
      sourcefile: filename,
      sourcemap: "inline",
    });
    return { format: "module", source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
