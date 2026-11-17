/* Algoritmos CFOP: PLL, OLL 2-look e OLL completo. */
(function (root) {
  'use strict';
  const C = {};
  const add = (id, mode, name, group, alg, alts) => { C[id] = { id, mode, name, group, alg, alts: alts || [] }; };

  // ---------- PLL ----------
  add('pll-Ua', 'pll', 'Ua', 'Só arestas', "M2 U M U2 M' U M2", ["R U' R U R U R U' R' U' R2"]);
  add('pll-Ub', 'pll', 'Ub', 'Só arestas', "M2 U' M U2 M' U' M2", ["R2 U R U R' U' R' U' R' U R'"]);
  add('pll-H', 'pll', 'H', 'Só arestas', "M2 U M2 U2 M2 U M2");
  add('pll-Z', 'pll', 'Z', 'Só arestas', "M' U M2 U M2 U M' U2 M2");
  add('pll-Aa', 'pll', 'Aa', 'Só cantos', "x R' U R' D2 R U' R' D2 R2 x'");
  add('pll-Ab', 'pll', 'Ab', 'Só cantos', "x R2 D2 R U R' D2 R U' R x'");
  add('pll-E', 'pll', 'E', 'Só cantos', "x' R U' R' D R U R' D' R U R' D R U' R' D' x");
  add('pll-T', 'pll', 'T', 'Troca adjacente', "R U R' U' R' F R2 U' R' U' R U R' F'");
  add('pll-F', 'pll', 'F', 'Troca adjacente', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R");
  add('pll-Ja', 'pll', 'Ja', 'Troca adjacente', "x R2 F R F' R U2 r' U r U2 x'", ["L' U' L F L' U' L U L F' L2 U L"]);
  add('pll-Jb', 'pll', 'Jb', 'Troca adjacente', "R U R' F' R U R' U' R' F R2 U' R'");
  add('pll-Ra', 'pll', 'Ra', 'Troca adjacente', "R U' R' U' R U R D R' U' R D' R' U2 R'");
  add('pll-Rb', 'pll', 'Rb', 'Troca adjacente', "R2 F R U R U' R' F' R U2 R' U2 R");
  add('pll-V', 'pll', 'V', 'Troca diagonal', "R' U R' U' y R' F' R2 U' R' U R' F R F");
  add('pll-Y', 'pll', 'Y', 'Troca diagonal', "F R U' R' U' R U R' F' R U R' U' R' F R F'");
  add('pll-Na', 'pll', 'Na', 'Troca diagonal', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'");
  add('pll-Nb', 'pll', 'Nb', 'Troca diagonal', "R' U R U' R' F' U' F R U R' F R' F' R U' R");
  add('pll-Ga', 'pll', 'Ga', 'G perms', "R2 U R' U R' U' R U' R2 U' D R' U R D'");
  add('pll-Gb', 'pll', 'Gb', 'G perms', "R' U' R U D' R2 U R' U R U' R U' R2 D");
  add('pll-Gc', 'pll', 'Gc', 'G perms', "R2 U' R U' R U R' U R2 U D' R U' R' D");
  add('pll-Gd', 'pll', 'Gd', 'G perms', "R U R' U' D R2 U' R U' R' U R' U R2 D'");

  // ---------- OLL 2-look: orientação das arestas ----------
  add('eo-dot', 'eo', 'Ponto', 'Arestas (cruz amarela)', "F R U R' U' F' f R U R' U' f'");
  add('eo-l', 'eo', 'L', 'Arestas (cruz amarela)', "f R U R' U' f'");
  add('eo-line', 'eo', 'Linha', 'Arestas (cruz amarela)', "F R U R' U' F'");

  // ---------- OLL completo ----------
  const OLL = [
    [1, 'Ponto', "R U2 R2 F R F' U2 R' F R F'"],
    [2, 'Ponto', "F R U R' U' F' f R U R' U' f'"],
    [3, 'Ponto', "f R U R' U' f' U' F R U R' U' F'"],
    [4, 'Ponto', "f R U R' U' f' U F R U R' U' F'"],
    [5, 'Quadrado', "l' U2 L U L' U l"],
    [6, 'Quadrado', "r U2 R' U' R U' r'"],
    [7, 'Relâmpago', "r U R' U R U2 r'"],
    [8, 'Relâmpago', "l' U' L U' L' U2 l"],
    [9, 'Peixe', "R U R' U' R' F R2 U R' U' F'"],
    [10, 'Peixe', "R U R' U R' F R F' R U2 R'"],
    [11, 'Relâmpago', "r U R' U R' F R F' R U2 r'"],
    [12, 'Relâmpago', "M' R' U' R U' R' U2 R U' R r'"],
    [13, 'Cavalo', "F U R U' R2 F' R U R U' R'"],
    [14, 'Cavalo', "R' F R U R' F' R F U' F'"],
    [15, 'Cavalo', "l' U' l L' U' L U l' U l"],
    [16, 'Cavalo', "r U r' R U R' U' r U' r'"],
    [17, 'Ponto', "R U R' U R' F R F' U2 R' F R F'"],
    [18, 'Ponto', "r U R' U R U2 r2 U' R U' R' U2 r"],
    [19, 'Ponto', "r' R U R U R' U' M' R' F R F'"],
    [20, 'Ponto', "r U R' U' M2 U R U' R' U' M'"],
    [21, 'Cruz', "R U2 R' U' R U R' U' R U' R'", 'H'],
    [22, 'Cruz', "R U2 R2 U' R2 U' R2 U2 R", 'Pi'],
    [23, 'Cruz', "R2 D' R U2 R' D R U2 R", 'Headlights'],
    [24, 'Cruz', "r U R' U' r' F R F'", 'Chameleon (T)'],
    [25, 'Cruz', "F' r U R' U' r' F R", 'Bowtie'],
    [26, 'Cruz', "R U2 R' U' R U' R'", 'Anti-Sune'],
    [27, 'Cruz', "R U R' U R U2 R'", 'Sune'],
    [28, 'Cantos orientados', "r U R' U' r' R U R U' R'"],
    [29, 'Awkward', "R U R' U' R U' R' F' U' F R U R'"],
    [30, 'Awkward', "F R' F R2 U' R' U' R U R' F2"],
    [31, 'P', "R' U' F U R U' R' F' R"],
    [32, 'P', "L U F' U' L' U L F L'"],
    [33, 'T', "R U R' U' R' F R F'"],
    [34, 'C', "R U R2 U' R' F R U R U' F'"],
    [35, 'Peixe', "R U2 R2 F R F' R U2 R'"],
    [36, 'W', "L' U' L U' L' U L U L F' L' F"],
    [37, 'Peixe', "F R' F' R U R U' R'"],
    [38, 'W', "R U R' U R U' R' U' R' F R F'"],
    [39, 'Relâmpago grande', "L F' L' U' L U F U' L'"],
    [40, 'Relâmpago grande', "R' F R U R' U' F' U R"],
    [41, 'Awkward', "R U R' U R U2 R' F R U R' U' F'"],
    [42, 'Awkward', "R' U' R U' R' U2 R F R U R' U' F'"],
    [43, 'P', "R' U' F' U F R"],
    [44, 'P', "F U R U' R' F'"],
    [45, 'T', "F R U R' U' F'"],
    [46, 'C', "R' U' R' F R F' U R"],
    [47, 'L pequeno', "R' U' R' F R F' R' F R F' U R"],
    [48, 'L pequeno', "F R U R' U' R U R' U' F'"],
    [49, 'L pequeno', "r U' r2 U r2 U r2 U' r"],
    [50, 'L pequeno', "r' U r2 U' r2 U' r2 U r'"],
    [51, 'Linha', "F U R U' R' U R U' R' F'"],
    [52, 'Linha', "R U R' U R U' B U' B' R'"],
    [53, 'L pequeno', "l' U2 L U L' U' L U L' U l"],
    [54, 'L pequeno', "r U2 R' U' R U R' U' R U' r'"],
    [55, 'Linha', "R' F R U R U' R2 F' R2 U' R' U R U R'"],
    [56, 'Linha', "r' U' r U' R' U R U' R' U R r' U r"],
    [57, 'Cantos orientados', "R U R' U' M' U R U' r'"]
  ];
  OLL.forEach(([n, g, a, nick]) => add('oll-' + n, 'oll', 'OLL ' + n + (nick ? ' · ' + nick : ''), g, a));

  const SETS = [
    { id: 'pll', name: 'PLL', desc: 'Permutação da última camada — 21 casos', cases: Object.keys(C).filter(k => k.startsWith('pll-')) },
    { id: 'oll2', name: 'OLL 2-look', desc: '3 casos de arestas + 7 casos de cantos', cases: ['eo-dot', 'eo-l', 'eo-line', 'oll-21', 'oll-22', 'oll-23', 'oll-24', 'oll-25', 'oll-26', 'oll-27'] },
    { id: 'oll', name: 'OLL completo', desc: 'Orientação da última camada — 57 casos', cases: OLL.map(o => 'oll-' + o[0]) }
  ];
  // Estado inicial: o que já sabes (OLL 2-look)
  const DEFAULT_LEARNED = SETS[1].cases.slice();

  const api = { CASES: C, SETS, DEFAULT_LEARNED, OLL_GROUPS: OLL.map(o => [o[0], o[1]]) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ALGS = api;
})(typeof window !== 'undefined' ? window : globalThis);
