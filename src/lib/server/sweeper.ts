import "server-only";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { ADDRESSES, BASE_RPC_URL, NETWORK } from "@/lib/config";
import {
  computeForwarderAddress,
  FORWARDER_FACTORY,
  forwarderFactoryAbi,
  mintRecipientFor,
} from "@/lib/forwarder";

/**
 * Dispara el envío de una dirección de cobro: llama a forward() en la
 * fábrica con una cuenta nuestra que solo paga el gas (centavos en Base).
 * El contrato decide a dónde va la plata; esta cuenta no puede cambiarlo.
 */

const chain = NETWORK === "mainnet" ? base : baseSepolia;
const publicClient = createPublicClient({ chain, transport: http(BASE_RPC_URL) });

const SWEEPER_KEY = process.env.BASE_SWEEPER_PRIVATE_KEY as Hex | undefined;

export function depositsEnabled(): boolean {
  return FORWARDER_FACTORY !== "";
}

export function sweeperConfigured(): boolean {
  return depositsEnabled() && Boolean(SWEEPER_KEY);
}

export interface DepositState {
  address: Address;
  mintRecipient: Hex;
  balanceUnits: bigint;
  minAmountUnits: bigint;
}

export async function readDeposit(owner: string): Promise<DepositState> {
  if (!FORWARDER_FACTORY) throw new Error("La dirección de cobro no está configurada.");
  const mintRecipient = mintRecipientFor(owner);
  const address = computeForwarderAddress(FORWARDER_FACTORY, mintRecipient);
  const [balanceUnits, minAmountUnits] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.base.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
    publicClient.readContract({
      address: FORWARDER_FACTORY,
      abi: forwarderFactoryAbi,
      functionName: "minAmount",
    }),
  ]);
  return { address, mintRecipient, balanceUnits, minAmountUnits };
}

export type SweepResult =
  | { status: "empty"; balanceUnits: bigint; minAmountUnits: bigint }
  | { status: "swept"; txHash: Hex; amountUnits: bigint };

// Un envío por cuenta a la vez: si dos pestañas lo piden, comparten el resultado.
const inFlight = new Map<string, Promise<SweepResult>>();

export function sweepDeposit(owner: string): Promise<SweepResult> {
  const pending = inFlight.get(owner);
  if (pending) return pending;
  const task = doSweep(owner).finally(() => inFlight.delete(owner));
  inFlight.set(owner, task);
  return task;
}

async function doSweep(owner: string): Promise<SweepResult> {
  if (!FORWARDER_FACTORY || !SWEEPER_KEY) {
    throw new Error("El envío automático no está configurado en este servidor.");
  }
  const state = await readDeposit(owner);
  if (state.balanceUnits < state.minAmountUnits) {
    return {
      status: "empty",
      balanceUnits: state.balanceUnits,
      minAmountUnits: state.minAmountUnits,
    };
  }

  const account = privateKeyToAccount(SWEEPER_KEY);
  const walletClient = createWalletClient({ account, chain, transport: http(BASE_RPC_URL) });
  const { request } = await publicClient.simulateContract({
    account,
    address: FORWARDER_FACTORY,
    abi: forwarderFactoryAbi,
    functionName: "forward",
    args: [state.mintRecipient],
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000,
  });
  if (receipt.status !== "success") {
    throw new Error("La transacción de envío falló en Base.");
  }
  return { status: "swept", txHash, amountUnits: state.balanceUnits };
}
