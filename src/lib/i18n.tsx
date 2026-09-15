"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Idiomas de Camalote: castellano rioplatense (default) e inglés.
 * El idioma se detecta del navegador la primera vez y queda guardado
 * en el dispositivo. El toggle vive en los headers.
 *
 * Las secciones `deposit`, `cobros` y `pay` pertenecen a los módulos
 * ocultos (cobrar con links, cruce desde Base) y se conservan tal cual.
 */

export type Lang = "es" | "en";

const es = {
  common: {
    usdc: "USDC",
    max: "MAX",
    free: "Gratis",
    close: "Cerrar",
    demoBadge: "Modo demo",
    demoNote: "Simulación: no se movieron fondos reales.",
  },
  landing: {
    navWhy: "Convenceme",
    navPrice: "Precio",
    navOpenApp: "Abrir la app",
    badgeDemo: "Probalo hoy en modo demo",
    heroLine1: "Cobrás en dólares.",
    heroLine2Pre: "¿Cuánto ",
    heroLine2Highlight: "te quedó",
    heroLine2Post: " el mes pasado?",
    heroSub: "Si lo tenés que pensar, ya sabés. Nadie lo aparta antes de que lo gastes.",
    heroCta: "Quiero que se aparte solo",
    heroSecondary: "¿Cómo?",
    heroShoreLeft: "USDC",
    heroShoreRight: "Acciones",
    heroStory:
      "Cada vez que cobrás en USDC, la parte que elegiste se convierte en acciones. Sola, antes de que la gastes.",
    showdownTitle: "Seamos honestos.",
    showdownSub: "Invertir «cuando sobre» no pasa nunca.",
    oldWayTitle: "Invertir como hasta ahora",
    oldWay: [
      "Broker, papeles, días de espera",
      "Mínimos que no llegás",
      "Acordarte cada mes",
      "Lo que sobra se gasta",
    ],
    newWayTitle: "Con Camalote",
    newWay: [
      "Una regla: «el 20 % de lo que me llega, al S&P 500»",
      "Se compra sola cuando te pagan",
      "0,45 % por compra, tope medio dólar, a la vista",
      "Las acciones son tuyas. Vender es gratis",
    ],
    letter: [
      "Nota de tus dólares:",
      "llegamos 100, veinte fuimos",
      "al S&P 500 antes de que nos",
      "gastes. Vos lo elegiste. 💜",
    ],
    whyTitle: "¿Y por qué en Solana?",
    whySub: "Lo que hay, hoy.",
    whyItems: [
      {
        claim: "Acá viven las acciones tokenizadas",
        body: "Más de 60 acciones y ETFs de Estados Unidos ya son tokens en Solana: el 93 % de todo lo tokenizado vive acá. Comprás una fracción desde 2 dólares.",
      },
      {
        claim: "Mover plata cuesta una fracción de centavo",
        body: "Por eso una compra de 10 dólares tiene sentido y vender no cuesta nada.",
      },
      {
        claim: "Hay laburo que paga en dólares acá",
        body: "Bounties y changas pagadas en USDC. Te pagan en Solana y la parte que elegiste se invierte ahí mismo.",
      },
      {
        claim: "Argentina juega de local",
        body: "Una de las comunidades más activas del mundo está acá. La puerta se abre desde adentro.",
      },
    ],
    whyLink: "Golpeá: Superteam Argentina",
    stepsTitle: "Armar tu regla lleva un minuto",
    steps: [
      {
        title: "Entrá con tu email",
        body: "Tu cuenta en Solana se crea sola. Sin instalar nada.",
      },
      {
        title: "Elegí cuánto y en qué",
        body: "Un porcentaje y una acción. Lo cambiás cuando quieras.",
      },
      {
        title: "Cobrá como siempre",
        body: "Cada vez que te llegan USDC, esa parte se junta y se compra sola al llegar a 10 dólares.",
      },
    ],
    stepsNote: "¿Todavía no te pagan en Solana?",
    stepsLink: "Mandá USDC a tu cuenta y comprá a mano",
    installCta: "Instalala en tu teléfono",
    installIosHint:
      "En iPhone: tocá el botón Compartir y elegí «Agregar a inicio».",
    factsTitle: "Lo que hay, en números.",
    facts: [
      { label: "Compra mínima", value: "$2" },
      { label: "Comisión por compra", value: "0,45 %" },
      { label: "Tope de comisión", value: "$0,50" },
      { label: "Vender", value: "Gratis" },
    ],
    pricingTitle: "Probá con tu número",
    pricingSub: "La misma cuenta que hace la app.",
    calcIfYouInvest: "Si invertís",
    calcYouBuy: "van al mercado",
    calcMinHint: "desde 2 USDC por compra",
    calcEmptyHint: "escribí un número y mirá",
    calcFeeLine: (fee: string, pct: string) =>
      `${fee} USDC de comisión (${pct} %, tope medio dólar).`,
    calcFootnote:
      "Aparte va Jupiter, 0,10 %, y la red, que pagás vos: menos de un centavo por operación, desde una reserva de 1 dólar que queda en tu cuenta. Lo ves antes de confirmar.",
    trustTitle: "Pensado para que duermas tranquilo",
    trust: [
      {
        title: "Tu cuenta es tuya",
        body: "Las acciones quedan en tu cuenta de Solana. Nosotros no podemos moverlas.",
      },
      {
        title: "Sin letra chica",
        body: "La comisión la ves antes de cada compra. No hay rendimiento prometido.",
      },
      {
        title: "Lo apagás cuando quieras",
        body: "Un toque y la regla se apaga. Vendés y retirás gratis.",
      },
    ],
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Qué compro exactamente?",
        a: "Acciones tokenizadas de xStocks, emitidas por Backed, una empresa suiza regulada. Siguen el precio de la acción real y los dividendos se reinvierten solos. No son la acción: no votás, y Backed puede congelarlas si la ley lo exige.",
      },
      {
        q: "¿Puede bajar?",
        a: "Sí. Sube y baja como en cualquier lado. Camalote no promete rendimiento ni recomienda activos.",
      },
      {
        q: "¿Cuánto cuesta?",
        a: "0,45 % por compra, nunca más de medio dólar, a la vista antes de confirmar. Vender es gratis. Aparte, Jupiter cobra 0,10 % y la red la pagás vos: menos de un centavo por operación, desde una reserva de 1 dólar que se carga sola y queda en tu cuenta. La primera compra de cada acción abre su cuenta: unos 25 centavos, de esa reserva.",
      },
      {
        q: "¿Y si no me pagan en Solana?",
        a: "Mandá USDC a tu cuenta desde cualquier billetera o exchange y comprá a mano. Para que la regla trabaje, pasale esta cuenta a quien te paga.",
      },
      {
        q: "¿Cuándo se compra?",
        a: "En segundos, mientras la app está abierta. Si te llegan USDC con la app cerrada, se compra cuando la abrís. Los cobros chicos se juntan hasta 10 dólares.",
      },
      {
        q: "¿Es legal desde Argentina?",
        a: "xStocks no está disponible en Estados Unidos, Reino Unido, Canadá y Australia. En Argentina, Backed no lo restringe. Camalote no custodia: vos firmás cada compra. Para impuestos, tu contador.",
      },
    ],
    finalTitle1: "Que la próxima vez que cobres,",
    finalTitle2: "una parte ya esté invertida.",
    finalSub: "Armá tu regla una vez. Después, cobrá como siempre.",
    finalCta: "Armar mi regla",
    footerMadeIn: "Hecho en Argentina 🇦🇷",
    footerNote:
      "xStocks las emite Backed y no están disponibles para residentes de Estados Unidos, Reino Unido, Canadá y Australia. Camalote no da consejos de inversión.",
  },
  app: {
    loginTitle: "Entrá con tu email",
    loginSub:
      "Sin extensiones, sin frases secretas. Tu cuenta se crea sola y es solo tuya.",
    emailLabel: "Tu email",
    emailPlaceholder: "vos@ejemplo.com",
    continue: "Continuar",
    demoLoginNote:
      "Estás en el modo demo: todo se simula y no se mueven fondos reales.",
    loginButton: "Entrar con email",
    loginHint: "Te llega un código de 6 dígitos. Nada más.",
    custodyNote:
      "Tu billetera es tuya: nosotros nunca podemos mover tus fondos.",
    logout: "Cerrar sesión",
    footer:
      "Tus USDC y tus acciones quedan en tu cuenta de Solana. Nosotros no podemos moverlos.",
    baseCard: "En Base",
    baseCardSub: "de acá salen",
    solanaCard: "En Solana",
    solanaCardSub: "acá llegan",
    addressPending: "Preparando tu dirección…",
    copyAddress: (card: string) => `Copiar dirección de ${card}`,
    deposit: "Depositar",
    withdraw: "Retirar",
    amountLabel: "¿Cuánto querés llevar a Solana?",
    amountPlaceholder: "25",
    amountHint: "Mínimo 0,50 USDC. Podés usar coma o punto para los decimales.",
    amountInvalid: "Escribí un monto válido, por ejemplo 25 o 12,50.",
    amountMin: "El mínimo para transferir es 0,50 USDC.",
    amountInsufficient: (balance: string) =>
      `No te alcanza: tenés ${balance} USDC en Base.`,
    quoteError: "No pudimos calcular la cotización. Probá de nuevo.",
    rowSend: "Enviás desde Base",
    rowFee: (pct: string) => `Comisión de Camalote (${pct} %)`,
    rowFeeNoPct: "Comisión de Camalote",
    rowExpress: "Envío exprés",
    rowNetwork: "Costo de red",
    rowNetworkValue: "$0, lo cubrimos",
    rowReceive: "Recibís en Solana",
    submit: "Llevar a Solana",
    retry: "Probar de nuevo",
    submitHint: "Confirmás una sola vez. El costo de red lo cubrimos nosotros.",
    errorTitle: "La transferencia no se completó",
    errorAfterBurn:
      " Si tus USDC ya salieron de Base, la entrega se completa sola: reintentá en un rato desde el historial.",
    genericRunError: "Algo salió mal. Tus fondos no se movieron.",
    stepSending: "Saliendo de Base",
    stepSendingDetail:
      "Tus USDC se están despachando. No cierres esta pantalla todavía.",
    stepAttesting: "Verificando el viaje",
    stepAttestingDetail:
      "La transferencia se está verificando oficialmente. Suele tardar menos de un minuto.",
    stepMinting: "Llegando a Solana",
    stepMintingDetail:
      "Estamos acreditando los USDC en tu cuenta de Solana.",
    slowNote:
      "A veces la red tarda unos minutos más de lo normal. Tus USDC están seguros y la entrega se completa sola. Podés dejar esta pantalla abierta o volver más tarde.",
    viewBaseTx: "Ver la transacción de salida",
    doneTitle: "¡Llegaron!",
    doneBody: (amount: string) =>
      `${amount} USDC ya están en tu cuenta de Solana.`,
    doneBodyNoAmount: "Tus USDC ya están en tu cuenta de Solana.",
    doneViewBase: "Ver salida en Base",
    doneViewSolana: "Ver llegada en Solana",
    doneAgain: "Hacer otra transferencia",
    historyTitle: "Últimas transferencias",
    historySim: " · simulación",
    historyDone: "Completada",
    historyError: "No completada",
    historyPending: "En camino",
    historyRetry: "Reintentar",
    historyRetrying: "Entregando…",
    historyNotSent: "No salió: tu plata no se movió",
    historyWithdrawTo: (addr: string) => `Retiro a ${addr}`,
    historyPaymentTo: (who: string) => `Pago a ${who}`,
    tabBridge: "Llevar a Solana",
    tabBridgeShort: "Cruzar",
    tabCobros: "Cobrar",
    tabInvest: "Invertir",
  },
  deposit: {
    title: "Depositá USDC en Base",
    sub: "Mandá tus USDC a esta dirección desde Coinbase o cualquier billetera.",
    qrAlt: "Código QR de tu dirección",
    pending:
      "Tu dirección se está preparando. Volvé a abrir esto en unos segundos.",
    warnNetworkPre: "· Red: ",
    warnNetworkMid: ". Moneda: ",
    warnNetworkPost: ". Nada más.",
    warnLoss: "· Si mandás otra moneda u otra red, esos fondos se pierden.",
    warnAuto: "· Apenas llegue, el saldo aparece solo en esta pantalla.",
    warnDemo: "· Modo demo: esta dirección es de muestra.",
    copyLabel: "Copiar dirección de Base",
  },
  cobros: {
    title: "Cobrá en dólares",
    sub: "Creá un link, mandalo por WhatsApp y te pagan desde Coinbase o Base. Los USDC llegan a tu cuenta de Solana.",
    solanaBalance: "Tu cuenta de Solana",
    amountLabel: "¿Cuánto cobrás?",
    amountPlaceholder: "40",
    amountHint: "Dejalo vacío y el que paga elige el monto. Mínimo 0,50 USDC.",
    amountInvalid: "Escribí un monto válido, por ejemplo 40 o 12,50.",
    amountMin: "El mínimo para cobrar es 0,50 USDC.",
    conceptLabel: "¿Por qué? (opcional)",
    conceptPlaceholder: "Diseño de logo",
    nameLabel: "Tu nombre",
    namePlaceholder: "Fer",
    nameHint: "Así te ve el que paga.",
    exactNote:
      "El que paga manda el número que pediste. La comisión (0,45 %, tope medio dólar) se descuenta de lo que te llega.",
    create: "Crear link de cobro",
    linkReady: "Tu link está listo",
    linkReadySub: "Compartilo por donde quieras. Cuando te paguen, lo vas a ver acá mismo.",
    qrAlt: "Código QR del link de cobro",
    copyLink: "Copiar link",
    share: "Compartir",
    shareWhatsapp: "Mandar por WhatsApp",
    shareText: (amount: string | null, concept: string, url: string) =>
      `Te paso mi link de Camalote para pagarme${amount ? ` ${amount} USDC` : ""}${concept ? ` (${concept})` : ""}: ${url}`,
    newLink: "Crear otro",
    listTitle: "Tus links de cobro",
    emptyList: "Todavía no creaste ningún link.",
    openAmount: "Monto abierto",
    statusPending: "Esperando pago",
    statusPaid: "Pagado",
    paidAmount: (amount: string) => `Llegaron ${amount} USDC`,
    viewPayment: "Ver en Solana",
    depositTitle: "Tu dirección de cobro en Base",
    depositBody:
      "Es tu billetera de Base. Cualquiera te manda USDC acá desde Coinbase o su billetera, sin registrarse. Todo lo que llega viaja solo a tu cuenta de Solana cuando abrís Camalote.",
    depositFee: (pct: string) =>
      `En el viaje se descuenta la comisión: ${pct} %, nunca más de medio dólar.`,
    depositOnly: "Solo USDC, solo por la red Base.",
    depositQr: "Ver QR",
    depositQrHide: "Ocultar QR",
    depositQrAlt: "Código QR de tu dirección de cobro en Base",
    depositIncoming: (amount: string) =>
      `Llegaron ${amount} USDC a tu dirección de cobro. Llevándolos a tu cuenta de Solana…`,
    depositDone: (amount: string) => `Entregados ${amount} USDC en tu cuenta de Solana.`,
    depositError:
      "No pudimos completar el viaje a Solana. Los USDC siguen en tu billetera de Base: reintentamos solos.",
    copyAddress: "Copiar dirección",
    ruleActive: (pct: string, asset: string) =>
      `Regla activa: el ${pct} % de cada cobro va a ${asset}.`,
    ruleOff: "¿Querés que una parte de cada cobro se invierta sola?",
    ruleLinkOn: "Ver cartera",
    ruleLinkOff: "Armá tu regla",
  },
  pay: {
    requestFrom: (name: string) => `${name} te pide`,
    requestAnon: "Te piden",
    chooseAmount: "Vos elegís cuánto",
    receivesOn: "Recibe USDC nativos en Solana",
    invalidTitle: "Este link no sirve para pagar",
    invalidBody:
      "Le falta el destino o el monto está mal. Pedile a quien te lo mandó que lo genere de nuevo.",
    loginTitle: "Pagá con tu email",
    loginSub: "Sin billeteras ni frases secretas. Tu cuenta se crea sola y es solo tuya.",
    loginButton: "Pagar con mi email",
    balanceLabel: "Tu saldo en Base",
    amountLabel: "¿Cuánto le mandás?",
    amountPlaceholder: "25",
    amountHint: "Mínimo 0,50 USDC. Podés usar coma o punto para los decimales.",
    youPay: "Pagás desde Base",
    fee: (pct: string) => `Comisión (${pct} %)`,
    express: "Envío exprés",
    network: "Costo de red",
    networkValue: "$0, lo cubrimos",
    theyReceive: (name: string) => `${name} recibe`,
    insufficient: (missing: string) => `Te faltan ${missing} USDC en Base.`,
    insufficientHint:
      "Mandá USDC a tu dirección de Base desde Coinbase o cualquier billetera. Apenas lleguen, el botón se activa solo.",
    topUp: "Cargar USDC en Base",
    submit: (amount: string) => `Pagar ${amount} USDC`,
    submitHint: "Confirmás una sola vez. El costo de red lo cubrimos nosotros.",
    doneTitle: "¡Pagado!",
    doneBody: (amount: string, name: string) =>
      `${name} ya tiene ${amount} USDC en su cuenta de Solana.`,
    again: "Hacer otro pago",
    viralTitle: "¿Vos también cobrás en dólares?",
    viralBody:
      "Creá tu link en un minuto. Te pagan desde Coinbase o Base sin registrarse, y te llega a Solana.",
    viralCta: "Crear mi link de cobro",
    orDivider: "o",
    directTitle: "Sin registrarte",
    directSub: (name: string) =>
      `Mandá los USDC desde Coinbase o cualquier billetera a la cuenta de Base de ${name}. Cuando abra Camalote, pasan solos a su cuenta de Solana.`,
    directSend: (amount: string) => `Mandá ${amount} USDC`,
    directSendOpen: "Mandá lo que quieras, desde 0,50 USDC",
    directOnly: "Solo USDC, solo por la red Base. Otra moneda u otra red se pierde.",
    directWaiting: "Esperando que lleguen…",
    directWaitingNote: (name: string) =>
      `Si cerrás esta página no pasa nada: los USDC ya quedan en la cuenta de ${name}.`,
    directDoneBody: (amount: string, name: string) =>
      `Los ${amount} USDC ya están en la cuenta de ${name}. Los va a ver en Solana cuando abra Camalote.`,
    directSimulate: "Simular el envío desde Coinbase",
    directQrAlt: "Código QR de la cuenta de Base",
    copyAddress: "Copiar dirección",
    footer:
      "Los USDC viajan por el camino oficial de sus emisores, directo a la cuenta de quien cobra.",
  },
  withdrawModal: {
    title: "Retirar en Solana",
    sub: "Mandá tus USDC a cualquier dirección de Solana.",
    destLabel: "¿A qué dirección?",
    destInvalid: "Esa dirección de Solana no parece válida.",
    destOwn: "Esa ya es tu propia cuenta.",
    amountLabel: "¿Cuánto?",
    amountInvalid: "Escribí un monto válido, por ejemplo 10 o 5,50.",
    amountMin: "El retiro mínimo es 0,10 USDC.",
    amountInsufficient: (balance: string) =>
      `No te alcanza: tenés ${balance} USDC.`,
    amountInsufficientFuel: (available: string, fuel: string) =>
      `Podés retirar hasta ${available} USDC: ${fuel} quedan para la reserva de red.`,
    hint: "Mínimo 0,10 USDC. La red se paga desde tu reserva de SOL: menos de un centavo.",
    hintFuel: (fuel: string) =>
      `Mínimo 0,10 USDC. Primero se cargan ${fuel} USDC de reserva de red, que quedan en tu cuenta como SOL.`,
    submit: "Retirar",
    submitting: "Enviando",
    stepFuel: "Cargando la reserva de red",
    doneTitle: "Retiro enviado",
    doneBody: (amount: string) => `${amount} USDC van en camino.`,
    doneBodyNoAmount: "Tus USDC van en camino.",
    viewOnSolana: "Ver en Solana",
    done: "Listo",
    genericError: "No pudimos completar el retiro. Probá de nuevo.",
  },
  invest: {
    title: "Invertí una parte de cada cobro",
    sub: "Elegís un porcentaje y una acción. Cada vez que te llegan USDC a tu cuenta, esa parte se compra sola. Desde 2 dólares, sin broker.",
    accountTitle: "Tu cuenta de Solana",
    accountSub: "Acá te llegan los USDC y acá quedan las acciones.",
    deposit: "Depositar",
    withdraw: "Retirar",
    copyAddress: "Copiar dirección",
    simulateIncoming: "Simular que te llegan 40 USDC",
    depositTitle: "Depositá USDC en Solana",
    depositSub:
      "Mandá USDC a esta cuenta desde cualquier billetera o exchange. O pasásela a quien te paga.",
    depositQrAlt: "Código QR de tu cuenta de Solana",
    depositPending: "Tu cuenta se está preparando. Volvé a abrir esto en unos segundos.",
    depositNetworkPre: "· Red: ",
    depositNetworkMid: ". Moneda: ",
    depositNetworkPost: ". Nada más.",
    depositLoss: "· Si mandás otra moneda u otra red, esos fondos se pierden.",
    depositRule: "· Lo que llega cuenta para tu regla.",
    depositDemo: "· Modo demo: esta cuenta es de muestra.",
    heroLeft: "En tu cuenta",
    heroRight: "En acciones",
    heroRightEmpty: "Todavía nada cruzó.",
    heroRightSub: (put: string) => `Pusiste ${put} ·`,
    ruleOffChip: "Regla apagada",
    ruleChange: "Cambiar",
    ruleDone: "Listo",
    crossing: "Cruzando: comprando ahora…",
    buyOpen: "Comprar",
    ruleTitle: "Tu regla",
    ruleOff: "Regla apagada. Prendela y elegí qué parte y en qué.",
    toggleLabel: "Invertir una parte de cada cobro",
    percentLabel: "¿Qué parte de lo que te llega?",
    assetLabel: "¿En qué?",
    ruleSummary: (pct: string, asset: string) =>
      `De cada cobro, el ${pct} % va a ${asset}.`,
    ruleMin: (min: string) => `Cuando esa parte junta ${min} USDC, se compra sola.`,
    ruleOpenNote:
      "La regla corre mientras Camalote está abierta. Si te llegan USDC con la app cerrada, se compra cuando la abrís.",
    pendingLabel: (pending: string, min: string) =>
      `Juntando: ${pending} de ${min} USDC`,
    paused: (msg: string) =>
      `La última compra no salió (${msg}). Lo apartado sigue guardado y reintentamos en un rato.`,
    portfolioTitle: "Tus acciones",
    valueLabel: "Vale hoy",
    investedLabel: "Pusiste",
    returnLabel: "Rendimiento",
    emptyPortfolio:
      "Todavía no tenés acciones. Se compran solas con tus próximos USDC, o comprá ahora.",
    pricesLive:
      "Precios de mercado de Jupiter. El rendimiento se calcula sobre lo comprado y vendido desde Camalote.",
    pricesFallback:
      "Precios de referencia: no pudimos consultar el mercado. El rendimiento se calcula sobre lo comprado y vendido desde Camalote.",
    priceEach: "c/u",
    dividendsLine: (usdc: string, tokens: string, asset: string) =>
      `Dividendos reinvertidos: +${usdc} USDC (${tokens} ${asset})`,
    sell: "Vender",
    buyTitle: "Comprar ahora",
    buySub: "Con los USDC de tu cuenta. Ves el precio y la comisión antes de confirmar.",
    buyAmountLabel: "¿Cuánto?",
    buyAmountHint: (min: string) => `Mínimo ${min} USDC por compra.`,
    buyAmountHintFuel: (min: string, fuel: string) =>
      `Mínimo ${min} USDC por compra. Esta vez se suma ${fuel} USDC de reserva de red, que queda en tu cuenta como SOL.`,
    buyAmountInvalid: "Escribí un monto válido, por ejemplo 10 o 25,50.",
    buyAmountMin: (min: string) => `El mínimo por compra es ${min} USDC.`,
    buyInsufficient: (balance: string) =>
      `No te alcanza: tenés ${balance} USDC en tu cuenta.`,
    buyInsufficientFuel: (balance: string, fuel: string) =>
      `No te alcanza: tenés ${balance} USDC y la reserva de red lleva ${fuel}.`,
    buyQuote: (asset: string) => `Ver precio de ${asset}`,
    quoteLoading: "Buscando el mejor precio…",
    rowSpend: "Invertís",
    rowCamaloteFee: (pct: string) => `Comisión Camalote (${pct} %)`,
    rowJupiter: (pct: string) => `Jupiter y red (${pct} %)`,
    rowIncluded: "en el precio",
    rowFeeShort: (fee: string) => `comisión ${fee}`,
    rowFuel: "Reserva de red (una vez)",
    fuelNote:
      "Queda en tu cuenta como SOL y con eso pagás la red de todas tus operaciones. Se recarga sola cuando se gasta.",
    rowReceive: "Recibís",
    quoteValid: "El precio vale un minuto.",
    quoteNotGasless: "La red se paga desde tu reserva de SOL: menos de un centavo.",
    confirmBuy: "Confirmar compra",
    changeAmount: "Cambiar",
    stepFuel: "Cargando la reserva de red",
    stepSigning: "Firmando con tu cuenta",
    stepSending: "Comprando en Solana",
    stepSellSending: "Vendiendo en Solana",
    stepFee: "Cobrando la comisión",
    doneTitle: "¡Compraste!",
    doneBody: (tokens: string, asset: string, usdc: string) =>
      `${tokens} ${asset} por ${usdc} USDC ya están en tu cuenta de Solana.`,
    camaloteFeeLine: (fee: string) => `Comisión de Camalote: ${fee} USDC.`,
    camaloteFeeSkipped: "Comisión de Camalote: esta vez no se pudo cobrar.",
    feeLine: (pct: string) => `Jupiter y red: ${pct} %, ya en el precio.`,
    fuelDoneLine: (fuel: string) =>
      `Reserva de red: ${fuel} USDC quedaron en tu cuenta como SOL.`,
    viewOnSolana: "Ver en Solana",
    buyAgain: "Comprar otra vez",
    genericError: "No pudimos completar la compra. Tus USDC no se movieron.",
    sellTitle: (asset: string) => `Vender ${asset}`,
    sellSub: "Los USDC vuelven a tu cuenta. Camalote no cobra por vender.",
    sellAmountLabel: "¿Cuánto?",
    sellAll: "Todo",
    sellHave: (amount: string, asset: string) => `Tenés ${amount} ${asset}.`,
    sellAmountInvalid: "Escribí una cantidad válida, por ejemplo 0,01.",
    sellTooMuch: "No tenés esa cantidad.",
    sellQuote: "Ver precio",
    sellRowSell: "Vendés",
    sellRowReceive: "Recibís",
    sellConfirm: "Vender",
    sellDoneTitle: "¡Vendido!",
    sellDoneBody: (usdc: string, tokens: string, asset: string) =>
      `${usdc} USDC ya están en tu cuenta por ${tokens} ${asset}.`,
    sellError: "No pudimos completar la venta. Tus acciones no se movieron.",
    done: "Listo",
    purchasesTitle: "Tus operaciones",
    purchaseBuying: "En curso…",
    purchaseDone: "Hecha",
    purchaseError: "No se completó",
    sourceRule: "por tu regla",
    sourceManual: "a mano",
    kindSell: "venta de",
    sim: " · simulación",
    disclosureTitle: "Lo que tenés que saber",
    disclosure: [
      "Son acciones tokenizadas de xStocks, emitidas por Backed. Siguen el precio de la acción, pero no son la acción ni dan derecho a voto. Suben y bajan: no hay rendimiento prometido.",
      "Los dividendos se reinvierten solos: cuando la acción paga, tu cantidad crece un poco. Lo ves en tu cartera.",
      "Backed puede congelarlas o retirarlas si la ley se lo exige. Esa parte no es solo tuya, como sí lo son tus USDC.",
      "No disponibles para residentes de Estados Unidos, Reino Unido, Canadá y Australia.",
      "Camalote cobra 0,45 % por compra, nunca más de medio dólar, y nada por vender. No recomienda activos: la regla la armás vos y la apagás cuando quieras.",
    ],
  },
};

