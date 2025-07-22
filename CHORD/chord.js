// Stato dell'applicazione
let state = {
    selectedCharacter: null,
    selectedLabel: null,
    selectedType: null, // 'character' o 'label'
    selectedSeasons: new Set(["1"]), // Inizializzazione con stagione 1 selezionata
    data: null,
    svg: null,
    zoomGroup: null,
    characterNodes: [],
    characteristicNodes: [],
    thoughtNodes: [],
    connections: [],
    groupedConnections: [],
    currentZoom: 1,
    currentTranslateX: 0,
    currentTranslateY: 0,
    config: {
    outerRadius: 0,
    innerRadius: 0,
    arcRadius: 0,
    labelRadius: 0,
    externalLabelRadius: 0,
    centerX: 0,
    centerY: 0,
    scaleFactor: 1.5,
    minArcGap: 0.08,
    minLabelSpacing: 0.08,
    colors: {
        character: '#ffffff',
        characterStroke: '#4fc3f7',
        characteristic: '#333',
        thoughtNode: '#ff6b6b',
        outgoingLine: '#ff6b6b',
        incomingLine: '#4fc3f7',
        defaultConnection: '#444444'
    }
}
};

// --- NUOVE FUNZIONI DA AGGIUNGERE IN FONDO ---

// --- Calcola il raggio dinamico per le label interne ---
function calculateDynamicLabelRadius() {
    if (!state.data) return 200;
    
    // Conta tutte le label uniche che verranno visualizzate
    const allLabels = new Set();
    
    state.data.nodes.forEach(node => {
        allLabels.add(node.id); // nomi personaggi (thought nodes)
    });
    
    state.data.links.forEach(link => {
        if (link.seasons && 
            link.seasons[state.selectedSeason] && 
            link.seasons[state.selectedSeason].labels) {
            link.seasons[state.selectedSeason].labels.forEach(label => {
                allLabels.add(label); // label caratteristiche
            });
        }
    });
    
    const totalLabels = allLabels.size;
    
    // Calcola lo spazio angolare necessario per ogni label
    const fontSize = 13 * state.config.scaleFactor;
    const avgLabelLength = Array.from(allLabels).reduce((sum, label) => sum + label.length, 0) / totalLabels;
    const avgCharWidth = fontSize * 0.6;
    const avgLabelPixelWidth = avgLabelLength * avgCharWidth;
    
    // Spaziatura minima desiderata in pixel tra le label
    const minSpacingPixels = 15 * state.config.scaleFactor;
    
    // Calcola il raggio necessario per garantire la spaziatura minima
    const totalPixelWidthNeeded = totalLabels * (avgLabelPixelWidth + minSpacingPixels);
    const circumferenceNeeded = totalPixelWidthNeeded;
    const radiusNeeded = circumferenceNeeded / (2 * Math.PI);
    
    // Raggio minimo per evitare che sia troppo piccolo
    const minRadius = 150 * state.config.scaleFactor;
    const maxRadius = 400 * state.config.scaleFactor;
    
    return Math.max(minRadius, Math.min(maxRadius, radiusNeeded));
}

// --- Utility per stima larghezza label più lunga (in pixel) ---
function estimateMaxLabelPixelWidth() {
    let maxLength = 0;
    let texts = [];
    if (!state.data) return 0;
    state.data.nodes.forEach(node => texts.push(node.id));
    state.data.links.forEach(link => {
        Object.values(link.seasons || {}).forEach(seasonObj => {
            if (Array.isArray(seasonObj.labels)) texts = texts.concat(seasonObj.labels);
        });
    });
    texts.forEach(t => {
        if (typeof t === 'string' && t.length > maxLength) maxLength = t.length;
    });
    const fontSize = 13 * state.config.scaleFactor;
    const avgCharWidth = fontSize * 0.6;
    return maxLength * avgCharWidth;
}

