import { db } from './firebase.js';
import {
    doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { mostrarPantalla } from './router.js';
import { getPerfil } from './auth.js';
import { cargarLobby } from './lobby.js';
import { obtenerNuevosDesbloqueos } from './avatares.js';
import { recalcularStatsDesdeJuegos } from './stats.js';
import { elegirDificultad, moverIA } from './ia.js';

const DELAY_REINICIO = 4;
const ESPERA_IA_MS   = 3000;
const TIEMPO_TURNO   = 15;
const EMPTY_BOARD    = () => ['','','','','','','','',''];

// Estado del juego
let salaActual   = null;   // número de sala (1-6)
let salaDocId    = null;   // ID del documento en Firestore
let miSimbolo    = null;
let turnoActual  = 'X';
let juegoTerminado = false;
let dosJugadores   = false;
let tableroLocal   = EMPTY_BOARD();
let reinicioTimer  = null;
let unsubJuego     = null;
let miSessionId    = null;
let statsGuardadasEnPartida = false;

// Estado IA
let modoIA   = false;
let simboloIA = null;
let nivelIA   = null;
let timerIA   = null;

// Temporizador de turno
let turnoTimerInterval  = null;
let turnoTimerSegundos  = 0;

// ── Helpers Firestore ─────────────────────────────────────────────────────────

async function getSalaDoc(salaId) {
    const snap = await getDocs(query(collection(db, 'juegos'), where('id', '==', salaId)));
    if (snap.empty) return null;
    return snap.docs[0];
}

async function updateSala(data) {
    if (!salaDocId) return;
    await updateDoc(doc(db, 'juegos', salaDocId), data);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initGame() {
    miSessionId = getPerfil()?.id || localStorage.getItem('tres_session') || Math.random().toString(36).slice(2);
    localStorage.setItem('tres_session', miSessionId);

    document.getElementById('btnVolver').addEventListener('click', salirSala);
    document.getElementById('reiniciar').addEventListener('click', () => reiniciarPartida(false));

    const tableroDiv = document.getElementById('tablero');
    tableroDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const celda = document.createElement('div');
        celda.classList.add('celda');
        celda.dataset.index = i;
        celda.setAttribute('role', 'gridcell');
        celda.setAttribute('tabindex', '0');
        celda.addEventListener('click', () => hacerMovimiento(i));
        celda.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') hacerMovimiento(i); });
        tableroDiv.appendChild(celda);
    }
}

export async function entrarSala(id) {
    const perfilActual = getPerfil();
    if (perfilActual?.id) { miSessionId = perfilActual.id; localStorage.setItem('tres_session', miSessionId); }

    salaActual = id;
    miSimbolo  = null;
    dosJugadores = false;
    juegoTerminado = false;
    tableroLocal = EMPTY_BOARD();
    statsGuardadasEnPartida = false;
    detenerIA();

    document.getElementById('salaLabel').textContent = `Sala ${id}`;
    document.getElementById('logsPanel').innerHTML = `<div class="log-entry">Conectando a sala ${id}...</div>`;
    actualizarVista();
    mostrarPantalla('screenJuego');
    await iniciarJuego();
}

// ── Logs ──────────────────────────────────────────────────────────────────────

function addLog(msg, tipo = 'info') {
    const panel = document.getElementById('logsPanel');
    if (!panel) return;
    const d = document.createElement('div');
    d.classList.add('log-entry');
    if (tipo === 'error')   d.classList.add('log-error');
    if (tipo === 'success') d.classList.add('log-success');
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    panel.appendChild(d);
    panel.scrollTop = panel.scrollHeight;
}

// ── Vista ─────────────────────────────────────────────────────────────────────

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
    document.getElementById('puntosX').textContent      = scores.x      || 0;
    document.getElementById('puntosO').textContent      = scores.o      || 0;
    document.getElementById('puntosEmpate').textContent = scores.empate || 0;
}

