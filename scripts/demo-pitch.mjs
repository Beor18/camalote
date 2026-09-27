/**
 * El pitch del video demo, una frase por escena y por idioma. Vende la
 * necesidad antes que el producto ("vendeme una pluma"): la servilleta es la
 * primera escena, la urgencia es la última. `demo-video.mjs` genera la voz
 * de cada escena, sostiene la pantalla el tiempo que dura la frase y mezcla
 * todo al final. Los nombres tienen que coincidir con las escenas del
 * script de grabación.
 *
 * "U.S.D.C." con puntos para que la voz lo deletree.
 */
export const PITCH = {
  en: [
    {
      name: "landing",
      text:
        "You get paid in dollars. Good. Now do some quick math: everything you earned last year. How much of it is still yours today? Right. You worked all year for the rent, the bills, the card. You got what was left. And nothing is ever left.",
    },
    {
      name: "login",
      text:
        "It's not that you don't want to invest. It's that 'later' never comes. The money lands and it already has an owner. The only one who gets out is the one who gets paid first. And that has to be you.",
    },
    {
      name: "rule",
      text:
        "So decide once, with a clear head: of everything I get paid, thirty percent is mine. What for? The trip. Into what? The S and P 500. Or Nvidia. Or SpaceX before it goes public. One decision. Not forty a year.",
    },
    {
      name: "incoming",
      text:
        "You get paid forty. But it's not forty anymore: it's twenty-eight for the month, and twelve already in the S and P 500, under the trip's name, before you even see them. You didn't decide anything. You had already decided.",
    },
    {
      name: "portfolio",
      text:
        "And one day you open the app, and it's there. How far the trip has come, how many payments to go, what it's worth today. It goes up and down, like everything worth having. But it's there. It's yours, in your account, and you sell whenever you want.",
    },
    {
      name: "receipt",
      text:
        "No fine print. Every purchase with its receipt, and the fee in plain sight before you confirm: never more than fifty cents. Selling is free. And if one day you don't want it anymore, you switch it off.",
    },
    {
      name: "closing",
      text:
        "The next payment is already on its way. What's going to happen to it? Camalote. Get paid as usual. Part of it will already be invested.",
    },
  ],
  es: [
    {
      name: "landing",
      text:
        "Cobrás en dólares. Bien. Ahora hacé una cuenta rápida: todo lo que cobraste el año pasado. ¿Cuánto de eso sigue siendo tuyo hoy? Eso. Trabajaste todo el año para el alquiler, las cuentas, la tarjeta. Para vos quedó lo que sobró. Y nunca sobra.",
    },
    {
      name: "login",
      text:
        "No es que no quieras invertir. Es que 'después' no llega nunca. La plata entra y ya tiene dueño. El único que se salva es el que cobra primero. Y ese tenés que ser vos.",
    },
    {
      name: "rule",
      text:
        "Entonces decidilo una sola vez, con la cabeza fría: de todo lo que me paguen, el treinta por ciento es mío. ¿Para qué? Para el viaje. ¿En qué? El S&P 500. O Nvidia. O SpaceX antes de que salga a bolsa. Una decisión. No cuarenta por año.",
    },
    {
      name: "incoming",
      text:
        "Te pagan cuarenta. Pero ya no son cuarenta: son veintiocho para el mes, y doce que ya están en el S&P 500, a nombre del viaje, antes de que los veas. No decidiste nada. Ya lo habías decidido.",
    },
    {
      name: "portfolio",
      text:
        "Y un día abrís, y está. Cuánto va del viaje, cuántos cobros faltan, cuánto vale hoy. Sube y baja, como todo lo que vale la pena. Pero está. Es tuyo, en tu cuenta, y lo vendés cuando quieras.",
    },
    {
      name: "receipt",
      text:
        "Sin letra chica. Cada compra con su comprobante, y la comisión a la vista antes de confirmar: nunca más de medio dólar. Vender es gratis. Y si un día no querés más, lo apagás.",
    },
    {
      name: "closing",
      text:
        "El próximo cobro ya está en camino. ¿Qué va a pasar con él? Camalote. Cobrá como siempre. Una parte ya va a estar invertida.",
    },
  ],
};

/** Voces de Edge (neurales, gratis, piden internet). La de castellano es argentina. */
export const VOICES = { en: "en-US-AndrewMultilingualNeural", es: "es-AR-TomasNeural" };
