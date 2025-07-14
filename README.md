Graph visualization with D3 - ECHOgraph for character's POV

Description:
-------------
Questo progetto visualizza un grafo interattivo con nodi e archi basato su dati JSON.
È possibile selezionare un nodo come "punto di vista" (POV) tramite click singolo,
visualizzare tooltip con opinioni sui link collegati, e filtrare dialoghi basati
sulla stagione tramite un filtro a slider.

Principles features:
---------------------------
- Grafico interattivo con nodi trascinabili (drag).
- Archi con frecce colorate che indicano giudizi (positivo, negativo, ambiguo).
- Tooltip che mostra etichette di opinioni passando con mouse sopra un nodo
  collegato al POV selezionato.
- Filtro stagione estetico con 6 pallini su una linea per selezionare la stagione.
- Box dialoghi fissa a destra che si popola con dialoghi relativi alla stagione
  selezionata e al link cliccato nel POV.
- Possibilità di resettare la selezione cliccando nuovamente sul nodo o arco.
- Legenda colori fissa in alto a sinistra.
- Stile moderno con animazioni e ombre leggere per tooltip e box dialoghi.

Main files:
----------------
- index.html          : struttura base della pagina con svg, tooltip, box dialoghi e filtro stagione
- graph.js            : script principale con la logica di caricamento dati, forze fisiche, interazioni e filtro
- style.css           : foglio di stile con regole per grafico, tooltip, box dialoghi, filtro e legenda
- data.json           : file dati con nodi, archi, opinioni stagionali e dialoghi annidati

How to use:
-----------
1. Apri index.html in un browser moderno (Chrome, Firefox, Edge).
2. Seleziona un nodo con click singolo per entrare nel POV.
3. Passa il mouse su un nodo collegato per vedere il tooltip con opinioni.
4. Seleziona una stagione tramite il filtro a slider (linea con 6 pallini).
5. Clicca su un arco tra due nodi nel POV per visualizzare i dialoghi di quella stagione
   nella box dialoghi a destra.
6. Clicca nuovamente su un nodo o arco per resettare la selezione e nascondere la box/dialoghi.
7. Usa la legenda in alto a sinistra per capire il significato dei colori degli archi.

Personalizations:
------------------
- Cambia i colori o la distanza del grafo modificando colorMap e forceLink distance.
- Modifica dimensioni e stile del filtro stagione nel CSS.
- Aggiungi più stagioni o dialoghi nel file data.json secondo la struttura mostrata.
- Migliora la box dialoghi aggiungendo animazioni o avatar come suggerito nel README CSS.

Support:
---------
Per domande o problemi, contattare lo sviluppatore o aprire issue su repository GitHub.

---

Thanks!