function actualizarEstado(ganador = null) {
    const span = document.getElementById('estado');
    if (!span) return;
    if (ganador === 'empate')  span.textContent = '🤝 Empate';
    else if (ganador)          span.textContent = modoIA && ganador === simboloIA ? '🤖 Ganó la IA' : `🎉 Ganó ${ganador}`;
    else if (modoIA)           span.textContent = turnoActual === miSimbolo ? `Tu turno (${miSimbolo}) — vs 🤖` : '🤖 IA pensando...';
    else if (!dosJugadores)    span.textContent = miSimbolo ? `Eres ${miSimbolo} — Esperando rival...` : 'Espectador';
    else if (!miSimbolo)       span.textContent = 'Modo espectador';
    else if (miSimbolo === turnoActual) span.textContent = `Tu turno (${miSimbolo})`;
    else                       span.textContent = `Turno de ${turnoActual}`;
}

// ── Cuenta regresiva ──────────────────────────────────────────────────────────

function iniciarCuentaRegresiva(ejecutar) {
    cancelarCuentaRegresiva();
    let s = DELAY_REINICIO;
    const div = document.getElementById('reinicioAuto');
    if (!div) return;
    div.textContent = `Reiniciando en ${s}s...`;
    reinicioTimer = setInterval(() => {
        s--;
        if (s <= 0) {
            clearInterval(reinicioTimer); reinicioTimer = null;
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

// ── Temporizador de turno ─────────────────────────────────────────────────────

function iniciarTurnoTimer() {
    detenerTurnoTimer();
    if (juegoTerminado) return;
    if (!dosJugadores && !modoIA) return;
    turnoTimerSegundos = TIEMPO_TURNO;
    _renderTimer(TIEMPO_TURNO);
    const wrap = document.getElementById('turnoTimerWrap');
    if (wrap) wrap.style.display = 'flex';
    turnoTimerInterval = setInterval(() => {
        turnoTimerSegundos--;
        _renderTimer(turnoTimerSegundos);
        if (turnoTimerSegundos <= 0) { detenerTurnoTimer(); _tiempoAgotado(); }
    }, 1000);
}

function detenerTurnoTimer() {
    if (turnoTimerInterval) { clearInterval(turnoTimerInterval); turnoTimerInterval = null; }
    const wrap = document.getElementById('turnoTimerWrap');
    if (wrap) wrap.style.display = 'none';
}

function _renderTimer(segundos) {
    const num = document.getElementById('turnoTimerNum');
    const arc = document.getElementById('turnoTimerArc');
    if (!num || !arc) return;
    num.textContent = segundos;
    const pct   = (segundos / TIEMPO_TURNO) * 100;
    arc.setAttribute('stroke-dasharray', `${pct} 100`);
    const color = segundos > 8 ? '#4ade80' : segundos > 4 ? '#facc15' : '#f87171';
    arc.style.stroke = color;
    num.style.color  = color;
}

function _tiempoAgotado() {
    if (juegoTerminado) return;
    if (modoIA) { turnoDeIA(); return; }
    if (turnoActual === miSimbolo && dosJugadores) {
        const vacias = tableroLocal.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
        if (vacias.length) {
            const idx = vacias[Math.floor(Math.random() * vacias.length)];
            addLog('⏱ Tiempo agotado — movimiento automático', 'error');
            hacerMovimiento(idx);
        }
    }
}

// ── Asignar símbolo ───────────────────────────────────────────────────────────

async function asignarSimbolo() {
    const salaDoc = await getSalaDoc(salaActual);
    if (!salaDoc) return;
    salaDocId = salaDoc.id;
    const g = salaDoc.data();

    if (g.x_player_id === miSessionId) { miSimbolo = 'X'; addLog('Reconectado como X', 'success'); return; }
    if (g.o_player_id === miSessionId) { miSimbolo = 'O'; addLog('Reconectado como O', 'success'); return; }

    // Verificar fantasmas
    const idsOcupados = [g.x_player_id, g.o_player_id].filter(Boolean);
    const existentes  = new Set();
    await Promise.all(idsOcupados.map(async id => {
        const p = await getDoc(doc(db, 'perfiles', id));
        if (p.exists()) existentes.add(id);
    }));

    const limpiar = {};
    if (g.x_player_id && !existentes.has(g.x_player_id)) limpiar.x_player_id = null;
    if (g.o_player_id && !existentes.has(g.o_player_id)) limpiar.o_player_id = null;
    if (Object.keys(limpiar).length) {
        await updateDoc(doc(db, 'juegos', salaDocId), limpiar);
        addLog('Slots fantasma liberados', 'info');
        // Recargar
        const fresh = await getDoc(doc(db, 'juegos', salaDocId));
        Object.assign(g, fresh.data());
    }

    if (g.x_player_id && g.o_player_id) { miSimbolo = null; addLog('Sala llena. Modo espectador.', 'info'); return; }

    // Intentar tomar X
    if (!g.x_player_id) {
        await updateDoc(doc(db, 'juegos', salaDocId), { x_player_id: miSessionId });
        const check = await getDoc(doc(db, 'juegos', salaDocId));
        if (check.data().x_player_id === miSessionId) { miSimbolo = 'X'; addLog('Eres X', 'success'); return; }
    }
    // Intentar tomar O
    if (!g.o_player_id) {
        await updateDoc(doc(db, 'juegos', salaDocId), { o_player_id: miSessionId });
        const check = await getDoc(doc(db, 'juegos', salaDocId));
        if (check.data().o_player_id === miSessionId) { miSimbolo = 'O'; addLog('Eres O', 'success'); return; }
    }

    miSimbolo = null;
    addLog('Sala llena. Espectador.', 'info');
}

// ── Movimiento ────────────────────────────────────────────────────────────────

async function hacerMovimiento(indice) {
    if (!modoIA && !dosJugadores) { addLog('Esperando rival...', 'error'); return; }
    if (juegoTerminado) return;
    if (!miSimbolo) return;
    if (miSimbolo !== turnoActual) { addLog('No es tu turno', 'error'); return; }
    if (tableroLocal[indice] !== '') { addLog('Casilla ocupada', 'error'); return; }

    tableroLocal[indice] = miSimbolo;
    actualizarVista();

    const resultado = verificarGanador(tableroLocal);
    const ganador   = resultado?.ganador || null;
    const siguienteTurno = ganador ? null : (turnoActual === 'X' ? 'O' : 'X');

    if (ganador) { juegoTerminado = true; actualizarVista(resultado.celdas); }
    else         { turnoActual = siguienteTurno; }
    actualizarEstado(ganador);

    if (modoIA) {
        if (ganador) {
            const div = document.getElementById('reinicioAuto');
            if (div) div.textContent = 'Práctica — no suma al ranking';
            setTimeout(() => reiniciarPartidaIA(), 2500);
        } else {
            setTimeout(() => turnoDeIA(), 600);
        }
        return;
    }

    // Partida real — actualizar Firestore
    let scoreUpdate = {};
    if (ganador) {
        const salaSnap = await getDoc(doc(db, 'juegos', salaDocId));
        const scores   = salaSnap.data()?.scores || { x: 0, o: 0, empate: 0 };
        if (ganador === 'X')      scores.x      = (scores.x      || 0) + 1;
        else if (ganador === 'O') scores.o      = (scores.o      || 0) + 1;
        else                      scores.empate = (scores.empate || 0) + 1;
        scoreUpdate = { scores };
        actualizarMarcador(scores);
    }

    await updateDoc(doc(db, 'juegos', salaDocId), {
        board: tableroLocal,
        current_turn: siguienteTurno,
        winner: ganador,
        is_active: !ganador,
        ...scoreUpdate
    });

    if (ganador) {
        await actualizarRankingPerfil(ganador);
        iniciarCuentaRegresiva(miSimbolo === 'X');
        detenerTurnoTimer();
    } else {
        iniciarTurnoTimer();
    }
}

// ── Ranking ───────────────────────────────────────────────────────────────────

async function actualizarRankingPerfil(ganador) {
    if (statsGuardadasEnPartida) return;
    statsGuardadasEnPartida = true;
    const perfil = getPerfil();
    if (!perfil || !miSimbolo) return;
    const victoriasAntes = perfil.victorias || 0;
    const stats = await recalcularStatsDesdeJuegos(perfil.id);
    if (!stats) { statsGuardadasEnPartida = false; return; }
    perfil.victorias = stats.victorias;
    perfil.derrotas  = stats.derrotas;
    perfil.empates   = stats.empates;
    perfil.partidas  = stats.partidas;
    addLog(`Stats: V${stats.victorias} E${stats.empates} D${stats.derrotas}`, 'success');
    if (stats.victorias > victoriasAntes) {
        const nuevos = obtenerNuevosDesbloqueos(victoriasAntes, stats.victorias);
        nuevos.forEach(av => mostrarNotificacionDesbloqueo(av));
    }
}

// ── Reinicio ──────────────────────────────────────────────────────────────────

async function reiniciarPartida(esAuto = false) {
    cancelarCuentaRegresiva();
    statsGuardadasEnPartida = false;
    addLog(esAuto ? 'Auto-reinicio...' : 'Reiniciando...', 'info');
    await updateDoc(doc(db, 'juegos', salaDocId), {
        board: EMPTY_BOARD(), current_turn: 'X', winner: null, is_active: true
    });
    tableroLocal = EMPTY_BOARD();
    turnoActual  = 'X';
    juegoTerminado = false;
    actualizarVista();
    actualizarEstado();
}

// ── IA ────────────────────────────────────────────────────────────────────────

function activarIA() {
    if (modoIA || dosJugadores || !miSimbolo) return;
    simboloIA = miSimbolo === 'X' ? 'O' : 'X';
    nivelIA   = elegirDificultad();
    modoIA    = true;
    tableroLocal = EMPTY_BOARD();
    turnoActual  = 'X';
    juegoTerminado = false;
    actualizarVista();
    actualizarEstado();
    addLog(`🤖 IA activada — nivel: ${nivelIA} (práctica, no suma al ranking)`, 'info');
    iniciarTurnoTimer();
    if (simboloIA === 'X') setTimeout(() => turnoDeIA(), 800);
}

function detenerIA() {
    modoIA = false; simboloIA = null; nivelIA = null;
    if (timerIA) { clearTimeout(timerIA); timerIA = null; }
    detenerTurnoTimer();
    const div = document.getElementById('reinicioAuto');
    if (div) div.textContent = '';
}

function turnoDeIA() {
    if (!modoIA || juegoTerminado) return;
    if (turnoActual !== simboloIA) return;
    const indice = moverIA([...tableroLocal], simboloIA, nivelIA);
    if (indice === -1) return;
    tableroLocal[indice] = simboloIA;
    actualizarVista();
    const resultado = verificarGanador(tableroLocal);
    const ganador   = resultado?.ganador || null;
    if (ganador) {
        juegoTerminado = true;
        detenerTurnoTimer();
        actualizarVista(resultado.celdas);
        actualizarEstado(ganador);
        const div = document.getElementById('reinicioAuto');
        if (div) div.textContent = 'Práctica — no suma al ranking';
        setTimeout(() => reiniciarPartidaIA(), 2500);
    } else {
        turnoActual = miSimbolo;
        actualizarEstado();
        iniciarTurnoTimer();
    }
}

function reiniciarPartidaIA() {
    if (!modoIA) return;
    tableroLocal = EMPTY_BOARD();
    turnoActual  = 'X';
    juegoTerminado = false;
    actualizarVista();
    actualizarEstado();
    const div = document.getElementById('reinicioAuto');
    if (div) div.textContent = '';
    iniciarTurnoTimer();
    if (simboloIA === 'X') setTimeout(() => turnoDeIA(), 800);
}

// ── Iniciar juego ─────────────────────────────────────────────────────────────

async function iniciarJuego() {
    await asignarSimbolo();

    const salaSnap = await getDoc(doc(db, 'juegos', salaDocId));
    if (salaSnap.exists()) {
        const g = salaSnap.data();
        tableroLocal   = g.board        || EMPTY_BOARD();
        turnoActual    = g.current_turn || 'X';
        juegoTerminado = !g.is_active;
        dosJugadores   = !!(g.x_player_id && g.o_player_id);
        actualizarVista();
        actualizarEstado(g.winner);
        actualizarMarcador(g.scores);
        addLog(`Sala ${salaActual} lista`, 'success');
        if (juegoTerminado) iniciarCuentaRegresiva(miSimbolo === 'X');
        if (!juegoTerminado && dosJugadores) iniciarTurnoTimer();
    }

    if (miSimbolo && !dosJugadores) {
        timerIA = setTimeout(() => activarIA(), ESPERA_IA_MS);
    }

    if (unsubJuego) { unsubJuego(); unsubJuego = null; }

    unsubJuego = onSnapshot(doc(db, 'juegos', salaDocId), async snap => {
        if (!snap.exists()) return;
        const ns = snap.data();
        const eraTerminado = juegoTerminado;
        const eraModoIA    = modoIA;

        tableroLocal   = ns.board;
        turnoActual    = ns.current_turn;
        juegoTerminado = !ns.is_active;
        const nuevosDosJugadores = !!(ns.x_player_id && ns.o_player_id);

        if (!dosJugadores && nuevosDosJugadores && modoIA) {
            detenerIA();
            tableroLocal = EMPTY_BOARD();
            turnoActual  = 'X';
            juegoTerminado = false;
            addLog('¡Rival conectado! Empezando partida real 🎮', 'success');
        }

        dosJugadores = nuevosDosJugadores;
        if (dosJugadores && timerIA) { clearTimeout(timerIA); timerIA = null; }

        let celdasG = [];
        if (ns.winner && ns.winner !== 'empate') {
            const r = verificarGanador(tableroLocal);
            if (r) celdasG = r.celdas;
        }

        actualizarVista(celdasG);
        actualizarEstado(ns.winner);
        actualizarMarcador(ns.scores);

        if (!eraTerminado && juegoTerminado && ns.winner && miSimbolo && !eraModoIA) {
            await actualizarRankingPerfil(ns.winner);
            iniciarCuentaRegresiva(miSimbolo === 'X');
        }
        if (eraTerminado && !juegoTerminado) cancelarCuentaRegresiva();
        if (!juegoTerminado && dosJugadores) iniciarTurnoTimer();
        if (juegoTerminado) detenerTurnoTimer();
    });
}

// ── Salir ─────────────────────────────────────────────────────────────────────

async function salirSala() {
    cancelarCuentaRegresiva();
    detenerIA();
    if (timerIA) { clearTimeout(timerIA); timerIA = null; }
    if (unsubJuego) { unsubJuego(); unsubJuego = null; }

    if (salaDocId) {
        if (miSimbolo === 'X') {
            await updateDoc(doc(db, 'juegos', salaDocId), { x_player_id: null });
        } else if (miSimbolo === 'O') {
            await updateDoc(doc(db, 'juegos', salaDocId), { o_player_id: null });
        }

        const salaSnap = await getDoc(doc(db, 'juegos', salaDocId));
        const g = salaSnap.data();
        if (g && !g.x_player_id && !g.o_player_id) {
            await updateDoc(doc(db, 'juegos', salaDocId), {
                board: EMPTY_BOARD(), current_turn: 'X', winner: null, is_active: true
            });
        }
    }

    salaActual = null; salaDocId = null; miSimbolo = null;
    mostrarPantalla('screenLobby');
    cargarLobby();
}

// ── Notificación desbloqueo ───────────────────────────────────────────────────

function mostrarNotificacionDesbloqueo(av) {
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
    requestAnimationFrame(() => notif.classList.add('notif-visible'));
    setTimeout(() => {
        notif.classList.remove('notif-visible');
        setTimeout(() => notif.remove(), 400);
    }, 4000);
}
