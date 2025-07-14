const width = 800;
const height = 600;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

const colorMap = {
  positivo: "#4CAF50",
  negativo: "#F44336",
  ambiguo: "#FFC107"
};

let activeNodeId = null;
let rawLinkData = null;
let selectedSeason = "1";
let selectedLinkId = null;

// BOX DINAMICO PER I DIALOGHI (fluttuante, non fisso)
const dialogueBox = d3.select("#dialogue-box");

// SEASON DOT FILTER BAR
const seasonDotContainer = d3.select("#season-dots");
for (let i = 1; i <= 6; i++) {
  seasonDotContainer.append("div")
    .attr("class", "season-dot" + (i == 1 ? " selected" : ""))
    .attr("data-season", i)
    .text(i)
    .on("click", function () {
      selectedSeason = String(i);
      d3.selectAll(".season-dot").classed("selected", false);
      d3.select(this).classed("selected", true);
      // Chiudi eventuali box dialoghi e donut
      dialogueBox.html("").classed("visible", false);
      svg.selectAll(".donut-chart").remove();
      svg.selectAll(".donut-tooltip-group").remove();
      if (activeNodeId) toggleHighlight(activeNodeId);
    });
}

// DEFINIZIONE FRECCE
const defs = svg.append("defs");
["positivo", "negativo", "ambiguo"].forEach(judgment => {
  defs.append("marker")
    .attr("id", `arrow-${judgment}`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 32)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("markerUnits", "userSpaceOnUse")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", colorMap[judgment]);
});

d3.json("data.json").then(data => {
  rawLinkData = data.links;
  const nodes = data.nodes.map(d => ({ ...d }));
  const links = data.links.map(d => ({ ...d }));

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Creazione archi (link)
  const link = svg.append("g")
    .attr("stroke", "#aaa")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke-width", 2)
    .attr("fill", "none")
    .attr("stroke", "#444")
    .attr("marker-end", "url(#arrow-ambiguo)")
    .on("click", function (event, d) {
      if (!activeNodeId) return;

      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;

      if (sourceId !== activeNodeId) return;

      const linkKey = `${sourceId}->${targetId}`;
      if (selectedLinkId === linkKey) {
        dialogueBox.html("").classed("visible", false);
        selectedLinkId = null;
      } else {
        const seasonData = d.seasons[selectedSeason];
        const dialogues = seasonData?.dialogues?.filter(line => line.trim() !== "");

        if (dialogues && dialogues.length > 0) {
          // Calcolo posizione centro arco (gestisce anche archi curvi)
          let sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
          let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

          // Se è curvo, calcola il punto di controllo
          if (d._isCurved && d._ctrlPoint) {
            cx = d._ctrlPoint.x;
            cy = d._ctrlPoint.y;
          }

          // Posiziona il dialogueBox vicino al centro dell’arco
          dialogueBox
            .html(dialogues.map(dd => `<div>🗨️ ${dd}</div>`).join(""))
            .style("left", `${cx + 10}px`)
            .style("top", `${cy + 10}px`)
            .classed("visible", true);
        } else {
          // Calcolo posizione centro arco
          let sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
          let cx = (sx + tx) / 2, cy = (sy + ty) / 2;
          if (d._isCurved && d._ctrlPoint) {
            cx = d._ctrlPoint.x;
            cy = d._ctrlPoint.y;
          }
          dialogueBox
            .html("<em>Nessun dialogo disponibile</em>")
            .style("left", `${cx}px`)
            .style("top", `${cy}px`)
            .classed("visible", true);
        }
        selectedLinkId = linkKey;
      }
    });

  // Creazione nodi
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node.append("circle")
    .attr("r", 20)
    .attr("fill", "#69b3a2");

  node.append("text")
    .text(d => d.id)
    .attr("x", 25)
    .attr("y", 5)
    .style("font-size", "12px");

  // Click e doppio click ben gestiti
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
    // Regole di visualizzazione della ciambella:
    // - In POV: solo sul nodo POV
    // - Fuori POV (activeNodeId == null): qualunque, ma solo una volta
    if (activeNodeId && d.id !== activeNodeId) {
      // In POV: ignora doppio click se non sul nodo POV
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

  // === ARCHI CURVI SOLO SE BIDIREZIONALI ===
  simulation.on("tick", () => {
    // 1. Costruisci una mappa per individuare i link bidirezionali
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
        // CURVA: punto di controllo per la curva quadratica
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
        // Salva info per la posizione del dialogo
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

    // Mantieni la donut chart agganciata al nodo durante l'animazione
    d3.selectAll(".donut-chart").each(function() {
      const nodeId = d3.select(this).attr("data-node-id");
      const n = nodes.find(n => n.id === nodeId);
      if (n) {
        d3.select(this)
          .attr("transform", `translate(${n.x},${n.y})`);
      }
    });
  });

  function toggleHighlight(nodeId) {
    // Chiudi la donut chart e tooltip
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    dialogueBox.html("").classed("visible", false);
    selectedLinkId = null;
    if (activeNodeId === nodeId) {
      node.select("circle").attr("opacity", 1);
      node.select("text").attr("opacity", 1);
      link
        .attr("opacity", 1)
        .attr("stroke", "#444")
        .attr("marker-end", "url(#arrow-ambiguo)");
      activeNodeId = null;
      tooltip.classed("hidden", true);
      return;
    }
    activeNodeId = nodeId;
    const connectedTargets = new Set(
      links
        .filter(l => (l.source.id || l.source) === nodeId)
        .map(l => (l.target.id || l.target))
    );

    node.select("circle").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1
    );
    node.select("text").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1
    );
    link
      .attr("opacity", d => (d.source.id || d.source) === nodeId ? 1 : 0.1)
      .attr("stroke", d => {
        const seasons = Object.values(d.seasons);
        return colorMap[seasons[0].judgment] || "#999";
      })
      .attr("marker-end", d => {
        const seasons = Object.values(d.seasons);
        const judgment = seasons[0].judgment.toLowerCase();
        return `url(#arrow-${judgment})`;
      });
  }

  function getOpinions(fromId, toId) {
    for (const link of rawLinkData) {
      const s = link.source.id || link.source;
      const t = link.target.id || link.target;
      if (s === fromId && t === toId) {
        const seasons = Object.values(link.seasons);
        if (seasons.length > 0) {
          return { labels: seasons[0].labels };
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

  // DONUT: doppio click su nodo
  function showDonutForNode(node) {
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
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
    setTimeout(() => {
      donutGroup.transition().duration(300).style("opacity", 0).remove();
      svg.selectAll(".donut-tooltip-group").remove();
    }, 10000);
  }
});