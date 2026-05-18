/**
 * setup.js — Ejecutar UNA SOLA VEZ para crear las 6 salas en Firestore.
 * Abre index.html, abre la consola del navegador y ejecuta:
 *   import('./js/setup.js').then(m => m.crearSalas())
 */
import { db } from './firebase.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function crearSalas() {
    const base = {
        board: ['','','','','','','','',''],
        current_turn: 'X',
        winner: null,
        is_active: true,
        x_player_id: null,
        o_player_id: null,
        x_player_history: null,
        o_player_history: null,
        scores: { x: 0, o: 0, empate: 0 }
    };

    for (let i = 1; i <= 6; i++) {
        const ref = doc(db, 'juegos', `sala-${i}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, { id: i, ...base });
            console.log(`✅ Sala ${i} creada`);
        } else {
            console.log(`⏭ Sala ${i} ya existe`);
        }
    }
    console.log('🎮 Salas listas');
}
