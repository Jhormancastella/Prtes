import { supabase } from './supabase.js';
import { mostrarPantalla } from './router.js';
import { getPerfil } from './auth.js';
import { cargarLobby } from './lobby.js';
import { obtenerNuevosDesbloqueos } from './avatares.js';
import { recalcularStatsDesdeJuegos } from './stats.js';

const DELAY_REINICIO = 4;
const EMPTY_BOARD = () => ['','','','','','','','',''];

// Estado del juego
let salaActual = null;
let miSimbolo = null;
let turnoActual = 'X';
let juegoTerminado = false;
let dosJugadores = false;
let tableroLocal = EMPTY_BOARD();
let reinicioTimer = null;
let canalJuego = null;
let miSessionId = null;
let statsGuardadasEnPartida = false; // evita doble conteo por partida

export function initGame() {
    miSessionId = getPerfil()?.id || localStorage.getItem('tres_session') || Math.random().toString(36).slice(2);
    localStorage.setItem('tres_session', miSessionId);

    document.getElementById('btnVolver').addEventListener('click', salirSala);
    document.getElementById('reiniciar').addEventListener('click', () => reiniciarPartida(false));

    // Limpiar sala si el usuario cierra la pestaña o navega fuera
    window.addEventListener('beforeunload', () => {
        if (salaActual && miSimbolo) {
            const campo = miSimbolo === 'X' ? 'x_player_id' : 'o_player_id';
            // sendBeacon es la única forma fiable en beforeunload
            // Como usamos Supabase REST, construimos la URL manualmente
            const url = `${supabase.supabaseUrl}/rest/v1/juegos?id=eq.${salaActual}`;
            const body = JSON.stringify({ [campo]: null });
            navigator.sendBeacon(url + '&' + new URLSearchParams({ [campo]: 'null' }));
            // Fallback síncrono (puede no ejecutarse en todos los browsers)
            supabase.from('juegos').update({ [campo]: null })
                .eq('id', salaActual)
                .eq(campo, miSessionId);
        }
    });

    const tableroDiv = document.getElementById('tablero');
    tableroDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const celda = document.createElement('div');
        celda.classList.add('celda');
        celda.dataset.index = i;
        celda.setAttribute('role', 'gridcell');
        celda.setAttribute('tabindex', '0');
        celda.addEventListener('click', () => hacerMovimiento(i));
        celda.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') hacerMovimiento(i); });
        tableroDiv.appendChild(celda);
    }
}

export async function entrarSala(id) {
    // Asegurar que miSessionId usa el ID real del perfil (puede haber cambiado tras login)
    const perfilActual = getPerfil();
    if (perfilActual?.id) {
        miSessionId = perfilActual.id;
        localStorage.setItem('tres_session', miSessionId);
    }

    salaActual = id;
    miSimbolo = null;
    dosJugadores = false;
    juegoTerminado = false;
    tableroLocal = EMPTY_BOARD();
    statsGuardadasEnPartida = false;

    document.getElementById('salaLabel').textContent = `Sala ${id}`;
    document.getElementById('logsPanel').innerHTML = `<div class="log-entry">Conectando a sala ${id}...</div>`;
    actualizarVista();
    mostrarPantalla('screenJuego');
    await iniciarJuego();
}

function addLog(msg, tipo = 'info') {
    const panel = document.getElementById('logsPanel');
    if (!panel) return;
    const d = document.createElement('div');
    d.classList.add('log-entry');
    if (tipo === 'error') d.classList.add('log-error');
    if (tipo === 'success') d.classList.add('log-success');
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    panel.appendChild(d);
    panel.scrollTop = panel.scrollHeight;
}

function actualizarVista(celdasGanadoras = []) {
    const celdas = document.querySelectorAll('.celda');
    for (let i = 0; i < 9; i++) {
        celdas[i].textContent = tableroLocal[i];
        celdas[i].classList.remove('x', 'o', 'ganadora');
        celdas[i].setAttribute('aria-label', tableroLocal[i] || `Celda ${i + 1}`);
        if (tableroLocal[i] === 'X') celdas[i].classList.add('x');
        if (tableroLocal[i] === 'O') celdas[i].classList.add('o');
        if (celdasGanadoras.includes(i)) celdas[i].classList.add('ganadora');
    }
}