export type Dictionary = typeof es;

const en: Dictionary = {
  common: {
    usdc: "USDC",
    max: "MAX",
    free: "Free",
    close: "Close",
    demoBadge: "Demo mode",
    demoNote: "Simulation: no real funds were moved.",
  },
  landing: {
    navWhy: "Convince me",
    navPrice: "Pricing",
    navOpenApp: "Open the app",
    badgeDemo: "Try it today in demo mode",
    heroLine1: "You get paid in dollars.",
    heroLine2Pre: "How much did you ",
    heroLine2Highlight: "keep",
    heroLine2Post: " last month?",
    heroSub: "If you have to think about it, you already know. Nobody sets it aside before you spend it.",
    heroCta: "I want it set aside for me",
    heroSecondary: "How?",
    heroShoreLeft: "USDC",
    heroShoreRight: "Stocks",
    heroStory:
      "Every time you get paid in USDC, the share you chose turns into stocks. On its own, before you spend it.",
    showdownTitle: "Let's be honest.",
    showdownSub: "Investing «whatever is left» never happens.",
    oldWayTitle: "Investing the usual way",
    oldWay: [
      "A broker, paperwork, days of waiting",
      "Minimums you never reach",
      "Remembering every month",
      "What's left gets spent",
    ],
    newWayTitle: "With Camalote",
    newWay: [
      "One rule: «20% of what comes in, to the S&P 500»",
      "It buys itself when you get paid",
      "0.45% per purchase, capped at half a dollar, in plain sight",
      "The stocks are yours. Selling is free",
    ],
    letter: [
      "A note from your dollars:",
      "100 of us arrived, twenty went",
      "to the S&P 500 before you",
      "spent us. You chose it. 💜",
    ],
    whyTitle: "And why on Solana?",
    whySub: "What's there, today.",
    whyItems: [
      {
        claim: "This is where tokenized stocks live",
        body: "More than 60 US stocks and ETFs already exist on Solana as tokens: 93% of everything tokenized lives here. You buy a fraction from 2 dollars.",
      },
      {
        claim: "Moving money costs a fraction of a cent",
        body: "That's why a 10-dollar purchase makes sense and selling costs nothing.",
      },
      {
        claim: "There's work that pays in dollars here",
        body: "Bounties and gigs paid in USDC. You get paid on Solana and the share you chose is invested right there.",
      },
      {
        claim: "Argentina plays at home",
        body: "One of the most active communities in the world is here. The door opens from the inside.",
      },
    ],
    whyLink: "Knock: Superteam Argentina",
    stepsTitle: "Setting your rule takes a minute",
    steps: [
      {
        title: "Sign in with your email",
        body: "Your Solana account creates itself. Nothing to install.",
      },
      {
        title: "Pick how much and what",
        body: "A percentage and a stock. Change it whenever you like.",
      },
      {
        title: "Get paid as usual",
        body: "Every time USDC land, that part adds up and buys itself once it reaches 10 dollars.",
      },
    ],
    stepsNote: "Not getting paid on Solana yet?",
    stepsLink: "Send USDC to your account and buy by hand",
    installCta: "Install it on your phone",
    installIosHint:
      "On iPhone: tap the Share button and choose «Add to Home Screen».",
    factsTitle: "What's there, in numbers.",
    facts: [
      { label: "Minimum purchase", value: "$2" },
      { label: "Fee per purchase", value: "0.45%" },
      { label: "Fee cap", value: "$0.50" },
      { label: "Selling", value: "Free" },
    ],
    pricingTitle: "Try your own number",
    pricingSub: "The same math the app runs.",
    calcIfYouInvest: "If you invest",
    calcYouBuy: "goes to market",
    calcMinHint: "from 2 USDC per purchase",
    calcEmptyHint: "type a number and see",
    calcFeeLine: (fee: string, pct: string) =>
      `${fee} USDC is our fee (${pct}%, capped at half a dollar).`,
    calcFootnote:
      "On top comes Jupiter, 0.10%, and the network, which you pay: under a cent per operation, from a 1-dollar reserve that stays in your account. You see it before confirming.",
    trustTitle: "Built so you can sleep at night",
    trust: [
      {
        title: "Your account is yours",
        body: "The stocks stay in your Solana account. We can't move them.",
      },
      {
        title: "No fine print",
        body: "You see the fee before every purchase. No promised return.",
      },
      {
        title: "Switch it off whenever you like",
        body: "One tap and the rule is off. Sell and withdraw for free.",
      },
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "What exactly am I buying?",
        a: "Tokenized stocks by xStocks, issued by Backed, a regulated Swiss company. They track the real stock's price and dividends reinvest on their own. They aren't the stock: you don't vote, and Backed can freeze them if the law requires it.",
      },
      {
        q: "Can it go down?",
        a: "Yes. It goes up and down like anywhere else. Camalote doesn't promise returns or recommend assets.",
      },
      {
        q: "How much does it cost?",
        a: "0.45% per purchase, never more than half a dollar, shown before you confirm. Selling is free. On top, Jupiter charges 0.10% and you pay the network: under a cent per operation, from a 1-dollar reserve that loads on its own and stays in your account. The first purchase of each stock opens its account: about 25 cents, from that reserve.",
      },
      {
        q: "What if I don't get paid on Solana?",
        a: "Send USDC to your account from any wallet or exchange and buy by hand. For the rule to work, give this account to whoever pays you.",
      },
      {
        q: "When does it buy?",
        a: "In seconds, while the app is open. If USDC land while it's closed, it buys when you open it. Small payments add up to 10 dollars.",
      },
      {
        q: "Is it legal from Argentina?",
        a: "xStocks aren't available in the United States, United Kingdom, Canada and Australia. In Argentina, Backed doesn't restrict them. Camalote doesn't hold your funds: you sign every purchase. For taxes, ask your accountant.",
      },
    ],
    finalTitle1: "Next time you get paid,",
    finalTitle2: "let part of it already be invested.",
    finalSub: "Set your rule once. Then get paid as usual.",
    finalCta: "Set my rule",
    footerMadeIn: "Made in Argentina 🇦🇷",
    footerNote:
      "xStocks are issued by Backed and aren't available to residents of the United States, United Kingdom, Canada and Australia. Camalote doesn't give investment advice.",
  },
  app: {
    loginTitle: "Sign in with your email",
    loginSub:
      "No extensions, no secret phrases. Your account creates itself and it's yours alone.",
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    continue: "Continue",
    demoLoginNote:
      "You're in demo mode: everything is simulated and no real funds move.",
    loginButton: "Sign in with email",
    loginHint: "You get a 6-digit code. That's it.",
    custodyNote: "Your wallet is yours: we can never move your funds.",
    logout: "Sign out",
    footer:
      "Your USDC and your stocks stay in your Solana account. We can never move them.",
    baseCard: "On Base",
    baseCardSub: "they leave from here",
    solanaCard: "On Solana",
    solanaCardSub: "they arrive here",
    addressPending: "Preparing your address…",
    copyAddress: (card: string) => `Copy ${card} address`,
    deposit: "Deposit",
    withdraw: "Withdraw",
    amountLabel: "How much do you want to take to Solana?",
    amountPlaceholder: "25",
    amountHint: "Minimum 0.50 USDC. You can use a comma or a dot for decimals.",
    amountInvalid: "Enter a valid amount, for example 25 or 12.50.",
    amountMin: "The minimum transfer is 0.50 USDC.",
    amountInsufficient: (balance: string) =>
      `Not enough: you have ${balance} USDC on Base.`,
    quoteError: "We couldn't calculate the quote. Try again.",
    rowSend: "You send from Base",
    rowFee: (pct: string) => `Camalote fee (${pct}%)`,
    rowFeeNoPct: "Camalote fee",
    rowExpress: "Express delivery",
    rowNetwork: "Network cost",
    rowNetworkValue: "$0, on us",
    rowReceive: "You receive on Solana",
    submit: "Take to Solana",
    retry: "Try again",
    submitHint: "You confirm once. We cover the network cost.",
    errorTitle: "The transfer didn't complete",
    errorAfterBurn:
      " If your USDC already left Base, delivery completes on its own: retry in a bit from your history.",
    genericRunError: "Something went wrong. Your funds didn't move.",
    stepSending: "Leaving Base",
    stepSendingDetail:
      "Your USDC are being dispatched. Don't close this screen just yet.",
    stepAttesting: "Verifying the trip",
    stepAttestingDetail:
      "The transfer is being officially verified. It usually takes under a minute.",
    stepMinting: "Arriving on Solana",
    stepMintingDetail: "We're crediting the USDC to your Solana account.",
    slowNote:
      "Sometimes the network takes a few minutes longer than usual. Your USDC are safe and delivery completes on its own. You can keep this screen open or come back later.",
    viewBaseTx: "View the outgoing transaction",
    doneTitle: "They arrived!",
    doneBody: (amount: string) =>
      `${amount} USDC are now in your Solana account.`,
    doneBodyNoAmount: "Your USDC are now in your Solana account.",
    doneViewBase: "View departure on Base",
    doneViewSolana: "View arrival on Solana",
    doneAgain: "Make another transfer",
    historyTitle: "Recent transfers",
    historySim: " · simulation",
    historyDone: "Completed",
    historyError: "Not completed",
    historyPending: "On its way",
    historyRetry: "Retry",
    historyRetrying: "Delivering…",
    historyNotSent: "Didn't go out: your money never moved",
    historyWithdrawTo: (addr: string) => `Withdrawal to ${addr}`,
    historyPaymentTo: (who: string) => `Payment to ${who}`,
    tabBridge: "Take to Solana",
    tabBridgeShort: "Move",
    tabCobros: "Get paid",
    tabInvest: "Invest",
  },
  deposit: {
    title: "Deposit USDC on Base",
    sub: "Send your USDC to this address from Coinbase or any wallet.",
    qrAlt: "QR code of your address",
    pending: "Your address is being prepared. Open this again in a few seconds.",
    warnNetworkPre: "· Network: ",
    warnNetworkMid: ". Asset: ",
    warnNetworkPost: ". Nothing else.",
    warnLoss: "· If you send another asset or another network, those funds are lost.",
    warnAuto: "· As soon as it lands, the balance shows up here on its own.",
    warnDemo: "· Demo mode: this address is a sample.",
    copyLabel: "Copy Base address",
  },
  cobros: {
    title: "Get paid in dollars",
    sub: "Create a link, send it on WhatsApp and get paid from Coinbase or Base. The USDC land in your Solana account.",
    solanaBalance: "Your Solana account",
    amountLabel: "How much are you charging?",
    amountPlaceholder: "40",
    amountHint: "Leave it empty and the payer picks the amount. Minimum 0.50 USDC.",
    amountInvalid: "Enter a valid amount, for example 40 or 12.50.",
    amountMin: "The minimum to charge is 0.50 USDC.",
    conceptLabel: "What for? (optional)",
    conceptPlaceholder: "Logo design",
    nameLabel: "Your name",
    namePlaceholder: "Fer",
    nameHint: "This is how the payer sees you.",
    exactNote:
      "The payer sends the number you asked for. The fee (0.45 %, capped at half a dollar) is taken from what arrives.",
    create: "Create payment link",
    linkReady: "Your link is ready",
    linkReadySub: "Share it anywhere. When you get paid, you'll see it right here.",
    qrAlt: "QR code of the payment link",
    copyLink: "Copy link",
    share: "Share",
    shareWhatsapp: "Send on WhatsApp",
    shareText: (amount: string | null, concept: string, url: string) =>
      `Here's my Camalote link to pay me${amount ? ` ${amount} USDC` : ""}${concept ? ` (${concept})` : ""}: ${url}`,
    newLink: "Create another",
    listTitle: "Your payment links",
    emptyList: "You haven't created any links yet.",
    openAmount: "Open amount",
    statusPending: "Awaiting payment",
    statusPaid: "Paid",
    paidAmount: (amount: string) => `${amount} USDC arrived`,
    viewPayment: "View on Solana",
    depositTitle: "Your payment address on Base",
    depositBody:
      "It's your Base wallet. Anyone can send you USDC here from Coinbase or their wallet, no sign-up. Whatever arrives travels to your Solana account on its own when you open Camalote.",
    depositFee: (pct: string) =>
      `The fee is taken on the way: ${pct} %, never more than half a dollar.`,
    depositOnly: "USDC only, Base network only.",
    depositQr: "Show QR",
    depositQrHide: "Hide QR",
    depositQrAlt: "QR code of your Base payment address",
    depositIncoming: (amount: string) =>
      `${amount} USDC reached your payment address. Bringing them to your Solana account…`,
    depositDone: (amount: string) => `${amount} USDC delivered to your Solana account.`,
    depositError:
      "We couldn't complete the trip to Solana. The USDC are still in your Base wallet: we'll retry on our own.",
    copyAddress: "Copy address",
    ruleActive: (pct: string, asset: string) =>
      `Rule on: ${pct}% of every payment goes to ${asset}.`,
    ruleOff: "Want part of every payment to invest itself?",
    ruleLinkOn: "See portfolio",
    ruleLinkOff: "Set your rule",
  },
  pay: {
    requestFrom: (name: string) => `${name} is asking you for`,
    requestAnon: "You're being asked for",
    chooseAmount: "You choose how much",
    receivesOn: "Receives native USDC on Solana",
    invalidTitle: "This link can't be paid",
    invalidBody:
      "It's missing the destination or the amount is wrong. Ask whoever sent it to generate it again.",
    loginTitle: "Pay with your email",
    loginSub: "No wallets, no secret phrases. Your account creates itself and it's yours alone.",
    loginButton: "Pay with my email",
    balanceLabel: "Your balance on Base",
    amountLabel: "How much are you sending?",
    amountPlaceholder: "25",
    amountHint: "Minimum 0.50 USDC. You can use a comma or a dot for decimals.",
    youPay: "You pay from Base",
    fee: (pct: string) => `Fee (${pct}%)`,
    express: "Express delivery",
    network: "Network cost",
    networkValue: "$0, on us",
    theyReceive: (name: string) => `${name} receives`,
    insufficient: (missing: string) => `You're ${missing} USDC short on Base.`,
    insufficientHint:
      "Send USDC to your Base address from Coinbase or any wallet. As soon as they land, the button enables itself.",
    topUp: "Add USDC on Base",
    submit: (amount: string) => `Pay ${amount} USDC`,
    submitHint: "You confirm once. We cover the network cost.",
    doneTitle: "Paid!",
    doneBody: (amount: string, name: string) =>
      `${name} now has ${amount} USDC in their Solana account.`,
    again: "Make another payment",
    viralTitle: "Do you get paid in dollars too?",
    viralBody:
      "Create your link in a minute. They pay from Coinbase or Base with no sign-up, and it lands on Solana.",
    viralCta: "Create my payment link",
    orDivider: "or",
    directTitle: "No sign-up",
    directSub: (name: string) =>
      `Send the USDC from Coinbase or any wallet to ${name}'s Base account. When they open Camalote, it moves to their Solana account on its own.`,
    directSend: (amount: string) => `Send ${amount} USDC`,
    directSendOpen: "Send any amount from 0.50 USDC",
    directOnly: "USDC only, Base network only. Any other coin or network is lost.",
    directWaiting: "Waiting for it to arrive…",
    directWaitingNote: (name: string) =>
      `If you close this page, nothing is lost: the USDC are already in ${name}'s account.`,
    directDoneBody: (amount: string, name: string) =>
      `The ${amount} USDC are already in ${name}'s account. They'll see them on Solana when they open Camalote.`,
    directSimulate: "Simulate the send from Coinbase",
    directQrAlt: "QR code of the Base account",
    copyAddress: "Copy address",
    footer:
      "USDC travel through their issuers' official route, straight to the account of whoever gets paid.",
  },
  withdrawModal: {
    title: "Withdraw on Solana",
    sub: "Send your USDC to any Solana address.",
    destLabel: "To which address?",
    destInvalid: "That Solana address doesn't look valid.",
    destOwn: "That's already your own account.",
    amountLabel: "How much?",
    amountInvalid: "Enter a valid amount, for example 10 or 5.50.",
    amountMin: "The minimum withdrawal is 0.10 USDC.",
    amountInsufficient: (balance: string) =>
      `Not enough: you have ${balance} USDC.`,
    amountInsufficientFuel: (available: string, fuel: string) =>
      `You can withdraw up to ${available} USDC: ${fuel} stay for the network reserve.`,
    hint: "Minimum 0.10 USDC. The network is paid from your SOL reserve: under a cent.",
    hintFuel: (fuel: string) =>
      `Minimum 0.10 USDC. First ${fuel} USDC go into a network reserve that stays in your account as SOL.`,
    submit: "Withdraw",
    submitting: "Sending",
    stepFuel: "Loading the network reserve",
    doneTitle: "Withdrawal sent",
    doneBody: (amount: string) => `${amount} USDC are on their way.`,
    doneBodyNoAmount: "Your USDC are on their way.",
    viewOnSolana: "View on Solana",
    done: "Done",
    genericError: "We couldn't complete the withdrawal. Try again.",
  },
  invest: {
    title: "Invest part of every payment",
    sub: "Pick a percentage and a stock. Every time USDC land in your account, that part buys itself. From 2 dollars, no broker.",
    accountTitle: "Your Solana account",
    accountSub: "USDC land here and the stocks stay here.",
    deposit: "Deposit",
    withdraw: "Withdraw",
    copyAddress: "Copy address",
    simulateIncoming: "Simulate 40 USDC arriving",
    depositTitle: "Deposit USDC on Solana",
    depositSub:
      "Send USDC to this account from any wallet or exchange. Or give it to whoever pays you.",
    depositQrAlt: "QR code of your Solana account",
    depositPending: "Your account is being prepared. Open this again in a few seconds.",
    depositNetworkPre: "· Network: ",
    depositNetworkMid: ". Asset: ",
    depositNetworkPost: ". Nothing else.",
    depositLoss: "· If you send another asset or another network, those funds are lost.",
    depositRule: "· Whatever lands counts for your rule.",
    depositDemo: "· Demo mode: this account is a sample.",
    heroLeft: "In your account",
    heroRight: "In stocks",
    heroRightEmpty: "Nothing has crossed yet.",
    heroRightSub: (put: string) => `You put in ${put} ·`,
    ruleOffChip: "Rule off",
    ruleChange: "Change",
    ruleDone: "Done",
    crossing: "Crossing: buying now…",
    buyOpen: "Buy",
    ruleTitle: "Your rule",
    ruleOff: "Rule off. Switch it on and pick how much and what.",
    toggleLabel: "Invest part of every payment",
    percentLabel: "How much of what comes in?",
    assetLabel: "Into what?",
    ruleSummary: (pct: string, asset: string) =>
      `${pct}% of every payment goes to ${asset}.`,
    ruleMin: (min: string) => `Once that part adds up to ${min} USDC, it buys itself.`,
    ruleOpenNote:
      "The rule runs while Camalote is open. If USDC land while the app is closed, it buys when you open it.",
    pendingLabel: (pending: string, min: string) =>
      `Adding up: ${pending} of ${min} USDC`,
    paused: (msg: string) =>
      `The last purchase didn't go through (${msg}). What was set aside is kept and we'll retry in a while.`,
    portfolioTitle: "Your stocks",
    valueLabel: "Worth today",
    investedLabel: "You put in",
    returnLabel: "Return",
    emptyPortfolio:
      "No stocks yet. They buy themselves with your next USDC, or buy now.",
    pricesLive:
      "Market prices from Jupiter. Return is computed on what was bought and sold through Camalote.",
    pricesFallback:
      "Reference prices: we couldn't reach the market. Return is computed on what was bought and sold through Camalote.",
    priceEach: "each",
    dividendsLine: (usdc: string, tokens: string, asset: string) =>
      `Dividends reinvested: +${usdc} USDC (${tokens} ${asset})`,
    sell: "Sell",
    buyTitle: "Buy now",
    buySub: "With the USDC in your account. You see the price and the fee before confirming.",
    buyAmountLabel: "How much?",
    buyAmountHint: (min: string) => `Minimum ${min} USDC per purchase.`,
    buyAmountHintFuel: (min: string, fuel: string) =>
      `Minimum ${min} USDC per purchase. This time ${fuel} USDC more go into a network reserve that stays in your account as SOL.`,
    buyAmountInvalid: "Enter a valid amount, for example 10 or 25.50.",
    buyAmountMin: (min: string) => `The minimum per purchase is ${min} USDC.`,
    buyInsufficient: (balance: string) =>
      `Not enough: you have ${balance} USDC in your account.`,
    buyInsufficientFuel: (balance: string, fuel: string) =>
      `Not enough: you have ${balance} USDC and the network reserve takes ${fuel}.`,
    buyQuote: (asset: string) => `See ${asset} price`,
    quoteLoading: "Finding the best price…",
    rowSpend: "You invest",
    rowCamaloteFee: (pct: string) => `Camalote fee (${pct}%)`,
    rowJupiter: (pct: string) => `Jupiter and network (${pct}%)`,
    rowIncluded: "in the price",
    rowFeeShort: (fee: string) => `fee ${fee}`,
    rowFuel: "Network reserve (once)",
    fuelNote:
      "It stays in your account as SOL and pays the network for all your operations. It tops up on its own when it runs out.",
    rowReceive: "You receive",
    quoteValid: "The price is good for a minute.",
    quoteNotGasless: "The network is paid from your SOL reserve: under a cent.",
    confirmBuy: "Confirm purchase",
    changeAmount: "Change",
    stepFuel: "Loading the network reserve",
    stepSigning: "Signing with your account",
    stepSending: "Buying on Solana",
    stepSellSending: "Selling on Solana",
    stepFee: "Charging the fee",
    doneTitle: "Bought!",
    doneBody: (tokens: string, asset: string, usdc: string) =>
      `${tokens} ${asset} for ${usdc} USDC are now in your Solana account.`,
    camaloteFeeLine: (fee: string) => `Camalote fee: ${fee} USDC.`,
    camaloteFeeSkipped: "Camalote fee: couldn't be collected this time.",
    feeLine: (pct: string) => `Jupiter and network: ${pct}%, already in the price.`,
    fuelDoneLine: (fuel: string) =>
      `Network reserve: ${fuel} USDC stayed in your account as SOL.`,
    viewOnSolana: "View on Solana",
    buyAgain: "Buy again",
    genericError: "We couldn't complete the purchase. Your USDC didn't move.",
    sellTitle: (asset: string) => `Sell ${asset}`,
    sellSub: "The USDC come back to your account. Camalote doesn't charge for selling.",
    sellAmountLabel: "How much?",
    sellAll: "All",
    sellHave: (amount: string, asset: string) => `You have ${amount} ${asset}.`,
    sellAmountInvalid: "Enter a valid amount, for example 0.01.",
    sellTooMuch: "You don't have that much.",
    sellQuote: "See price",
    sellRowSell: "You sell",
    sellRowReceive: "You receive",
    sellConfirm: "Sell",
    sellDoneTitle: "Sold!",
    sellDoneBody: (usdc: string, tokens: string, asset: string) =>
      `${usdc} USDC are now in your account for ${tokens} ${asset}.`,
    sellError: "We couldn't complete the sale. Your stocks didn't move.",
    done: "Done",
    purchasesTitle: "Your operations",
    purchaseBuying: "In progress…",
    purchaseDone: "Done",
    purchaseError: "Not completed",
    sourceRule: "by your rule",
    sourceManual: "by hand",
    kindSell: "sale of",
    sim: " · simulation",
    disclosureTitle: "What you should know",
    disclosure: [
      "These are tokenized stocks by xStocks, issued by Backed. They track the stock's price, but they are not the stock and carry no voting rights. They go up and down: there's no promised return.",
      "Dividends reinvest on their own: when the stock pays, your amount grows a little. You see it in your portfolio.",
      "Backed can freeze or claw them back if the law requires it. That part isn't yours alone, the way your USDC are.",
      "Not available to residents of the United States, United Kingdom, Canada and Australia.",
      "Camalote charges 0.45% per purchase, never more than half a dollar, and nothing for selling. It doesn't recommend assets: you set the rule and switch it off whenever you like.",
    ],
  },
};

const DICTIONARIES: Record<Lang, Dictionary> = { es, en };
const STORAGE_KEY = "camalote.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const LangContext = createContext<LangContextValue>({
  lang: "es",
  setLang: () => {},
  t: es,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    // Sincronización inicial con localStorage / idioma del navegador.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(stored);
      } else if (!navigator.language.toLowerCase().startsWith("es")) {
        setLangState("en");
      }
    } catch {
      // sin almacenamiento, queda el default
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // no crítico
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, t: DICTIONARIES[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Toggle ES/EN para los headers. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      className="flex items-center rounded-lg border border-border p-0.5"
      role="group"
      aria-label="Idioma / Language"
    >
      {(["es", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
            lang === option
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