// --- Aggiorna dimensioni e raggi dinamicamente in base alle label ---
// --- Aggiorna dimensioni con raggio dinamico (SOSTITUISCE LA VERSIONE ESISTENTE) ---
function updateDimensions() {
    state.config.width = 900;  // Aumentato per contenere raggi più grandi
    state.config.height = 900; // Aumentato per contenere raggi più grandi
    state.config.centerX = 450;
    state.config.centerY = 450;

    state.svg.setAttribute('viewBox', `0 0 ${state.config.width} ${state.config.height}`);

    const scaleFactor = state.config.scaleFactor;

    // RAGGIO DINAMICO per le label interne
    state.config.labelRadius = calculateDynamicLabelRadius();

    // Calcola larghezza massima label (px)
    const maxLabelPixelWidth = estimateMaxLabelPixelWidth();

    // L'anello degli archi esterni sempre oltre la label più lunga
    const margin = 35 * scaleFactor; // Aumentato il margine
    state.config.arcRadius = state.config.labelRadius + (maxLabelPixelWidth / 2) + margin;

    // Esterno (nomi personaggi) 
    state.config.externalLabelRadius = state.config.arcRadius + 60 * scaleFactor;

    // Compatibilità
    state.config.outerRadius = state.config.arcRadius;
    state.config.innerRadius = state.config.labelRadius;
}

// --- Stima la larghezza di testo in radianti ---
function estimateTextWidth(text, fontSize, radius) {
    const avgCharWidth = fontSize * 0.6;
    const pixelWidth = text.length * avgCharWidth;
    return pixelWidth / radius;
}

// --- Rotazione testo leggibile ---
function calculateTextRotation(x, y, centerX, centerY) {
    const angle = Math.atan2(y - centerY, x - centerX);
    let rotation = angle * (180 / Math.PI);
    if (rotation > 90) rotation -= 180;
    else if (rotation < -90) rotation += 180;
    return rotation;
}

// --- Calcola ampiezza angolare ---
// --- Calcola ampiezza angolare con spaziatura aumentata per evitare sovrapposizioni ---
function calculateCharacterArcSpan(labelsCount, hasThoughts) {
    const totalElements = labelsCount + 1;
    if (totalElements === 0) return 0;
    
    // AUMENTATO: Spaziatura minima tra gli elementi (era 1.5, ora 2.5)
    const minElementSpacing = state.config.minLabelSpacing * 2.5;
    
    // AUMENTATO: Larghezza base di ogni elemento (era 0.04, ora 0.06)  
    const baseElementWidth = 0.06;
    
    const totalSpacing = (totalElements - 1) * minElementSpacing;
    const totalElementWidth = totalElements * baseElementWidth;
    
    // AUMENTATO: Padding ai lati (era 0.04, ora 0.08)
    const padding = 0.08;
    
    return totalElementWidth + totalSpacing + (2 * padding);
}

// --- Distribuzione ottimale ---
function distributeCharactersOptimally(characterData) {
    const totalCharacters = characterData.length;
    const totalCircumference = 2 * Math.PI;
    const characterSpans = characterData.map(data =>
        Math.max(calculateCharacterArcSpan(data.labelsCount, data.hasThoughts), 0.05)
    );
    const totalRequiredSpace = characterSpans.reduce((sum, span) => sum + span, 0);
    const totalGapSpace = totalCharacters * state.config.minArcGap;
    const totalNeededSpace = totalRequiredSpace + totalGapSpace;
    let scalingFactor = 1;
    if (totalNeededSpace > totalCircumference) scalingFactor = totalNeededSpace / totalCircumference;
    const characterPositions = [];
    let currentAngle = -Math.PI / 2;
    for (let i = 0; i < totalCharacters; i++) {
        const span = characterSpans[i] / scalingFactor;
        const startAngle = currentAngle;
        const endAngle = currentAngle + span;
        const centerAngle = (startAngle + endAngle) / 2;
        characterPositions.push({
            ...characterData[i],
            startAngle,
            endAngle,
            centerAngle,
            span
        });
        currentAngle = endAngle + (state.config.minArcGap / scalingFactor);
    }
    return characterPositions;
}

// --- Path arco personaggio ---
function createCharacterArc(startAngle, endAngle, radius) {
    if (endAngle <= startAngle) endAngle = startAngle + 0.05;
    const x1 = state.config.centerX + radius * Math.cos(startAngle);
    const y1 = state.config.centerY + radius * Math.sin(startAngle);
    const x2 = state.config.centerX + radius * Math.cos(endAngle);
    const y2 = state.config.centerY + radius * Math.sin(endAngle);
    const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
}

