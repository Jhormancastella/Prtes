import { supabase } from './supabase.js';
import { mostrarPantalla } from './router.js';
import { getPerfil } from './auth.js';
import { cargarLobby } from './lobby.js';

const DELAY_REINICIO = 4;
let salaActual = null;
let miSimbolo = null;
let turnoActual = 'X';
let juegoTerminado = false;
let dosJugadores = false;
let tableroLocal = ["","","","","","","","",""];
let reinicioTimer = null;
let canalJuego = null;
let miSessionId = null;

export function initGame() {
    miSessionId = getPerfil()?.id || localStorage.getItem('tres_session') || (Math.random().toString(36).slice(2));
    localStorage.setItem('tres_session', miSessionId);

    document.getElementById('btnVolver').addEventListener('click', salirSala);
    document.getElementById('reiniciar').addEventListener('click', () => reiniciarPartida(false));

    const tableroDiv = document.getElementById('tablero');
    tableroDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const celda = document.createElement('div');
        celda.classList.add('celda');
        celda.dataset.index = i;
        celda.addEventListener('click', () => hacerMovimiento(i));
        tableroDiv.appendChild(celda);
    }
}

export async function entrarSala(id) {
    salaActual = id;
    miSimbolo = null;
    dosJugadores = false;
    juegoTerminado = false;
    tableroLocal = ["","","","","","","","",""];

    document.getElementById('salaLabel').textContent = `Sala ${id}`;
    document.getElementById('logsPanel').innerHTML = `<div class="log-entry">Conectando a sala ${id}...</div>`;
    actualizarVista();
    mostrarPantalla('screenJuego');
    await iniciarJuego();
}

function addLog(msg, tipo = 'info') {
    const panel = document.getElementById('logsPanel');
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
        if (tableroLocal[i] === 'X') celdas[i].classList.add('x');
        if (tableroLocal[i] === 'O') celdas[i].classList.add('o');
        if (celdasGanadoras.includes(i)) celdas[i].classList.add('ganadora');
    }
}

function verificarGanador(board) {
    const lineas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let [a,b,c] of lineas) {
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
    if (ganador === 'empate') span.textContent = 'Empate';
    else if (ganador) span.textContent = `Ganó ${ganador} 🎉`;
    else if (!dosJugadores) span.textContent = miSimbolo ? `Eres ${miSimbolo} - Esperando rival...` : 'Espectador';
    else if (!miSimbolo) span.textContent = 'Modo espectador';
    else if (miSimbolo === turnoActual) span.textContent = `Tu turno (${miSimbolo})`;
    else span.textContent = `Turno de ${turnoActual}`;
}

function iniciarCuentaRegresiva(ejecutar) {
    cancelarCuentaRegresiva();
    let s = DELAY_REINICIO;
    const div = document.getElementById('reinicioAuto');
    div.textContent = `Reiniciando en ${s}s...`;
    reinicioTimer = setInterval(() => {
        s--;
        if (s <= 0) {
            clearInterval(reinicioTimer);
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
    const { data: g } = await supabase.from('juegos').select('x_player_id, o_player_id').eq('id', salaActual).single();
    if (!g) return;

    if (g.x_player_id === miSessionId) { miSimbolo = 'X'; addLog('Reconectado como X', 'success'); return; }
    if (g.o_player_id === miSessionId) { miSimbolo = 'O'; addLog('Reconectado como O', 'success'); return; }

    const { data: rx } = await supabase.from('juegos').update({ x_player_id: miSessionId })
        .eq('id', salaActual).is('x_player_id', null).select('id');
    if (rx?.length) { miSimbolo = 'X'; addLog('Eres X', 'success'); return; }

    const { data: ro } = await supabase.from('juegos').update({ o_player_id: miSessionId })
        .eq('id', salaActual).is('o_player_id', null).select('id');
    if (ro?.length) { miSimbolo = 'O'; addLog('Eres O', 'success'); return; }

    miSimbolo = null;
    addLog('Sala llena. Espectador.', 'info');
}

async function hacerMovimiento(indice) {
    if (!dosJugadores) { addLog('Esperando rival...', 'error'); return; }
    if (juegoTerminado) return;
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

        // Actualizar ranking del perfil
        await actualizarRankingPerfil(ganador);
    }

    await supabase.from('juegos').update({
        board: tableroLocal,
        current_turn: siguienteTurno,
        winner: ganador,
        is_active: !ganador,
        ...scoreUpdate
    }).eq('id', salaActual);

    if (ganador && miSimbolo === 'X') iniciarCuentaRegresiva(true);
}

async function actualizarRankingPerfil(ganador) {
    const perfil = getPerfil();
    if (!perfil) return;
    const campo = ganador === miSimbolo ? 'victorias' : ganador === 'empate' ? 'empates' : 'derrotas';
    await supabase.from('perfiles').update({
        [campo]: (perfil[campo] || 0) + 1,
        partidas: (perfil.partidas || 0) + 1
    }).eq('id', perfil.id);
}

async function reiniciarPartida(esAuto = false) {
    cancelarCuentaRegresiva();
    addLog(esAuto ? 'Auto-reinicio...' : 'Reiniciando...', 'info');
    await supabase.from('juegos').update({
        board: ['','','','','','','','',''],
        current_turn: 'X',
        winner: null,
        is_active: true
    }).eq('id', salaActual);

    tableroLocal = ['','','','','','','','',''];
    turnoActual = 'X';
    juegoTerminado = false;
    actualizarVista();
    actualizarEstado();
}

async function iniciarJuego() {
    await asignarSimbolo();

    const { data: g } = await supabase.from('juegos').select('*').eq('id', salaActual).single();
    if (g) {
        tableroLocal = g.board || ['','','','','','','','',''];
        turnoActual = g.current_turn || 'X';
        juegoTerminado = !g.is_active;
        dosJugadores = !!(g.x_player_id && g.o_player_id);
        actualizarVista();
        actualizarEstado(g.winner);
        actualizarMarcador(g.scores);
        addLog(`Sala ${salaActual} lista`, 'success');
        if (juegoTerminado && miSimbolo === 'X') iniciarCuentaRegresiva(true);
    }

    if (canalJuego) supabase.removeChannel(canalJuego);
    canalJuego = supabase
        .channel(`sala-${salaActual}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'juegos',
            filter: `id=eq.${salaActual}`
        }, (payload) => {
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

            if (!eraTerminado && juegoTerminado && miSimbolo !== 'X') iniciarCuentaRegresiva(false);
            if (eraTerminado && !juegoTerminado) cancelarCuentaRegresiva();
        })
        .subscribe(s => addLog(`Realtime: ${s}`, s === 'SUBSCRIBED' ? 'success' : 'info'));
}

async function salirSala() {
    cancelarCuentaRegresiva();
    if (canalJuego) { supabase.removeChannel(canalJuego); canalJuego = null; }

    if (miSimbolo === 'X') {
        await supabase.from('juegos').update({ x_player_id: null }).eq('id', salaActual).eq('x_player_id', miSessionId);
    } else if (miSimbolo === 'O') {
        await supabase.from('juegos').update({ o_player_id: null }).eq('id', salaActual).eq('o_player_id', miSessionId);
    }

    // Si la sala quedó vacía, resetear tablero también
    const { data: g } = await supabase.from('juegos')
        .select('x_player_id, o_player_id')
        .eq('id', salaActual).single();

    if (g && !g.x_player_id && !g.o_player_id) {
        await supabase.from('juegos').update({
            board: ['','','','','','','','',''],
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
