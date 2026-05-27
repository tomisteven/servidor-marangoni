const mongoose = require('mongoose');
require('dotenv').config();
const Ranking = require('../models/Ranking');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const rankings = await Ranking.find({});
  console.log('Rankings found:', rankings.length);
  if (rankings.length > 0) {
    rankings.forEach(r => {
      console.log(`Disciplina: ${r.disciplina}, Tipo: ${r.tipo}, Entradas: ${r.entradas.length}`);
      r.entradas.slice(0, 3).forEach(e => console.log(`  Posicion ${e.posicion}: jugadorId ${e.jugadorId}, pts ${e.puntos}`));
    });
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