// --- FUNZIONE CHORD: Arco curvo che parte dal bordo del cerchio interno ---
function createChordPath(sourceNode, targetNode) {
    const cx = state.config.centerX;
    const cy = state.config.centerY;
    const r = state.config.labelRadius;
    
    // Calcola i punti di partenza e arrivo sul bordo del cerchio delle label
    const sourceAngle = Math.atan2(sourceNode.y - cy, sourceNode.x - cx);
    const targetAngle = Math.atan2(targetNode.y - cy, targetNode.x - cx);
    
    const sx = cx + r * Math.cos(sourceAngle);
    const sy = cy + r * Math.sin(sourceAngle);
    const tx = cx + r * Math.cos(targetAngle);
    const ty = cy + r * Math.sin(targetAngle);
    
    // Punto di controllo verso il centro per curvatura chord
    const controlRadius = r * 0.3; // 30% del raggio per curvatura moderata
    const midAngle = (sourceAngle + targetAngle) / 2;
    
    // Gestisci attraversamento di -PI/PI
    let angleDiff = targetAngle - sourceAngle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const correctedMidAngle = sourceAngle + angleDiff / 2;
    
    const controlX = cx + controlRadius * Math.cos(correctedMidAngle);
    const controlY = cy + controlRadius * Math.sin(correctedMidAngle);
    
    return `M ${sx} ${sy} Q ${controlX} ${controlY} ${tx} ${ty}`;
}

