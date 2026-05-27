const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  rol: {
    type: String,
    enum: ['jugador', 'profesor', 'organizador', 'administrador'],
    default: 'jugador'
  },
  avatar: { type: String, default: '' },
  telefono: { type: String },
  fechaNacimiento: { type: Date },
  dni: { type: String },
  nacionalidad: { type: String },
  sexo: { type: String, enum: ['hombre', 'mujer', 'otro'] },
  domicilio: { type: String },
  disciplinas: [{ type: String, enum: ['padel', 'tenis'] }],
  categoria: { type: String }, // Ej: 'A', 'B', 'Primera', etc.
  activo: { type: Boolean, default: true },
  fechaRegistro: { type: Date, default: Date.now },
  ultimoLogin: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
