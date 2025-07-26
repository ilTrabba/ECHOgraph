const width = 2680;  // Raddoppiato come richiesto
const height = 1800; // Raddoppiato come richiesto
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

const colorMap = {
  positive: "#4CAF50",
  negative: "#F44336",
  ambiguous: "#FFC107",
  neutral: "#c9c9c9ff"
};

let activeNodeId = null;
let rawLinkData = null;
let selectedSeasons = new Set(); // Changed to support multiple selection
let selectedLinkId = null;
let graphData = null;
let simulation = null;
let link = null;
let node = null;

// BOX DINAMICO PER I DIALOGHI
const dialogueBox = d3.select("#dialogue-box");

// SEASON DOT FILTER BAR
const seasonDotContainer = d3.select("#season-dots");

// Function to center graph immediately without animation
function centerGraphImmediate() {
  if (!simulation || !node) return;
  
  const nodes = simulation.nodes();
  if (nodes.length === 0) return;
  
  // Find graph bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  nodes.forEach(d => {
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.y > maxY) maxY = d.y;
  });
  
  // Calculate center
  const graphCenterX = (minX + maxX) / 2;
  const graphCenterY = (minY + maxY) / 2;
  
  // Viewport center
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  
  // Calculate transform
  const translateX = viewportCenterX - graphCenterX;
  const translateY = viewportCenterY - graphCenterY;
  
  // Apply transform IMMEDIATELY without animation
  const svgElement = svg.node();
  svgElement.style.transform = `translate(${translateX}px, ${translateY}px)`;
}

document.addEventListener('DOMContentLoaded', function() {
    const pageToggle = document.getElementById('pageToggle');
    
    if (pageToggle) {
        pageToggle.addEventListener('change', function() {
            if (!this.checked) {
                // Add exit animation
                document.body.classList.add('page-fade-out');
                
                setTimeout(() => {
                    // Add center parameter when going to graph
                    window.location.href = '../CHORD/index_chord.html'; 
                }, 250);
            }
        });
    }
});

for (let i = 1; i <= 6; i++) {
  seasonDotContainer.append("div")
    .attr("class", "season-dot") // No initial selection
    .attr("data-season", i)
    .text(i)
    .on("click", function () {
      const season = String(i);
      
      if (selectedSeasons.has(season)) {
        // Deselect if already selected
        selectedSeasons.delete(season);
        d3.select(this).classed("selected", false);
      } else {
        // Select if not selected
        // If no seasons selected, allow single selection
        // If seasons already selected, allow multiple selection
        selectedSeasons.add(season);
        d3.select(this).classed("selected", true);
      }

      // Update graph for selected seasons
      updateGraphForSeasons();
    });
}

// Reset button
seasonDotContainer.append("div")
  .attr("class", "reset-button")
  .text("↻")
  .on("click", function () {
    // Deseleziona tutti i capitoli
    selectedSeasons.clear();
    
    // Rimuovi la classe selected da tutti i dot
    seasonDotContainer.selectAll(".season-dot").classed("selected", false);
    
    // Aggiorna il grafo
    updateGraphForSeasons();
  });


// DEFINIZIONE FRECCE - Allineate con quelle nell'HTML
const defs = svg.append("defs");
["positive", "negative", "ambiguous", "neutral"].forEach(judgment => {
  defs.append("marker")
    .attr("id", `arrow-${judgment}`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20) // Mantiene il valore corretto per la precisione
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("markerUnits", "userSpaceOnUse")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", colorMap[judgment]);
});

// Function to update graph for selected seasons
function updateGraphForSeasons() {
  // Reset state
  activeNodeId = null;
  selectedLinkId = null;
  
  // Close dialogue box and remove all overlays
  dialogueBox.html("").classed("visible", false);
  svg.selectAll(".donut-chart").remove();
  svg.selectAll(".donut-tooltip-group").remove();
  svg.selectAll(".segmented-links").remove();
  svg.selectAll(".overlay-links").remove();
  svg.selectAll(".pov-overlay-links").remove();
  svg.selectAll(".pov-segmented-overlays").remove();
  
  // Update link visibility and style for selected seasons
  updateLinkVisibility();
  
  // Restore node opacity
  if (node) {
    node.select("circle").attr("opacity", 1);
    node.select("text").attr("opacity", 1);
  }
  if (link) {
    link.attr("opacity", 1);
  }
  
  // Hide tooltip if visible
  tooltip.classed("hidden", true);
}