// --- Elabora dati nodi e connessioni ---
// --- Elabora dati nodi e connessioni ---
function processData() {
    if (!state.data || state.selectedSeasons.size === 0) {
        // Se nessuna stagione selezionata, resetta tutto
        state.characterNodes = [];
        state.characteristicNodes = [];
        state.thoughtNodes = [];
        state.connections = [];
        state.groupedConnections = [];
        return;
    }
    
    const characters = state.data.nodes.map(node => node.id);
    state.characterNodes = [];
    state.characteristicNodes = [];
    state.thoughtNodes = [];
    state.connections = [];
    state.groupedConnections = [];

    const characterData = characters.map(character => {
        const incomingLabels = [];
        const labelSources = {};
        
        // Per ogni stagione selezionata, raccogli le label
        state.selectedSeasons.forEach(selectedSeason => {
            state.data.links.forEach(link => {
                if (link.target === character &&
                    link.seasons &&
                    link.seasons[selectedSeason] &&
                    link.seasons[selectedSeason].labels &&
                    link.seasons[selectedSeason].labels.length > 0) {
                    link.seasons[selectedSeason].labels.forEach(label => {
                        if (!incomingLabels.some(item => item.label === label)) {
                            incomingLabels.push({
                                label,
                                source: link.source,
                                judgment: link.seasons[selectedSeason].judgment
                            });
                        }
                        if (!labelSources[label]) labelSources[label] = [];
                        if (!labelSources[label].includes(link.source)) {
                            labelSources[label].push(link.source);
                        }
                    });
                }
            });
        });
        
        const hasOutgoingThoughts = Array.from(state.selectedSeasons).some(selectedSeason => 
            state.data.links.some(link =>
                link.source === character &&
                link.seasons &&
                link.seasons[selectedSeason] &&
                link.seasons[selectedSeason].labels &&
                link.seasons[selectedSeason].labels.length > 0
            )
        );
        
        return {
            id: character,
            labelsCount: incomingLabels.length,
            hasThoughts: true,
            incomingLabels,
            labelSources
        };
    });

    const characterPositions = distributeCharactersOptimally(characterData);

    characterPositions.forEach(charData => {
        const externalX = state.config.centerX + state.config.externalLabelRadius * Math.cos(charData.centerAngle);
        const externalY = state.config.centerY + state.config.externalLabelRadius * Math.sin(charData.centerAngle);

        const characterNode = {
            id: charData.id,
            x: externalX,
            y: externalY,
            angle: charData.centerAngle,
            startAngle: charData.startAngle,
            endAngle: charData.endAngle,
            type: 'character',
            labelsCount: charData.labelsCount,
            hasOutgoingThoughts: charData.hasThoughts
        };
        state.characterNodes.push(characterNode);

        const totalElements = charData.labelsCount + 1;
        if (totalElements > 0) {
            const availableSpan = charData.endAngle - charData.startAngle - 0.02;
            const elementSpacing = availableSpan / (totalElements + 1);
            let elementIndex = 1;
            
            const thoughtAngle = charData.startAngle + 0.01 + elementIndex * elementSpacing;
            const thoughtText = charData.id;
            const fontSize = 13 * state.config.scaleFactor;
            const avgCharWidth = fontSize * 0.6;
            const halfTextWidth = (thoughtText.length * avgCharWidth) / 2;
            const adjustedRadius = state.config.labelRadius + halfTextWidth;
            const thoughtX = state.config.centerX + adjustedRadius * Math.cos(thoughtAngle);
            const thoughtY = state.config.centerY + adjustedRadius * Math.sin(thoughtAngle);

            state.thoughtNodes.push({
                id: `${charData.id}_thoughts`,
                character: charData.id,
                x: thoughtX,
                y: thoughtY,
                angle: thoughtAngle,
                type: 'thought',
                label: charData.id,
                textEnd: { x: thoughtX, y: thoughtY }
            });
            elementIndex++;
            
            charData.incomingLabels.forEach(labelData => {
                const angle = charData.startAngle + 0.01 + elementIndex * elementSpacing;
                const labelText = labelData.label;
                const fontSize = 13 * state.config.scaleFactor;
                const avgCharWidth = fontSize * 0.6;
                const halfTextWidth = (labelText.length * avgCharWidth) / 2;
                const adjustedRadius = state.config.labelRadius + halfTextWidth;
                const x = state.config.centerX + adjustedRadius * Math.cos(angle);
                const y = state.config.centerY + adjustedRadius * Math.sin(angle);
        
                state.characteristicNodes.push({
                    id: `${charData.id}_${labelData.label}`,
                    character: charData.id,
                    x,
                    y,
                    angle,
                    type: 'characteristic',
                    label: labelData.label,
                    sources: charData.labelSources[labelData.label],
                    judgment: labelData.judgment,
                    textEnd: { x, y }
                });
                elementIndex++;
            });
        }
    });

    // Connessioni raggruppate per tutte le stagioni selezionate
    state.characterNodes.forEach(charNode => {
        const targetChar = charNode.id;
        const labelGroups = {};
        
        state.selectedSeasons.forEach(selectedSeason => {
            state.data.links.forEach(link => {
                if (link.target === targetChar &&
                    link.seasons &&
                    link.seasons[selectedSeason] &&
                    link.seasons[selectedSeason].labels &&
                    link.seasons[selectedSeason].labels.length > 0) {
                    link.seasons[selectedSeason].labels.forEach(label => {
                        if (!labelGroups[label]) labelGroups[label] = [];
                        labelGroups[label].push({
                            sourceCharacter: link.source,
                            targetCharacter: link.target,
                            label,
                            judgment: link.seasons[selectedSeason].judgment
                        });
                    });
                }
            });
        });
        
        Object.keys(labelGroups).forEach(label => {
            const connections = labelGroups[label];
            const targetCharacteristic = state.characteristicNodes.find(
                n => n.character === targetChar && n.label === label
            );
            if (targetCharacteristic && connections.length > 0) {
                const uniqueSources = [...new Set(connections.map(c => c.sourceCharacter))];
                uniqueSources.forEach(sourceChar => {
                    const sourceThought = state.thoughtNodes.find(n => n.character === sourceChar);
                    if (sourceThought) {
                        state.groupedConnections.push({
                            source: sourceThought,
                            target: targetCharacteristic,
                            sourceCharacter: sourceChar,
                            targetCharacter: targetChar,
                            label,
                            judgment: connections[0].judgment
                        });
                    }
                });
            }
        });
    });
    
    // Mantieni le connessioni originali per tutte le stagioni
    state.selectedSeasons.forEach(selectedSeason => {
        state.data.links.forEach(link => {
            if (link.seasons &&
                link.seasons[selectedSeason] &&
                link.seasons[selectedSeason].labels &&
                link.seasons[selectedSeason].labels.length > 0) {
                link.seasons[selectedSeason].labels.forEach(label => {
                    state.connections.push({
                        sourceCharacter: link.source,
                        targetCharacter: link.target,
                        label,
                        judgment: link.seasons[selectedSeason].judgment
                    });
                });
            }
        });
    });
}

