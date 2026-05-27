const mongoose = require('mongoose');
require('dotenv').config();
require('../models/User');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  // Check matches per tournament
  const tournaments = await Tournament.find({ formato: 'eliminacion_directa_perdedores' });
  for (const t of tournaments) {
    const count = await Match.countDocuments({ torneoId: t._id });
    const groupCount = await Match.countDocuments({ torneoId: t._id, grupo: { $exists: true } });
    console.log(`Tournament: ${t.nombre} (${t.estado}) | Total matches: ${count} | Group: ${groupCount}`);
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
