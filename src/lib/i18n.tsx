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
    navWhy: "Cómo funciona",
    navPrice: "Precio",
    navOpenApp: "Abrir la app",
    badgeDemo: "Probalo hoy, sin poner un peso",
    heroEyebrow: "Para los que cobran en USDC",
    heroLine1: "Una parte de cada cobro",
    heroHighlight: "se invierte.",
    heroSub:
      "Antes de que la gastes. Elegís qué parte, para qué y en qué. Una sola vez. Después, cobrá como siempre.",
    heroCta: "Armar mi regla",
    heroSecondary: "Ver cómo funciona",
    heroProof: ["Desde 2 dólares", "Sin broker ni papeles", "Lo apagás cuando quieras"],
    // El producto tal cual se ve, con números de ejemplo (no es una promesa).
    mock: {
      on: "Prendida",
      edit: "Editar",
      headline: "El 30 % de cada cobro",
      goesTo: "va a ✈️ El viaje",
      inAsset: "en acciones",
      progress: "1.240",
      target: "de 2.000 USDC · 62 %",
      pace: "A este ritmo llegás en marzo.",
      chip: "✈️ El viaje",
      status: "Apartado: 4,00 USDC. Compra al juntar 10.",
      moment: "Te llegaron 40 USDC. 12 ya son de El viaje: vas por el 62 %.",
    },
    problemTitle: "Te pagan 40. Se van 40.",
    problemSub:
      "Alquiler, cuentas, tarjeta. Para vos queda lo que sobra, y nunca sobra. Camalote da vuelta el orden: primero vos, después el resto.",
    napkinTitle: "Hacé la cuenta.",
    napkinSub: "En serio. Escribí lo que cobraste el año pasado, más o menos.",
    napkinInputLabel: "Cobraste",
    napkinPercentLabel: "Si una parte se hubiera apartado sola",
    napkinResultPre: "Hoy tendrías",
    napkinResultPost: "invertidos a tu nombre. Sin haber movido un dedo.",
    napkinFootnote:
      "Es lo que habrías puesto. Lo que vale después sube y baja con el mercado, como todo.",
    napkinEmpty: "Escribí un número y mirá.",
    oldWayTitle: "Como hasta ahora",
    oldWay: [
      "Acordarte de invertir cada mes",
      "Cuarenta decisiones por año",
      "Broker, papeles, mínimos",
      "Lo que sobra se gasta",
    ],
    newWayTitle: "Con Camalote",
    newWay: [
      "Decidís una sola vez: «el 30 % es mío»",
      "Para algo concreto: la compu, el viaje, el colchón",
      "Se aparta cuando te pagan, antes de que lo veas",
      "En acciones, o en dólares que rinden si no querés el sube y baja",
    ],
    stepsTitle: "Lo armás en un minuto",
    stepsSub: "Entrás con tu email, contestás tres preguntas y listo. Después, cobrá como siempre: lo demás pasa solo.",
    steps: [
      {
        title: "Elegí qué parte",
        body: "El 10, el 20, el 30 % de cada cobro. Se aparta antes de que lo veas.",
      },
      {
        title: "Ponele nombre",
        body: "La compu, el viaje, un colchón. La app te dice cuántos cobros faltan y cuánto vale hoy.",
      },
      {
        title: "Elegí en qué",
        body: "Acciones, empresas privadas o dólares que rinden. Lo cambiás cuando quieras.",
      },
    ],
    stepsVisual: {
      percents: ["10 %", "20 %", "30 %"],
      goals: ["✈️ Viaje", "🖥️ Compu", "🛟 Colchón"],
      tabs: ["Acciones", "Privadas", "Dólares"],
    },
    stepsNote: "¿Todavía no te pagan en Solana?",
    stepsLink: "Mandá USDC a tu cuenta y empezá a mano",
    pickTitle: "¿En qué?",
    pickSub: "Tres destinos. Elegís uno para tu regla y lo cambiás cuando quieras.",
    picks: [
      {
        title: "Acciones de Estados Unidos",
        body: "Más de 60 empresas, tokenizadas en Solana. Desde 2 dólares. Los dividendos se reinvierten solos.",
        tag: "Comisión 0,45 %",
      },
      {
        title: "Empresas privadas",
        body: "Las que todavía no salieron a bolsa. Más riesgo, para el que lo busca.",
        tag: "Comisión 0,45 %",
      },
      {
        title: "Dólares que rinden",
        body: "Cerca del 4 % anual, respaldados por letras del Tesoro de Estados Unidos. Sin el sube y baja. Los sacás cuando quieras.",
        tag: "Comisión 0,10 %",
      },
    ],
    installCta: "Instalala en tu teléfono",
    installIosHint:
      "En iPhone: tocá el botón Compartir y elegí «Agregar a inicio».",
    factsTitle: "Sin letra chica.",
    facts: [
      { label: "Compra mínima", value: "$2" },
      { label: "Comisión por compra", value: "0,45 %" },
      { label: "Tope de comisión", value: "$0,50" },
      { label: "Vender o sacar", value: "Gratis" },
    ],
    factsNote: "En dólares que rinden, la comisión es 0,10 %. Sacarlos, gratis.",
    pricingTitle: "La comisión, con tu número",
    pricingSub: "La misma cuenta que hace la app.",
    calcIfYouInvest: "Si invertís",
    calcYouBuy: "van al mercado",
    calcMinHint: "desde 2 USDC por compra",
    calcEmptyHint: "escribí un número y mirá",
    calcFeeLine: (fee: string, pct: string) =>
      `${fee} USDC de comisión (${pct} %, tope medio dólar).`,
    calcFootnote:
      "Aparte va el costo del mercado, 0,10 %, y la red, que pagás vos: menos de un centavo por operación, desde una reserva de 1 dólar que queda en tu cuenta. Lo ves antes de confirmar.",
    trustTitle: "Pensado para que duermas tranquilo",
    trust: [
      {
        title: "Tu cuenta es tuya",
        body: "Las acciones y los dólares quedan en tu cuenta. Nadie puede retirarlos ni mandarlos a otra cuenta.",
      },
      {
        title: "Sin promesas",
        body: "La comisión la ves antes de confirmar. Nadie te promete rendimiento: las acciones suben y bajan, y la tasa de los dólares cambia.",
      },
      {
        title: "Lo apagás cuando quieras",
        body: "Un toque y la regla se apaga. Vendés, sacás y retirás gratis.",
      },
    ],
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Qué compro exactamente?",
        a: "Acciones tokenizadas emitidas por Backed, una empresa suiza regulada. Siguen el precio de la acción real y los dividendos se reinvierten solos. No son la acción: no votás, y el emisor puede congelarlas si la ley lo exige. Si elegís dólares que rinden, no comprás nada: tus USDC se ponen a rendir.",
      },
      {
        q: "¿Qué es la meta?",
        a: "Para qué juntás: la compu, el viaje, tres meses de colchón. La regla la va llenando sola con cada cobro y la app te dice cuánto falta. Cuando llegás, decidís vos: seguir, otra meta, o vender y retirar.",
      },
      {
        q: "¿Y si no quiero acciones?",
        a: "Elegís «dólares que rinden»: tus USDC se ponen a rendir en dólares respaldados por letras del Tesoro de Estados Unidos. Rinden 3,6 % anual hoy y suben de a poco todos los días, sin el sube y baja de las acciones. Los sacás cuando quieras, gratis. No es un banco ni un plazo fijo: el riesgo es del emisor. Ahí la comisión es 0,10 %. El colchón de tres meses va ahí por defecto.",
      },
      {
        q: "¿Puede bajar?",
        a: "Las acciones, sí: suben y bajan como en cualquier lado. Los dólares que rinden no siguen al mercado, pero tampoco son un banco: el riesgo es del emisor. Camalote no promete rendimiento ni recomienda activos.",
      },
      {
        q: "¿Cuánto cuesta?",
        a: "0,45 % por compra, nunca más de medio dólar, a la vista antes de confirmar. En dólares que rinden, 0,10 %. Vender o sacar es gratis. Aparte, el mercado cobra 0,10 % y la red la pagás vos: menos de un centavo por operación, desde una reserva de 1 dólar que se carga sola y queda en tu cuenta. La primera compra de cada acción abre su cuenta: unos 25 centavos, de esa reserva.",
      },
      {
        q: "¿Y si no me pagan en Solana?",
        a: "Mandá USDC a tu cuenta desde cualquier billetera o exchange y empezá a mano: comprás o ponés a rendir cuando quieras. Para que la regla trabaje, pasale esta cuenta a quien te paga.",
      },
      {
        q: "¿Cuándo se mueve la plata?",
        a: "En segundos. Con tu agente activo, aunque la app esté cerrada. Sin agente, se mueve cuando abrís la app. Los cobros chicos se juntan hasta 10 dólares.",
      },
      {
        q: "¿Qué son las empresas antes de salir a bolsa?",
        a: "Tokens que siguen el valor de empresas privadas grandes, sobre todo de tecnología. No son acciones ni dan derechos. El precio es lo que el mercado cree que valen y puede alejarse mucho de la referencia que publica el emisor: la app te lo muestra, y la regla no compra si el token está más de 5 % caro. El emisor cobra 1 % por transferencia. Es más riesgo que una acción que cotiza.",
      },
      {
        q: "¿Es legal desde Argentina?",
        a: "Las acciones no están disponibles en Estados Unidos, Reino Unido, Canadá y Australia. En Argentina, el emisor no las restringe. Camalote no custodia: vos firmás cada compra. Para impuestos, tu contador.",
      },
      {
        q: "¿Por qué en Solana?",
        a: "Porque ahí ya viven las acciones tokenizadas: más de 60 de Estados Unidos y empresas privadas. Mover plata cuesta una fracción de centavo, por eso una compra de 10 dólares tiene sentido y vender es gratis. Y hay laburo que paga en USDC: bounties y changas. Argentina juega de local: una de las comunidades más activas del mundo está acá.",
      },
    ],
    finalTitle1: "El próximo cobro ya está en camino.",
    finalTitle2: "¿Qué va a pasar con él?",
    finalSub: "Armá tu regla una vez. Después, cobrá como siempre.",
    finalCta: "Armar mi regla",
    footerMadeIn: "Hecho en Argentina 🇦🇷",
    footerNote:
      "Las acciones las emite Backed y no están disponibles para residentes de Estados Unidos, Reino Unido, Canadá y Australia. Los dólares que rinden (USDY) los emite Ondo, para personas fuera de Estados Unidos. Camalote no da consejos de inversión.",
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
      "Tu cuenta es tuya: nosotros nunca podemos retirar tus fondos.",
    logout: "Cerrar sesión",
    footer:
      "Tus USDC y tus acciones quedan en tu cuenta de Solana. Nadie más que vos puede retirarlos.",
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
    sectionsLabel: "Secciones",
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
    accountTitle: "Tu cuenta",
    accountSub: "Acá te pagan. Lo que llega cuenta para tu regla.",
    accountAddress: "Tu dirección",
    welcomeTitle: "Cada vez que cobrás, una parte va para vos primero.",
    welcomeSub: "Lo decidís una sola vez. Después se aparta sola, antes de que la gastes.",
    welcomeSteps: [
      { title: "Qué parte", hint: "El 10, el 20, el 30 % de cada cobro." },
      { title: "Para qué", hint: "El viaje, la compu, un colchón." },
      { title: "En qué", hint: "Acciones o dólares que rinden." },
    ],
    setupCta: "Armar mi regla",
    setupTakes: "Tres preguntas. Un minuto.",
    ruleOn: "Prendida",
    rulePausedTag: "En pausa",
    ruleResume: "Reanudar",
    ruleEdit: "Editar",
    ruleEditLabel: "Editar la regla",
    ruleTurnOff: "Apagar la regla",
    ruleHeadline: (pct: number) => `El ${pct} % de cada cobro`,
    ruleGoesTo: (to: string) => `va a ${to}`,
    ruleInAsset: (asset: string) => `en ${asset}`,
    rulePausedNote: "Mientras está en pausa, lo que llega no se aparta.",
    stepOf: (n: number, total: number) => `Paso ${n} de ${total}`,
    next: "Siguiente",
    back: "Atrás",
    turnOn: "Prender la regla",
    save: "Guardar",
    reviewPart: "Qué parte",
    reviewGoal: "Para qué",
    reviewWhere: "En qué",
    percentExample: (pct: number) => `Te llegan 100: ${pct} van para vos primero.`,
    goalNoneShort: "Sin meta",
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
    ruleDone: "Listo",
    crossing: "Comprando ahora…",
    buyOnce: "Comprar una vez",
    ruleTitle: "Tu regla",
    toggleLabel: "Invertir una parte de cada cobro",
    percentLabel: "¿Qué parte de lo que te llega?",
    assetLabel: "¿En qué?",
    assetGroupStocks: "Acciones",
    assetGroupPreIpo: "Privadas",
    assetGroupDollars: "Dólares",
    dollarsChipSub: "Cerca del 4 % anual, sin el sube y baja de las acciones",
    dollarsPickerNote:
      "Dólares respaldados por letras del Tesoro de Estados Unidos. Rinden 3,6 % anual hoy; el porcentaje cambia con la tasa de Estados Unidos. No es un banco ni un plazo fijo: el riesgo es del emisor, no del mercado. Comisión de Camalote: 0,10 %.",
    dollarsRuleNote:
      "Sin horario ni referencia: la regla compra apenas junta el mínimo. El rendimiento se ve como un precio que sube de a poco todos los días.",
    dollarsNote:
      "El rendimiento se ve como un precio que sube de a poco cada día. No es un banco.",
    // Con USDC en la mano no se "compran dólares": se ponen a rendir y se sacan.
    dollarsBuyTitle: "Poner dólares a rendir",
    dollarsBuySub:
      "Tus USDC pasan a dólares que rinden. Los sacás cuando quieras, sin comisión de Camalote.",
    dollarsAmountLabel: "¿Cuánto ponés a rendir?",
    dollarsQuote: "Ver cuánto queda rindiendo",
    dollarsRowSpend: "Ponés",
    dollarsRowReceive: "Queda rindiendo",
    dollarsRowUnits: (tokens: string, price: string) => `${tokens} USDY a ${price} c/u`,
    dollarsConfirm: "Confirmar",
    dollarsStepSending: "Pasando a dólares que rinden",
    dollarsDoneTitle: "¡Ya rinden!",
    dollarsDoneBody: (usdc: string, tokens: string) =>
      `${usdc} USDC ya están rindiendo en tu cuenta (${tokens} USDY).`,
    dollarsAgain: "Poner más",
    dollarsTakeOut: "Sacar",
    dollarsSellTitle: "Sacar los dólares",
    dollarsSellSub: "Vuelven a tu cuenta como USDC. Sin comisión de Camalote.",
    dollarsSellAmountLabel: "¿Cuánto sacás?",
    dollarsSellHave: (value: string) => `Tenés ${value} USD rindiendo.`,
    dollarsSellRowSell: "Sacás",
    dollarsStepTakingOut: "Sacando los dólares",
    dollarsSellDoneTitle: "¡Listo!",
    dollarsSellDoneBody: (usdc: string) => `${usdc} USDC volvieron a tu cuenta.`,
    dollarsRowSub: "Cerca del 4 % anual",
    kindTakeOut: "Sacaste",
    preIpoPickerNote:
      "Tokens que siguen el valor de empresas privadas. Más riesgo: sin derechos, 1 % por transferencia y un precio que puede alejarse de su referencia.",
    waitMarketLabel: "Comprar solo con Wall Street abierto",
    waitMarketHint: "Fuera de horario, el precio puede alejarse del de la acción.",
    preIpoRuleNote:
      "Sin horario de mercado. La regla no compra si el token está más de 5 % arriba de su valor de referencia.",
    waitingMarket: (when: string) => `Listo para comprar. Esperando a que abra Wall Street (${when}).`,
    waitingPremium: (asset: string, pct: string) =>
      `Listo para comprar, pero ${asset} está ${pct} arriba de su referencia. Esperando a que baje.`,
    soon: "pronto",
    marketOpenNote: (when: string) => `Wall Street está abierto. Cierra ${when}.`,
    marketClosedNote: (when: string) =>
      `Wall Street está cerrado hasta ${when}. Fuera de horario el token puede alejarse del precio de la acción.`,
    referenceLine: (mark: string, pct: string) => `Valor de referencia: $${mark} · el token está ${pct}.`,
    premiumHighNote: "Está caro. Podés esperar.",
    transferFeeNote: (pct: string) => `El emisor cobra ${pct} % por transferencia, ya en el precio.`,
    ruleSummary: (pct: string, asset: string) =>
      `De cada cobro, el ${pct} % va a ${asset}.`,
    ruleSummaryGoal: (pct: string, goal: string, asset: string) =>
      `De cada cobro, el ${pct} % es para ${goal}, en ${asset}.`,
    // Con dólares que rinden, el verbo no es "comprar": es "poner a rendir".
    ruleSummaryDollars: (pct: string) => `De cada cobro, el ${pct} % se pone a rendir en dólares.`,
    ruleGoesToDollars: "se pone a rendir en dólares",
    pendingLabelDollars: (pending: string, min: string) =>
      `Apartado: ${pending} USDC. Al juntar ${min}, se pone a rendir.`,
    crossingDollars: "Poniendo a rendir…",
    goalLabel: "¿Para qué?",
    goalPresets: {
      computer: "La compu nueva",
      trip: "El viaje",
      cushion: "Colchón de 3 meses",
      move: "La mudanza",
      course: "El curso",
      custom: "Otra cosa",
    },
    goalNone: "Sin meta por ahora",
    goalNameLabel: "Ponele nombre",
    goalTargetLabel: "¿Cuánto?",
    goalMonthlyLabel: "¿Cuánto necesitás por mes para vivir?",
    goalCushionHint: (target: string) => `Tres meses de eso: ${target} USDC.`,
    goalDueLabel: "¿Para cuándo?",
    goalDueOptional: "Si querés",
    goalMarketNote: "Cuenta lo que compres desde ahora, a valor de hoy: sube y baja con el mercado.",
    heroGoalOf: (target: string) => `de ${target} USDC`,
    heroGoalReached: "Meta cumplida",
    goalProgressLabel: "Avance de la meta",
    goalPaymentsToGo: (n: number) =>
      n === 1 ? "Falta un cobro como el último." : `Faltan unos ${n} cobros como el último.`,
    goalEta: (month: string) => `A este ritmo llegás en ${month}.`,
    goalNeeded: (amount: string, month: string) =>
      `Para llegar en ${month} necesitás apartar ${amount} USDC por mes.`,
    goalMoment: (amount: string, share: string, goal: string, pct: string) =>
      `Te llegaron ${amount} USDC. ${share} ya son de ${goal}: vas por el ${pct} %.`,
    goalMomentNoGoal: (amount: string, share: string) =>
      `Te llegaron ${amount} USDC. ${share} ya están apartados.`,
    goalReachedTitle: "¡Llegaste!",
    goalReachedBody: (goal: string, value: string) =>
      `${goal}: ya hay ${value} USDC juntados, sin que te acordaras. Ahora decidís vos.`,
    goalKeepGoing: "Seguir juntando",
    goalNext: "Elegir la próxima meta",
    goalSell: "Vender y retirar",
    goalShare: "Contarlo",
    goalShared: "Copiado",
    goalShareText: (goal: string) =>
      `Junté ${goal} sin acordarme: una parte de cada cobro se invirtió sola con Camalote.`,
    ruleMin: (min: string) => `Cuando esa parte junta ${min} USDC, se compra sola.`,
    ruleOpenNote:
      "Sin agente, la regla corre mientras Camalote está abierta. Con tu agente activo, compra aunque la cierres.",
    pendingLabel: (pending: string, min: string) =>
      `Apartado: ${pending} USDC. Compra al juntar ${min}.`,
    paused: (msg: string) =>
      `La última compra no salió (${msg}). Lo apartado sigue guardado y reintentamos en un rato.`,
    portfolioTitle: "Lo que ya es tuyo",
    valueLabel: "Vale hoy",
    investedLabel: "Pusiste",
    returnLabel: "Rendimiento",
    emptyPortfolio: "Todavía nada. Se compra solo con tu próximo cobro.",
    emptyPortfolioNoRule: "Todavía nada. Armá la regla y se compra solo con tu próximo cobro.",
    pricesLive:
      "Precios de mercado en vivo. El rendimiento se calcula sobre lo comprado y vendido desde Camalote.",
    pricesFallback:
      "Precios de referencia: no pudimos consultar el mercado. El rendimiento se calcula sobre lo comprado y vendido desde Camalote.",
    priceEach: "c/u",
    dividendsLine: (usdc: string, tokens: string, asset: string) =>
      `Dividendos reinvertidos: +${usdc} USDC (${tokens} ${asset})`,
    sell: "Vender",
    buyTitle: "Comprar una vez",
    buySub: "Fuera de la regla, con los USDC de tu cuenta. Ves el precio y la comisión antes de confirmar.",
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
    rowJupiter: (pct: string) => `Mercado y red (${pct} %)`,
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
    feeLine: (pct: string) => `Mercado y red: ${pct} %, ya en el precio.`,
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
    purchasesTitle: "Movimientos",
    purchaseBuying: "En curso…",
    purchaseDone: "Hecha",
    purchaseError: "No se completó",
    sourceRule: "por tu regla",
    sourceManual: "a mano",
    kindSell: "Venta de",
    sim: " · simulación",
    disclosureTitle: "Lo que tenés que saber",
    disclosure: [
      "Son acciones tokenizadas emitidas por Backed. Siguen el precio de la acción, pero no son la acción ni dan derecho a voto. Suben y bajan: no hay rendimiento prometido.",
      "Los dividendos se reinvierten solos: cuando la acción paga, tu cantidad crece un poco. Lo ves en tu cartera.",
      "Backed puede congelarlas o retirarlas si la ley se lo exige. Esa parte no es solo tuya, como sí lo son tus USDC.",
      "No disponibles para residentes de Estados Unidos, Reino Unido, Canadá y Australia.",
      "Las empresas antes de salir a bolsa son tokens de PreStocks: exposición al valor de empresas privadas, sin derechos ni dividendos, con 1 % por transferencia y un precio que a veces se aleja mucho de su referencia. Más riesgo que una acción que cotiza. Tampoco para residentes de Estados Unidos.",
      "Fuera del horario de Wall Street, el token de una acción puede alejarse de su precio; por eso la regla espera a la apertura si vos querés.",
      "Los dólares que rinden son USDY, emitidos por Ondo y respaldados por letras del Tesoro de Estados Unidos, para personas fuera de Estados Unidos. El rendimiento (3,6 % anual hoy) cambia con la tasa de Estados Unidos y se ve como un precio que sube. No es un depósito bancario: si el emisor falla, el riesgo es tuyo.",
      "Camalote cobra 0,45 % por compra, nunca más de medio dólar, y nada por vender. No recomienda activos: la regla la armás vos y la apagás cuando quieras.",
      "Tu agente firma por vos con un permiso limitado: solo las compras que dice tu regla y la comisión de Camalote, hasta medio dólar. No puede retirar ni mandar tu plata a otra cuenta. Lo apagás cuando quieras y el permiso se borra.",
    ],
  },
  agent: {
    title: "Tu agente",
    on: "Activo",
    off: "Apagado",
    offSub: "Compra según tu regla aunque cierres la app.",
    onSub: "Cuando te pagan, aparta tu parte y compra. Aunque la app esté cerrada.",
    enable: "Activar mi agente",
    runNow: "Revisar ahora",
    running: "Revisando…",
    disable: "Apagar mi agente",
    history: "Lo que hizo",
    empty: "Todavía nada. Acá te va a contar cada cosa que haga.",
    byAi: "Decidió con IA",
    byRule: "Siguió tu regla",
    needsRule: "Primero armá tu regla. Después lo activás.",
    sheetTitle: "Tu agente compra por vos",
    sheetSub: "Le das un permiso limitado. Hace solo lo que dice tu regla.",
    canTitle: "Puede",
    can: [
      "Comprar lo que elegiste, con la parte que elegiste.",
      "Cobrar la comisión de cada compra, hasta 0,50.",
      "Contarte qué hizo.",
    ],
    cantTitle: "No puede",
    cant: [
      "Retirar tu plata ni mandarla a otra cuenta.",
      "Comprar otra cosa, ni más de lo que dice tu regla.",
      "Cambiar tu regla.",
    ],
    sheetNote: "Lo apagás cuando quieras. Antes de activarlo, te pedimos que confirmes el permiso.",
    sheetNoteDemo: "En el demo, el permiso se simula.",
    confirm: "Dar permiso y activar",
    enabling: "Activando…",
    later: "Ahora no",
    error: "No se pudo activar. Probá de nuevo.",
    ago: (text: string) => `hace ${text}`,
    justNow: "recién",
    toggleLabel: "Prender o apagar tu agente",
    kinds: {
      bought: "Compró",
      set_aside: "Apartó",
      waiting: "Esperando",
      error: "No pudo comprar",
      enabled: "Activado",
      disabled: "Apagado",
    },
    seeAll: (n: number) => `Ver todo (${n})`,
    historyTitle: "Todo lo que hizo tu agente",
    today: "Hoy",
    yesterday: "Ayer",
    close: "Cerrar",
  },
  onboarding: {
    stepOf: (n: number, total: number) => `Paso ${n} de ${total}`,
    steps: ["Tu regla", "Tu agente", "Tu primer cobro"],
    agentTitle: "Ahora, que lo haga solo.",
    agentSub: "Tu agente cumple tu regla aunque no abras la app. Y te cuenta cada cosa que hace.",
    agentPoints: [
      "Te pagan y aparta tu parte al toque.",
      "Al juntar 10 dólares, compra.",
      "Nunca retira ni mueve tu plata a otro lado.",
    ],
    skip: "Más tarde",
    fundTitle: "Último paso: que te paguen acá.",
    fundSub: "Pasale esta dirección a quien te paga, o mandate USDC desde donde los tengas. Cada cobro que llega cuenta para tu regla.",
    fundAddress: "Tu dirección en Solana",
    fundQr: "Ver código QR",
    fundOnlyUsdc: "Solo USDC en la red de Solana.",
    fundDemo: "En el demo, en tu cuenta vas a poder simular un cobro.",
    finish: "Listo, ir a mi cuenta",
    agentOnTag: "Agente activo",
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
    navWhy: "How it works",
    navPrice: "Pricing",
    navOpenApp: "Open the app",
    badgeDemo: "Try it today, no money needed",
    heroEyebrow: "For people who get paid in USDC",
    heroLine1: "Part of every payment",
    heroHighlight: "gets invested.",
    heroSub:
      "Before you can spend it. Pick how much, what for and where. Just once. Then get paid as usual.",
    heroCta: "Set up my rule",
    heroSecondary: "See how it works",
    heroProof: ["From 2 dollars", "No broker, no paperwork", "Switch it off anytime"],
    mock: {
      on: "On",
      edit: "Edit",
      headline: "30% of every payment",
      goesTo: "goes to ✈️ The trip",
      inAsset: "in stocks",
      progress: "1,240",
      target: "of 2,000 USDC · 62%",
      pace: "At this pace you get there in March.",
      chip: "✈️ The trip",
      status: "Set aside: 4.00 USDC. Buys once it reaches 10.",
      moment: "40 USDC landed. 12 already belong to The trip: you're at 62%.",
    },
    problemTitle: "You get paid 40. 40 leave.",
    problemSub:
      "Rent, bills, the card. You get what's left, and nothing is ever left. Camalote flips the order: you first, the rest after.",
    napkinTitle: "Do the math.",
    napkinSub: "Seriously. Type what you earned last year, more or less.",
    napkinInputLabel: "You earned",
    napkinPercentLabel: "If a share had set itself aside",
    napkinResultPre: "Today you'd have",
    napkinResultPost: "invested in your name. Without lifting a finger.",
    napkinFootnote:
      "That's what you'd have put in. What it's worth later goes up and down with the market, like everything.",
    napkinEmpty: "Type a number and see.",
    oldWayTitle: "The usual way",
    oldWay: [
      "Remembering to invest every month",
      "Forty decisions a year",
      "A broker, paperwork, minimums",
      "What's left gets spent",
    ],
    newWayTitle: "With Camalote",
    newWay: [
      "You decide once: «30% is mine»",
      "For something real: the laptop, the trip, the cushion",
      "Set aside when you get paid, before you see it",
      "In stocks, or in dollars that earn if you don't want the ups and downs",
    ],
    stepsTitle: "Set it up in a minute",
    stepsSub: "Sign in with your email, answer three questions, done. Then get paid as usual: the rest happens on its own.",
    steps: [
      {
        title: "Pick how much",
        body: "10, 20, 30% of every payment. Set aside before you see it.",
      },
      {
        title: "Give it a name",
        body: "The laptop, the trip, a cushion. The app tells you how many payments to go and what it's worth today.",
      },
      {
        title: "Pick where",
        body: "Stocks, private companies or dollars that earn. Change it whenever you like.",
      },
    ],
    stepsVisual: {
      percents: ["10%", "20%", "30%"],
      goals: ["✈️ Trip", "🖥️ Laptop", "🛟 Cushion"],
      tabs: ["Stocks", "Private", "Dollars"],
    },
    stepsNote: "Not getting paid on Solana yet?",
    stepsLink: "Send USDC to your account and start by hand",
    pickTitle: "Where does it go?",
    pickSub: "Three destinations. Pick one for your rule and change it whenever you like.",
    picks: [
      {
        title: "US stocks",
        body: "More than 60 companies, tokenized on Solana. From 2 dollars. Dividends reinvest on their own.",
        tag: "Fee 0.45%",
      },
      {
        title: "Private companies",
        body: "The ones that haven't gone public yet. More risk, for those who want it.",
        tag: "Fee 0.45%",
      },
      {
        title: "Dollars that earn",
        body: "About 4% a year, backed by short-term US Treasuries. No ups and downs. Take them out whenever you like.",
        tag: "Fee 0.10%",
      },
    ],
    installCta: "Install it on your phone",
    installIosHint:
      "On iPhone: tap the Share button and choose «Add to Home Screen».",
    factsTitle: "No fine print.",
    facts: [
      { label: "Minimum purchase", value: "$2" },
      { label: "Fee per purchase", value: "0.45%" },
      { label: "Fee cap", value: "$0.50" },
      { label: "Selling or taking out", value: "Free" },
    ],
    factsNote: "In dollars that earn, the fee is 0.10%. Taking them out is free.",
    pricingTitle: "The fee, with your number",
    pricingSub: "The same math the app runs.",
    calcIfYouInvest: "If you invest",
    calcYouBuy: "goes to market",
    calcMinHint: "from 2 USDC per purchase",
    calcEmptyHint: "type a number and see",
    calcFeeLine: (fee: string, pct: string) =>
      `${fee} USDC is our fee (${pct}%, capped at half a dollar).`,
    calcFootnote:
      "On top comes the market cost, 0.10%, and the network, which you pay: under a cent per operation, from a 1-dollar reserve that stays in your account. You see it before confirming.",
    trustTitle: "Built so you can sleep at night",
    trust: [
      {
        title: "Your account is yours",
        body: "The stocks and the dollars stay in your account. No one can withdraw them or send them elsewhere.",
      },
      {
        title: "No promises",
        body: "You see the fee before you confirm. Nobody promises a return: stocks go up and down, and the dollars' rate changes.",
      },
      {
        title: "Switch it off whenever you like",
        body: "One tap and the rule is off. Sell, take out and withdraw for free.",
      },
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "What exactly am I buying?",
        a: "Tokenized stocks issued by Backed, a regulated Swiss company. They track the real stock's price and dividends reinvest on their own. They aren't the stock: you don't vote, and the issuer can freeze them if the law requires it. If you pick dollars that earn, you don't buy anything: your USDC are put to earn.",
      },
      {
        q: "What's the goal?",
        a: "What you're saving for: the laptop, the trip, a three-month cushion. The rule fills it on its own with every payment and the app tells you how much is left. When you get there, it's your call: keep going, another goal, or sell and withdraw.",
      },
      {
        q: "What if I don't want stocks?",
        a: "Pick «dollars that earn»: your USDC are put to earn in dollars backed by short-term US Treasuries. They yield 3.6% a year today and creep up a little every day, without the ups and downs of stocks. Take them out whenever you like, for free. Not a bank and not a term deposit: the risk is the issuer's. The fee there is 0.10%. The three-month cushion goes there by default.",
      },
      {
        q: "Can it go down?",
        a: "Stocks, yes: they go up and down like anywhere else. Dollars that earn don't follow the market, but they aren't a bank either: the risk is the issuer's. Camalote doesn't promise returns or recommend assets.",
      },
      {
        q: "How much does it cost?",
        a: "0.45% per purchase, never more than half a dollar, shown before you confirm. In dollars that earn, 0.10%. Selling or taking out is free. On top, the market charges 0.10% and you pay the network: under a cent per operation, from a 1-dollar reserve that loads on its own and stays in your account. The first purchase of each stock opens its account: about 25 cents, from that reserve.",
      },
      {
        q: "What if I don't get paid on Solana?",
        a: "Send USDC to your account from any wallet or exchange and start by hand: buy or put to earn whenever you like. For the rule to work, give this account to whoever pays you.",
      },
      {
        q: "When does the money move?",
        a: "In seconds. With your agent on, even with the app closed. Without it, it moves when you open the app. Small payments add up to 10 dollars.",
      },
      {
        q: "What are pre-IPO companies?",
        a: "Tokens that track the value of large private companies, mostly in tech. They aren't shares and carry no rights. The price is what the market thinks they're worth and can drift far from the reference the issuer publishes: the app shows it, and the rule doesn't buy while the token is more than 5% expensive. The issuer charges 1% per transfer. It's riskier than a listed stock.",
      },
      {
        q: "Is it legal from Argentina?",
        a: "The stocks aren't available in the United States, United Kingdom, Canada and Australia. In Argentina, the issuer doesn't restrict them. Camalote doesn't hold your funds: you sign every purchase. For taxes, ask your accountant.",
      },
      {
        q: "Why on Solana?",
        a: "Because that's where tokenized stocks already live: more than 60 US stocks plus private companies. Moving money costs a fraction of a cent, which is why a 10-dollar purchase makes sense and selling is free. And there's work that pays in USDC: bounties and gigs. Argentina plays at home: one of the most active communities in the world is here.",
      },
    ],
    finalTitle1: "The next payment is already on its way.",
    finalTitle2: "What's going to happen to it?",
    finalSub: "Set your rule once. Then get paid as usual.",
    finalCta: "Set my rule",
    footerMadeIn: "Made in Argentina 🇦🇷",
    footerNote:
      "The stocks are issued by Backed and aren't available to residents of the United States, United Kingdom, Canada and Australia. Dollars that earn (USDY) are issued by Ondo, for people outside the United States. Camalote doesn't give investment advice.",
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
    custodyNote: "Your account is yours: we can never withdraw your funds.",
    logout: "Sign out",
    footer:
      "Your USDC and your stocks stay in your Solana account. Only you can withdraw them.",
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
    sectionsLabel: "Sections",
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
    accountTitle: "Your account",
    accountSub: "Get paid here. Whatever lands counts for your rule.",
    accountAddress: "Your address",
    welcomeTitle: "Every time you get paid, a part goes to you first.",
    welcomeSub: "Decide it once. After that it sets itself aside, before you can spend it.",
    welcomeSteps: [
      { title: "How much", hint: "10, 20, 30% of every payment." },
      { title: "What for", hint: "The trip, the laptop, a cushion." },
      { title: "Where", hint: "Stocks or dollars that earn." },
    ],
    setupCta: "Set up my rule",
    setupTakes: "Three questions. One minute.",
    ruleOn: "On",
    rulePausedTag: "Paused",
    ruleResume: "Resume",
    ruleEdit: "Edit",
    ruleEditLabel: "Edit the rule",
    ruleTurnOff: "Turn the rule off",
    ruleHeadline: (pct: number) => `${pct}% of every payment`,
    ruleGoesTo: (to: string) => `goes to ${to}`,
    ruleInAsset: (asset: string) => `in ${asset}`,
    rulePausedNote: "While paused, nothing that lands is set aside.",
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    next: "Next",
    back: "Back",
    turnOn: "Turn the rule on",
    save: "Save",
    reviewPart: "How much",
    reviewGoal: "What for",
    reviewWhere: "Where",
    percentExample: (pct: number) => `100 land: ${pct} go to you first.`,
    goalNoneShort: "No goal",
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
    ruleDone: "Done",
    crossing: "Buying now…",
    buyOnce: "Buy once",
    ruleTitle: "Your rule",
    toggleLabel: "Invest part of every payment",
    percentLabel: "How much of what comes in?",
    assetLabel: "Into what?",
    assetGroupStocks: "Stocks",
    assetGroupPreIpo: "Pre-IPO",
    assetGroupDollars: "Dollars",
    dollarsChipSub: "About 4% a year, without the ups and downs of stocks",
    dollarsPickerNote:
      "Dollars backed by short-term US Treasuries. They yield 3.6% a year today; the rate moves with US rates. Not a bank and not a term deposit: the risk is the issuer's, not the market's. Camalote fee: 0.10%.",
    dollarsRuleNote:
      "No market hours and no reference: the rule buys as soon as it adds up to the minimum. The yield shows up as a price that creeps up a little every day.",
    dollarsNote:
      "The yield shows up as a price that creeps up a little every day. Not a bank.",
    dollarsBuyTitle: "Put dollars to earn",
    dollarsBuySub:
      "Your USDC become dollars that earn. Take them out whenever you like, no Camalote fee.",
    dollarsAmountLabel: "How much do you put to earn?",
    dollarsQuote: "See how much ends up earning",
    dollarsRowSpend: "You put in",
    dollarsRowReceive: "Ends up earning",
    dollarsRowUnits: (tokens: string, price: string) => `${tokens} USDY at ${price} each`,
    dollarsConfirm: "Confirm",
    dollarsStepSending: "Moving into dollars that earn",
    dollarsDoneTitle: "Earning!",
    dollarsDoneBody: (usdc: string, tokens: string) =>
      `${usdc} USDC are now earning in your account (${tokens} USDY).`,
    dollarsAgain: "Put more",
    dollarsTakeOut: "Take out",
    dollarsSellTitle: "Take the dollars out",
    dollarsSellSub: "They come back to your account as USDC. No Camalote fee.",
    dollarsSellAmountLabel: "How much do you take out?",
    dollarsSellHave: (value: string) => `You have ${value} USD earning.`,
    dollarsSellRowSell: "You take out",
    dollarsStepTakingOut: "Taking the dollars out",
    dollarsSellDoneTitle: "Done!",
    dollarsSellDoneBody: (usdc: string) => `${usdc} USDC are back in your account.`,
    dollarsRowSub: "About 4% a year",
    kindTakeOut: "Took out",
    preIpoPickerNote:
      "Tokens that track the value of private companies. Riskier: no rights, a 1% transfer fee and a price that can drift from its reference.",
    waitMarketLabel: "Buy only while Wall Street is open",
    waitMarketHint: "Outside market hours, the price can drift from the stock's.",
    preIpoRuleNote:
      "No market hours. The rule doesn't buy while the token trades more than 5% above its reference value.",
    waitingMarket: (when: string) => `Ready to buy. Waiting for Wall Street to open (${when}).`,
    waitingPremium: (asset: string, pct: string) =>
      `Ready to buy, but ${asset} is ${pct} above its reference. Waiting for it to come down.`,
    soon: "soon",
    marketOpenNote: (when: string) => `Wall Street is open. It closes ${when}.`,
    marketClosedNote: (when: string) =>
      `Wall Street is closed until ${when}. Outside market hours the token can drift from the stock's price.`,
    referenceLine: (mark: string, pct: string) => `Reference value: $${mark} · the token is ${pct}.`,
    premiumHighNote: "It's expensive. You can wait.",
    transferFeeNote: (pct: string) => `The issuer charges ${pct}% per transfer, already in the price.`,
    ruleSummary: (pct: string, asset: string) =>
      `${pct}% of every payment goes to ${asset}.`,
    ruleSummaryGoal: (pct: string, goal: string, asset: string) =>
      `${pct}% of every payment goes to ${goal}, in ${asset}.`,
    ruleSummaryDollars: (pct: string) => `${pct}% of every payment goes into dollars that earn.`,
    ruleGoesToDollars: "goes into dollars that earn",
    pendingLabelDollars: (pending: string, min: string) =>
      `Set aside: ${pending} USDC. Once it reaches ${min}, it goes to earn.`,
    crossingDollars: "Putting to earn…",
    goalLabel: "What for?",
    goalPresets: {
      computer: "The new laptop",
      trip: "The trip",
      cushion: "3-month cushion",
      move: "Moving out",
      course: "The course",
      custom: "Something else",
    },
    goalNone: "No goal for now",
    goalNameLabel: "Give it a name",
    goalTargetLabel: "How much?",
    goalMonthlyLabel: "How much do you need per month to live?",
    goalCushionHint: (target: string) => `Three months of that: ${target} USDC.`,
    goalDueLabel: "By when?",
    goalDueOptional: "Optional",
    goalMarketNote: "Counts what you buy from now on, at today's value: it goes up and down with the market.",
    heroGoalOf: (target: string) => `of ${target} USDC`,
    heroGoalReached: "Goal reached",
    goalProgressLabel: "Goal progress",
    goalPaymentsToGo: (n: number) =>
      n === 1 ? "One more payment like the last one." : `About ${n} more payments like the last one.`,
    goalEta: (month: string) => `At this pace you get there in ${month}.`,
    goalNeeded: (amount: string, month: string) =>
      `To get there by ${month} you need to set aside ${amount} USDC a month.`,
    goalMoment: (amount: string, share: string, goal: string, pct: string) =>
      `${amount} USDC landed. ${share} already belong to ${goal}: you're at ${pct}%.`,
    goalMomentNoGoal: (amount: string, share: string) =>
      `${amount} USDC landed. ${share} are already set aside.`,
    goalReachedTitle: "You made it!",
    goalReachedBody: (goal: string, value: string) =>
      `${goal}: ${value} USDC are in, without you remembering once. Now it's your call.`,
    goalKeepGoing: "Keep going",
    goalNext: "Pick the next goal",
    goalSell: "Sell and withdraw",
    goalShare: "Tell someone",
    goalShared: "Copied",
    goalShareText: (goal: string) =>
      `I saved up for ${goal} without remembering once: part of every payment invested itself with Camalote.`,
    ruleMin: (min: string) => `Once that part adds up to ${min} USDC, it buys itself.`,
    ruleOpenNote:
      "Without the agent, the rule runs while Camalote is open. With your agent on, it buys even when it's closed.",
    pendingLabel: (pending: string, min: string) =>
      `Set aside: ${pending} USDC. Buys once it reaches ${min}.`,
    paused: (msg: string) =>
      `The last purchase didn't go through (${msg}). What was set aside is kept and we'll retry in a while.`,
    portfolioTitle: "What's already yours",
    valueLabel: "Worth today",
    investedLabel: "You put in",
    returnLabel: "Return",
    emptyPortfolio: "Nothing yet. It buys itself with your next payment.",
    emptyPortfolioNoRule: "Nothing yet. Set up the rule and it buys itself with your next payment.",
    pricesLive:
      "Live market prices. Return is computed on what was bought and sold through Camalote.",
    pricesFallback:
      "Reference prices: we couldn't reach the market. Return is computed on what was bought and sold through Camalote.",
    priceEach: "each",
    dividendsLine: (usdc: string, tokens: string, asset: string) =>
      `Dividends reinvested: +${usdc} USDC (${tokens} ${asset})`,
    sell: "Sell",
    buyTitle: "Buy once",
    buySub: "Outside the rule, with the USDC in your account. You see the price and the fee before confirming.",
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
    rowJupiter: (pct: string) => `Market and network (${pct}%)`,
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
    feeLine: (pct: string) => `Market and network: ${pct}%, already in the price.`,
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
    purchasesTitle: "Activity",
    purchaseBuying: "In progress…",
    purchaseDone: "Done",
    purchaseError: "Not completed",
    sourceRule: "by your rule",
    sourceManual: "by hand",
    kindSell: "Sale of",
    sim: " · simulation",
    disclosureTitle: "What you should know",
    disclosure: [
      "These are tokenized stocks issued by Backed. They track the stock's price, but they are not the stock and carry no voting rights. They go up and down: there's no promised return.",
      "Dividends reinvest on their own: when the stock pays, your amount grows a little. You see it in your portfolio.",
      "Backed can freeze or claw them back if the law requires it. That part isn't yours alone, the way your USDC are.",
      "Not available to residents of the United States, United Kingdom, Canada and Australia.",
      "Pre-IPO companies are PreStocks tokens: exposure to the value of private companies, with no rights or dividends, a 1% transfer fee and a price that sometimes drifts far from its reference. Riskier than a listed stock. Also not for US residents.",
      "Outside Wall Street hours, a stock token can drift from its price; that's why the rule waits for the open if you want it to.",
      "Dollars that earn are USDY, issued by Ondo and backed by short-term US Treasuries, for people outside the United States. The yield (3.6% a year today) moves with US rates and shows up as a rising price. Not a bank deposit: if the issuer fails, the risk is yours.",
      "Camalote charges 0.45% per purchase, never more than half a dollar, and nothing for selling. It doesn't recommend assets: you set the rule and switch it off whenever you like.",
      "Your agent signs for you with a limited permission: only the buys your rule says and Camalote's fee, up to half a dollar. It can't withdraw or send your money to another account. Switch it off anytime and the permission is removed.",
    ],
  },
  agent: {
    title: "Your agent",
    on: "On",
    off: "Off",
    offSub: "Buys by your rule even with the app closed.",
    onSub: "When you get paid, it sets your share aside and buys. Even with the app closed.",
    enable: "Turn on my agent",
    runNow: "Check now",
    running: "Checking…",
    disable: "Turn off my agent",
    history: "What it did",
    empty: "Nothing yet. It'll tell you here about everything it does.",
    byAi: "Decided with AI",
    byRule: "Followed your rule",
    needsRule: "Set up your rule first. Then turn it on.",
    sheetTitle: "Your agent buys for you",
    sheetSub: "You give it a limited permission. It only does what your rule says.",
    canTitle: "It can",
    can: [
      "Buy what you picked, with the share you picked.",
      "Charge the fee on each buy, up to 0.50.",
      "Tell you what it did.",
    ],
    cantTitle: "It can't",
    cant: [
      "Withdraw your money or send it to another account.",
      "Buy something else, or more than your rule says.",
      "Change your rule.",
    ],
    sheetNote: "Switch it off whenever you like. Before it turns on, we'll ask you to confirm the permission.",
    sheetNoteDemo: "In the demo, the permission is simulated.",
    confirm: "Give permission and turn on",
    enabling: "Turning on…",
    later: "Not now",
    error: "Couldn't turn it on. Try again.",
    ago: (text: string) => `${text} ago`,
    justNow: "just now",
    toggleLabel: "Turn your agent on or off",
    kinds: {
      bought: "Bought",
      set_aside: "Set aside",
      waiting: "Waiting",
      error: "Couldn't buy",
      enabled: "Turned on",
      disabled: "Turned off",
    },
    seeAll: (n: number) => `See all (${n})`,
    historyTitle: "Everything your agent did",
    today: "Today",
    yesterday: "Yesterday",
    close: "Close",
  },
  onboarding: {
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    steps: ["Your rule", "Your agent", "Your first payment"],
    agentTitle: "Now, let it run on its own.",
    agentSub: "Your agent follows your rule even if you never open the app. And it tells you everything it does.",
    agentPoints: [
      "You get paid and it sets your share aside right away.",
      "Once it saves 10 dollars, it buys.",
      "It never withdraws or moves your money anywhere else.",
    ],
    skip: "Later",
    fundTitle: "Last step: get paid here.",
    fundSub: "Give this address to whoever pays you, or send yourself USDC from wherever you have it. Every payment that lands counts for your rule.",
    fundAddress: "Your Solana address",
    fundQr: "Show QR code",
    fundOnlyUsdc: "Only USDC on the Solana network.",
    fundDemo: "In the demo, you'll be able to simulate a payment from your account.",
    finish: "Done, go to my account",
    agentOnTag: "Agent on",
  },
};

const DICTIONARIES: Record<Lang, Dictionary> = { es, en };
const STORAGE_KEY = "camalote.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

/** Idioma por defecto: inglés. El castellano queda a un toque y se recuerda. */
export const DEFAULT_LANG: Lang = "en";

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: DICTIONARIES[DEFAULT_LANG],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    // Solo se respeta lo que el usuario eligió en este dispositivo; el idioma
    // del navegador no decide, así la app abre en inglés para todos.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(stored);
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
      aria-label="Language / Idioma"
    >
      {(["en", "es"] as const).map((option) => (
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