// --- Visualizzazione SVG aggiornata con CHORD STYLE per l'anello interno ---
function createVisualization() {
    if (!state.data) return;
    state.zoomGroup.innerHTML = '';

    if (state.selectedSeasons.size === 0) {
        const messageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        messageText.setAttribute('x', state.config.centerX);
        messageText.setAttribute('y', state.config.centerY);
        messageText.setAttribute('text-anchor', 'middle');
        messageText.setAttribute('font-size', 18);
        messageText.setAttribute('fill', '#666');
        messageText.textContent = 'Select chapters to view visualization';
        state.zoomGroup.appendChild(messageText);
        return;
    }

    // ===== CONNESSIONI CHORD STYLE (partono dal bordo del cerchio interno) =====
    state.groupedConnections.forEach((connection, index) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createChordPath(connection.source, connection.target));
        path.setAttribute('class', 'connection-path');
        path.setAttribute('stroke', state.config.colors.defaultConnection);
        path.setAttribute('stroke-width', 1);
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', 0.6);
        path.setAttribute('data-source', connection.sourceCharacter);
        path.setAttribute('data-target', connection.targetCharacter);
        path.setAttribute('data-label', connection.label);
        path.setAttribute('data-index', index);
        state.zoomGroup.appendChild(path);
    });

    // ===== ANELLO ESTERNO (archi personaggio) =====
    state.characterNodes.forEach(node => {
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arc.setAttribute('d', createCharacterArc(node.startAngle, node.endAngle, state.config.arcRadius));
        arc.setAttribute('class', 'character-arc');
        arc.setAttribute('stroke', state.config.colors.characterStroke);
        arc.setAttribute('stroke-width', 4);
        arc.setAttribute('fill', 'none');
        arc.setAttribute('data-character', node.id);
        state.zoomGroup.appendChild(arc);

        // Nome esterno del personaggio - POSIZIONATO CORRETTAMENTE
        const externalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        externalText.setAttribute('x', node.x);
        externalText.setAttribute('y', node.y);
        externalText.setAttribute('class', 'character-external-text');
        externalText.setAttribute('font-size', 12 * state.config.scaleFactor);
        externalText.setAttribute('font-weight', 'bold');
        externalText.setAttribute('fill', '#333');
        externalText.setAttribute('text-anchor', 'middle');
        externalText.setAttribute('alignment-baseline', 'middle');
        externalText.setAttribute('data-character', node.id);
        const externalRotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        externalText.setAttribute('transform', `rotate(${externalRotation}, ${node.x}, ${node.y})`);
        externalText.textContent = node.id;
        state.zoomGroup.appendChild(externalText);
    });

    // ===== ANELLO INTERNO: Label caratteristiche =====
    state.characteristicNodes.forEach(node => {
        const rotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'characteristic-text clickable-label');
        text.setAttribute('font-size', 13 * state.config.scaleFactor);
        text.setAttribute('fill', state.config.colors.characteristic);
        text.setAttribute('data-character', node.character);
        text.setAttribute('data-label', node.label);
        text.setAttribute('data-sources', node.sources.join(','));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('alignment-baseline', 'middle');
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });

    // ===== ANELLO INTERNO: Nomi rossi pensiero =====
    state.thoughtNodes.forEach(node => {
        const rotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'thought-text clickable-label');
        text.setAttribute('fill', state.config.colors.thoughtNode);
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-size', 13 * state.config.scaleFactor);
        text.setAttribute('data-character', node.character);
        text.setAttribute('data-label', node.label);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('alignment-baseline', 'middle');
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });

    // ===== CERCHIO DI RIFERIMENTO per label =====
    const referenceCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    referenceCircle.setAttribute('cx', state.config.centerX);
    referenceCircle.setAttribute('cy', state.config.centerY);
    referenceCircle.setAttribute('r', state.config.labelRadius);
    referenceCircle.setAttribute('fill', 'none');
    referenceCircle.setAttribute('stroke', 'rgba(200, 200, 200, 0.3)');
    referenceCircle.setAttribute('stroke-width', '1');
    referenceCircle.setAttribute('class', 'reference-circle');
    state.zoomGroup.appendChild(referenceCircle);
}

