const mongoose = require('mongoose');

const rankingSchema = new mongoose.Schema({
  disciplina: { type: String, enum: ['padel', 'tenis'], required: true },
  tipo: { type: String, enum: ['global', 'torneo'], required: true },
  torneoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
  entradas: [{
    jugadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    posicion: { type: Number },
    puntos: { type: Number, default: 0 },
    partidosJugados: { type: Number, default: 0 },
    partidosGanados: { type: Number, default: 0 },
    partidosPerdidos: { type: Number, default: 0 },
    setsGanados: { type: Number, default: 0 },
    setsPerdidos: { type: Number, default: 0 },
    torneoGanados: { type: Number, default: 0 }
  }],
  actualizadoEn: { type: Date, default: Date.now }
}, { timestamps: true });

rankingSchema.index({ disciplina: 1, tipo: 1 });

module.exports = mongoose.model('Ranking', rankingSchema);
