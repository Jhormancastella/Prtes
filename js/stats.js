import { db } from './firebase.js';
import {
    collection, getDocs, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function recalcularStatsDesdeJuegos(uid) {
    try {
        const snap = await getDocs(collection(db, 'juegos'));
        if (snap.empty) return null;

        let victorias = 0, derrotas = 0, empates = 0;

        snap.forEach(d => {
            const sala = d.data();
            const s    = sala.scores || {};
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
        });

        const partidas = victorias + derrotas + empates;
        await updateDoc(doc(db, 'perfiles', uid), { victorias, derrotas, empates, partidas });
        return { victorias, derrotas, empates, partidas };
    } catch (e) {
        console.warn('recalcularStats error:', e);
        return null;
    }
}