// ===== ZOOM E PAN =====
function setupZoom() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            state.currentZoom = Math.min(state.currentZoom * 1.3, 5);
            updateZoom();
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            state.currentZoom = Math.max(state.currentZoom / 1.3, 0.2);
            updateZoom();
        });
    }
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            centerVisualization();
        });
    }
    state.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = state.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const svgX = (mouseX / rect.width) * state.config.width;
        const svgY = (mouseY / rect.height) * state.config.height;
        const worldX = (svgX - state.currentTranslateX) / state.currentZoom;
        const worldY = (svgY - state.currentTranslateY) / state.currentZoom;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.2, Math.min(5, state.currentZoom * zoomFactor));
        const newTranslateX = svgX - worldX * newZoom;
        const newTranslateY = svgY - worldY * newZoom;
        state.currentZoom = newZoom;
        state.currentTranslateX = newTranslateX;
        state.currentTranslateY = newTranslateY;
        updateZoom();
    });
    let isDragging = false;
    let startX, startY;
    state.svg.addEventListener('mousedown', (e) => {
        if (e.target === state.svg || e.target === state.zoomGroup) {
            isDragging = true;
            startX = e.clientX - state.currentTranslateX;
            startY = e.clientY - state.currentTranslateY;
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            state.currentTranslateX = e.clientX - startX;
            state.currentTranslateY = e.clientY - startY;
            updateZoom();
        }
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
}

function updateZoom() {
    const transform = `translate(${state.currentTranslateX}, ${state.currentTranslateY}) scale(${state.currentZoom})`;
    state.zoomGroup.setAttribute('transform', transform);
}

// ===== EVENTI E INTERAZIONI CON FIX COMPLETO =====
function setupEventListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('character-arc') || e.target.classList.contains('character-external-text') || e.target.tagName === 'textPath') {
            const character = e.target.getAttribute('data-character') || e.target.textContent;
            handleCharacterClick(character);
        } else if (e.target.classList.contains('clickable-label')) {
            const character = e.target.getAttribute('data-character');
            const label = e.target.getAttribute('data-label');
            handleLabelClick(character, label);
        } else if (e.target === state.svg || e.target === state.zoomGroup) {
            resetHighlighting();
        }
    });
}

function handleCharacterClick(character) {
    if (state.selectedCharacter === character && state.selectedType === 'character') {
        resetHighlighting(); return;
    }
    state.selectedCharacter = character;
    state.selectedLabel = null;
    state.selectedType = 'character';
    highlightCharacterConnections(character);
    updateInfoPanel(character);
}

function handleLabelClick(character, label) {
    if (state.selectedCharacter === character && state.selectedLabel === label && state.selectedType === 'label') {
        resetHighlighting(); return;
    }
    state.selectedCharacter = character;
    state.selectedLabel = label;
    state.selectedType = 'label';
    highlightLabelConnections(character, label);
    updateInfoPanelForLabel(character, label);
}

function highlightCharacterConnections(character) {
    // RESET COMPLETO di tutti gli archi
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
        // RESET COMPLETO degli stili inline
        path.style.stroke = state.config.colors.defaultConnection;
        path.style.strokeWidth = '1';
        path.style.opacity = '0.6';
    });

    // Evidenzia solo gli archi del personaggio selezionato
    const outgoingPaths = document.querySelectorAll(`[data-source="${character}"]`);
    outgoingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.outgoingLine;
        path.style.strokeWidth = '2';
        path.style.opacity = '0.8';
    });

    const incomingPaths = document.querySelectorAll(`[data-target="${character}"]`);
    incomingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
        path.style.strokeWidth = '2';
        path.style.opacity = '0.8';
    });

    // Reset archi personaggi
    const characterArcs = document.querySelectorAll('.character-arc');
    characterArcs.forEach(arc => {
        arc.style.filter = 'none';
        if (arc.getAttribute('data-character') === character) {
            arc.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        }
    });
}

function highlightLabelConnections(character, label) {
    // RESET COMPLETO di tutti gli archi
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
        // RESET COMPLETO degli stili inline
        path.style.stroke = state.config.colors.defaultConnection;
        path.style.strokeWidth = '1';
        path.style.opacity = '0.6';
    });

    // Evidenzia SOLO gli archi della label specifica
    const specificPaths = document.querySelectorAll(`[data-target="${character}"][data-label="${label}"]`);
    specificPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
        path.style.strokeWidth = '2';
        path.style.opacity = '0.8';
    });

    // Reset di tutte le label e evidenzia solo quella selezionata
    const characteristicTexts = document.querySelectorAll('.characteristic-text');
    characteristicTexts.forEach(text => {
        text.style.filter = 'none';
        text.style.fontWeight = 'normal';
        if (text.getAttribute('data-character') === character && text.getAttribute('data-label') === label) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.8))';
            text.style.fontWeight = 'bold';
        }
    });

    const thoughtTexts = document.querySelectorAll('.thought-text');
    thoughtTexts.forEach(text => {
        text.style.filter = 'none';
        if (text.getAttribute('data-character') === character && text.getAttribute('data-label') === label) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 107, 0.8))';
        }
    });

    // Reset archi personaggi e evidenzia solo quelli rilevanti
    const characterArcs = document.querySelectorAll('.character-arc');
    characterArcs.forEach(arc => {
        arc.style.filter = 'none'; // Reset prima di tutto
        const nodeCharacter = arc.getAttribute('data-character');
        if (nodeCharacter === character) {
            arc.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        } else {
            const labelNode = state.characteristicNodes.find(n =>
                n.character === character && n.label === label
            );
            if (labelNode && labelNode.sources.includes(nodeCharacter)) {
                arc.style.filter = 'drop-shadow(0 0 20px rgba(255, 107, 107, 0.8))';
            }
        }
    });
}