function verificarGanador(board) {
    const lineas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lineas) {
        if (board[a] && board[a] === board[b] && board[a] === board[c])
            return { ganador: board[a], celdas: [a,b,c] };
    }
    if (board.every(c => c !== '')) return { ganador: 'empate', celdas: [] };
    return null;
}

function actualizarMarcador(scores) {
    if (!scores) return;
    document.getElementById('puntosX').textContent = scores.x || 0;
    document.getElementById('puntosO').textContent = scores.o || 0;
    document.getElementById('puntosEmpate').textContent = scores.empate || 0;
}

function actualizarEstado(ganador = null) {
    const span = document.getElementById('estado');
    if (!span) return;
    if (ganador === 'empate') span.textContent = '🤝 Empate';
    else if (ganador) span.textContent = `🎉 Ganó ${ganador}`;
    else if (!dosJugadores) span.textContent = miSimbolo ? `Eres ${miSimbolo} — Esperando rival...` : 'Espectador';
    else if (!miSimbolo) span.textContent = 'Modo espectador';
    else if (miSimbolo === turnoActual) span.textContent = `Tu turno (${miSimbolo})`;
    else span.textContent = `Turno de ${turnoActual}`;
}

function iniciarCuentaRegresiva(ejecutar) {
    cancelarCuentaRegresiva();
    let s = DELAY_REINICIO;
    const div = document.getElementById('reinicioAuto');
    if (!div) return;
    div.textContent = `Reiniciando en ${s}s...`;
    reinicioTimer = setInterval(() => {
        s--;
        if (s <= 0) {
            clearInterval(reinicioTimer);
            reinicioTimer = null;
            div.textContent = '';
            if (ejecutar) reiniciarPartida(true);
        } else {
            div.textContent = `Reiniciando en ${s}s...`;
        }
    }, 1000);
}

function cancelarCuentaRegresiva() {
    if (reinicioTimer) { clearInterval(reinicioTimer); reinicioTimer = null; }
    const div = document.getElementById('reinicioAuto');
    if (div) div.textContent = '';
}

async function asignarSimbolo() {
    const { data: g } = await supabase
        .from('juegos')
        .select('x_player_id, o_player_id')
        .eq('id', salaActual)
        .single();
    if (!g) return;

    // Reconexión — ya estás en la sala
    if (g.x_player_id === miSessionId) { miSimbolo = 'X'; addLog('Reconectado como X', 'success'); return; }
    if (g.o_player_id === miSessionId) { miSimbolo = 'O'; addLog('Reconectado como O', 'success'); return; }

    // Verificar si los IDs actuales son válidos (existen en perfiles)
    // Si no existen, son fantasmas — limpiarlos para liberar el slot
    const idsOcupados = [g.x_player_id, g.o_player_id].filter(Boolean);
    if (idsOcupados.length > 0) {
        const { data: perfilesExistentes } = await supabase
            .from('perfiles')
            .select('id')
            .in('id', idsOcupados);
        const existentes = new Set((perfilesExistentes || []).map(p => p.id));

        const limpiar = {};
        if (g.x_player_id && !existentes.has(g.x_player_id)) limpiar.x_player_id = null;
        if (g.o_player_id && !existentes.has(g.o_player_id)) limpiar.o_player_id = null;

        if (Object.keys(limpiar).length > 0) {
            await supabase.from('juegos').update(limpiar).eq('id', salaActual);
            addLog('Slots fantasma liberados', 'info');
            // Recargar estado limpio
            const { data: gLimpio } = await supabase
                .from('juegos').select('x_player_id, o_player_id').eq('id', salaActual).single();
            if (gLimpio) {
                g.x_player_id = gLimpio.x_player_id;
                g.o_player_id = gLimpio.o_player_id;
            }
        }
    }

    // Sala llena con jugadores reales — espectador
    if (g.x_player_id && g.o_player_id) {
        miSimbolo = null;
        addLog('Sala llena. Modo espectador.', 'info');
        return;
    }

    // Intentar tomar X
    const { data: rx, error: exX } = await supabase
        .from('juegos')
        .update({ x_player_id: miSessionId })
        .eq('id', salaActual)
        .is('x_player_id', null)
        .select('id');
    if (!exX && rx?.length) { miSimbolo = 'X'; addLog('Eres X', 'success'); return; }

    // Intentar tomar O
    const { data: ro, error: exO } = await supabase
        .from('juegos')
        .update({ o_player_id: miSessionId })
        .eq('id', salaActual)
        .is('o_player_id', null)
        .select('id');
    if (!exO && ro?.length) { miSimbolo = 'O'; addLog('Eres O', 'success'); return; }

    miSimbolo = null;
    addLog('Sala llena. Espectador.', 'info');
}