// Function to update link visibility for multiple seasons
function updateLinkVisibility() {
  if (!link) return;
  
  // Remove any existing segmented links and overlay links
  svg.selectAll(".segmented-link").remove();
  svg.selectAll(".overlay-link").remove();
  svg.selectAll(".segmented-overlay").remove();
  
  // If no seasons selected, hide all links
  if (selectedSeasons.size === 0) {
    link.attr("display", "none");
    return;
  }
  
  // For each link, check if it has any non-empty judgment in selected seasons
  link.attr("display", d => {
    let hasJudgment = false;
    for (const season of selectedSeasons) {
      const seasonData = d.seasons?.[season];
      if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
        hasJudgment = true;
        break;
      }
    }
    return hasJudgment ? "inline" : "none";
  });
  
  // If only one season selected, use simple coloring (NO overlay creation here)
  if (selectedSeasons.size === 1) {
    const season = Array.from(selectedSeasons)[0];
    link
      .attr("stroke", d => {
        const seasonData = d.seasons?.[season];
        return seasonData?.judgment ? colorMap[seasonData.judgment] || colorMap.neutral : colorMap.neutral;
      })
      .attr("marker-end", d => {
        const seasonData = d.seasons?.[season];
        return seasonData?.judgment ? `url(#arrow-${seasonData.judgment})` : `url(#arrow-neutral)`;
      });
  } else if (selectedSeasons.size > 1) {
    // Multiple seasons - create segmented paths (NO overlay creation here)
    createSegmentedLinks();
    // Hide original links when segmented
    link.attr("display", "none");
  }
}

// Function to create overlay links for POV mode - Single Chapter
function createPOVOverlaysSingle(season, activeNodeId) {
  // Get links from active node only
  const activeLinks = link.data().filter(d => {
    const sourceId = typeof d.source === "object" ? d.source.id : d.source;
    const seasonData = d.seasons?.[season];
    return sourceId === activeNodeId && seasonData && seasonData.judgment && seasonData.judgment.trim() !== "";
  });
  
  if (activeLinks.length === 0) return;
  
  const overlayGroup = svg.append("g").attr("class", "pov-overlay-links");
  
  // Insert overlay group before nodes
  const nodeGroup = node.node().parentNode;
  nodeGroup.parentNode.insertBefore(overlayGroup.node(), nodeGroup);
  
  activeLinks.forEach(linkData => {
    const overlayLink = overlayGroup.append("path")
      .attr("class", "pov-overlay-link")
      .attr("stroke", "transparent")
      .attr("stroke-width", 14)
      .attr("fill", "none")
      .attr("opacity", 0)
      .style("cursor", "pointer")
      .style("pointer-events", "stroke")
      .datum(linkData);
    
    // Add click handler
    overlayLink.on("click", function(event, d) {
      const seasonData = d.seasons?.[season];
      if (!seasonData || !seasonData.judgment || seasonData.judgment.trim() === "") return;
      
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;
      const linkKey = `${sourceId}->${targetId}-${season}`;
      
      if (selectedLinkId === linkKey) {
        dialogueBox.html("").classed("visible", false);
        selectedLinkId = null;
        return;
      }
      
      showDialogueForLink(d, seasonData);
      selectedLinkId = linkKey;
      event.stopPropagation();
    });
  });
}

