class GraphVisualization {
  constructor(selectedSeasons = new Set()) {
    this.selectedSeasons = selectedSeasons;
    this.width = 2680;
    this.height = 1800;
    this.svg = null;
    this.tooltip = null;
    this.colorMap = {
      positive: "#4CAF50",
      negative: "#F44336",
      ambiguous: "#FFC107",
      neutral: "#c9c9c9ff"
    };
    
    this.activeNodeId = null;
    this.rawLinkData = null;
    this.selectedLinkId = null;
    this.graphData = null;
    this.simulation = null;
    this.link = null;
    this.node = null;
    this.dialogueBox = null;
    
    this.init();
  }
  
  init() {
    this.svg = d3.select("#main-container svg");
    this.tooltip = d3.select("#tooltip");
    this.dialogueBox = d3.select("#dialogue-box");
    
    // Setup SVG dimensions
    this.svg.attr("width", "100%").attr("height", "100%");
    
    // Setup markers
    this.setupMarkers();
    
    // Load data
    this.loadData();
  }
  
  setupMarkers() {
    const defs = this.svg.select("defs");
    ["positive", "negative", "ambiguous", "neutral"].forEach(judgment => {
      defs.append("marker")
        .attr("id", `arrow-${judgment}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .attr("markerUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", this.colorMap[judgment]);
    });
  }
  
  async loadData() {
    try {
      const data = await d3.json("data.json");
      this.rawLinkData = data.links;
      this.graphData = data;
      
      const nodes = data.nodes.map(d => ({ ...d }));
      const links = data.links.map(d => ({ ...d }));

      this.simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(300))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("collision", d3.forceCollide(40))
        .force("center", d3.forceCenter(this.width / 2, this.height / 2));

      this.createVisualization(nodes, links);
      this.updateForSeasons(this.selectedSeasons);
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  createVisualization(nodes, links) {
    const zoomGroup = this.svg.select("#zoom-group");
    
    // Create links
    this.link = zoomGroup.append("g")
      .attr("stroke", "#aaa")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .style("cursor", "pointer");

    this.setupLinkClickHandlers();

    // Create nodes
    this.node = zoomGroup.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(this.drag(this.simulation));

    this.node.append("circle")
      .attr("r", 14)
      .attr("fill", "#69b3a2");

    this.node.append("text")
      .text(d => d.id)
      .attr("x", 25)
      .attr("y", 5)
      .style("font-size", "12px");

    this.setupNodeEventHandlers();
    this.setupSimulationTick(links);
  }
  
  setupNodeEventHandlers() {
    let clickTimer = null;
    const clickDelay = 250;

    this.node.on("click", (event, d) => {
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        this.toggleHighlight(d.id);
        clickTimer = null;
      }, clickDelay);
    });

    this.node.on("dblclick", (event, d) => {
      if (clickTimer) clearTimeout(clickTimer);
      if (this.activeNodeId && d.id !== this.activeNodeId) {
        return;
      }
      this.showDonutForNode(d);
      event.stopPropagation();
    });

    this.node.on("mouseover", (event, d) => {
      if (!this.activeNodeId || this.activeNodeId === d.id) return;
      const opinionData = this.getOpinions(this.activeNodeId, d.id);
      if (!opinionData) return;
      
      const matrix = event.currentTarget.getCTM();
      const svgRect = this.svg.node().getBoundingClientRect();
      const x = svgRect.left + matrix.e;
      const y = svgRect.top + matrix.f;

      let tooltipContent;
      if (this.selectedSeasons.size > 1) {
        const seasonsArray = Array.from(this.selectedSeasons).sort();
        const boxes = seasonsArray.map(season => {
          const link = this.rawLinkData.find(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return s === this.activeNodeId && t === d.id;
          });
          
          const seasonData = link?.seasons?.[season];
          const labels = seasonData?.labels || [];
          
          let labelText = 'No opinion';
          if (labels.length > 0) {
            const inheritedMap = new Map();
            if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
              seasonData.inherited_labels.forEach(([label, originalSeason]) => {
                inheritedMap.set(label.toLowerCase(), originalSeason);
              });
            }
            
            const processedLabels = labels.map(label => {
              const labelKey = label.toLowerCase();
              if (inheritedMap.has(labelKey)) {
                return `${label} (chapter ${inheritedMap.get(labelKey)})`;
              }
              return label;
            });
            
            labelText = processedLabels.join('<br>');
          }
          
          return `<div style="display: inline-block; margin-right: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9; vertical-align: top;">
            <strong>Ch.${season}</strong><br>
            ${labelText}
          </div>`;
        }).join('');
        
        tooltipContent = `<div style="display: flex; flex-wrap: nowrap; white-space: nowrap;">${boxes}</div>`;
      } else {
        tooltipContent = opinionData.labels.join("<br>");
      }

      this.tooltip
        .classed("hidden", false)
        .html(tooltipContent)
        .style("left", `${x}px`)
        .style("top", `${y - 40}px`);
    });
    
    this.node.on("mouseout", () => {
      this.tooltip.classed("hidden", true);
    });
  }
  
  setupSimulationTick(links) {
    this.simulation.on("tick", () => {
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

      this.link.attr("d", (d) => {
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

          d._isCurved = true;
          d._ctrlPoint = { x: px, y: py };
          return `M${sx},${sy} Q${px},${py} ${tx},${ty}`;
        } else {
          d._isCurved = false;
          d._ctrlPoint = null;
          return `M${sx},${sy}L${tx},${ty}`;
        }
      });

      this.svg.selectAll(".pov-overlay-link").attr("d", (d) => {
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

      this.node.attr("transform", d => `translate(${d.x},${d.y})`);

      if (this.selectedSeasons.size > 1) {
        this.svg.selectAll(".segmented-link").remove();
        this.createSegmentedLinks();
      }

      d3.selectAll(".donut-chart").each((d, i, nodes) => {
        const nodeId = d3.select(nodes[i]).attr("data-node-id");
        const n = this.simulation.nodes().find(n => n.id === nodeId);
        if (n) {
          d3.select(nodes[i]).attr("transform", `translate(${n.x},${n.y})`);
        }
      });
    });
  }
  
  updateForSeasons(newSelectedSeasons) {
    this.selectedSeasons = newSelectedSeasons;
    this.updateGraphForSeasons();
  }
  
  updateGraphForSeasons() {
    this.activeNodeId = null;
    this.selectedLinkId = null;
    
    this.dialogueBox.html("").classed("visible", false);
    this.svg.selectAll(".donut-chart").remove();
    this.svg.selectAll(".donut-tooltip-group").remove();
    this.svg.selectAll(".segmented-links").remove();
    this.svg.selectAll(".overlay-links").remove();
    this.svg.selectAll(".pov-overlay-links").remove();
    this.svg.selectAll(".pov-segmented-overlays").remove();
    
    this.updateLinkVisibility();
    
    if (this.node) {
      this.node.select("circle").attr("opacity", 1);
      this.node.select("text").attr("opacity", 1);
    }
    if (this.link) {
      this.link.attr("opacity", 1);
    }
    
    this.tooltip.classed("hidden", true);
  }
  
  updateLinkVisibility() {
    if (!this.link) return;
    
    this.svg.selectAll(".segmented-link").remove();
    this.svg.selectAll(".overlay-link").remove();
    this.svg.selectAll(".segmented-overlay").remove();
    
    if (this.selectedSeasons.size === 0) {
      this.link.attr("display", "none");
      return;
    }
    
    this.link.attr("display", d => {
      let hasJudgment = false;
      for (const season of this.selectedSeasons) {
        const seasonData = d.seasons?.[season];
        if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
          hasJudgment = true;
          break;
        }
      }
      return hasJudgment ? "inline" : "none";
    });
    
    if (this.selectedSeasons.size === 1) {
      const season = Array.from(this.selectedSeasons)[0];
      this.link
        .attr("stroke", d => {
          const seasonData = d.seasons?.[season];
          return seasonData?.judgment ? this.colorMap[seasonData.judgment] || this.colorMap.neutral : this.colorMap.neutral;
        })
        .attr("marker-end", d => {
          const seasonData = d.seasons?.[season];
          return seasonData?.judgment ? `url(#arrow-${seasonData.judgment})` : `url(#arrow-neutral)`;
        });
    } else if (this.selectedSeasons.size > 1) {
      this.createSegmentedLinks();
      this.link.attr("display", "none");
    }
  }
  
  createSegmentedLinks() {
    const seasonsArray = Array.from(this.selectedSeasons).sort();
    const segmentCount = seasonsArray.length;
    const nodeRadius = 14;
    
    const visibleLinks = this.link.data().filter(d => {
      let hasJudgment = false;
      for (const season of this.selectedSeasons) {
        const seasonData = d.seasons?.[season];
        if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
          hasJudgment = true;
          break;
        }
      }
      return hasJudgment;
    });
    
    const segmentedGroup = this.svg.select("#zoom-group").append("g").attr("class", "segmented-links");
    
    visibleLinks.forEach(linkData => {
      const sx = linkData.source.x, sy = linkData.source.y;
      const tx = linkData.target.x, ty = linkData.target.y;
      
      const sourceId = linkData.source.id || linkData.source;
      const targetId = linkData.target.id || linkData.target;
      const isCurved = linkData._isCurved;
      
      let fullPathStart, fullPathEnd, fullPathCtrl;
      
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
      
      seasonsArray.forEach((season, index) => {
        const seasonData = linkData.seasons?.[season];
        const judgment = seasonData?.judgment || "";
        const color = judgment ? (this.colorMap[judgment] || this.colorMap.neutral) : this.colorMap.neutral;
        
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
        
        const segment = segmentedGroup.append("path")
          .attr("class", "segmented-link")
          .attr("d", segmentPath)
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("fill", "none")
          .attr("opacity", this.activeNodeId ? (sourceId === this.activeNodeId ? 1 : 0.01) : 1)
          .style("cursor", "pointer")
          .datum({
            ...linkData,
            segment: {
              season: season,
              seasonData: seasonData,
              index: index
            }
          });
        
        if (index === segmentCount - 1 && judgment) {
          segment.attr("marker-end", `url(#arrow-${judgment})`);
        }
        
        segment.on("click", (event, d) => {
          if (!this.activeNodeId) return;
          
          const sourceId = typeof d.source === "object" ? d.source.id : d.source;
          if (sourceId !== this.activeNodeId) return;
          
          const segmentSeason = d.segment.season;
          const segmentSeasonData = d.segment.seasonData;
          
          if (segmentSeasonData && segmentSeasonData.judgment && segmentSeasonData.judgment.trim() !== "") {
            this.showDialogueForLink(d, segmentSeasonData);
          } else {
            this.showNoOpinionMessage(d, segmentSeason);
          }
          
          event.stopPropagation();
        });
      });
    });
  }
  
