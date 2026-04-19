/**
 * stats.js
 * Recalcula victorias/derrotas/empates sumando los scores
 * de TODAS las salas donde el jugador ha participado alguna vez.
 *
 * Usa x_player_history / o_player_history (IDs permanentes que nunca
 * se borran al salir) como fuente de verdad.
 * Fallback a x_player_id / o_player_id para salas antiguas sin history.
 */

import { supabase } from './supabase.js';

export async function recalcularStatsDesdeJuegos(uid) {
    // Primero intentar con columnas history, si falla usar solo las actuales
    let salas = null;

    const { data: salasConHistory, error: errHistory } = await supabase
        .from('juegos')
        .select('x_player_id, o_player_id, x_player_history, o_player_history, scores');

    if (errHistory) {
        // Las columnas history no existen aún — usar solo los campos actuales
        const { data: salasFallback, error: errFallback } = await supabase
            .from('juegos')
            .select('x_player_id, o_player_id, scores');
        if (errFallback) return null;
        salas = salasFallback;
    } else {
        salas = salasConHistory;
    }

    if (!salas?.length) return null;

    let victorias = 0;
    let derrotas  = 0;
    let empates   = 0;

    for (const sala of salas) {
        const s = sala.scores || {};

        const fueX = sala.x_player_history === uid || sala.x_player_id === uid;
        const fueO = sala.o_player_history === uid || sala.o_player_id === uid;

        if (fueX && !fueO) {
            victorias += s.x      || 0;
            derrotas  += s.o      || 0;
            empates   += s.empate || 0;
        } else if (fueO && !fueX) {
            victorias += s.o      || 0;
            derrotas  += s.x      || 0;
            empates   += s.empate || 0;
        }
    }

    const partidas = victorias + derrotas + empates;

    await supabase
        .from('perfiles')
        .update({ victorias, derrotas, empates, partidas })
        .eq('id', uid);

    return { victorias, derrotas, empates, partidas };
}
