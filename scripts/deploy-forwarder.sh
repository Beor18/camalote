#!/usr/bin/env bash
# Despliega la fábrica de direcciones de cobro (CamaloteForwarderFactory).
#   DEPLOYER_PRIVATE_KEY=0x… pnpm contracts:deploy:testnet   (o :mainnet)
# Opcionales: FEE_RECIPIENT (default: NEXT_PUBLIC_FEE_RECIPIENT_BASE de .env.local),
#             OWNER (default: la cuenta que despliega), RPC_URL.
set -euo pipefail
NET="${1:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env.local" ]; then
  # solo tomamos la billetera de comisiones; nada más sale de ahí
  ENV_FEE="$(grep -E '^NEXT_PUBLIC_FEE_RECIPIENT_BASE=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '"' || true)"
fi
: "${DEPLOYER_PRIVATE_KEY:?Falta DEPLOYER_PRIVATE_KEY (cuenta con un poco de ETH en Base para el gas)}"
FEE_RECIPIENT="${FEE_RECIPIENT:-${ENV_FEE:-}}"
: "${FEE_RECIPIENT:?Falta FEE_RECIPIENT (o NEXT_PUBLIC_FEE_RECIPIENT_BASE en .env.local)}"

if [ "$NET" = "mainnet" ]; then
  USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  TOKEN_MESSENGER_V2=0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d
  RPC_URL="${RPC_URL:-https://mainnet.base.org}"
else
  USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
  TOKEN_MESSENGER_V2=0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
  RPC_URL="${RPC_URL:-https://sepolia.base.org}"
fi
export PATH="$HOME/.foundry/bin:$PATH"
OWNER="${OWNER:-$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")}"

echo "Red: $NET · dueño: $OWNER · comisiones a: $FEE_RECIPIENT"
cd "$ROOT/contracts"
USDC="$USDC" TOKEN_MESSENGER_V2="$TOKEN_MESSENGER_V2" OWNER="$OWNER" FEE_RECIPIENT="$FEE_RECIPIENT" \
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast -vv
echo
echo "Listo. Poné en .env.local:"
echo "  NEXT_PUBLIC_FORWARDER_FACTORY=<la dirección de CamaloteForwarderFactory de arriba>"
echo "  BASE_SWEEPER_PRIVATE_KEY=<clave de una cuenta con centavos de ETH en Base para disparar envíos>"