// Function to create segmented overlay links for POV mode - Multi Chapter
function createPOVOverlaysMulti(activeNodeId) {
  const seasonsArray = Array.from(selectedSeasons).sort();
  const segmentCount = seasonsArray.length;
  
  // Get links from active node only
  const activeLinks = link.data().filter(d => {
    const sourceId = typeof d.source === "object" ? d.source.id : d.source;
    if (sourceId !== activeNodeId) return false;
    
    // Check if any selected season has judgment
    for (const season of selectedSeasons) {
      const seasonData = d.seasons?.[season];
      if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
        return true;
      }
    }
    return false;
  });
  
  if (activeLinks.length === 0) return;
  
  const overlayGroup = svg.append("g").attr("class", "pov-segmented-overlays");
  
  // Insert overlay group before nodes
  const nodeGroup = node.node().parentNode;
  nodeGroup.parentNode.insertBefore(overlayGroup.node(), nodeGroup);
  
  activeLinks.forEach(linkData => {
    const sx = linkData.source.x, sy = linkData.source.y;
    const tx = linkData.target.x, ty = linkData.target.y;
    const nodeRadius = 14;
    
    // Calculate full path (same logic as createSegmentedLinks)
    let fullPathStart, fullPathEnd, fullPathCtrl;
    const isCurved = linkData._isCurved;
    
    if (isCurved && linkData._ctrlPoint) {
      fullPathStart = { x: sx, y: sy };
      fullPathEnd = { x: tx, y: ty };
      fullPathCtrl = { x: linkData._ctrlPoint.x, y: linkData._ctrlPoint.y };
    } else {
      const dx = tx - sx;
      const dy = ty - sy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const unitX = dx / distance;
      const unitY = dy / distance;
      
      fullPathStart = { 
        x: sx + unitX * nodeRadius, 
        y: sy + unitY * nodeRadius 
      };
      fullPathEnd = { 
        x: tx - unitX * nodeRadius, 
        y: ty - unitY * nodeRadius 
      };
    }
    
    // Create overlay for each segment
    seasonsArray.forEach((season, index) => {
      const seasonData = linkData.seasons?.[season];
      
      // Calculate segment path
      let segmentPath;
      if (isCurved && fullPathCtrl) {
        const t1 = index / segmentCount;
        const t2 = (index + 1) / segmentCount;
        
        const startX = (1-t1)*(1-t1)*fullPathStart.x + 2*(1-t1)*t1*fullPathCtrl.x + t1*t1*fullPathEnd.x;
        const startY = (1-t1)*(1-t1)*fullPathStart.y + 2*(1-t1)*t1*fullPathCtrl.y + t1*t1*fullPathEnd.y;
        const endX = (1-t2)*(1-t2)*fullPathStart.x + 2*(1-t2)*t2*fullPathCtrl.x + t2*t2*fullPathEnd.x;
        const endY = (1-t2)*(1-t2)*fullPathStart.y + 2*(1-t2)*t2*fullPathCtrl.y + t2*t2*fullPathEnd.y;
        
        const segCtrlX = (1-(t1+t2)/2)*(1-(t1+t2)/2)*fullPathStart.x + 2*(1-(t1+t2)/2)*((t1+t2)/2)*fullPathCtrl.x + ((t1+t2)/2)*((t1+t2)/2)*fullPathEnd.x;
        const segCtrlY = (1-(t1+t2)/2)*(1-(t1+t2)/2)*fullPathStart.y + 2*(1-(t1+t2)/2)*((t1+t2)/2)*fullPathCtrl.y + ((t1+t2)/2)*((t1+t2)/2)*fullPathEnd.y;
        
        segmentPath = `M${startX},${startY} Q${segCtrlX},${segCtrlY} ${endX},${endY}`;
      } else {
        const startX = fullPathStart.x + (fullPathEnd.x - fullPathStart.x) * (index / segmentCount);
        const startY = fullPathStart.y + (fullPathEnd.y - fullPathStart.y) * (index / segmentCount);
        const endX = fullPathStart.x + (fullPathEnd.x - fullPathStart.x) * ((index + 1) / segmentCount);
        const endY = fullPathStart.y + (fullPathEnd.y - fullPathStart.y) * ((index + 1) / segmentCount);
        
        segmentPath = `M${startX},${startY}L${endX},${endY}`;
      }
      
      // Create segment overlay
      const segmentOverlay = overlayGroup.append("path")
        .attr("class", "pov-segmented-overlay")
        .attr("d", segmentPath)
        .attr("stroke", "transparent")
        .attr("stroke-width", 15)
        .attr("fill", "none")
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .style("pointer-events", "stroke")
        .datum({
          ...linkData,
          segment: {
            season: season,
            seasonData: seasonData,
            index: index
          }
        });
      
      // Add click handler for segment
      segmentOverlay.on("click", function(event, d) {
        const segmentSeason = d.segment.season;
        const segmentSeasonData = d.segment.seasonData;
        
        if (segmentSeasonData && segmentSeasonData.judgment && segmentSeasonData.judgment.trim() !== "") {
          showDialogueForLink(d, segmentSeasonData);
        } else {
          showNoOpinionMessage(d, segmentSeason);
        }
        
        event.stopPropagation();
      });
    });
  });
}

