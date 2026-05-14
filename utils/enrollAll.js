const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Tournament = require('../models/Tournament');

dotenv.config();

const enrollAll = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    const tournament = await Tournament.findOne({ nombre: 'Torneo Apertura 2026' });
    if (!tournament) {
      console.error('Tournament not found');
      process.exit(1);
    }

    const players = await User.find();
    console.log(`Found ${players.length} players.`);

    tournament.jugadoresInscritos = players.map(p => ({
      jugadorId: p._id,
      fechaInscripcion: new Date(),
      estado: 'confirmado'
    }));

    // Also set max players to accommodate them if needed (though 14 < 16)
    tournament.estado = 'inscripcion'; 
    await tournament.save();

    console.log(`Enrolled ${players.length} players successfully.`);
    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

enrollAll();
