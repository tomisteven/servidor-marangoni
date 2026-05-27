const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const t = await Tournament.findOne({ formato: 'eliminacion_directa_perdedores' }).sort({ createdAt: -1 });
  console.log('Tournament:', t.nombre, '| Estado:', t.estado, '| Zonas:', t.zonas.length);

  const isDoubles = t.disciplina === 'padel';

  // Delete existing group matches
  const deleted = await Match.deleteMany({ torneoId: t._id, grupo: { $exists: true, $ne: null } });
  console.log('Deleted existing group matches:', deleted.deletedCount);

  let created = 0;
  for (const zona of t.zonas) {
    const participants = zona.jugadores;
    const n = participants.length;
    console.log(`Zone ${zona.nombre}: ${n} players`);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        await Match.create({
          torneoId: t._id,
          ronda: 1,
          numeroPartido: t.zonas.indexOf(zona) * 100 + (i * 10 + j),
          grupo: zona.nombre,
          estado: 'pendiente',
          jugador1: isDoubles ? undefined : participants[i],
          jugador2: isDoubles ? undefined : participants[j],
        });
        created++;
      }
    }
  }
  console.log('Total matches created:', created);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