function resetHighlighting() {
    state.selectedCharacter = null;
    state.selectedLabel = null;
    state.selectedType = null;
    
    // RESET COMPLETO di tutti gli archi
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.style.stroke = state.config.colors.defaultConnection;
        path.style.strokeWidth = '1';
        path.style.opacity = '0.6';
    });

    // Reset archi personaggi
    const allArcs = document.querySelectorAll('.character-arc');
    allArcs.forEach(arc => { arc.style.filter = 'none'; });

    // Reset testi
    const allTexts = document.querySelectorAll('.characteristic-text, .thought-text, textPath');
    allTexts.forEach(text => {
        text.style.filter = 'none';
        if (text.classList.contains('characteristic-text')) {
            text.style.fontWeight = 'normal';
        }
    });

    updateInfoPanel(null);
}

function updateInfoPanel(character) {
    const infoContent = document.getElementById('info-content');
    if (!character) {
        const selectedSeasonsArray = Array.from(state.selectedSeasons).sort();
        const seasonsText = selectedSeasonsArray.length > 0 ? selectedSeasonsArray.join(', ') : 'None';
        
        infoContent.innerHTML = `
            <strong>Istruzioni:</strong><br>
            Clicca su un arco esterno per evidenziare le relazioni del personaggio.<br>
            Clicca su una label interna per evidenziare solo gli archi che la puntano.<br>
            <span style="color: #ff6b6b;">Rosso</span>: Archi in uscita<br>
            <span style="color: #4fc3f7;">Blu</span>: Archi in entrata<br>
            <br>
            <strong>Chapters selected:</strong> ${seasonsText}<br>
            <br>
            <strong>Controlli:</strong><br>
            • Rotella mouse: Zoom al cursore<br>
            • Trascina: Pan<br>
        `;
        return;
    }
    const outgoingConnections = state.groupedConnections.filter(c =>
        c.sourceCharacter === character
    );
    const incomingConnections = state.groupedConnections.filter(c =>
        c.targetCharacter === character
    );
    const selectedSeasonsArray = Array.from(state.selectedSeasons).sort();
    infoContent.innerHTML = `
        <strong>${character}</strong><br>
        <strong>Chapters:</strong> ${selectedSeasonsArray.join(', ')}<br>
        Pensieri verso altri: ${outgoingConnections.length}<br>
        Caratteristiche ricevute: ${incomingConnections.length}<br>
        <br>
        <small>Clicca altrove per deselezionare</small>
    `;
}

function updateInfoPanelForLabel(character, label) {
    const infoContent = document.getElementById('info-content');
    const labelNode = state.characteristicNodes.find(n =>
        n.character === character && n.label === label
    );
    if (labelNode) {
        const selectedSeasonsArray = Array.from(state.selectedSeasons).sort();
        
        infoContent.innerHTML = `
            <strong>Label selezionata:</strong><br>
            "${label}"<br>
            <strong>Personaggio:</strong> ${character}<br>
            <strong>Chapters:</strong> ${selectedSeasonsArray.join(', ')}<br>
            <strong>Pensato da:</strong> ${labelNode.sources.join(', ')}<br>
            <strong>Numero di fonti:</strong> ${labelNode.sources.length}<br>
            <br>
            <small>Clicca altrove per deselezionare</small>
        `;
    }
}

