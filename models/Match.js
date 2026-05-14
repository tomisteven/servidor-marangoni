const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  torneoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  ronda: { type: Number, required: true },
  numeroPartido: { type: Number, required: true },
  grupo: { type: String }, // Identificador del grupo (ej: 'A', 'B', '1', etc)
  tipoCuadro: { 
    type: String, 
    enum: ['principal', 'perdedores'], 
    default: 'principal' 
  },
  
  // Singles
  jugador1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  jugador2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Dobles (Pádel)
  pareja1: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pareja2: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  resultado: {
    sets: [{
      jugador1: { type: Number, default: 0 },
      jugador2: { type: Number, default: 0 }
    }],
    ganador: { type: mongoose.Schema.Types.Mixed }, // userId o 'pareja1'/'pareja2'
    games: { type: mongoose.Schema.Types.Mixed },
    tiebreak: { type: mongoose.Schema.Types.Mixed }
  },
  
  estado: {
    type: String,
    enum: ['pendiente', 'en_curso', 'finalizado', 'walkover'],
    default: 'pendiente'
  },
  
  fechaHora: { type: Date },
  cancha: { type: String },
  cargadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

matchSchema.index({ torneoId: 1, ronda: 1 });

module.exports = mongoose.model('Match', matchSchema);
