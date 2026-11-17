# CuboLab

Site para acompanhar a evolução no cubo de Rubik.

- **Timer** — cronómetro estilo csTimer com baralhamentos (2x2 a 7x7, OH, Pyraminx, Skewb, Megaminx), mo3/ao5/ao12/ao50/ao100, +2/DNF e inspeção WCA opcional.
- **Evolução** — gráficos dos tempos, média por dia, distribuição e recordes pessoais.
- **Aprender** — algoritmos PLL, OLL 2-look e OLL completo organizados em *Por aprender / Em progresso / Aprendido*, com diagramas e treino de reconhecimento.

Ao entrar com Google (botão no topo), os tempos e o estado dos algoritmos sincronizam entre dispositivos através do Firebase (Auth + Firestore, configurado em `firebase-config.js`; ver `sync.js`). Sem sessão iniciada, os dados ficam só no browser (localStorage). Usa ⚙ → *Exportar cópia* para fazer cópias de segurança ou passar os dados para outro dispositivo. Também é possível importar o histórico do csTimer.

Correr localmente: `python3 -m http.server 8765` e abrir http://localhost:8765.
