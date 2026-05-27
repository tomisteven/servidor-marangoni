const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Match = require('./models/Match');
const Tournament = require('./models/Tournament');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const t = await Tournament.findOne({ formato: 'eliminacion_directa_perdedores' }).sort({ createdAt: -1 });
  if (!t) return console.log('No tournament found');
  console.log('Tournament ID:', t._id);
  console.log('Zonas:', t.zonas.length);
  const matches = await Match.find({ torneoId: t._id });
  console.log('Matches count:', matches.length);
  process.exit(0);
}
run();
