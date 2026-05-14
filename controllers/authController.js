const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.status(statusCode)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol,
        disciplinas: user.disciplinas
      }
    });
};

exports.register = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, disciplinas } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      nombre,
      apellido,
      email,
      passwordHash: password,
      disciplinas
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.ultimoLogin = Date.now();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ success: true, data: {} });
};

exports.getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const token = generateToken(user._id);
    res.status(200).json({ success: true, token });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('nombre apellido email rol avatar disciplinas activo dni telefono nacionalidad categoria');
    const Ranking = require('../models/Ranking');
    
    // Traer los rankings globales
    const padelRanking = await Ranking.findOne({ disciplina: 'padel', tipo: 'global' });
    const tenisRanking = await Ranking.findOne({ disciplina: 'tenis', tipo: 'global' });

    const usersWithStats = users.map(u => {
      const userObj = u.toObject();
      const pEntry = padelRanking?.entradas.find(e => e.jugadorId.toString() === u._id.toString());
      const tEntry = tenisRanking?.entradas.find(e => e.jugadorId.toString() === u._id.toString());
      
      userObj.rankingPoints = {
        padel: pEntry?.puntos || 0,
        tenis: tEntry?.puntos || 0
      };
      return userObj;
    });

    res.status(200).json({ success: true, data: usersWithStats });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      telefono: req.body.telefono,
      fechaNacimiento: req.body.fechaNacimiento,
      dni: req.body.dni,
      nacionalidad: req.body.nacionalidad,
      sexo: req.body.sexo,
      domicilio: req.body.domicilio,
      avatar: req.body.avatar
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]);

    const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.adminUpdateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'nombre', 'apellido', 'email', 'rol', 'categoria', 
      'dni', 'telefono', 'nacionalidad', 'sexo', 'domicilio', 'activo'
    ];

    const fieldsToUpdate = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) fieldsToUpdate[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    user.activo = !user.activo;
    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
exports.updateUserRanking = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { disciplina, puntos } = req.body;

    if (!['padel', 'tenis'].includes(disciplina)) {
      return res.status(400).json({ success: false, message: 'Disciplina inválida' });
    }

    const Ranking = require('../models/Ranking');
    let ranking = await Ranking.findOne({ disciplina, tipo: 'global' });
    if (!ranking) ranking = await Ranking.create({ disciplina, tipo: 'global' });

    let entry = ranking.entradas.find(e => e.jugadorId.toString() === userId);
    if (!entry) {
      entry = { jugadorId: userId, puntos: 0 };
      ranking.entradas.push(entry);
    }

    entry.puntos = puntos;
    await ranking.save();

    res.status(200).json({ success: true, data: ranking });
  } catch (error) {
    next(error);
  }
};
