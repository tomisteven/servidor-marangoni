const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const PlayerStats = require('../models/PlayerStats');
const Ranking = require('../models/Ranking');

dotenv.config();

const users = [
  { nombre: 'Admin', apellido: 'Sistema', email: 'admin@test.com', passwordHash: '12345678', rol: 'administrador', disciplinas: ['padel', 'tenis'] },
  { nombre: 'Juan', apellido: 'Padel', email: 'juan@test.com', passwordHash: '12345678', rol: 'jugador', disciplinas: ['padel'] },
  { nombre: 'Pedro', apellido: 'Tenis', email: 'pedro@test.com', passwordHash: '12345678', rol: 'jugador', disciplinas: ['tenis'] },
  { nombre: 'Maria', apellido: 'Pro', email: 'maria@test.com', passwordHash: '12345678', rol: 'profesor', disciplinas: ['padel', 'tenis'] },
];

// Add 10 more random players
for (let i = 1; i <= 10; i++) {
  users.push({
    nombre: `Jugador${i}`,
    apellido: `Test`,
    email: `player${i}@test.com`,
    passwordHash: '12345678',
    rol: 'jugador',
    disciplinas: ['padel', 'tenis']
  });
}

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for seeding...');

    await User.deleteMany();
    await Tournament.deleteMany();
    await PlayerStats.deleteMany();
    await Ranking.deleteMany();

    const createdUsers = await User.create(users);
    console.log(`${createdUsers.length} users created.`);

    // Create a tournament
    const tournament = await Tournament.create({
      nombre: 'Torneo Apertura 2026',
      disciplina: 'padel',
      formato: 'eliminacion_directa',
      estado: 'inscripcion',
      maxJugadores: 16,
      minJugadores: 4,
      organizadorId: createdUsers[0]._id,
      fechaInicio: new Date(),
      fechaLimiteInscripcion: new Date(),
      categoria: '5ta'
    });

    console.log('Seed data created successfully!');
    process.exit();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
