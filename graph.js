const width = 1340;
const height = 900;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

const colorMap = {
  positivo: "#4CAF50",
  negativo: "#F44336",
  ambiguo: "#FFC107",
  neutro: "#000000"
};

let activeNodeId = null;
let rawLinkData = null;
let selectedSeason = "1";
let selectedLinkId = null;
let graphData = null;
let simulation = null;
let link = null;
let node = null;

// BOX DINAMICO PER I DIALOGHI
const dialogueBox = d3.select("#dialogue-box");

// SEASON DOT FILTER BAR
const seasonDotContainer = d3.select("#season-dots");

for (let i = 1; i <= 6; i++) {
  seasonDotContainer.append("div")
    .attr("class", "season-dot" + (i === 1 ? " selected" : ""))
    .attr("data-season", i)
    .text(i)
    .on("click", function () {
      selectedSeason = String(i);

      // Aggiorna stile dot selezionato
      d3.selectAll(".season-dot").classed("selected", false);
      d3.select(this).classed("selected", true);

      // Aggiorna tutto in base alla stagione
      updateGraphForSeason(selectedSeason);
    });
}

// DEFINIZIONE FRECCE
const defs = svg.append("defs");
["positivo", "negativo", "ambiguo", "neutro"].forEach(judgment => {
  defs.append("marker")
    .attr("id", `arrow-${judgment}`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 22)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("markerUnits", "userSpaceOnUse")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", colorMap[judgment]);
});

// Funzione per aggiornare il grafo per la stagione
function updateGraphForSeason(season) {
  selectedSeason = season;
  
  // Reset dello stato
  activeNodeId = null;
  selectedLinkId = null;
  
  // Chiudi dialogue box e rimuovi donut charts
  dialogueBox.html("").classed("visible", false);
  svg.selectAll(".donut-chart").remove();
  svg.selectAll(".donut-tooltip-group").remove();
  
  // Aggiorna visibilità e stile dei link per la nuova stagione
  updateLinkVisibility();
  
  // Ripristina opacità dei nodi
  if (node) {
    node.select("circle").attr("opacity", 1);
    node.select("text").attr("opacity", 1);
  }
  if (link) {
    link.attr("opacity", 1);
  }
  
  // Nascondi tooltip se visibile
  tooltip.classed("hidden", true);
}

