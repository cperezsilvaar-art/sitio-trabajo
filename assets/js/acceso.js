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
        <p class="pm-pie">Herramienta interna de trabajo. Los datos se guardan solo en esta computadora.</p>
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
            if (!cif) { mostrarError('Clave incorrecta.'); return; }
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
