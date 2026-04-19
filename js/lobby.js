// lobby.js v2
import { supabase } from './supabase.js';
import { entrarSala } from './game.js';

const TOTAL_SALAS = 6;
let canalLobby = null;

export async function cargarLobby() {
    await limpiarJugadoresFantasma();
    const { data: salas } = await supabase
        .from('juegos')
        .select('id, x_player_id, o_player_id, scores')
        .order('id');
    renderLobby(salas || []);
    suscribirLobby();
}

/**
 * Detecta jugadores cuyo ID no existe en perfiles (sesión expirada / cuenta eliminada)
 * y los elimina de las salas, reseteando la sala si queda vacía.
 */
async function limpiarJugadoresFantasma() {
    const { data: salas } = await supabase
        .from('juegos')
        .select('id, x_player_id, o_player_id')
        .order('id');
    if (!salas?.length) return;

    // Recoger todos los IDs de jugadores presentes en salas
    const ids = [...new Set(
        salas.flatMap(s => [s.x_player_id, s.o_player_id]).filter(Boolean)
    )];
    if (!ids.length) return;

    // Verificar cuáles existen realmente en perfiles
    const { data: perfiles } = await supabase
        .from('perfiles')
        .select('id')
        .in('id', ids);

    const existentes = new Set((perfiles || []).map(p => p.id));

    for (const sala of salas) {
        const xValido = sala.x_player_id && existentes.has(sala.x_player_id);
        const oValido = sala.o_player_id && existentes.has(sala.o_player_id);

        // Si algún slot tiene un ID fantasma, limpiar
        if ((sala.x_player_id && !xValido) || (sala.o_player_id && !oValido)) {
            const update = {};
            if (sala.x_player_id && !xValido) update.x_player_id = null;
            if (sala.o_player_id && !oValido) update.o_player_id = null;

            // Si la sala queda vacía, resetear tablero también
            const quedaVacia = !xValido && !oValido;
            if (quedaVacia) {
                Object.assign(update, {
                    board: ['','','','','','','','',''],
                    current_turn: 'X',
                    winner: null,
                    is_active: true
                });
            }
            await supabase.from('juegos').update(update).eq('id', sala.id);
        }
    }
}

export function limpiarLobby() {
    if (canalLobby) { supabase.removeChannel(canalLobby); canalLobby = null; }
}

/**
 * Resetea TODAS las salas: limpia jugadores y tablero.
 * Útil cuando hay salas atascadas con jugadores fantasma.
 */
export async function resetearTodasLasSalas() {
    const resetData = {
        x_player_id: null,
        o_player_id: null,
        board: ['','','','','','','','',''],
        current_turn: 'X',
        winner: null,
        is_active: true
    };
    for (let i = 1; i <= TOTAL_SALAS; i++) {
        await supabase.from('juegos').update(resetData).eq('id', i);
    }
}

function renderLobby(salas) {
    const grid = document.getElementById('salasGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= TOTAL_SALAS; i++) {
        const sala = salas.find(s => s.id === i);
        const jugadores = sala ? [sala.x_player_id, sala.o_player_id].filter(Boolean).length : 0;
        const llena = jugadores >= 2;
        const scores = sala?.scores || { x: 0, o: 0, empate: 0 };

        // Estado visual
        let estadoClass, badgeClass, badgeIcon, badgeText;
        if (jugadores === 0) {
            estadoClass = 'estado-libre';
            badgeClass = 'badge-libre'; badgeIcon = '●'; badgeText = 'Libre';
        } else if (jugadores === 1) {
            estadoClass = 'estado-esperando';
            badgeClass = 'badge-uno'; badgeIcon = '◐'; badgeText = 'Esperando...';
        } else {
            estadoClass = '';
            badgeClass = 'badge-llena'; badgeIcon = '●'; badgeText = 'En juego';
        }

        // Slots de jugadores
        const slot1 = jugadores >= 1
            ? `<div class="sala-slot ocupado" title="Jugador X">✕</div>`
            : `<div class="sala-slot vacio">+</div>`;
        const slot2 = jugadores >= 2
            ? `<div class="sala-slot ocupado" title="Jugador O">○</div>`
            : `<div class="sala-slot vacio">+</div>`;

        const card = document.createElement('div');
        card.classList.add('sala-card');
        if (llena) card.classList.add('llena');
        if (estadoClass) card.classList.add(estadoClass);
        card.setAttribute('role', 'listitem');

        card.innerHTML = `
            <div class="sala-numero">Sala ${i}</div>
            <div class="sala-avatares">
                ${slot1}
                <div class="sala-vs">VS</div>
                ${slot2}
            </div>
            <div class="sala-estado-badge ${badgeClass}">
                <span>${badgeIcon}</span> ${badgeText}
            </div>
            <div class="sala-scores-row">
                <div class="sala-score-item">
                    <div class="sala-score-val sv">${scores.x || 0}</div>
                    <div class="sala-score-lbl">X</div>
                </div>
                <div class="sala-score-item">
                    <div class="sala-score-val se">${scores.empate || 0}</div>
                    <div class="sala-score-lbl">E</div>
                </div>
                <div class="sala-score-item">
                    <div class="sala-score-val sd">${scores.o || 0}</div>
                    <div class="sala-score-lbl">O</div>
                </div>
            </div>
        `;

        if (!llena) {
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Sala ${i}, ${badgeText}`);
            card.addEventListener('click', () => entrarSala(i));
            card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') entrarSala(i); });
        } else {
            card.setAttribute('aria-disabled', 'true');
        }

        grid.appendChild(card);
    }
}

function suscribirLobby() {
    if (canalLobby) supabase.removeChannel(canalLobby);
    canalLobby = supabase
        .channel('lobby-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'juegos' }, async () => {
            const { data: salas } = await supabase
                .from('juegos').select('id, x_player_id, o_player_id, scores').order('id');
            renderLobby(salas || []);
        })
        .subscribe();
}