  setupLinkClickHandlers() {
    if (!this.link) return;
    
    this.link.on("click", (event, d) => {
      if (!this.activeNodeId) return;

      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;

      if (sourceId !== this.activeNodeId) return;

      if (this.selectedSeasons.size > 1) {
        for (const season of this.selectedSeasons) {
          const seasonData = d.seasons?.[season];
          if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
            const linkKey = `${sourceId}->${targetId}-${season}`;
            
            if (this.selectedLinkId === linkKey) {
              this.dialogueBox.html("").classed("visible", false);
              this.selectedLinkId = null;
              return;
            }

            this.showDialogueForLink(d, seasonData);
            this.selectedLinkId = linkKey;
            return;
          }
        }
      } else if (this.selectedSeasons.size === 1) {
        const season = Array.from(this.selectedSeasons)[0];
        const seasonData = d.seasons?.[season];
        if (!seasonData || !seasonData.judgment || seasonData.judgment.trim() === "") return;

        const linkKey = `${sourceId}->${targetId}-${season}`;
        
        if (this.selectedLinkId === linkKey) {
          this.dialogueBox.html("").classed("visible", false);
          this.selectedLinkId = null;
          return;
        }

        this.showDialogueForLink(d, seasonData);
        this.selectedLinkId = linkKey;
      }
    });
  }
  
  toggleHighlight(nodeId) {
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    this.svg.selectAll(".segmented-links").remove();
    this.svg.selectAll(".overlay-links").remove();
    this.svg.selectAll(".pov-overlay-links").remove();
    this.svg.selectAll(".pov-segmented-overlays").remove();
    this.dialogueBox.html("").classed("visible", false);
    this.selectedLinkId = null;
    
    if (this.activeNodeId === nodeId) {
      this.node.select("circle").attr("opacity", 1);
      this.node.select("text").attr("opacity", 1);
      this.link.attr("opacity", 1);
      this.activeNodeId = null;
      this.tooltip.classed("hidden", true);
      this.updateLinkVisibility();
      return;
    }
    
    this.activeNodeId = nodeId;
    this.selectedLinkId = null;
    
    const connectedTargets = new Set();
    this.rawLinkData.forEach(l => {
      const sourceId = l.source.id || l.source;
      const targetId = l.target.id || l.target;
      
      if (sourceId === nodeId) {
        for (const season of this.selectedSeasons) {
          const seasonData = l.seasons?.[season];
          if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
            connectedTargets.add(targetId);
            break;
          }
        }
      }
    });

    this.node.select("circle").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.3
    );
    this.node.select("text").attr("opacity", d =>
      d.id === nodeId || connectedTargets.has(d.id) ? 1 : 0.1
    );
    
    this.link.attr("opacity", d => {
      const sourceId = d.source.id || d.source;
      if (sourceId === nodeId) {
        for (const season of this.selectedSeasons) {
          const seasonData = d.seasons?.[season];
          if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
            return 1;
          }
        }
        return 0.01;
      }
      return 0.01;
    });
    
    this.updateLinkVisibility();
    
    this.svg.selectAll(".segmented-link").attr("opacity", d => {
      const sourceId = d.source.id || d.source;
      return sourceId === nodeId ? 1 : 0.01;
    });
    
    if (this.selectedSeasons.size === 1) {
      const season = Array.from(this.selectedSeasons)[0];
      this.createPOVOverlaysSingle(season, nodeId);
    } else if (this.selectedSeasons.size > 1) {
      this.createPOVOverlaysMulti(nodeId);
    }
  }
  
  createPOVOverlaysSingle(season, activeNodeId) {
    const activeLinks = this.link.data().filter(d => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const seasonData = d.seasons?.[season];
      return sourceId === activeNodeId && seasonData && seasonData.judgment && seasonData.judgment.trim() !== "";
    });
    
    if (activeLinks.length === 0) return;
    
    const overlayGroup = this.svg.select("#zoom-group").append("g").attr("class", "pov-overlay-links");
    
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
      
      overlayLink.on("click", (event, d) => {
        const seasonData = d.seasons?.[season];
        if (!seasonData || !seasonData.judgment || seasonData.judgment.trim() === "") return;
        
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        const targetId = typeof d.target === "object" ? d.target.id : d.target;
        const linkKey = `${sourceId}->${targetId}-${season}`;
        
        if (this.selectedLinkId === linkKey) {
          this.dialogueBox.html("").classed("visible", false);
          this.selectedLinkId = null;
          return;
        }
        
        this.showDialogueForLink(d, seasonData);
        this.selectedLinkId = linkKey;
        event.stopPropagation();
      });
    });
  }
  
  createPOVOverlaysMulti(activeNodeId) {
    const seasonsArray = Array.from(this.selectedSeasons).sort();
    const segmentCount = seasonsArray.length;
    
    const activeLinks = this.link.data().filter(d => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      if (sourceId !== activeNodeId) return false;
      
      for (const season of this.selectedSeasons) {
        const seasonData = d.seasons?.[season];
        if (seasonData && seasonData.judgment && seasonData.judgment.trim() !== "") {
          return true;
        }
      }
      return false;
    });
    
    if (activeLinks.length === 0) return;
    
    const overlayGroup = this.svg.select("#zoom-group").append("g").attr("class", "pov-segmented-overlays");
    
    activeLinks.forEach(linkData => {
      const sx = linkData.source.x, sy = linkData.source.y;
      const tx = linkData.target.x, ty = linkData.target.y;
      const nodeRadius = 14;
      
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
      
      seasonsArray.forEach((season, index) => {
        const seasonData = linkData.seasons?.[season];
        
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
        
        segmentOverlay.on("click", (event, d) => {
          const segmentSeason = d.segment.season;
          const segmentSeasonData = d.segment.seasonData;
          
          if (segmentSeasonData && segmentSeasonData.judgment && segmentSeasonData.judgment.trim() !== "") {
            this.showDialogueForLink(d, segmentSeasonData);
          } else {
            this.showNoOpinionMessage(d, segmentSeason);
          }
          
          event.stopPropagation();
        });
      });
    });
  }
  
  showNoOpinionMessage(linkData, season) {
    let sx = linkData.source.x, sy = linkData.source.y, tx = linkData.target.x, ty = linkData.target.y;
    let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

    if (linkData._isCurved && linkData._ctrlPoint) {
      cx = linkData._ctrlPoint.x;
      cy = linkData._ctrlPoint.y;
    }

    const svgRect = this.svg.node().getBoundingClientRect();
    const pageX = svgRect.left + cx;
    const pageY = svgRect.top + cy;

    this.dialogueBox
      .html(`<div class="dialogue-content"><em>Nessuna opinione presente nel capitolo ${season}</em></div>`)
      .style("left", `${pageX}px`)
      .style("top", `${pageY}px`)
      .classed("visible", true);
  }
  
  showDialogueForLink(linkData, seasonData) {
    const dialogues = seasonData?.dialogues?.filter(line => line.line && line.line.trim() !== "");
    
    let sx = linkData.source.x, sy = linkData.source.y, tx = linkData.target.x, ty = linkData.target.y;
    let cx = (sx + tx) / 2, cy = (sy + ty) / 2;

    if (linkData._isCurved && linkData._ctrlPoint) {
      cx = linkData._ctrlPoint.x;
      cy = linkData._ctrlPoint.y;
    }

    const svgRect = this.svg.node().getBoundingClientRect();
    const pageX = svgRect.left + cx;
    const pageY = svgRect.top + cy;

    if (!dialogues || dialogues.length === 0) {
      this.dialogueBox
        .html(`<div class="dialogue-content"><em>No dialogues available for this chapter</em></div>`)
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

      this.dialogueBox
        .html(`<div class="dialogue-content">${html}</div>`)
        .style("left", `${pageX}px`)
        .style("top", `${pageY}px`)
        .classed("visible", true);
    }
  }
  
  getOpinions(fromId, toId) {
    for (const link of this.rawLinkData) {
      const s = link.source.id || link.source;
      const t = link.target.id || link.target;
      if (s === fromId && t === toId) {
        if (this.selectedSeasons.size > 1) {
          const allLabels = [];
          let hasRealOpinion = false;
          const seasonsArray = Array.from(this.selectedSeasons).sort();
          seasonsArray.forEach(season => {
            const seasonData = link.seasons?.[season];
            if (seasonData && seasonData.labels && seasonData.labels.length > 0) {
              const inheritedMap = new Map();
              if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
                seasonData.inherited_labels.forEach(([label, originalSeason]) => {
                  inheritedMap.set(label.toLowerCase(), originalSeason);
                });
              }
              
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
          return hasRealOpinion ? { labels: allLabels } : null;
        } else if (this.selectedSeasons.size === 1) {
          const season = Array.from(this.selectedSeasons)[0];
          const seasonData = link.seasons?.[season];
          if (seasonData && seasonData.labels && seasonData.labels.length > 0) {
            const inheritedMap = new Map();
            if (seasonData.inherited_labels && Array.isArray(seasonData.inherited_labels)) {
              seasonData.inherited_labels.forEach(([label, originalSeason]) => {
                inheritedMap.set(label.toLowerCase(), originalSeason);
              });
            }
            
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
  
  drag(simulation) {
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
  
  showDonutForNode(node) {
    d3.selectAll(".donut-chart").remove();
    d3.selectAll(".donut-tooltip-group").remove();
    
    const receivedLinks = this.rawLinkData.filter(link => {
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (targetId !== node.id || !link.seasons) return false;
      
      for (const season of this.selectedSeasons) {
        if (link.seasons[season]) return true;
      }
      return false;
    });
    
    const labelCounts = {};
    receivedLinks.forEach(link => {
      for (const season of this.selectedSeasons) {
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
    
    const thisNode = this.simulation.nodes().find(n => n.id === node.id);
    if (!thisNode) return;
    
    const cx = thisNode.x;
    const cy = thisNode.y;
    const radius = 38, innerRadius = 18;
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const pie = d3.pie().sort(null).value(d => d.value);
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    const donutGroup = this.svg.select("#zoom-group").append("g")
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
      .on("mousemove", (event, d) => {
        this.svg.selectAll(".donut-tooltip-group").remove();
        const a = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        const labelRadius = radius + 32;
        const lx = Math.cos(a) * labelRadius + cx;
        const ly = Math.sin(a) * labelRadius + cy;
        const labelText = d.data.label;
        
        const tooltipGroup = this.svg.select("#zoom-group").append("g")
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
      .on("mouseleave", () => {
        this.svg.selectAll(".donut-tooltip-group").remove();
      });
    
    setTimeout(() => {
      donutGroup.transition().duration(300).style("opacity", 0).remove();
      this.svg.selectAll(".donut-tooltip-group").remove();
    }, 10000);
  }
}

window.GraphVisualization = GraphVisualization;