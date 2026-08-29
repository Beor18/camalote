# Brand — Camalote

_Status: active_

**Camalote** lleva USDC de Base a Solana en segundos, con login por email, gas
patrocinado y tarifas a la vista. La marca transmite dos cosas: **calma**
(dinero en serio, cero ansiedad) y **movimiento** (el viaje entre dos redes).

## Nombre y voz

- Nombre: **camalote** (siempre en minúscula en el logo; "Camalote" en prosa).
- Idioma: español rioplatense, voseo ("traé", "recibís", "probalo").
- Tono: claro, cercano, cero jerga. Nunca "bridge", "attestation", "mintear"
  de cara al usuario: se dice "viaje", "certificación de Circle", "acreditar".
- Los errores dicen qué pasó y qué hacer; nunca culpan al usuario.
- La transparencia es parte de la voz: cada costo se muestra antes de confirmar.

## Color

Neutrales cálidos + un solo acento índigo. El gradiente de marca se reserva
para momentos clave (hero, éxito, borde de la tarjeta de tarifas).

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | `#FBFAF8` | `#12100E` | fondo de página |
| `--surface` | `#FFFFFF` | `#1B1916` | tarjetas |
| `--foreground` | `#1C1917` | `#F0EEE9` | texto |
| `--muted` | `#F3F1EE` | `#262320` | fondos suaves |
| `--muted-foreground` | `#57534E` | `#A8A29E` | texto secundario |
| `--border` | `#E7E5E4` | `#2E2A26` | bordes 1px |
| `--primary` | `#4F46E5` | `#6D64F0` | CTA, foco, links |
| `--success` | `#15803D` | `#34D399` | éxito, "gratis" |
| `--warning` | `#B45309` | `#FBBF24` | badges demo/testnet |
| `--destructive` | `#DC2626` | `#F87171` | errores |

**Gradiente de marca** (`--brand-gradient`): `#0052FF` (Base) → `#8B5CF6`
(violeta Solana) → `#109D74` / `#14F195` en dark (verde Solana), a 100°.
Cuenta la historia del producto: de la orilla azul a la orilla verde.

## Tipografía

- **Display** (`--font-display`): Space Grotesk — títulos y números héroe.
- **UI/cuerpo** (`--font-sans`): Inter.
- **Números y direcciones** (`--font-mono`): JetBrains Mono, siempre con
  `tabular-nums`. Los montos en USDC llevan 2 decimales y coma decimal (es-AR).

## Iconografía y formas

- Lucide, un solo peso de trazo.
- Radios: tarjetas `rounded-2xl`, botones e inputs `rounded-xl`.
- Separación por bordes 1px, no por sombras (las sombras solo en overlays).
- Isologo: un camalote flotando (hoja verde Solana, flor violeta) sobre el
  agua con el gradiente de marca (azul Base → verde Solana). Fondo oscuro
  `#12100E` en el ícono de app. Fuente: `scripts/generate-icons.mjs` y
  `src/components/logo.tsx`.

## Movimiento

- Micro-feedback 100 ms, entradas 150–400 ms, nunca más de 500 ms.
- `ease-out` para entrar, `ease-in` para salir; nada de `linear` ni
  `transition: all`.
- Todo respeta `prefers-reduced-motion` (las monedas del hero quedan
  estáticas sobre el arco).