// Function to create segmented links for multi-chapter visualization
function createSegmentedLinks() {
  const seasonsArray = Array.from(selectedSeasons).sort();
  const segmentCount = seasonsArray.length;
  const nodeRadius = 14; // Same as the circle radius
  
  // Get visible links data
  const visibleLinks = link.data().filter(d => {
    let hasJudgment = false;
    for (const season of selectedSeasons) {
      const seasonData = d.seasons?.[season];
      if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
        hasJudgment = true;
        break;
      }
    }
    return hasJudgment;
  });
  
  const segmentedGroup = svg.append("g").attr("class", "segmented-links");
  
  // Sposta il gruppo segmentato prima dei nodi nel DOM per il corretto z-order
  node.node().parentNode.insertBefore(segmentedGroup.node(), node.node());
  
  visibleLinks.forEach(linkData => {
    const sx = linkData.source.x, sy = linkData.source.y;
    const tx = linkData.target.x, ty = linkData.target.y;
    
    // Determine if this is a curved link (bidirectional)
    const sourceId = linkData.source.id || linkData.source;
    const targetId = linkData.target.id || linkData.target;
    const isCurved = linkData._isCurved;
    
    // Calculate the full path points (like the original links)
    let fullPathStart, fullPathEnd, fullPathCtrl;
    
    if (isCurved && linkData._ctrlPoint) {
      // For curved links, use the same calculation as the original
      fullPathStart = { x: sx, y: sy };
      fullPathEnd = { x: tx, y: ty };
      fullPathCtrl = { x: linkData._ctrlPoint.x, y: linkData._ctrlPoint.y };
    } else {
      // For straight links, calculate adjusted endpoints exactly like D3 does
      const dx = tx - sx;
      const dy = ty - sy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const unitX = dx / distance;
      const unitY = dy / distance;
      
      fullPathStart = { 
        x: sx + unitX * nodeRadius, 
        y: sy + unitY * nodeRadius 
      };
      fullPathEnd = { 
        x: tx - unitX * nodeRadius, 
        y: ty - unitY * nodeRadius 
      };
    }
    
    seasonsArray.forEach((season, index) => {
      const seasonData = linkData.seasons?.[season];
      const judgment = seasonData?.judgment || "";
      const color = judgment ? (colorMap[judgment] || colorMap.neutral) : colorMap.neutral;
      
      // Calculate segment path
      let segmentPath;
      if (isCurved && fullPathCtrl) {
        // For curved links, create segments along the curve
        const t1 = index / segmentCount;
        const t2 = (index + 1) / segmentCount;
        
        // Calculate points along the original curve
        const startX = (1-t1)*(1-t1)*fullPathStart.x + 2*(1-t1)*t1*fullPathCtrl.x + t1*t1*fullPathEnd.x;
        const startY = (1-t1)*(1-t1)*fullPathStart.y + 2*(1-t1)*t1*fullPathCtrl.y + t1*t1*fullPathEnd.y;
        const endX = (1-t2)*(1-t2)*fullPathStart.x + 2*(1-t2)*t2*fullPathCtrl.x + t2*t2*fullPathEnd.x;
        const endY = (1-t2)*(1-t2)*fullPathStart.y + 2*(1-t2)*t2*fullPathCtrl.y + t2*t2*fullPathEnd.y;
        
        // Control point for this segment
        const segCtrlX = (1-(t1+t2)/2)*(1-(t1+t2)/2)*fullPathStart.x + 2*(1-(t1+t2)/2)*((t1+t2)/2)*fullPathCtrl.x + ((t1+t2)/2)*((t1+t2)/2)*fullPathEnd.x;
        const segCtrlY = (1-(t1+t2)/2)*(1-(t1+t2)/2)*fullPathStart.y + 2*(1-(t1+t2)/2)*((t1+t2)/2)*fullPathCtrl.y + ((t1+t2)/2)*((t1+t2)/2)*fullPathEnd.y;
        
        segmentPath = `M${startX},${startY} Q${segCtrlX},${segCtrlY} ${endX},${endY}`;
      } else {
        // For straight links, create linear segments using the adjusted coordinates
        const startX = fullPathStart.x + (fullPathEnd.x - fullPathStart.x) * (index / segmentCount);
        const startY = fullPathStart.y + (fullPathEnd.y - fullPathStart.y) * (index / segmentCount);
        const endX = fullPathStart.x + (fullPathEnd.x - fullPathStart.x) * ((index + 1) / segmentCount);
        const endY = fullPathStart.y + (fullPathEnd.y - fullPathStart.y) * ((index + 1) / segmentCount);
        
        segmentPath = `M${startX},${startY}L${endX},${endY}`;
      }
      
      // Create the segment path
      const segment = segmentedGroup.append("path")
        .attr("class", "segmented-link")
        .attr("d", segmentPath)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("opacity", activeNodeId ? (sourceId === activeNodeId ? 1 : 0.01) : 1)
        .style("cursor", "pointer")
        .datum({
          ...linkData,
          segment: {
            season: season,
            seasonData: seasonData,
            index: index
          }
        });
      
      // Add arrow marker only to the last segment
      if (index === segmentCount - 1 && judgment) {
        segment.attr("marker-end", `url(#arrow-${judgment})`);
      }
      
      // Add click handler for segment
      segment.on("click", function(event, d) {
        if (!activeNodeId) return;
        
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        if (sourceId !== activeNodeId) return;
        
        const segmentSeason = d.segment.season;
        const segmentSeasonData = d.segment.seasonData;
        
        if (segmentSeasonData && segmentSeasonData.judgment && segmentSeasonData.judgment.trim() !== "") {
          // Show dialogue for this specific season
          showDialogueForLink(d, segmentSeasonData);
        } else {
          // Show "no opinion" message
          showNoOpinionMessage(d, segmentSeason);
        }
        
        event.stopPropagation();
      });
    });
  });
}

