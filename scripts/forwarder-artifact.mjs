// Toma el código de creación del forwarder compilado por Foundry y guarda su
// keccak256: es lo único que el front necesita para calcular direcciones CREATE2.
import { readFileSync, writeFileSync } from "node:fs";
import { keccak256 } from "viem";

const artifactUrl = new URL(
  "../contracts/out/CamaloteForwarder.sol/CamaloteForwarder.json",
  import.meta.url
);
const artifact = JSON.parse(readFileSync(artifactUrl, "utf8"));
const hash = keccak256(artifact.bytecode.object);
const out = `// Generado por scripts/forwarder-artifact.mjs a partir de contracts/out. No editar a mano.
/** keccak256 del código de creación de CamaloteForwarder (para calcular direcciones CREATE2). */
export const FORWARDER_INIT_CODE_HASH =
  "${hash}" as const;
`;
writeFileSync(new URL("../src/lib/forwarder/generated.ts", import.meta.url), out);
console.log("FORWARDER_INIT_CODE_HASH", hash);
