const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  disciplina: { type: String, enum: ['padel', 'tenis'], required: true },
  formato: {
    type: String,
    enum: ['grupos_+_eliminacion', 'eliminacion_directa_perdedores', 'grupos_1y2_eliminacion', 'eliminacion_directa'],
    required: true
  },
  estado: {
    type: String,
    enum: ['borrador', 'inscripcion', 'en_curso', 'finalizado', 'cancelado'],
    default: 'inscripcion'
  },
  fechaInicio: { type: Date },
  fechaFin: { type: Date },
  fechaLimiteInscripcion: { type: Date },
  maxJugadores: { type: Number, required: true },
  minJugadores: { type: Number, default: 4 },
  inscripciones: [{
    jugador1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jugador2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Opcional para singles, obligatorio para dobles en lógica
    fechaInscripcion: { type: Date, default: Date.now },
    estado: { type: String, enum: ['confirmado', 'pendiente', 'cancelado'], default: 'confirmado' }
  }],
  bracket: { type: mongoose.Schema.Types.Mixed }, // Cuadro Principal
  bracketSecundario: { type: mongoose.Schema.Types.Mixed }, // Cuadro de Perdedores
  ganador: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Campeón Absoluto
  ganadorSecundario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Campeón Perdedores
  
  // Sistema de Puntos para el Ranking (Personalizable por torneo)
  puntosConfig: {
    partidoGanadoGrupo: { type: Number, default: 10 },
    partidoPerdidoGrupo: { type: Number, default: 5 },
    llegarCuartos: { type: Number, default: 50 },
    llegarSemis: { type: Number, default: 75 },
    llegarFinal: { type: Number, default: 100 },
    campeon: { type: Number, default: 150 },
    // Puntos específicos para el Cuadro de Perdedores
    campeonPerdedores: { type: Number, default: 40 },
    finalistaPerdedores: { type: Number, default: 20 }
  },

  zonas: [{
    nombre: { type: String }, // 'Zona 1', 'Zona 2', etc.
    jugadores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  organizadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  descripcion: { type: String },
  premio: { type: String },
  categoria: { type: String },
  rankingGenerado: { type: Boolean, default: false }
}, { timestamps: true });

// Índices para búsquedas rápidas
tournamentSchema.index({ disciplina: 1, estado: 1 });
tournamentSchema.index({ organizadorId: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);
