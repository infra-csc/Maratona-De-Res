// Hook de resolução para `node --test` com TypeScript nativo: o código-fonte
// importa "./x.js" (convenção do bundler/tsc), mas no disco só existe "./x.ts".
// Se o .js relativo não existir, tenta o .ts equivalente.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (isRelative && specifier.endsWith(".js")) {
      return nextResolve(specifier.slice(0, -3) + ".ts", context);
    }
    throw err;
  }
}