// ===== CARICAMENTO DATI E INIT =====
async function loadData() {
    try {
        const response = await fetch('../data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        state.data = await response.json();
        console.log('Dati caricati con successo:', state.data);
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        showError('Errore nel caricamento del file data.json. Assicurati che il file sia presente e accessibile.');
        return false;
    }
    return true;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffebee;
        border: 2px solid #f44336;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        text-align: center;
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;
    errorDiv.innerHTML = `
        <h3 style="color: #f44336; margin-top: 0;">Errore di Caricamento</h3>
        <p>${message}</p>
        <button onclick="this.parentElement.remove()" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        ">Chiudi</button>
    `;
    document.body.appendChild(errorDiv);
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #4fc3f7;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 1000;
        font-family: Arial, sans-serif;
    `;
    loadingDiv.innerHTML = `
        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #4fc3f7; border-top: 4px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 10px; color: #333;">Caricamento dati...</p>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}
        </style>
    `;
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) loadingDiv.remove();
}

function updateSeasonSelector() {
    const seasonSelector = document.getElementById('season-selector');
    if (seasonSelector) {
        seasonSelector.innerHTML = '';
        const seasons = new Set();
        state.data.links.forEach(link => {
            if (link.seasons) Object.keys(link.seasons).forEach(season => { seasons.add(season); });
        });
        Array.from(seasons).sort().forEach(season => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = `Stagione ${season}`;
            if (season === state.selectedSeason) option.selected = true;
            seasonSelector.appendChild(option);
        });
        seasonSelector.addEventListener('change', (e) => {
            state.selectedSeason = e.target.value;
            processData();
            createVisualization();
            resetHighlighting();
        });
    }
}

function centerVisualization() {
    const svgRect = state.svg.getBoundingClientRect();
    const svgCenterX = svgRect.width / 2;
    const svgCenterY = svgRect.height / 2;
    state.currentTranslateX = svgCenterX - state.config.centerX;
    state.currentTranslateY = svgCenterY - state.config.centerY;
    state.currentZoom = 1;
    updateZoom();
}

// AGGIUNGI QUESTA SEZIONE PRIMA DELLA FUNZIONE init() nel chord.js esistente

// Funzionalità toggle per tornare alla pagina principale
document.addEventListener('DOMContentLoaded', function() {
    const pageToggle = document.getElementById('pageToggle');
    
    if (pageToggle) {
        pageToggle.addEventListener('change', function() {
            if (!this.checked) {
                // Animazione di uscita
                document.body.classList.add('page-fade-out');
                
                setTimeout(() => {
                    window.location.href = '../GRAPH/index.html'; 
                }, 250);
            }
        });
    }
});

async function init() {
    showLoading();
    const dataLoaded = await loadData();
    hideLoading();
    if (!dataLoaded) return;
    state.svg = document.getElementById('chord-visualization') || document.getElementById('visualization');
    state.zoomGroup = document.getElementById('chord-zoom-group') || document.getElementById('zoom-group');
    updateDimensions();
    processData();
    createVisualization();
    centerVisualization();
    setupEventListeners();
    setupZoom();
    
    // AGGIUNGI QUESTA RIGA
    initializeSeasonFilter();
    
    window.addEventListener('resize', () => {
        updateDimensions();
        processData();
        createVisualization();
        centerVisualization();
    });
}

// Inizializzazione del filtro dots 
function initializeSeasonFilter() {
    const seasonDotContainer = d3.select("#season-dots");
    seasonDotContainer.selectAll("*").remove();

    for (let i = 1; i <= 6; i++) {
        seasonDotContainer.append("div")
            .attr("class", "season-dot")
            .attr("data-season", i)
            .text(i)
            .classed("selected", state.selectedSeasons.has(String(i))) // Seleziona stagione 1 inizialmente
            .on("click", function () {
                const season = String(i);
                
                if (state.selectedSeasons.has(season)) {
                    state.selectedSeasons.delete(season);
                    d3.select(this).classed("selected", false);
                } else {
                    state.selectedSeasons.add(season);
                    d3.select(this).classed("selected", true);
                }

                // Aggiorna il chord
                resetHighlighting();
                processData();
                createVisualization();
                updateInfoPanel(null);
            });
    }

    // Reset button
    seasonDotContainer.append("div")
        .attr("class", "reset-button")
        .text("↻")
        .on("click", function () {
            state.selectedSeasons.clear();
            seasonDotContainer.selectAll(".season-dot").classed("selected", false);
            resetHighlighting();
            processData();
            createVisualization();
            updateInfoPanel(null);
        });
}

document.addEventListener('DOMContentLoaded', init);