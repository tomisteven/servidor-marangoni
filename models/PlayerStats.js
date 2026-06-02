const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
  jugadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  porDisciplina: {
    padel: {
      partidosJugados: { type: Number, default: 0 },
      ganados: { type: Number, default: 0 },
      perdidos: { type: Number, default: 0 },
      setsGanados: { type: Number, default: 0 },
      setsPerdidos: { type: Number, default: 0 },
      torneoGanados: { type: Number, default: 0 },
      torneoJugados: { type: Number, default: 0 },
      rachaActual: { type: Number, default: 0 },
      mejorRacha: { type: Number, default: 0 }
    },
    tenis: {
      partidosJugados: { type: Number, default: 0 },
      ganados: { type: Number, default: 0 },
      perdidos: { type: Number, default: 0 },
      setsGanados: { type: Number, default: 0 },
      setsPerdidos: { type: Number, default: 0 },
      torneoGanados: { type: Number, default: 0 },
      torneoJugados: { type: Number, default: 0 },
      rachaActual: { type: Number, default: 0 },
      mejorRacha: { type: Number, default: 0 }
    }
  },
  historialVsJugadores: [{
    rivalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disciplina: { type: String, enum: ['padel', 'tenis'] },
    ganados: { type: Number, default: 0 },
    perdidos: { type: Number, default: 0 },
    ultimoPartido: { type: Date }
  }],
  ultimaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
