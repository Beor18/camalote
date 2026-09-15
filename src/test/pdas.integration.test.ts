import { describe, expect, it } from "vitest";
import { Connection } from "@solana/web3.js";
import { deriveReceiveMessagePdas } from "@/lib/cctp/solanaPdas";
import { ADDRESSES } from "@/lib/config";

/**
 * Verificación contra mainnet: si nuestras derivaciones de PDA son correctas,
 * las cuentas de configuración de CCTP v2 EXISTEN on-chain.
 * Corre solo con RUN_INTEGRATION=1 (necesita red).
 */
const enabled = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!enabled)("PDAs de CCTP v2 en mainnet", () => {
  it("las cuentas de configuración existen on-chain", async () => {
    const connection = new Connection(ADDRESSES.solana.rpcUrl, "confirmed");
    const pdas = deriveReceiveMessagePdas(new Uint8Array(32));

    const staticAccounts = {
      messageTransmitter: pdas.messageTransmitter,
      tokenMessenger: pdas.tokenMessenger,
      tokenMinter: pdas.tokenMinter,
      localToken: pdas.localToken,
      remoteTokenMessenger: pdas.remoteTokenMessenger,
      tokenPair: pdas.tokenPair,
      custodyTokenAccount: pdas.custodyTokenAccount,
    };

    const infos = await connection.getMultipleAccountsInfo(
      Object.values(staticAccounts)
    );
    const missing = Object.keys(staticAccounts).filter(
      (_, i) => infos[i] === null
    );
    expect(missing, `PDAs sin cuenta on-chain: ${missing.join(", ")}`).toEqual(
      []
    );
  }, 30000);
});