async function hacerMovimiento(indice) {
    if (!dosJugadores) { addLog('Esperando rival...', 'error'); return; }
    if (juegoTerminado) return;
    if (!miSimbolo) return;
    if (miSimbolo !== turnoActual) { addLog('No es tu turno', 'error'); return; }
    if (tableroLocal[indice] !== '') { addLog('Casilla ocupada', 'error'); return; }

    tableroLocal[indice] = miSimbolo;
    actualizarVista();

    const resultado = verificarGanador(tableroLocal);
    const ganador = resultado?.ganador || null;
    const siguienteTurno = ganador ? null : (turnoActual === 'X' ? 'O' : 'X');

    if (ganador) {
        juegoTerminado = true;
        actualizarVista(resultado.celdas);
    } else {
        turnoActual = siguienteTurno;
    }
    actualizarEstado(ganador);

    let scoreUpdate = {};
    if (ganador) {
        const { data: gd } = await supabase.from('juegos').select('scores').eq('id', salaActual).single();
        const scores = gd?.scores || { x: 0, o: 0, empate: 0 };
        if (ganador === 'X') scores.x = (scores.x || 0) + 1;
        else if (ganador === 'O') scores.o = (scores.o || 0) + 1;
        else scores.empate = (scores.empate || 0) + 1;
        scoreUpdate = { scores };
        actualizarMarcador(scores);
    }

    await supabase.from('juegos').update({
        board: tableroLocal,
        current_turn: siguienteTurno,
        winner: ganador,
        is_active: !ganador,
        ...scoreUpdate
    }).eq('id', salaActual);

    // Cada jugador actualiza sus propias stats al terminar
    // El que hizo el movimiento lo hace aquí directamente
    if (ganador) {
        await actualizarRankingPerfil(ganador);
        iniciarCuentaRegresiva(miSimbolo === 'X');
    }
}

async function actualizarRankingPerfil(ganador) {
    // Guard: solo una vez por partida por jugador
    if (statsGuardadasEnPartida) return;
    statsGuardadasEnPartida = true;

    const perfil = getPerfil();
    if (!perfil || !miSimbolo) return;

    const victoriasAntes = perfil.victorias || 0;

    // Recalcular sumando todos los scores de todas las salas donde participó
    // Esto es la fuente de verdad — no depende del estado local
    const stats = await recalcularStatsDesdeJuegos(perfil.id);

    if (!stats) {
        addLog('Error recalculando stats', 'error');
        statsGuardadasEnPartida = false;
        return;
    }

    // Sincronizar objeto local
    perfil.victorias = stats.victorias;
    perfil.derrotas  = stats.derrotas;
    perfil.empates   = stats.empates;
    perfil.partidas  = stats.partidas;

    addLog(`Stats: V${stats.victorias} E${stats.empates} D${stats.derrotas}`, 'success');

    // Notificar desbloqueos de avatares
    if (stats.victorias > victoriasAntes) {
        const nuevos = obtenerNuevosDesbloqueos(victoriasAntes, stats.victorias);
        nuevos.forEach(av => mostrarNotificacionDesbloqueo(av));
    }
}

async function reiniciarPartida(esAuto = false) {
    cancelarCuentaRegresiva();
    statsGuardadasEnPartida = false; // nueva partida, nuevo conteo
    addLog(esAuto ? 'Auto-reinicio...' : 'Reiniciando...', 'info');
    await supabase.from('juegos').update({
        board: EMPTY_BOARD(),
        current_turn: 'X',
        winner: null,
        is_active: true
    }).eq('id', salaActual);

    tableroLocal = EMPTY_BOARD();
    turnoActual = 'X';
    juegoTerminado = false;
    actualizarVista();
    actualizarEstado();
}

