import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * CSP ESTRICTA, SIN unsafe-inline (referencia 14.2).
 *
 * Es barata aqui porque el diseno la hizo barata: cero scripts de terceros, cero hosts
 * externos (la fuente esta auto-alojada, ver ui/global.css), cero <style>, cero
 * dangerouslySetInnerHTML —prohibido por ESLint— y cero imagenes. La superficie que hay
 * que permitir es, literalmente, el propio origen.
 *
 * Los `style={{}}` de React NO necesitan 'unsafe-inline': React los aplica por CSSOM
 * (node.style.setProperty), y la CSP no intercepta CSSOM. Lo que si intercepta son los
 * <style> del markup y los atributos style="", y no hay ninguno.
 *
 * Ojo: `frame-ancestors` NO se puede poner en una <meta>, solo en cabecera. Por eso la
 * CSP se envia como CABECERA y no como meta.
 */
const CSP_BASE = [
  "default-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  // El API va por el proxy: mismo origen. Nada mas tiene que salir.
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  // Nadie nos mete en un iframe: es lo que cierra el clickjacking.
  "frame-ancestors 'none'",
]

/**
 * La CSP de DESARROLLO es OTRA COSA, y conviene no llamarla estricta.
 *
 * El modo dev de cualquier bundler es incompatible con una CSP estricta por diseno, y no
 * es una excusa: son hechos comprobables.
 *
 *  * script-src 'unsafe-inline': Vite inyecta el preambulo de React Refresh como script
 *    EN LINEA dentro de index.html. Sin la relajacion, la app no arranca —comprobado: la
 *    pantalla se queda en blanco—. Y un nonce no vale: lo tendria que emitir Vite.
 *  * style-src 'unsafe-inline': Vite inyecta el CSS creando elementos <style> por JS para
 *    poder hacer HMR.
 *  * connect-src ws:: el canal de HMR.
 *
 * CON script-src Y style-src EN 'unsafe-inline', ESTA CSP NO DEFIENDE DE UN XSS. Decir lo
 * contrario seria teatro. Lo que si hace, y por eso se queda, es de ALARMA DE DERIVA: el
 * dia que alguien anada una fuente de Google, un script de terceros o una llamada a una
 * API externa, revienta en desarrollo en vez de en el despliegue. Las directivas que
 * vigilan eso —font-src, img-src, connect-src, frame-ancestors, object-src, base-uri,
 * form-action— siguen enteras.
 *
 * La CSP de verdad es la del build, y se puede comprobar: `npm run preview`.
 */
const CSP_DEV = [
  ...CSP_BASE.filter((d) => !d.startsWith('connect-src') && !d.startsWith('script-src')),
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws:",
].join('; ')

const CSP_ESTRICTA = [...CSP_BASE, "style-src 'self'"].join('; ')

// Acompañan a la CSP en dev y preview. nosniff cierra la reinterpretacion MIME;
// no-referrer no filtra rutas internas si algun dia hay un enlace externo.
const CABECERAS_COMUNES = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

export default defineConfig({
  plugins: [react()],

  // El navegador solo habla con el propio origen: el proxy de dev evita abrir CORS
  // entre 5173 y 3000 (referencia 14.1).
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    headers: { 'Content-Security-Policy': CSP_DEV, ...CABECERAS_COMUNES },
  },

  // `npm run preview` sirve el build: es lo mas parecido a produccion que hay aqui, y
  // lleva la CSP estricta. Si algo se rompiera bajo CSP, se rompe AQUI y no en un
  // despliegue.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    headers: { 'Content-Security-Policy': CSP_ESTRICTA, ...CABECERAS_COMUNES },
  },
})
