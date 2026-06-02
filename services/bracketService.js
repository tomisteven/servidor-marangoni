const Match = require('../models/Match');

/**
 * Generates a single elimination bracket
 */
exports.generateSingleElimination = async (tournamentId, players, isDoubles = false, tipoCuadro = 'principal') => {
  const numParticipants = players.length;
  if (numParticipants < 2) return null; // Retornar null si no hay suficientes jugadores

  const rounds = Math.ceil(Math.log2(numParticipants));
  const bracketSize = Math.pow(2, rounds);
  const numMatchesR1 = bracketSize / 2;

  // Create placeholders for all rounds first to have IDs
  const allMatches = [];
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = Math.pow(2, rounds - r);
    for (let m = 1; m <= matchesInRound; m++) {
      const match = await Match.create({
        torneoId: tournamentId,
        ronda: r,
        numeroPartido: m,
        tipoCuadro: tipoCuadro,
        estado: 'pendiente'
      });
      allMatches.push(match);
    }
  }

  // Distribute players in Round 1
  const r1Matches = allMatches.filter(m => m.ronda === 1);
  
  for (let i = 0; i < numParticipants; i++) {
    const matchIndex = i % numMatchesR1;
    const match = r1Matches[matchIndex];
    const isSlot1 = !match.jugador1 && (!match.pareja1 || match.pareja1.length === 0);
    
    if (isDoubles) {
      const pair = [players[i].jugador1, players[i].jugador2].filter(id => id);
      if (isSlot1) match.pareja1 = pair;
      else match.pareja2 = pair;
    } else {
      if (isSlot1) match.jugador1 = players[i].jugador1;
      else match.jugador2 = players[i].jugador1;
    }
  }

  // Update R1 matches state and handle BYEs
  for (const match of r1Matches) {
    const hasP1 = isDoubles ? (match.pareja1 && match.pareja1.length > 0) : !!match.jugador1;
    const hasP2 = isDoubles ? (match.pareja2 && match.pareja2.length > 0) : !!match.jugador2;

    if (hasP1 && hasP2) {
      match.estado = 'pendiente';
    } else if (hasP1 || hasP2) {
      // BYE: Auto-win
      const winner = hasP1 ? 
        (isDoubles ? match.pareja1 : match.jugador1) : 
        (isDoubles ? match.pareja2 : match.jugador2);
      
      match.estado = 'finalizado';
      match.resultado = { ganador: winner, sets: [] };
      
      // Advance to next round
      const nextMatchNum = Math.ceil(match.numeroPartido / 2);
      const nextMatch = allMatches.find(m => m.ronda === 2 && m.numeroPartido === nextMatchNum && m.tipoCuadro === tipoCuadro);
      if (nextMatch) {
        const nextPlayerKey = match.numeroPartido % 2 !== 0 ? 
          (isDoubles ? 'pareja1' : 'jugador1') : 
          (isDoubles ? 'pareja2' : 'jugador2');
        nextMatch[nextPlayerKey] = winner;
        await nextMatch.save();
      }
    } else {
      match.estado = 'finalizado';
    }
    await match.save();
  }

  return { rounds, firstRoundMatches: r1Matches.length };
};

/**
 * Generates an empty single elimination bracket (organizer assigns first round manually)
 */
exports.generateEmptyBracket = async (tournamentId, numParticipants) => {
  const rounds = Math.ceil(Math.log2(numParticipants));
  const bracketSize = Math.pow(2, rounds);
  const numMatchesR1 = bracketSize / 2;

  const allMatches = [];
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = Math.pow(2, rounds - r);
    for (let m = 1; m <= matchesInRound; m++) {
      const match = await Match.create({
        torneoId: tournamentId,
        ronda: r,
        numeroPartido: m,
        tipoCuadro: 'principal',
        estado: 'pendiente'
      });
      allMatches.push(match);
    }
  }

  return { rounds, firstRoundMatches: numMatchesR1 };
};

