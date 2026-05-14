const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const PlayerStats = require('../models/PlayerStats');
const Ranking = require('../models/Ranking');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const cleanAndSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a la base de datos...');

    // 1. Limpiar todo
    console.log('Limpiando base de datos...');
    await User.deleteMany({});
    await Tournament.deleteMany({});
    await Match.deleteMany({});
    await PlayerStats.deleteMany({});
    await Ranking.deleteMany({});

    // 2. Crear Admin
    const admin = await User.create({
      nombre: 'Admin',
      apellido: 'Sistema',
      email: 'admin@test.com',
      passwordHash: '12345678', // Se hashea en el modelo
      rol: 'administrador',
      disciplinas: ['padel', 'tenis']
    });
    console.log('Admin creado: admin@test.com / 12345678');

    // 3. Crear 20 Jugadores de Test
    console.log('Creando jugadores...');
    for (let i = 1; i <= 20; i++) {
      await User.create({
        nombre: `Jugador ${i}`,
        apellido: `Test`,
        email: `jugador${i}@test.com`,
        passwordHash: '12345678',
        rol: 'jugador',
        disciplinas: ['padel', 'tenis'],
        activo: true
      });
      process.stdout.write(`\r  → Creado jugador ${i}/20`);
    }
    console.log('\n20 jugadores creados exitosamente.');

    console.log('Base de datos reseteada y lista para testear.');
    process.exit();
  } catch (error) {
    console.error('Error al resetear la base de datos:', error);
    process.exit(1);
  }
};

cleanAndSeed();