async function iniciarJuego() {
    await asignarSimbolo();

    const { data: g } = await supabase.from('juegos').select('*').eq('id', salaActual).single();
    if (g) {
        tableroLocal = g.board || EMPTY_BOARD();
        turnoActual = g.current_turn || 'X';
        juegoTerminado = !g.is_active;
        dosJugadores = !!(g.x_player_id && g.o_player_id);
        actualizarVista();
        actualizarEstado(g.winner);
        actualizarMarcador(g.scores);
        addLog(`Sala ${salaActual} lista`, 'success');
        if (juegoTerminado) iniciarCuentaRegresiva(miSimbolo === 'X');
    }

    if (canalJuego) { await supabase.removeChannel(canalJuego); canalJuego = null; }

    canalJuego = supabase
        .channel(`sala-${salaActual}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'juegos',
            filter: `id=eq.${salaActual}`
        }, async (payload) => {
            const ns = payload.new;
            const eraTerminado = juegoTerminado;
            tableroLocal = ns.board;
            turnoActual = ns.current_turn;
            juegoTerminado = !ns.is_active;
            dosJugadores = !!(ns.x_player_id && ns.o_player_id);

            let celdasG = [];
            if (ns.winner && ns.winner !== 'empate') {
                const r = verificarGanador(tableroLocal);
                if (r) celdasG = r.celdas;
            }

            actualizarVista(celdasG);
            actualizarEstado(ns.winner);
            actualizarMarcador(ns.scores);

            // Cuando la partida termina, cada jugador guarda sus propias stats.
            // El flag statsGuardadasEnPartida evita doble conteo si ambos
            // llaman a esta función (quien hizo el movimiento ya la llamó antes).
            if (!eraTerminado && juegoTerminado && ns.winner && miSimbolo) {
                await actualizarRankingPerfil(ns.winner);
                iniciarCuentaRegresiva(miSimbolo === 'X');
            }
            if (eraTerminado && !juegoTerminado) cancelarCuentaRegresiva();
        })
        .subscribe(s => addLog(`Realtime: ${s}`, s === 'SUBSCRIBED' ? 'success' : 'info'));
}

async function salirSala() {
    cancelarCuentaRegresiva();
    if (canalJuego) { await supabase.removeChannel(canalJuego); canalJuego = null; }

    if (miSimbolo === 'X') {
        await supabase.from('juegos').update({ x_player_id: null }).eq('id', salaActual).eq('x_player_id', miSessionId);
    } else if (miSimbolo === 'O') {
        await supabase.from('juegos').update({ o_player_id: null }).eq('id', salaActual).eq('o_player_id', miSessionId);
    }

    const { data: g } = await supabase.from('juegos')
        .select('x_player_id, o_player_id')
        .eq('id', salaActual).single();

    if (g && !g.x_player_id && !g.o_player_id) {
        await supabase.from('juegos').update({
            board: EMPTY_BOARD(),
            current_turn: 'X',
            winner: null,
            is_active: true
        }).eq('id', salaActual);
    }

    salaActual = null;
    miSimbolo = null;
    mostrarPantalla('screenLobby');
    cargarLobby();
}

function mostrarNotificacionDesbloqueo(av) {
    // Eliminar notificación previa si existe
    document.getElementById('notif-desbloqueo')?.remove();

    const notif = document.createElement('div');
    notif.id = 'notif-desbloqueo';
    notif.className = 'notif-desbloqueo';
    notif.innerHTML = `
        <img src="${av.url}" alt="${av.label}" class="notif-avatar-img">
        <div class="notif-texto">
            <div class="notif-titulo">🔓 ¡Avatar desbloqueado!</div>
            <div class="notif-nombre">${av.label}</div>
            <div class="notif-desc">${av.descripcion}</div>
        </div>
    `;
    document.body.appendChild(notif);

    // Animar entrada
    requestAnimationFrame(() => notif.classList.add('notif-visible'));

    // Auto-cerrar a los 4 segundos
    setTimeout(() => {
        notif.classList.remove('notif-visible');
        setTimeout(() => notif.remove(), 400);
    }, 4000);
}