/**
 * Generates a Round Robin schedule (Groups of 3/4)
 */
exports.generateRoundRobin = async (tournamentId, players, isDoubles = false) => {
  const numParticipants = players.length;
  if (numParticipants < 2) throw new Error('Not enough participants');

  let numGroupsOf3 = Math.floor(numParticipants / 3);
  let numGroupsOf4 = 0;
  let remainder = numParticipants % 3;

  if (remainder === 1) {
    if (numGroupsOf3 >= 1) {
      numGroupsOf3 -= 1;
      numGroupsOf4 = 1;
    } else {
      numGroupsOf4 = 1;
    }
  } else if (remainder === 2) {
    if (numGroupsOf3 >= 2) {
      numGroupsOf3 -= 2;
      numGroupsOf4 = 2;
    } else if (numGroupsOf3 === 1) {
      numGroupsOf3 = 1;
      remainder = 2;
    }
  }

  const groupConfigs = [];
  for (let i = 0; i < numGroupsOf3; i++) groupConfigs.push(3);
  for (let i = 0; i < numGroupsOf4; i++) groupConfigs.push(4);
  if (remainder === 2 && numGroupsOf3 === 0 && numGroupsOf4 === 0) groupConfigs.push(2);
  if (numParticipants === 5) { groupConfigs.pop(); groupConfigs.push(3); groupConfigs.push(2); }

  const groups = groupConfigs.map((size, i) => ({
    id: String.fromCharCode(65 + i),
    players: []
  }));

  // Distribute players
  let playerIdx = 0;
  groups.forEach(group => {
    const size = groupConfigs[groups.indexOf(group)];
    for (let i = 0; i < size; i++) {
      if (players[playerIdx]) {
        group.players.push(players[playerIdx]);
        playerIdx++;
      }
    }
  });

  // Generate matches for each group
  for (const group of groups) {
    const participants = group.players;
    const n = participants.length;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const matchData = {
          torneoId: tournamentId,
          ronda: 1,
          numeroPartido: groups.indexOf(group) * 100 + (i * 10 + j),
          grupo: group.id,
          estado: 'pendiente'
        };

        if (isDoubles) {
          matchData.pareja1 = [participants[i].jugador1, participants[i].jugador2].filter(id => id);
          matchData.pareja2 = [participants[j].jugador1, participants[j].jugador2].filter(id => id);
        } else {
          matchData.jugador1 = participants[i].jugador1;
          matchData.jugador2 = participants[j].jugador1;
        }

        await Match.create(matchData);
      }
    }
  }

  return { type: 'round_robin', groups: groups.map(g => g.id), numGroups: groups.length };
};

/**
 * Generates a Group Stage (Round Robin in small groups)
 */
exports.generateGroups = async (tournamentId, players, groupSize = 4, isDoubles = false) => {
  const numParticipants = players.length;
  const numGroups = Math.ceil(numParticipants / groupSize);
  
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: String.fromCharCode(65 + i), // A, B, C...
      players: []
    });
  }

  // Distribute players into groups
  players.forEach((p, index) => {
    groups[index % numGroups].players.push(p);
  });

  // Generate matches for each group
  for (const group of groups) {
    const participants = group.players;
    const n = participants.length;
    if (n < 2) continue;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const matchData = {
          torneoId: tournamentId,
          ronda: 1,
          numeroPartido: groups.indexOf(group) * 100 + (i * 10 + j),
          grupo: group.id,
          estado: 'pendiente'
        };

        if (isDoubles) {
          matchData.pareja1 = [participants[i].jugador1, participants[i].jugador2].filter(id => id);
          matchData.pareja2 = [participants[j].jugador1, participants[j].jugador2].filter(id => id);
        } else {
          matchData.jugador1 = participants[i].jugador1;
          matchData.jugador2 = participants[j].jugador1;
        }

        await Match.create(matchData);
      }
    }
  }

  return { type: 'groups', groups: groups.map(g => g.id), numGroups: groups.length };
};
