const PlayerStats = require('../models/PlayerStats');
const Ranking = require('../models/Ranking');

exports.updatePlayerStats = async (match, tournament) => {
  const { sets, ganador } = match.resultado;
  const disciplina = tournament.disciplina;
  const isDoubles = disciplina === 'padel';

  const players1 = isDoubles ? match.pareja1 : [match.jugador1];
  const players2 = isDoubles ? match.pareja2 : [match.jugador2];
  const allPlayers = [...players1, ...players2].filter(id => id);
  
  for (const p of allPlayers) {
    const pId = p._id || p;
    if (!pId) continue;

    let stats = await PlayerStats.findOne({ jugadorId: pId });
    if (!stats) stats = await PlayerStats.create({ jugadorId: pId });

    // Find if player is in team 1 or team 2
    const isInTeam1 = players1.some(tp => (tp._id || tp).toString() === pId.toString());
    const isWinner = ganador?.toString() === pId.toString() || 
                     (isDoubles && (match.pareja1.some(tp => (tp._id || tp).toString() === pId.toString()) && 
                                    match.pareja1.some(tp => (tp._id || tp).toString() === ganador?.toString())));
    
    // Simplification for winner check in doubles: if winnerId is one of the members of the pair
    const p1IsWinner = isDoubles ? match.pareja1.some(tp => (tp._id || tp).toString() === ganador?.toString())
                                 : match.jugador1?.toString() === ganador?.toString();

    const playerWonMatch = isInTeam1 ? p1IsWinner : !p1IsWinner;

    const p1Sets = sets.reduce((acc, s) => acc + (s.jugador1 > s.jugador2 ? 1 : 0), 0);
    const p2Sets = sets.reduce((acc, s) => acc + (s.jugador2 > s.jugador1 ? 1 : 0), 0);
    
    const playerSets = isInTeam1 ? p1Sets : p2Sets;
    const rivalSets = isInTeam1 ? p2Sets : p1Sets;

    const dStats = stats.porDisciplina[disciplina];
    dStats.partidosJugados += 1;
    if (playerWonMatch) {
      dStats.ganados += 1;
      dStats.rachaActual += 1;
      if (dStats.rachaActual > dStats.mejorRacha) dStats.mejorRacha = dStats.rachaActual;
    } else {
      dStats.perdidos += 1;
      dStats.rachaActual = 0;
    }
    dStats.setsGanados += playerSets;
    dStats.setsPerdidos += rivalSets;

    // Update head-to-head (historialVsJugadores)
    const rivals = isInTeam1 ? players2 : players1;
    for (const rival of rivals) {
      const rivalId = rival?._id || rival;
      if (!rivalId || rivalId.toString() === pId.toString()) continue;

      let h2h = stats.historialVsJugadores.find(h => h.rivalId.toString() === rivalId.toString() && h.disciplina === disciplina);
      if (!h2h) {
        h2h = {
          rivalId: rivalId,
          disciplina: disciplina,
          ganados: 0,
          perdidos: 0,
          ultimoPartido: new Date()
        };
        stats.historialVsJugadores.push(h2h);
        h2h = stats.historialVsJugadores[stats.historialVsJugadores.length - 1];
      }

      if (playerWonMatch) {
        h2h.ganados += 1;
      } else {
        h2h.perdidos += 1;
      }
      h2h.ultimoPartido = new Date();
    }

    stats.ultimaActualizacion = Date.now();
    await stats.save();

    // Update Global Ranking
    let ranking = await Ranking.findOne({ disciplina, tipo: 'global' });
    if (!ranking) ranking = await Ranking.create({ disciplina, tipo: 'global' });

    let entry = ranking.entradas.find(e => e.jugadorId.toString() === pId.toString());
    if (!entry) {
      entry = { jugadorId: pId };
      ranking.entradas.push(entry);
    }

    entry.partidosJugados += 1;
    if (playerWonMatch) {
      entry.partidosGanados += 1;
    } else {
      entry.partidosPerdidos += 1;
    }

    // 1. Puntos por Partido (Grupos)
    if (match.grupo) {
      if (playerWonMatch) {
        entry.puntos += tournament.puntosConfig?.partidoGanadoGrupo || 10;
      } else {
        entry.puntos += tournament.puntosConfig?.partidoPerdidoGrupo || 5;
      }
    }

    // 2. Puntos por Ronda Alcanzada (Eliminatorias)
    if (!match.grupo && playerWonMatch) {
      const totalRounds = tournament.bracket?.rounds || tournament.bracketSecundario?.rounds || 1;
      const remainingRounds = totalRounds - match.ronda;
      const isPrincipal = match.tipoCuadro !== 'perdedores';

      if (isPrincipal) {
        if (remainingRounds === 3) entry.puntos += tournament.puntosConfig?.llegarCuartos || 50;
        if (remainingRounds === 2) entry.puntos += tournament.puntosConfig?.llegarSemis || 75;
        if (remainingRounds === 1) entry.puntos += tournament.puntosConfig?.llegarFinal || 100;
        if (remainingRounds === 0) entry.puntos += tournament.puntosConfig?.campeon || 150;
      } else {
        // Cuadro de Perdedores
        if (remainingRounds === 1) entry.puntos += tournament.puntosConfig?.finalistaPerdedores || 20;
        if (remainingRounds === 0) entry.puntos += tournament.puntosConfig?.campeonPerdedores || 40;
      }
    }

    entry.setsGanados += playerSets;
    entry.setsPerdidos += rivalSets;

    await ranking.save();
  }
};

exports.awardTournamentPoints = async (tournament) => {
  // Esta función ahora solo se usa para marcar el torneo como procesado
  // ya que los puntos se dan partido a partido (incrementalmente)
  tournament.rankingGenerado = true;
  await tournament.save();
};

exports.awardQualifyingPoints = async (tournament, playerIds, totalRounds) => {
  const disciplina = tournament.disciplina;
  let ranking = await Ranking.findOne({ disciplina, tipo: 'global' });
  if (!ranking) ranking = await Ranking.create({ disciplina, tipo: 'global' });

  let pointsToAward = 0;
  if (totalRounds === 3) {
    // Starts at Quarterfinals -> reaching Quarterfinals gives llegarCuartos points (50)
    pointsToAward = tournament.puntosConfig?.llegarCuartos || 50;
  } else if (totalRounds === 2) {
    // Starts at Semifinals -> reaching Semifinals gives llegarSemis points (75)
    pointsToAward = tournament.puntosConfig?.llegarSemis || 75;
  } else if (totalRounds === 1) {
    // Starts at Finals -> reaching Finals gives llegarFinal points (100)
    pointsToAward = tournament.puntosConfig?.llegarFinal || 100;
  }

  if (pointsToAward === 0) return;

  for (const pId of playerIds) {
    if (!pId) continue;
    let entry = ranking.entradas.find(e => e.jugadorId.toString() === pId.toString());
    if (!entry) {
      entry = { jugadorId: pId };
      ranking.entradas.push(entry);
    }
    entry.puntos += pointsToAward;
  }

  await ranking.save();
};

