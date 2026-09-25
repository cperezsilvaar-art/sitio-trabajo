/*
 * acceso.js — Portada y clave de acceso.
 *
 * La clave no es una cortina: deriva una llave con PBKDF2 y cifra el contenido
 * del tablero con AES-GCM antes de guardarlo. Sin la clave, lo que queda en el
 * navegador es ilegible.
 *
 * La contracara es que no hay recuperación posible. Si se pierde la clave, se
 * pierden los datos: por eso el tablero insiste con los respaldos.
 */

const CLAVE_SEGURIDAD = 'farmatodo.rrhh.seguridad.v1';
const ITERACIONES = 250000;
const TESTIGO = 'panel-rrhh-ok';

const Acceso = (() => {
/* En trozos, no de una. `String.fromCharCode(...bytes)` pasa un argumento por
   byte: con el padrón completo cifrado son más de 150.000 argumentos y el
   navegador corta con "Maximum call stack size exceeded". El guardado fallaba
   solo cuando había datos de verdad, que es cuando importa. */
  const b64 = buf => {
    const bytes = new Uint8Array(buf);
    const TROZO = 0x8000;
    let s = '';
    for (let i = 0; i < bytes.length; i += TROZO) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + TROZO));
    }
    return btoa(s);
  };
  const debuf = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const texto = new TextEncoder();
  const desTexto = new TextDecoder();

  function disponible() {
    return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.deriveKey === 'function';
  }

  async function derivar(clave, salt) {
    const base = await crypto.subtle.importKey('raw', texto.encode(clave), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERACIONES, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** Envuelve la llave en las dos operaciones que necesita el almacén. */
  function cifradorCon(llave) {
    return {
      async cifrar(txt) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, texto.encode(txt));
        return JSON.stringify({ v: 1, iv: b64(iv), d: b64(ct) });
      },
      async descifrar(txt) {
        const p = JSON.parse(txt);
        if (!p || p.v !== 1) throw new Error('formato desconocido');
        const pt = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: debuf(p.iv) }, llave, debuf(p.d));
        return desTexto.decode(pt);
      }
    };
  }

  const leerSeguridad = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_SEGURIDAD) || 'null'); }
    catch (e) { return null; }
  };

  async function crearClave(clave) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const llave = await derivar(clave, salt);
    const cif = cifradorCon(llave);
    localStorage.setItem(CLAVE_SEGURIDAD, JSON.stringify({
      v: 1, salt: b64(salt), iteraciones: ITERACIONES, testigo: await cif.cifrar(TESTIGO)
    }));
    return cif;
  }

  async function abrirCon(clave) {
    const seg = leerSeguridad();
    if (!seg) return null;
    const llave = await derivar(clave, debuf(seg.salt));
    const cif = cifradorCon(llave);
    try {
      if (await cif.descifrar(seg.testigo) !== TESTIGO) return null;
    } catch (e) { return null; }   // clave incorrecta: el descifrado falla
    return cif;
  }

  /* ------------------------------ pantalla ------------------------------ */

  const marca = `<svg class="marca" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="none" stroke="currentColor" stroke-width="3.5"/>
      <path d="M32 19v26M19 32h26" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    </svg>`;

  /* Foto del local para la portada, como data URI. Vacío = se dibuja la
     ilustración de abajo, que no pesa nada y funciona sin conexión. Para poner
     la foto real alcanza con pegarla acá: el resto de la portada no cambia. */
  const FOTO_LOCAL = '';

  /* El local de la esquina: techo de teja a cuatro aguas, las columnas
     blancas, la vidriera encendida y las dos palmeras con los canteros. Es un
     dibujo y no una foto porque el panel tiene que abrir sin conexión y sin
     pedir nada afuera; para la foto real está FOTO_LOCAL, acá arriba. */
  const local = `<svg class="pm-local" viewBox="0 0 420 268" aria-hidden="true">
      <defs>
        <linearGradient id="lc-techo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5a9bd8"/><stop offset="1" stop-color="#2563a8"/>
        </linearGradient>
        <linearGradient id="lc-ala" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f7fc0"/><stop offset="1" stop-color="#1f5695"/>
        </linearGradient>
        <linearGradient id="lc-vidrio" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#dce9f8"/><stop offset=".55" stop-color="#f3ead4"/>
          <stop offset="1" stop-color="#e6d9b8"/>
        </linearGradient>
        <radialGradient id="lc-piso" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#9ecbff" stop-opacity=".34"/>
          <stop offset="1" stop-color="#9ecbff" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <ellipse cx="210" cy="232" rx="200" ry="34" fill="url(#lc-piso)"/>

      <!-- alas laterales -->
      <path d="M12 126h120v28H12zM288 126h120v28H288z" fill="url(#lc-ala)"/>
      <path d="M12 154h120v62H12zM288 154h120v62H288z" fill="#e8eef6"/>
      <path d="M20 166h104v34H20zM296 166h104v34H296z" fill="#123f77" opacity=".9"/>
      <g fill="url(#lc-vidrio)" opacity=".85">
        <rect x="26" y="172" width="44" height="24" rx="2"/>
        <rect x="76" y="172" width="42" height="24" rx="2"/>
        <rect x="302" y="172" width="42" height="24" rx="2"/>
        <rect x="350" y="172" width="44" height="24" rx="2"/>
      </g>

      <!-- techo de cuatro aguas -->
      <path d="M210 34l96 92H114z" fill="url(#lc-techo)"/>
      <g stroke="#8fc0ea" stroke-opacity=".45" stroke-width="1.4">
        <path d="M210 34v92M168 78l0 48M252 78l0 48M140 104h140M126 118h168"/>
      </g>
      <path d="M108 126h204v10H108z" fill="#f2f6fb"/>

      <!-- frente central -->
      <path d="M120 136h180v82H120z" fill="#eef3f9"/>
      <g fill="#cfdceb">
        <rect x="124" y="136" width="12" height="82"/>
        <rect x="176" y="136" width="11" height="82"/>
        <rect x="233" y="136" width="11" height="82"/>
        <rect x="284" y="136" width="12" height="82"/>
      </g>
      <rect x="140" y="142" width="140" height="44" rx="2" fill="url(#lc-vidrio)"/>
      <g stroke="#b9c8da" stroke-width="1.2" opacity=".7">
        <path d="M175 142v44M210 142v44M245 142v44M140 164h140"/>
      </g>
      <rect x="162" y="158" width="96" height="15" rx="3" fill="#123f77"/>
      <rect x="172" y="163" width="76" height="5" rx="2.5" fill="#5e9ede" opacity=".55"/>
      <rect x="186" y="186" width="48" height="32" fill="#f7f2e4"/>
      <g stroke="#b9c8da" stroke-width="1.3"><path d="M210 186v32M186 186v32M234 186v32"/></g>

      <!-- las dos palmeras -->
      <g>
        <path d="M132 218c2-30 3-58 2-82" stroke="#6d5a44" stroke-width="7"
              stroke-linecap="round" fill="none"/>
        <g fill="#3d8f72">
          <path d="M134 132c-22-16-42-14-54 2 20-6 38-2 54 6z"/>
          <path d="M134 132c20-18 42-18 56-2-21-6-40-2-56 8z"/>
          <path d="M134 132c-14-24-34-32-52-24 20 2 38 12 52 28z"/>
          <path d="M134 132c16-22 38-28 54-18-20 0-38 8-54 22z"/>
        </g>
      </g>
      <g>
        <path d="M292 218c-2-30-3-60-2-84" stroke="#6d5a44" stroke-width="7"
              stroke-linecap="round" fill="none"/>
        <g fill="#3d8f72">
          <path d="M290 130c-22-18-44-16-56 0 21-6 40-2 56 6z"/>
          <path d="M290 130c20-18 44-18 58-2-22-6-42-2-58 8z"/>
          <path d="M290 130c-14-24-34-34-52-26 20 2 38 14 52 30z"/>
          <path d="M290 130c16-24 38-30 56-20-21 0-40 8-56 24z"/>
        </g>
      </g>

      <!-- canteros y explanada -->
      <path d="M96 226c14-16 44-18 58-4-18 6-40 8-58 4z" fill="#2f7a5e"/>
      <path d="M268 222c14-14 44-12 58 4-18 4-40 2-58-4z" fill="#2f7a5e"/>
      <g fill="#e8c257" opacity=".9">
        <circle cx="112" cy="222" r="3"/><circle cx="126" cy="218" r="2.6"/>
        <circle cx="142" cy="220" r="2.6"/><circle cx="288" cy="218" r="2.6"/>
        <circle cx="304" cy="216" r="3"/><circle cx="318" cy="220" r="2.6"/>
      </g>
      <path d="M120 216h8v6h-8zM296 214h8v6h-8z" fill="#c7d2de" opacity=".7"/>

      <path d="M18 244c60-22 324-22 384 0" fill="none" stroke="#9ecbff"
            stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 254c72-14 228-14 300 0" fill="none" stroke="#9ecbff"
            stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

  function pantalla(modo, cfg) {
    const primeraVez = modo === 'crear';
    const bienvenida = modo === 'bienvenida';
    return `<div class="portada">
      <section class="portada-marca">
        <div class="pm-cima">
          ${marca}
          <p class="pm-eyebrow">Farmatodo · Recursos Humanos</p>
          <h1>Panel de Control de RRHH</h1>
          <p class="pm-bajada">Visitas a sucursales, FTE real, costo laboral y desarrollo del equipo${cfg && cfg.area ? ` · ${cfg.area}` : ''}.</p>
        </div>
        ${FOTO_LOCAL
          ? `<img class="pm-local" src="${FOTO_LOCAL}" alt="">`
          : local}
        <p class="pm-pie">Herramienta interna de trabajo. Los datos se guardan solo en esta computadora.</p>
        ${/* El cartel de «esto es la demostración» vivía adentro del panel, o sea
             detrás del candado: justo el lugar donde no se lo puede leer cuando
             uno no logra entrar. Y las dos portadas eran idénticas, así que
             quedarse afuera de la página publicada se confundía con quedarse
             afuera del panel de trabajo. */''}
        ${typeof PAGINA_DE_DEMOSTRACION !== 'undefined' && PAGINA_DE_DEMOSTRACION
          ? `<p class="pm-pie pm-demo"><strong>Ésta es la página de demostración.</strong>
             Las personas que trae están inventadas. Tu panel de trabajo es el que abrís
             desde el archivo, y tiene su propia clave: la de acá no lo abre, y la de allá
             no abre ésta.</p>`
          : ''}
      </section>

      <section class="portada-acceso">
        <div class="pa-caja">
          <p class="pa-hola">Bienvenido</p>
          <h2>${bienvenida ? 'Panel listo para trabajar' : (primeraVez ? 'Creá tu clave de acceso' : 'Ingresá tu clave')}</h2>
          <p class="pa-texto">${bienvenida
            ? 'Estás trabajando sin clave: el contenido se guarda sin cifrar en esta computadora.'
            : (primeraVez
              ? 'La clave cifra el contenido del panel en esta computadora. Elegí una que puedas recordar: no hay forma de recuperarla.'
              : 'Escribí la clave con la que protegiste el panel.')}</p>

          ${bienvenida ? `
            <button class="b pa-boton" data-entrar type="button">Entrar al panel</button>
            <button class="pa-link" data-poner-clave>Proteger con una clave</button>
          ` : ''}

          <form id="form-acceso" autocomplete="off" novalidate${bienvenida ? ' hidden' : ''}>
            <label class="campo"><span>Clave</span>
              <input type="password" id="clave1" autocomplete="current-password"
                     placeholder="${primeraVez ? 'Al menos 6 caracteres' : ''}"></label>
            ${primeraVez ? `<label class="campo"><span>Repetí la clave</span>
              <input type="password" id="clave2" autocomplete="new-password"></label>` : ''}
            <p class="pa-error" id="acceso-error" hidden></p>
            <button class="b pa-boton" type="submit">${primeraVez ? 'Crear clave y entrar' : 'Entrar'}</button>
          </form>

          ${bienvenida ? '' : primeraVez
            ? `<p class="pa-nota"><strong>Guardá la clave donde puedas recuperarla.</strong> El panel no puede restablecerla:
                 si se pierde, se pierden los datos. Exportá un respaldo cada tanto desde Configuración.</p>
               <button class="pa-link" data-sin-clave>Prefiero entrar sin clave</button>`
            : `<button class="pa-link" data-olvide>Olvidé la clave</button>`}
        </div>
      </section>
    </div>`;
  }

  function montar(html) {
    let cont = document.getElementById('acceso');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'acceso';
      document.body.appendChild(cont);
    }
    cont.innerHTML = html;
    return cont;
  }

  function mostrarError(msg) {
    const e = document.getElementById('acceso-error');
    if (!e) return;
    e.textContent = msg;
    e.hidden = false;
  }

  function limpiarError() {
    const e = document.getElementById('acceso-error');
    if (e) { e.textContent = ''; e.hidden = true; }
  }

  /**
   * Muestra la portada y resuelve con el cifrador cuando el usuario entra.
   * Resuelve con null cuando decide trabajar sin clave.
   */
  function pedirAcceso(cfg) {
    return new Promise(resolve => {
      const seg = leerSeguridad();

      if (!disponible()) {
        // Sin WebCrypto no se puede cifrar; se avisa en lugar de fingir que sí.
        montar(pantalla('crear', cfg));
        mostrarError('Este navegador no permite cifrar los datos. El panel va a funcionar sin clave.');
        document.getElementById('form-acceso').addEventListener('submit', ev => ev.preventDefault());
      } else {
        montar(pantalla(seg ? (seg.sinClave ? 'bienvenida' : 'abrir') : 'crear', cfg));
      }

      const cont = document.getElementById('acceso');
      const terminar = cif => { cont.remove(); document.body.classList.remove('bloqueado'); resolve(cif); };
      document.body.classList.add('bloqueado');

      cont.addEventListener('click', async ev => {
        if (ev.target.closest('[data-entrar]')) terminar(null);

        if (ev.target.closest('[data-poner-clave]')) {
          // Pasa a crear clave; el contenido en claro se cifra al abrir
          localStorage.removeItem(CLAVE_SEGURIDAD);
          montar(pantalla('crear', cfg));
          conectarFormulario(null, cont, terminar, cfg);
          return;
        }

        if (ev.target.closest('[data-sin-clave]')) {
          localStorage.setItem(CLAVE_SEGURIDAD, JSON.stringify({ v: 1, sinClave: true }));
          terminar(null);
        }
        if (ev.target.closest('[data-olvide]')) {
          const ok = confirmarEnPortada();
          ok.then(borrar => {
            if (!borrar) return;
            localStorage.removeItem(CLAVE_SEGURIDAD);
            localStorage.removeItem(CLAVE_ALMACEN);
            location.reload();
          });
        }
      });

      conectarFormulario(seg, cont, terminar, cfg);
    });
  }

  function conectarFormulario(seg, cont, terminar, cfg) {
      const form = document.getElementById('form-acceso');
      if (!form) return;
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const c1 = document.getElementById('clave1').value;
        const c2 = document.getElementById('clave2');
        const boton = form.querySelector('button[type="submit"]');
        boton.disabled = true;

        try {
          if (!seg || !seg.salt) {
            if (!c1) { mostrarError('Escribí una clave para proteger el panel.'); return; }
            if (c1.length < 6) { mostrarError('Usá al menos 6 caracteres.'); return; }
            if (c2 && c1 !== c2.value) { mostrarError('Las dos claves no coinciden.'); return; }
            terminar(await crearClave(c1));
          } else {
            if (!c1) { mostrarError('Escribí tu clave.'); return; }
            const cif = await abrirCon(c1);
            if (!cif) {
              /* «Clave incorrecta» a secas deja al coordinador probando de nuevo
                 sin saber que cada panel tiene la suya, ni que no hay
                 recuperación. Las dos cosas se dicen acá, que es donde está
                 parado. */
              mostrarError('Clave incorrecta. Ojo: cada panel tiene la suya — la del que abrís ' +
                'desde el archivo no abre el del link, y al revés. Si no te acordás de ésta no hay ' +
                'forma de recuperarla: la única salida es empezar de cero acá e importar un ' +
                'respaldo .json, si tenés uno exportado.');
              return;
            }
            terminar(cif);
          }
        } finally {
          boton.disabled = false;
        }
      });

      form.addEventListener('input', limpiarError);

      const primero = document.getElementById('clave1');
      if (primero) primero.focus();
  }

  /* Confirmación propia, porque el visor bloquea confirm() del navegador. */
  function confirmarEnPortada() {
    return new Promise(resolve => {
      const velo = document.createElement('div');
      velo.className = 'velo';
      velo.innerHTML = `<div class="dialogo">
        <h3>Empezar de cero</h3>
        <p>Sin la clave no hay forma de leer lo guardado. La única salida es borrar el contenido
           y volver a empezar, con una clave nueva. Si tenés un respaldo exportado, vas a poder importarlo después.</p>
        <div class="acciones">
          <button class="b sec" data-r="0">Cancelar</button>
          <button class="b peligro" data-r="1">Borrar y empezar de nuevo</button>
        </div>
      </div>`;
      velo.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-r]');
        if (btn) { velo.remove(); resolve(btn.dataset.r === '1'); }
        else if (ev.target === velo) { velo.remove(); resolve(false); }
      });
      document.body.appendChild(velo);
    });
  }

  /** ¿Ya eligió trabajar sin clave? */
  const sinClave = () => { const s = leerSeguridad(); return !!(s && s.sinClave); };

  return { pedirAcceso, sinClave, disponible };
})();