// Function to show "no opinion" message for neutral segments
function showNoOpinionMessage(linkData, season) {
  let sx = linkData.source.x, sy = linkData.source.y, tx = linkData.target.x, ty = linkData.target.y;
  let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

  if (linkData._isCurved && linkData._ctrlPoint) {
    cx = linkData._ctrlPoint.x;
    cy = linkData._ctrlPoint.y;
  }

  const svgRect = svg.node().getBoundingClientRect();
  const pageX = svgRect.left + cx;
  const pageY = svgRect.top + cy;

  dialogueBox
    .html(`<em>Nessuna opinione presente nel capitolo ${season}</em>`)
    .style("left", `${pageX}px`)
    .style("top", `${pageY}px`)
    .classed("visible", true);
}

// Global function to show dialogue box for a link
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
      .html("<em>No dialogues available for this chapter</em>")
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

// Function to configure event listeners on links
function setupLinkClickHandlers(showDialogueCallback) {
  if (!link) return;
  
  link.on("click", function (event, d) {
    // Allow click on links only in POV mode
    if (!activeNodeId) return;

    const sourceId = typeof d.source === "object" ? d.source.id : d.source;
    const targetId = typeof d.target === "object" ? d.target.id : d.target;

    // Allow click only on links from the active node
    if (sourceId !== activeNodeId) return;

    // If multiple seasons selected, need to determine which segment was clicked
    if (selectedSeasons.size > 1) {
      // For now, show dialogue for first season with judgment
      // TODO: Implement segment-based clicking
      for (const season of selectedSeasons) {
        const seasonData = d.seasons?.[season];
        if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
          const linkKey = `${sourceId}->${targetId}-${season}`;
          
          if (selectedLinkId === linkKey) {
            dialogueBox.html("").classed("visible", false);
            selectedLinkId = null;
            return;
          }

          showDialogueCallback(d, seasonData);
          selectedLinkId = linkKey;
          return;
        }
      }
    } else if (selectedSeasons.size === 1) {
      // Single season - original behavior
      const season = Array.from(selectedSeasons)[0];
      const seasonData = d.seasons?.[season];
      if (!seasonData || !seasonData.judgment || seasonData.judgment.trim() === "") return;

      const linkKey = `${sourceId}->${targetId}-${season}`;
      
      if (selectedLinkId === linkKey) {
        dialogueBox.html("").classed("visible", false);
        selectedLinkId = null;
        return;
      }

      showDialogueCallback(d, seasonData);
      selectedLinkId = linkKey;
    }
  });
}

