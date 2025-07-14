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

const dialogueBox = d3.select("#dialogue-box");

const seasonDotContainer = d3.select("#season-dots");
for (let i = 1; i <= 6; i++) {
  seasonDotContainer.append("div")
    .attr("class", "season-dot" + (i == 1 ? " selected" : ""))
    .attr("data-season", i)
    .text(i)
    .on("click", function() {
      selectedSeason = String(i);

      d3.selectAll(".season-dot")
        .classed("selected", false);
      d3.select(this)
        .classed("selected", true);

      d3.select("#dialogue-box").html(""); // Reset box

      if (activeNodeId) toggleHighlight(activeNodeId);
    });
}

// Definizione dei marker freccia colorati
const defs = svg.append("defs");

const arrowData = [
  { id: "arrow-positivo", color: colorMap.positivo },
  { id: "arrow-negativo", color: colorMap.negativo },
  { id: "arrow-ambiguo", color: colorMap.ambiguo },
];

arrowData.forEach(({ id, color }) => {
  defs.append("marker")
    .attr("id", id)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 30) // più lungo per non finire sotto al nodo
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("markerUnits", "userSpaceOnUse")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", color);
});

d3.json("data.json").then(data => {
  rawLinkData = data.links;

  const nodes = data.nodes.map(d => Object.assign({}, d));
  const links = data.links.map(d => Object.assign({}, d));

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = svg.append("g")
  .attr("stroke", "#aaa")
  .selectAll("path")
  .data(links)
  .join("path")
  .attr("stroke-width", 2)
  .attr("fill", "none")
  .attr("stroke", "#444")
  .attr("marker-end", "url(#arrow-ambiguo)")
  .on("click", function(event, d) {
    if (!activeNodeId) return;

    const sourceId = typeof d.source === "object" ? d.source.id : d.source;
    const targetId = typeof d.target === "object" ? d.target.id : d.target;

    // Solo se l'arco parte dal POV attivo
    if (sourceId !== activeNodeId) return;

    const linkKey = `${sourceId}->${targetId}`;
    if (selectedLinkId === linkKey) {
      // Unclick
      dialogueBox.html("");
      selectedLinkId = null;
    } else {
      const seasonData = d.seasons[selectedSeason];
      const dialogues = seasonData?.dialogues?.filter(line => line.trim() !== "");
      if (dialogues && dialogues.length > 0) {
        dialogueBox.html(dialogues.map(d => `<div>${d}</div>`).join(""));
        selectedLinkId = linkKey;
      } else {
        dialogueBox.html("<em>Nessun dialogo disponibile</em>");
        selectedLinkId = linkKey;
      }
    }
  });

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

  node.on("click", (event, d) => {
    toggleHighlight(d.id);
  });

  node.on("mouseover", function(event, d) {
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

  simulation.on("tick", () => {
    link.attr("d", d => {
      // Calcolo con margine per la freccia (raggio 20)
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy);
      const offsetX = (dx * 6) / dr;
      const offsetY = (dy * 6) / dr;

      const x1 = d.source.x;
      const y1 = d.source.y;
      const x2 = d.target.x - offsetX;
      const y2 = d.target.y - offsetY;

      return `M${x1},${y1}L${x2},${y2}`;
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function toggleHighlight(nodeId) {
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

    dialogueBox.html("");
    selectedLinkId = null;
    activeNodeId = nodeId;

    const connectedTargets = new Set(
      links
        .filter(l => l.source === nodeId || l.source.id === nodeId)
        .map(l => (typeof l.target === "string" ? l.target : l.target.id))
    );

    node.select("circle").attr("opacity", d => {
      return d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1;
    });

    node.select("text").attr("opacity", d => {
      return d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1;
    });

    link
      .attr("opacity", d => (d.source.id || d.source) === nodeId ? 1 : 0.1)
      .attr("stroke", d => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        if (sourceId === nodeId) {
          const seasons = Object.values(d.seasons);
          return colorMap[seasons[0].judgment] || "#999";
        }
        return "#444";
      })
      .attr("marker-end", d => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        if (sourceId === nodeId) {
          const seasons = Object.values(d.seasons);
          const judgment = seasons[0].judgment.toLowerCase();
          return `url(#arrow-${judgment})`;
        }
        return "url(#arrow-ambiguo)";
      });
  }

  function getOpinions(fromId, toId) {
    for (const link of rawLinkData) {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (sourceId === fromId && targetId === toId) {
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
});