// Funzione per aggiornare la visibilità dei link
function updateLinkVisibility() {
  if (!link) return;
  
  link
    .attr("display", d => {
      const seasonData = d.seasons?.[selectedSeason];
      return (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") ? "inline" : "none";
    })
    .attr("stroke", d => {
      const seasonData = d.seasons?.[selectedSeason];
      return seasonData?.judgment ? colorMap[seasonData.judgment] : "#999";
    })
    .attr("marker-end", d => {
      const seasonData = d.seasons?.[selectedSeason];
      return seasonData?.judgment ? `url(#arrow-${seasonData.judgment})` : "";
    });
}

// Funzione per configurare gli event listener sui link
function setupLinkClickHandlers(showDialogueCallback) {
  if (!link) return;
  
  link.on("click", function (event, d) {
    // Permetti click sui link solo se siamo in modalità POV
    if (!activeNodeId) return;

    const sourceId = typeof d.source === "object" ? d.source.id : d.source;
    const targetId = typeof d.target === "object" ? d.target.id : d.target;

    // Permetti click solo sui link che partono dal nodo attivo
    if (sourceId !== activeNodeId) return;

    // Verifica che il link sia visibile per la stagione corrente
    const seasonData = d.seasons?.[selectedSeason];
    if (!seasonData || !seasonData.judgment || seasonData.judgment.trim() === "") return;

    const linkKey = `${sourceId}->${targetId}-${selectedSeason}`;
    
    // Se clicco sullo stesso link, chiudi il dialogue box
    if (selectedLinkId === linkKey) {
      dialogueBox.html("").classed("visible", false);
      selectedLinkId = null;
      return;
    }

    // Mostra il dialogue box per il nuovo link
    showDialogueCallback(d, seasonData);
    selectedLinkId = linkKey;
  });
}

d3.json("data.json").then(data => {
  rawLinkData = data.links;
  graphData = data;
  
  const nodes = data.nodes.map(d => ({ ...d }));
  const links = data.links.map(d => ({ ...d }));

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(300))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("collision", d3.forceCollide(40))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // CREAZIONE ARCHI (link)
  link = svg.append("g")
    .attr("stroke", "#aaa")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke-width", 2)
    .attr("fill", "none")
    .style("cursor", "pointer");

  // Funzione per mostrare il dialogue box per un link
  function showDialogueForLink(linkData, seasonData) {
    const dialogues = seasonData?.dialogues?.filter(line => line.line && line.line.trim() !== "");
    
    // Calcola la posizione del dialogue box
    let sx = linkData.source.x, sy = linkData.source.y, tx = linkData.target.x, ty = linkData.target.y;
    let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

    if (linkData._isCurved && linkData._ctrlPoint) {
      cx = linkData._ctrlPoint.x;
      cy = linkData._ctrlPoint.y;
    }

    // Converti le coordinate SVG in coordinate della pagina
    const svgRect = svg.node().getBoundingClientRect();
    const pageX = svgRect.left + cx;
    const pageY = svgRect.top + cy;

    if (!dialogues || dialogues.length === 0) {
      dialogueBox
        .html("<em>Nessun dialogo disponibile per questa stagione</em>")
        .style("left", `${pageX}px`)
        .style("top", `${pageY}px`)
        .classed("visible", true);
    } else {
      const html = dialogues.map(d => {
        return `
          <div style="margin-bottom: 8px;">
            <strong>${d.character || "?"}</strong> <em>(${d.episode || "-"})</em><br>
            "${d.line}"
          </div>
        `;
      }).join("");

      dialogueBox
        .html(html)
        .style("left", `${pageX}px`)
        .style("top", `${pageY}px`)
        .classed("visible", true);
    }
  }

  // Configura gli event listener sui link dopo aver definito showDialogueForLink
  setupLinkClickHandlers(showDialogueForLink);

  // CREAZIONE NODI
  node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node.append("circle")
    .attr("r", 14)
    .attr("fill", "#69b3a2");

  node.append("text")
    .text(d => d.id)
    .attr("x", 25)
    .attr("y", 5)
    .style("font-size", "12px");

  // Click e doppio click sui nodi
  let clickTimer = null;
  const clickDelay = 250;

  node.on("click", function(event, d) {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      toggleHighlight(d.id);
      clickTimer = null;
    }, clickDelay);
  });

  node.on("dblclick", function(event, d) {
    if (clickTimer) clearTimeout(clickTimer);

    // Regole di visualizzazione della ciambella
    if (activeNodeId && d.id !== activeNodeId) {
      return;
    }
    showDonutForNode(d);
    event.stopPropagation();
  });

  node.on("mouseover", function (event, d) {
    if (!activeNodeId || activeNodeId === d.id) return;
    const opinionData = getOpinions(activeNodeId, d.id);
    if (!opinionData) return;
    
    const matrix = this.getCTM();
    const svgRect = svg.node().getBoundingClientRect();
    const x = svgRect.left + matrix.e;
    const y = svgRect.top + matrix.f;

    tooltip
      .classed("hidden", false)
      .html(opinionData.labels.join("<br>"))
      .style("left", `${x}px`)
      .style("top", `${y - 40}px`);
  });

  node.on("mouseout", () => {
    tooltip.classed("hidden", true);
  });

  // Inizializza la visibilità dei link per la stagione corrente
  updateLinkVisibility();

  // ANIMAZIONE: aggiorna posizioni durante la simulazione
  simulation.on("tick", () => {
    // Costruisci una mappa per individuare i link bidirezionali
    const bidir = {};
    links.forEach(link => {
      const a = (link.source.id || link.source);
      const b = (link.target.id || link.target);
      bidir[`${a}->${b}`] = false;
    });
    links.forEach(link => {
      const a = (link.source.id || link.source);
      const b = (link.target.id || link.target);
      if (bidir[`${b}->${a}`] !== undefined) {
        bidir[`${a}->${b}`] = true;
        bidir[`${b}->${a}`] = true;
      }
    });

    link.attr("d", function(d) {
      const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
      const a = (d.source.id || d.source);
      const b = (d.target.id || d.target);
      
      if (bidir[`${a}->${b}`]) {
        // CURVA per link bidirezionali
        const curveOffset = 35;
        const dx = tx - sx;
        const dy = ty - sy;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const nx = -dy;
        const ny = dx;
        const norm = Math.sqrt(nx * nx + ny * ny) || 1;
        const px = mx + (nx / norm) * curveOffset;
        const py = my + (ny / norm) * curveOffset;

        d._isCurved = true;
        d._ctrlPoint = { x: px, y: py };
        return `M${sx},${sy} Q${px},${py} ${tx},${ty}`;
      } else {
        d._isCurved = false;
        d._ctrlPoint = null;
        return `M${sx},${sy}L${tx},${ty}`;
      }
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);

    // Mantieni le donut chart agganciate ai nodi
    d3.selectAll(".donut-chart").each(function() {
      const nodeId = d3.select(this).attr("data-node-id");
      const n = nodes.find(n => n.id === nodeId);
      if (n) {
        d3.select(this).attr("transform", `translate(${n.x},${n.y})`);
      }
    });
  });

  // Funzione per mostrare il dialogue box per un link
  function showDialogueForLink(linkData, seasonData) {
    const dialogues = seasonData?.dialogues?.filter(line => line.line && line.line.trim() !== "");
    
    // Calcola la posizione del dialogue box
    let sx = linkData.source.x, sy = linkData.source.y, tx = linkData.target.x, ty = linkData.target.y;
    let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

    if (linkData._isCurved && linkData._ctrlPoint) {
      cx = linkData._ctrlPoint.x;
      cy = linkData._ctrlPoint.y;
    }

    // Converti le coordinate SVG in coordinate della pagina
    const svgRect = svg.node().getBoundingClientRect();
    const pageX = svgRect.left + cx;
    const pageY = svgRect.top + cy;

    if (!dialogues || dialogues.length === 0) {
      dialogueBox
        .html("<em>Nessun dialogo disponibile per questa stagione</em>")
        .style("left", `${pageX}px`)
        .style("top", `${pageY}px`)
        .classed("visible", true);
    } else {
      const html = dialogues.map(d => {
        return `
          <div style="margin-bottom: 8px;">
            <strong>${d.character || "?"}</strong> <em>(${d.episode || "-"})</em><br>
            "${d.line}"
          </div>
        `;
      }).join("");

      dialogueBox
        .html(html)
        .style("left", `${pageX}px`)
        .style("top", `${pageY}px`)
        .classed("visible", true);
    }
  }

  function toggleHighlight(nodeId) {
    // Chiudi dialogue box, donut charts e tooltip
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    dialogueBox.html("").classed("visible", false);
    selectedLinkId = null;
    
    if (activeNodeId === nodeId) {
      // Disattiva POV
      node.select("circle").attr("opacity", 1);
      node.select("text").attr("opacity", 1);
      link.attr("opacity", 1);
      activeNodeId = null;
      tooltip.classed("hidden", true);
      updateLinkVisibility();
      return;
    }
    
    // Attiva POV
    activeNodeId = nodeId;
    selectedLinkId = null;
    
    // Trova i nodi connessi per la stagione corrente
    const connectedTargets = new Set();
    rawLinkData.forEach(l => {
      const sourceId = l.source.id || l.source;
      const targetId = l.target.id || l.target;
      
      if (sourceId === nodeId) {
        const seasonData = l.seasons?.[selectedSeason];
        if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
          connectedTargets.add(targetId);
        }
      }
    });

    // Aggiorna opacità dei nodi
    node.select("circle").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.3
    );
    node.select("text").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1
    );
    
    // Aggiorna opacità dei link
    link.attr("opacity", d => {
      const sourceId = d.source.id || d.source;
      if (sourceId === nodeId) {
        const seasonData = d.seasons?.[selectedSeason];
        return (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") ? 1 : 0.01;
      }
      return 0.01;
    });
    
    updateLinkVisibility();
  }

  function getOpinions(fromId, toId) {
    for (const link of rawLinkData) {
      const s = link.source.id || link.source;
      const t = link.target.id || link.target;
      if (s === fromId && t === toId) {
        const seasonData = link.seasons?.[selectedSeason];
        if (seasonData && seasonData.labels) {
          return { labels: seasonData.labels };
        }
      }
    }
    return null;
  }

  function drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  // Funzione per mostrare la donut chart
  function showDonutForNode(node) {
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    
    // Filtra i link in base alla stagione corrente
    const receivedLinks = rawLinkData.filter(link => {
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      return targetId === node.id && link.seasons && link.seasons[selectedSeason];
    });
    
    const labelCounts = {};
    receivedLinks.forEach(link => {
      const season = link.seasons[selectedSeason];
      if (season && Array.isArray(season.labels)) {
        season.labels.forEach(label => {
          if (!label) return;
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        });
      }
    });
    
    const data = Object.entries(labelCounts)
      .map(([label, value]) => ({ label, value }));
    
    if (!data.length) return;
    
    const thisNode = d3.selectAll("g").filter(d2 => d2 && d2.id === node.id).data()[0];
    if (!thisNode) return;
    
    const cx = thisNode.x;
    const cy = thisNode.y;
    const radius = 38, innerRadius = 18;
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const pie = d3.pie().sort(null).value(d => d.value);
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    const donutGroup = svg.append("g")
      .attr("class", "donut-chart")
      .attr("data-node-id", node.id)
      .attr("pointer-events", "none")
      .attr("transform", `translate(${cx},${cy})`);
    
    donutGroup.selectAll("path")
      .data(pie(data))
      .join("path")
      .attr("d", arc)
      .attr("fill", d => color(d.data.label))
      .attr("opacity", 0.9)
      .attr("pointer-events", "all")
      .on("mousemove", function(event, d) {
        svg.selectAll(".donut-tooltip-group").remove();
        const a = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        const labelRadius = radius + 32;
        const lx = Math.cos(a) * labelRadius + cx;
        const ly = Math.sin(a) * labelRadius + cy;
        const labelText = d.data.label;
        
        const tooltipGroup = svg.append("g")
          .attr("class", "donut-tooltip-group")
          .attr("pointer-events", "none")
          .attr("transform", `translate(${lx},${ly})`);
        
        const tempText = tooltipGroup.append("text")
          .attr("font-size", 13)
          .attr("font-family", "sans-serif")
          .attr("fill", "#000")
          .attr("x", 0)
          .attr("y", 0)
          .attr("text-anchor", "middle")
          .text(labelText);
        
        const bbox = tempText.node().getBBox();
        const paddingX = 10, paddingY = 6;
        
        tooltipGroup.insert("rect", "text")
          .attr("x", bbox.x - paddingX)
          .attr("y", bbox.y - paddingY)
          .attr("width", bbox.width + 2 * paddingX)
          .attr("height", bbox.height + 2 * paddingY)
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("fill", "#f8f8fa")
          .attr("stroke", "#bbb")
          .attr("stroke-width", 1)
          .attr("opacity", 0.86);
      })
      .on("mouseleave", function() {
        svg.selectAll(".donut-tooltip-group").remove();
      });
    
    // Auto-remove dopo 10 secondi
    setTimeout(() => {
      donutGroup.transition().duration(300).style("opacity", 0).remove();
      svg.selectAll(".donut-tooltip-group").remove();
    }, 10000);
  }

  // Event listener per chiudere il dialogue box
  if (document.getElementById('dialogue-box')) {
    document.getElementById('dialogue-box').addEventListener('click', () => {
      dialogueBox.html("").classed("visible", false);
      selectedLinkId = null;
    });
  }

});