d3.json("../data.json").then(data => {
  rawLinkData = data.links;
  graphData = data;
  
  const nodes = data.nodes.map(d => ({ ...d }));
  const links = data.links.map(d => ({ ...d }));

  // Check if we need to center immediately (coming from chord)
  const urlParams = new URLSearchParams(window.location.search);
  const shouldCenter = urlParams.get('center');
  const povCharacter = urlParams.get('character');
  const povSeasons = urlParams.get('seasons');
  let hasCentered = false; // Flag to center only once

  // Se arriva dal CHORD con POV, imposta le stagioni selezionate
  if (povSeasons) {
    selectedSeasons.clear();
    povSeasons.split(',').forEach(season => {
      selectedSeasons.add(season);
      // Aggiorna anche i dot visivamente
      seasonDotContainer.selectAll(".season-dot")
        .classed("selected", function() {
          return povSeasons.split(',').includes(d3.select(this).attr("data-season"));
        });
    });
  }

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
        .html("<em>No dialogues available for this chapter</em>")
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

  // Se arriva dal CHORD con POV, attiva automaticamente il POV
  if (povCharacter && shouldCenter === 'true') {
    setTimeout(() => {
      toggleHighlight(povCharacter);
      centerGraphImmediate();
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 100);
  }

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

    let tooltipContent;
    if (selectedSeasons.size > 1) {
      // Multi-chapter mode: show boxes side by side with inheritance info
      const seasonsArray = Array.from(selectedSeasons).sort();
      const boxes = seasonsArray.map(season => {
        const link = rawLinkData.find(l => {
          const s = l.source.id || l.source;
          const t = l.target.id || l.target;
          return s === activeNodeId && t === d.id;
        });
        
        const seasonData = link?.seasons?.[season];
        const labels = seasonData?.labels || [];
        
        let labelText = 'No opinion';
        if (labels.length > 0) {
          // Crea una mappa per le label ereditate
          const inheritedMap = new Map();
          if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
            seasonData.inherited_labels.forEach(([label, originalSeason]) => {
              inheritedMap.set(label.toLowerCase(), originalSeason);
            });
          }
          
          // Processa le label con informazioni di ereditarietà
          const processedLabels = labels.map(label => {
            const labelKey = label.toLowerCase();
            if (inheritedMap.has(labelKey)) {
              return `${label} (chapter ${inheritedMap.get(labelKey)})`;
            }
            return label;
          });
          
          // Unisci le label con <br> invece che con virgole per metterle una per riga
          labelText = processedLabels.join('<br>');
        }
        
        return `<div style="display: inline-block; margin-right: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9; vertical-align: top;">
          <strong>Ch.${season}</strong><br>
          ${labelText}
        </div>`;
      }).join('');
      
      // Usa display: flex con nowrap per forzare i box sempre in orizzontale
      tooltipContent = `<div style="display: flex; flex-wrap: nowrap; white-space: nowrap;">${boxes}</div>`;
    } else {
      // Single chapter mode: uses getOpinions which already has inheritance info
      tooltipContent = opinionData.labels.join("<br>");
    }

    tooltip
      .classed("hidden", false)
      .html(tooltipContent)
      .style("left", `${x}px`)
      .style("top", `${y - 40}px`);
  });
  
  node.on("mouseout", () => {
    tooltip.classed("hidden", true);
  });

  // Inizializza la visibilità dei link per la stagione corrente
  updateLinkVisibility();

  // ANIMATION: update positions during simulation
  simulation.on("tick", () => {
    // CENTRA IMMEDIATAMENTE AL PRIMO TICK se necessario
    if (shouldCenter === 'true' && !hasCentered) {
      hasCentered = true;
      
      // Centra immediatamente senza setTimeout
      centerGraphImmediate();
      // Rimuovi il parametro dall'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Build map to identify bidirectional links
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
        // CURVE for bidirectional links
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

    // Update POV overlay links to match normal links
    svg.selectAll(".pov-overlay-link").attr("d", function(d) {
      const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
      const a = (d.source.id || d.source);
      const b = (d.target.id || d.target);
      
      if (bidir[`${a}->${b}`]) {
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
        return `M${sx},${sy} Q${px},${py} ${tx},${ty}`;
      } else {
        return `M${sx},${sy}L${tx},${ty}`;
      }
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);

    // Update segmented links if they exist
    if (selectedSeasons.size > 1) {
      svg.selectAll(".segmented-link").remove();
      createSegmentedLinks();
    }

    // Keep donut charts attached to nodes
    d3.selectAll(".donut-chart").each(function() {
      const nodeId = d3.select(this).attr("data-node-id");
      const n = nodes.find(n => n.id === nodeId);
      if (n) {
        d3.select(this).attr("transform", `translate(${n.x},${n.y})`);
      }
    });
  });

  function toggleHighlight(nodeId) {
    // Close dialogue box, donut charts and tooltip
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    svg.selectAll(".segmented-links").remove();
    svg.selectAll(".overlay-links").remove();
    svg.selectAll(".pov-overlay-links").remove();         // Rimuovi overlay POV esistenti
    svg.selectAll(".pov-segmented-overlays").remove();    // Rimuovi overlay segmentati esistenti
    dialogueBox.html("").classed("visible", false);
    selectedLinkId = null;
    
    if (activeNodeId === nodeId) {
      // Deactivate POV
      node.select("circle").attr("opacity", 1);
      node.select("text").attr("opacity", 1);
      link.attr("opacity", 1);
      activeNodeId = null;
      tooltip.classed("hidden", true);
      updateLinkVisibility();
      return;
    }
    
    // Activate POV
    activeNodeId = nodeId;
    selectedLinkId = null;
    
    // Find connected nodes for selected seasons
    const connectedTargets = new Set();
    rawLinkData.forEach(l => {
      const sourceId = l.source.id || l.source;
      const targetId = l.target.id || l.target;
      
      if (sourceId === nodeId) {
        for (const season of selectedSeasons) {
          const seasonData = l.seasons?.[season];
          if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
            connectedTargets.add(targetId);
            break; // Found at least one connection, add target
          }
        }
      }
    });

    // Update node opacity
    node.select("circle").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.3
    );
    node.select("text").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1
    );
    
    // Update link opacity
    link.attr("opacity", d => {
      const sourceId = d.source.id || d.source;
      if (sourceId === nodeId) {
        // Check if any selected season has judgment
        for (const season of selectedSeasons) {
          const seasonData = d.seasons?.[season];
          if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
            return 1;
          }
        }
        return 0.01;
      }
      return 0.01;
    });
    
    updateLinkVisibility();
    
    // Update segmented link opacity if they exist
    svg.selectAll(".segmented-link").attr("opacity", d => {
      const sourceId = d.source.id || d.source;
      return sourceId === nodeId ? 1 : 0.01;
    });
    
    // 🎯 CREATE POV OVERLAYS HERE!
    if (selectedSeasons.size === 1) {
      // Single chapter: create simple overlays
      const season = Array.from(selectedSeasons)[0];
      createPOVOverlaysSingle(season, nodeId);
    } else if (selectedSeasons.size > 1) {
      // Multi chapter: create segmented overlays
      createPOVOverlaysMulti(nodeId);
    }
  }

  function getOpinions(fromId, toId) {
    for (const link of rawLinkData) {
      const s = link.source.id || link.source;
      const t = link.target.id || link.target;
      if (s === fromId && t === toId) {
        // If multiple seasons selected, combine labels from all seasons
        if (selectedSeasons.size > 1) {
          const allLabels = [];
          let hasRealOpinion = false;
          const seasonsArray = Array.from(selectedSeasons).sort();
          seasonsArray.forEach(season => {
            const seasonData = link.seasons?.[season];
            if (seasonData && seasonData.labels && seasonData.labels.length > 0) {
              // Crea una mappa per le label ereditate
              const inheritedMap = new Map();
              if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
                seasonData.inherited_labels.forEach(([label, originalSeason]) => {
                  // Confronto case-insensitive per gestire variazioni di maiuscole/minuscole
                  inheritedMap.set(label.toLowerCase(), originalSeason);
                });
              }
              
              // Processa le label con informazioni di ereditarietà
              const processedLabels = seasonData.labels.map(label => {
                const labelKey = label.toLowerCase();
                if (inheritedMap.has(labelKey)) {
                  return `${label} (chapter ${inheritedMap.get(labelKey)})`;
                }
                return label;
              });
              
              allLabels.push(`Chapter ${season}: ${processedLabels.join(', ')}`);
              hasRealOpinion = true;
            } else {
              allLabels.push(`Chapter ${season}: No opinion`);
            }
          });
          // Restituisci null se non ci sono opinioni reali in nessun capitolo
          return hasRealOpinion ? { labels: allLabels } : null;
        } else if (selectedSeasons.size === 1) {
          // Single season - original behavior with inheritance info
          const season = Array.from(selectedSeasons)[0];
          const seasonData = link.seasons?.[season];
          if (seasonData && seasonData.labels && seasonData.labels.length > 0) {
            // Crea una mappa per le label ereditate
            const inheritedMap = new Map();
            if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
              seasonData.inherited_labels.forEach(([label, originalSeason]) => {
                // Confronto case-insensitive per gestire variazioni di maiuscole/minuscole
                inheritedMap.set(label.toLowerCase(), originalSeason);
              });
            }
            
            // Processa le label con informazioni di ereditarietà
            const processedLabels = seasonData.labels.map(label => {
              const labelKey = label.toLowerCase();
              if (inheritedMap.has(labelKey)) {
                return `${label} (chapter ${inheritedMap.get(labelKey)})`;
              }
              return label;
            });
            
            return { labels: processedLabels };
          }
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

  // Function to show donut chart
  function showDonutForNode(node) {
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    
    // Filter links based on selected seasons
    const receivedLinks = rawLinkData.filter(link => {
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (targetId !== node.id || !link.seasons) return false;
      
      // Check if any selected season has data
      for (const season of selectedSeasons) {
        if (link.seasons[season]) return true;
      }
      return false;
    });
    
    const labelCounts = {};
    receivedLinks.forEach(link => {
      for (const season of selectedSeasons) {
        const seasonData = link.seasons[season];
        if (seasonData && Array.isArray(seasonData.labels)) {
          seasonData.labels.forEach(label => {
            if (!label) return;
            labelCounts[label] = (labelCounts[label] || 0) + 1;
          });
        }
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
    
    // Auto-remove after 10 seconds
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