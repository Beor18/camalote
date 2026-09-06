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
 */

export type Lang = "es" | "en";

const es = {
  common: {
    usdc: "USDC",
    max: "MAX",
    free: "Gratis",
    close: "Cerrar",
    demoBadge: "Modo demo",
    testnetBadge: "Red de prueba",
    demoNote: "Simulación: no se movieron fondos reales.",
  },
  landing: {
    navWhy: "Convenceme",
    navPrice: "Precio",
    navOpenApp: "Abrir la app",
    badgeDemo: "Probalo hoy en modo demo",
    badgeTestnet: "Versión de prueba",
    heroLine1: "Te pagaron 100 dólares.",
    heroLine2Pre: "¿Cuántos ",
    heroLine2Highlight: "te llegaron",
    heroLine2Post: "?",
    heroSub: "Si tenés que hacer la cuenta, ya sabés la respuesta.",
    heroCta: "Quiero que lleguen los 100",
    heroSecondary: "¿Cómo?",
    heroPhotoAlt:
      "Un camalote flotando solo en el agua abierta de un río, con su reflejo",
    heroStory:
      "El camalote baja por el río y trae hasta tu orilla lo que viene de lejos. Lo mismo hacemos con los dólares que te deben: salen de Base y llegan enteros a tu cuenta en Solana.",
    heroPhotoCredit: "Foto",
    showdownTitle: "Seamos honestos.",
    showdownSub:
      "Si la respuesta fue «menos de 100», no es culpa tuya. Es del camino que hacen para llegar a vos.",
    baseColTitle: "Cobrar como hasta ahora",
    baseCol: [
      "Cada intermediario se queda con una parte",
      "Días de espera, papeles, preguntas",
      "Te los pasan a pesos sin preguntarte",
      "O terminás explicándole cripto a tu cliente",
    ],
    solanaColTitle: "Cobrar con Camalote",
    solanaCol: [
      "Un link con el monto, por WhatsApp",
      "El que paga entra con su mail y paga desde Coinbase o Base",
      "Te llega exactamente lo que pediste, en un minuto",
      "La comisión la paga el que paga: nunca más de medio dólar",
      "Los dólares quedan tuyos, en Solana, y los movés gratis",
    ],
    letter: [
      "Nota de tus dólares:",
      "pediste 100, somos 100.",
      "Nadie nos tocó en el camino.",
      "Contá si querés. 💜",
    ],
    whyTitle: "¿Y por qué a Solana?",
    whySub: "No te pedimos que nos creas. Esto es lo que hay, hoy.",
    whyItems: [
      {
        claim: "Acá la plata se usa",
        body: "Mover plata tarda menos de un segundo y cuesta una fracción de centavo. Por eso podemos pagar el costo de red por vos y dejarte los retiros gratis. Tus dólares dejan de estar guardados: pagan, rinden y se mueven entre miles de apps, todos los días.",
      },
      {
        claim: "Hay laburo que paga en dólares",
        body: "Protocolos de todo el mundo publican trabajos y changas pagadas en USDC para programar, diseñar o escribir. No hace falta CV eterno: mostrás lo que sabés hacer y cobrás. Y te pagan acá, en Solana.",
      },
      {
        claim: "Si construís, hay respaldo de verdad",
        body: "Grants de hasta $10.000 para tu proyecto. Mentores que acompañan. Y descuentos reales en todo lo que un proyecto necesita: auditorías, servidores, abogados, contadores.",
      },
      {
        claim: "Argentina juega de local",
        body: "Una de las comunidades más activas del mundo está acá: un bootcamp que termina con demo day frente a fondos, un estudio para grabar tu pitch, un directorio para encontrar socio. La puerta se abre desde adentro.",
      },
    ],
    whyLink: "Golpeá: Superteam Argentina",
    stepsTitle: "Cobrar es así de fácil",
    steps: [
      {
        title: "Creá el link",
        body: "Entrás con tu email, ponés cuánto y por qué. Sin registrarte en ningún lado, sin instalar nada.",
      },
      {
        title: "Mandalo",
        body: "WhatsApp, Telegram, un mail. El que te paga entra con su mail y paga desde Coinbase o Base. No necesita saber nada de cripto.",
      },
      {
        title: "Ya está",
        body: "Un minuto después, los dólares están en tu cuenta en Solana. Exactamente los que pediste.",
      },
    ],
    stepsBridgeNote: "¿Ya tenés USDC en Base?",
    stepsBridgeLink: "Traelos vos mismo a Solana",
    installCta: "Instalala en tu teléfono",
    installIosHint:
      "En iPhone: tocá el botón Compartir y elegí «Agregar a inicio».",
    statsTitle: "Esto ya arrancó.",
    statsVolumeLabel: "USDC entregados en Solana",
    statsCrossingsLabel: "Entregas completadas",
    statsTimeLabel: "Tiempo por entrega",
    statsTimeValue: "1 minuto",
    statsCapLabel: "Tope de comisión",
    statsCapValue: "$0,50",
    statsAltWithdrawLabel: "Retiros",
    statsAltWithdrawValue: "Gratis",
    statsAltMinLabel: "Mínimo para cobrar",
    statsAltMinValue: "$0,50",
    pricingTitle: "Probá con tu número",
    pricingSub: "Sin letra chica: esta cuenta es la misma que hace la app.",
    calcIfYouBring: "Si pedís",
    calcYouReceive: "te llegan",
    calcPayerPuts: "El que te paga pone",
    calcMinHint: "desde 0,50 USDC ya podés",
    calcEmptyHint: "escribí un número y mirá",
    calcFootnote:
      "La diferencia es nuestra comisión, nunca más de medio dólar, más el envío exprés. El costo de red lo ponemos nosotros. Lo que pediste es lo que llega.",
    trustTitle: "Pensado para que duermas tranquilo",
    trust: [
      {
        title: "USDC de verdad, de punta a punta",
        body: "Nada de copias ni atajos raros: salen USDC de Base y llegan USDC a Solana, por el camino oficial de quienes los emiten.",
      },
      {
        title: "Tu plata nunca pasa por nosotros",
        body: "Viaja directo de la cuenta del que paga a la tuya. No podemos tocarla, ni queriendo. Y si un día te querés ir, te la llevás toda.",
      },
      {
        title: "Si algo se demora, no se pierde",
        body: "Una vez que salió, la entrega está garantizada. Cerrá la app, quedate sin batería: cuando vuelvas, va a estar.",
      },
    ],
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Quién paga la comisión?",
        a: "El que paga. Vos recibís exactamente el número que pediste. La comisión nunca pasa de medio dólar, y el costo de red lo cubrimos nosotros.",
      },
      {
        q: "¿El que me paga necesita saber de cripto?",
        a: "No. Entra con su email y necesita USDC en Base: si los tiene en Coinbase, los manda gratis a la dirección que le mostramos. Del resto nos ocupamos nosotros.",
      },
      {
        q: "¿Por qué me llegan a Solana?",
        a: "Porque ahí mover plata cuesta una fracción de centavo: eso es lo que nos deja pagar el costo de red por vos y darte retiros gratis. Y es donde paga la comunidad que te rodea: bounties, grants y laburos en dólares. Si igual los querés en otro lado, los retirás cuando quieras.",
      },
      {
        q: "¿Y cómo los paso a pesos?",
        a: "Camalote no cambia dólares por pesos. Tus USDC son tuyos: los retirás gratis a cualquier cuenta de Solana, incluidas varias billeteras argentinas que los reciben, y ahí los cambiás cuando y como quieras.",
      },
      {
        q: "¿Qué son Base y Solana?",
        a: "Dos redes donde pueden vivir tus USDC, como dos bancos distintos para la misma plata. Base es la red de Coinbase; ahí es donde mucha gente de afuera tiene sus dólares digitales. Solana es donde está pasando todo. Camalote trae los dólares de una a la otra.",
      },
      {
        q: "¿Qué es Superteam?",
        a: "La comunidad de Solana en Argentina y en más de 15 países. Organizan bounties pagados en USDC, grants de hasta $10.000 para proyectos y eventos para conocer gente que construye. Cuando te lleguen los dólares, caés parado.",
      },
      {
        q: "¿Cuánto tarda?",
        a: "Normalmente menos de un minuto, de punta a punta. Si la red está muy cargada puede tardar unos minutos más, pero llega siempre.",
      },
      {
        q: "¿Cuánto cuesta?",
        a: "Nuestra comisión nunca pasa de medio dólar por cobro, y el envío exprés suma unos centavos. Lo paga el que te paga: vos pedís un número y ese es el que llega.",
      },
      {
        q: "¿Es seguro?",
        a: "Los USDC viajan por el mismo camino oficial que usan los emisores de la moneda, por donde pasan miles de millones de dólares todos los días. Y tu plata nunca pasa por nuestras manos: va de la cuenta del que paga a la tuya.",
      },
    ],
    finalTitle1: "Que la próxima respuesta",
    finalTitle2: "sea «los 100».",
    finalSub: "Creá tu link y cobrá en dólares de una vez.",
    finalCta: "Crear mi link de cobro",
    footerMadeIn: "Hecho en Argentina 🇦🇷 para acercar el mundo a Solana, junto a",
    footerBadge: "Versión de prueba, sin dinero real",
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
      "Tus USDC viajan por el camino oficial de sus emisores. Tu plata nunca pasa por nuestras manos.",
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
    tabCobros: "Cobrar",
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
    exactNote: "El que paga cubre la comisión: vos recibís el número que pediste.",
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
      "Creá tu link en un minuto. Te pagan desde Coinbase o Base y te llega a Solana.",
    viralCta: "Crear mi link de cobro",
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
    hint: "Mínimo 0,10 USDC. Costo de red: $0, lo cubrimos.",
    submit: "Retirar",
    submitting: "Enviando",
    doneTitle: "Retiro enviado",
    doneBody: (amount: string) => `${amount} USDC van en camino.`,
    doneBodyNoAmount: "Tus USDC van en camino.",
    viewOnSolana: "Ver en Solana",
    done: "Listo",
    genericError: "No pudimos completar el retiro. Probá de nuevo.",
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
    testnetBadge: "Test network",
    demoNote: "Simulation: no real funds were moved.",
  },
  landing: {
    navWhy: "Convince me",
    navPrice: "Pricing",
    navOpenApp: "Open the app",
    badgeDemo: "Try it today in demo mode",
    badgeTestnet: "Test version",
    heroLine1: "You got paid 100 dollars.",
    heroLine2Pre: "How many ",
    heroLine2Highlight: "reached you",
    heroLine2Post: "?",
    heroSub: "If you have to do the math, you already know the answer.",
    heroCta: "I want all 100 to arrive",
    heroSecondary: "How?",
    heroPhotoAlt:
      "A camalote floating alone on the open water of a river, with its reflection",
    heroStory:
      "The camalote drifts down the river carrying what comes from far away to your shore. Same with the dollars you're owed: they leave Base and land whole in your Solana account.",
    heroPhotoCredit: "Photo",
    showdownTitle: "Let's be honest.",
    showdownSub:
      "If the answer was «less than 100», it's not your fault. It's the road they take to reach you.",
    baseColTitle: "Getting paid the usual way",
    baseCol: [
      "Every middleman keeps a slice",
      "Days of waiting, paperwork, questions",
      "Converted to local currency without asking you",
      "Or you end up explaining crypto to your client",
    ],
    solanaColTitle: "Getting paid with Camalote",
    solanaCol: [
      "One link with the amount, over WhatsApp",
      "The payer signs in with their email and pays from Coinbase or Base",
      "You get exactly what you asked for, in a minute",
      "The payer covers the fee: never more than half a dollar",
      "The dollars stay yours, on Solana, and move for free",
    ],
    letter: [
      "A note from your dollars:",
      "you asked for 100, we are 100.",
      "Nobody touched us on the way.",
      "Count us if you like. 💜",
    ],
    whyTitle: "And why Solana?",
    whySub: "We're not asking you to trust us. This is what's there, today.",
    whyItems: [
      {
        claim: "Here money gets used",
        body: "Moving money takes under a second and costs a fraction of a cent. That's why we can cover the network cost for you and keep withdrawals free. Your dollars stop sitting still: they pay, earn and move across thousands of apps, every day.",
      },
      {
        claim: "There's work that pays in dollars",
        body: "Protocols from around the world post jobs and gigs paid in USDC for coding, design or writing. No endless CV: you show what you can do and get paid. And they pay you here, on Solana.",
      },
      {
        claim: "If you build, there's real backing",
        body: "Grants of up to $10,000 for your project. Mentors who stick around. And real discounts on everything a project needs: audits, servers, lawyers, accountants.",
      },
      {
        claim: "Argentina plays at home",
        body: "One of the most active communities in the world is here: a bootcamp that ends with a demo day in front of funds, a studio to record your pitch, a directory to find a co-founder. The door opens from the inside.",
      },
    ],
    whyLink: "Knock: Superteam Argentina",
    stepsTitle: "Getting paid is this easy",
    steps: [
      {
        title: "Create the link",
        body: "Sign in with your email, set how much and what for. No sign-ups anywhere, nothing to install.",
      },
      {
        title: "Send it",
        body: "WhatsApp, Telegram, an email. The payer signs in with their email and pays from Coinbase or Base. They don't need to know a thing about crypto.",
      },
      {
        title: "Done",
        body: "A minute later, the dollars are in your Solana account. Exactly the amount you asked for.",
      },
    ],
    stepsBridgeNote: "Already have USDC on Base?",
    stepsBridgeLink: "Bring them to Solana yourself",
    installCta: "Install it on your phone",
    installIosHint:
      "On iPhone: tap the Share button and choose «Add to Home Screen».",
    statsTitle: "It's already started.",
    statsVolumeLabel: "USDC delivered on Solana",
    statsCrossingsLabel: "Deliveries completed",
    statsTimeLabel: "Time per delivery",
    statsTimeValue: "1 minute",
    statsCapLabel: "Fee cap",
    statsCapValue: "$0.50",
    statsAltWithdrawLabel: "Withdrawals",
    statsAltWithdrawValue: "Free",
    statsAltMinLabel: "Minimum to get paid",
    statsAltMinValue: "$0.50",
    pricingTitle: "Try your own number",
    pricingSub: "No fine print: this is the same math the app runs.",
    calcIfYouBring: "If you ask for",
    calcYouReceive: "you receive",
    calcPayerPuts: "The payer puts in",
    calcMinHint: "from 0.50 USDC you're good",
    calcEmptyHint: "type a number and see",
    calcFootnote:
      "The difference is our fee, never more than half a dollar, plus express delivery. We cover the network cost. What you asked for is what arrives.",
    trustTitle: "Built so you can sleep at night",
    trust: [
      {
        title: "Real USDC, end to end",
        body: "No copies, no odd shortcuts: USDC leave Base and USDC land on Solana, through the official path of the people who issue them.",
      },
      {
        title: "Your money never passes through us",
        body: "It travels straight from the payer's account to yours. We can't touch it, even if we wanted to. And if one day you want out, you take all of it with you.",
      },
      {
        title: "If it's delayed, it's not lost",
        body: "Once it's out, delivery is guaranteed. Close the app, run out of battery: when you're back, it'll be there.",
      },
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "Who pays the fee?",
        a: "The payer. You receive exactly the number you asked for. The fee never exceeds half a dollar, and we cover the network cost.",
      },
      {
        q: "Does the person paying me need to know crypto?",
        a: "No. They sign in with their email and need USDC on Base: if they have them on Coinbase, they send them for free to the address we show. We take care of the rest.",
      },
      {
        q: "Why do the dollars land on Solana?",
        a: "Because moving money there costs a fraction of a cent: that's what lets us cover the network cost for you and keep withdrawals free. It's also where the community around you pays: bounties, grants and dollar jobs. If you'd still rather have them elsewhere, withdraw whenever you like.",
      },
      {
        q: "How do I turn them into local currency?",
        a: "Camalote doesn't exchange dollars. Your USDC are yours: withdraw them for free to any Solana account, including several local wallets that accept them, and exchange there whenever and however you want.",
      },
      {
        q: "What are Base and Solana?",
        a: "Two networks where your USDC can live, like two different banks for the same money. Base is Coinbase's network; that's where many people abroad keep their digital dollars. Solana is where everything is happening. Camalote brings the dollars from one to the other.",
      },
      {
        q: "What is Superteam?",
        a: "The Solana community in Argentina and in 15+ countries. They run bounties paid in USDC, grants of up to $10,000 for projects and events to meet people who build. When the dollars land, you land on your feet.",
      },
      {
        q: "How long does it take?",
        a: "Usually under a minute, end to end. If the network is very busy it can take a few more minutes, but it always arrives.",
      },
      {
        q: "How much does it cost?",
        a: "Our fee never exceeds half a dollar per payment, and express delivery adds a few cents. The payer covers it: you ask for a number and that's the number that arrives.",
      },
      {
        q: "Is it safe?",
        a: "The USDC travel the same official path the currency's issuers use, where billions of dollars move every day. And your money never passes through our hands: it goes from the payer's account to yours.",
      },
    ],
    finalTitle1: "Make the next answer",
    finalTitle2: "«all 100».",
    finalSub: "Create your link and get paid in dollars, at last.",
    finalCta: "Create my payment link",
    footerMadeIn: "Made in Argentina 🇦🇷 to bring the world to Solana, with",
    footerBadge: "Test version, no real money",
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
      "Your USDC travel through their issuers' official route. Your money never passes through our hands.",
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
    tabCobros: "Get paid",
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
    exactNote: "The payer covers the fee: you receive exactly the number you asked for.",
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
      "Create your link in a minute. Get paid from Coinbase or Base, receive on Solana.",
    viralCta: "Create my payment link",
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
    hint: "Minimum 0.10 USDC. Network cost: $0, on us.",
    submit: "Withdraw",
    submitting: "Sending",
    doneTitle: "Withdrawal sent",
    doneBody: (amount: string) => `${amount} USDC are on their way.`,
    doneBodyNoAmount: "Your USDC are on their way.",
    viewOnSolana: "View on Solana",
    done: "Done",
    genericError: "We couldn't complete the withdrawal. Try again.",
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
