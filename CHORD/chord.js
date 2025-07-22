// Stato dell'applicazione
let state = {
    selectedCharacter: null,
    selectedLabel: null,
    selectedType: null, // 'character' o 'label'
    selectedSeason: "1", // Stagione attualmente selezionata
    data: null, // Dati caricati dal JSON
    svg: null,
    zoomGroup: null,
    characterNodes: [],
    characteristicNodes: [],
    thoughtNodes: [],
    connections: [],
    groupedConnections: [], // Connessioni raggruppate per label per personaggio
    currentZoom: 1,
    currentTranslateX: 0,
    currentTranslateY: 0,
    config: {
        outerRadius: 0,
        innerRadius: 0,
        arcRadius: 0, // Raggio per gli archi dei personaggi
        labelRadius: 0, // Raggio per le label interne agli archi
        externalLabelRadius: 0, // Raggio per i nomi esterni
        centerX: 0,
        centerY: 0,
        scaleFactor: 1.5,
        minArcGap: 0.08, // Gap minimo tra archi adiacenti
        minLabelSpacing: 0.06, // Spaziatura minima tra label
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

// Carica i dati dal file JSON esterno
async function loadData() {
    try {
        const response = await fetch('../data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        state.data = await response.json();
        console.log('Dati caricati con successo:', state.data);
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        showError('Errore nel caricamento del file data.json. Assicurati che il file sia presente e accessibile.');
        return false;
    }
    return true;
}

// Mostra un messaggio di errore all'utente
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

// Funzione per calcolare l'angolo di rotazione del testo
function calculateTextRotation(x, y, centerX, centerY) {
    const angle = Math.atan2(y - centerY, x - centerX);
    let rotation = angle * (180 / Math.PI);
    
    // Assicurati che il testo sia sempre leggibile (non sottosopra)
    if (rotation > 90) {
        rotation -= 180;
    } else if (rotation < -90) {
        rotation += 180;
    }
    
    return rotation;
}

// Calcola l'ampiezza angolare necessaria per un personaggio basata sul numero di label
function calculateCharacterArcSpan(labelsCount, hasThoughts) {
    const totalElements = labelsCount + (hasThoughts ? 1 : 0);
    if (totalElements === 0) return 0;
    
    // Spacing minimo tra elementi
    const minElementSpacing = state.config.minLabelSpacing;
    const baseElementWidth = 0.04; // Larghezza angolare base per elemento
    
    // Calcola l'ampiezza necessaria
    const totalSpacing = (totalElements - 1) * minElementSpacing;
    const totalElementWidth = totalElements * baseElementWidth;
    const padding = 0.02; // Padding ai lati dell'arco
    
    return totalElementWidth + totalSpacing + (2 * padding);
}

// Distribuisce i personaggi attorno al cerchio considerando le loro esigenze di spazio
function distributeCharactersOptimally(characterData) {
    const totalCharacters = characterData.length;
    const totalCircumference = 2 * Math.PI;
    
    // Calcola l'ampiezza necessaria per ogni personaggio
    const characterSpans = characterData.map(data => {
        const span = calculateCharacterArcSpan(data.labelsCount, data.hasThoughts);
        return Math.max(span, 0.05); // Ampiezza minima
    });
    
    // Calcola lo spazio totale necessario
    const totalRequiredSpace = characterSpans.reduce((sum, span) => sum + span, 0);
    const totalGapSpace = totalCharacters * state.config.minArcGap;
    const totalNeededSpace = totalRequiredSpace + totalGapSpace;
    
    // Se serve più spazio, espandi il raggio
    let scalingFactor = 1;
    if (totalNeededSpace > totalCircumference) {
        scalingFactor = totalNeededSpace / totalCircumference;
        console.log(`Scaling factor: ${scalingFactor}`);
    }
    
    // Distribuisci i personaggi
    const characterPositions = [];
    let currentAngle = -Math.PI / 2; // Inizia dall'alto
    
    for (let i = 0; i < totalCharacters; i++) {
        const span = characterSpans[i] / scalingFactor;
        const startAngle = currentAngle;
        const endAngle = currentAngle + span;
        const centerAngle = (startAngle + endAngle) / 2;
        
        characterPositions.push({
            ...characterData[i],
            startAngle: startAngle,
            endAngle: endAngle,
            centerAngle: centerAngle,
            span: span
        });
        
        // Muovi al prossimo personaggio con gap
        currentAngle = endAngle + (state.config.minArcGap / scalingFactor);
    }
    
    return characterPositions;
}

// Crea un arco SVG per rappresentare un personaggio
function createCharacterArc(startAngle, endAngle, radius) {
    // Assicurati che gli angoli siano nel range corretto
    if (endAngle <= startAngle) {
        endAngle = startAngle + 0.05; // Arco minimo
    }
    
    // Calcola i punti dell'arco
    const x1 = state.config.centerX + radius * Math.cos(startAngle);
    const y1 = state.config.centerY + radius * Math.sin(startAngle);
    const x2 = state.config.centerX + radius * Math.cos(endAngle);
    const y2 = state.config.centerY + radius * Math.sin(endAngle);
    
    // Determina se l'arco è maggiore di 180 gradi
    const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;
    
    // Crea il path dell'arco
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
    
    return pathData;
}

// Inizializzazione
async function init() {
    showLoading();
    
    const dataLoaded = await loadData();
    hideLoading();
    
    if (!dataLoaded) {
        return;
    }
    
    state.svg = document.getElementById('visualization');
    state.zoomGroup = document.getElementById('zoom-group');
    
    updateSeasonSelector();
    updateDimensions();
    
    processData();
    createVisualization();
    
    centerVisualization();
    
    setupEventListeners();
    setupZoom();
    
    window.addEventListener('resize', () => {
        updateDimensions();
        processData();
        createVisualization();
        centerVisualization();
    });
}

// Centra la visualizzazione sul centro del cerchio
function centerVisualization() {
    const svgRect = state.svg.getBoundingClientRect();
    const svgCenterX = svgRect.width / 2;
    const svgCenterY = svgRect.height / 2;
    
    state.currentTranslateX = svgCenterX - state.config.centerX;
    state.currentTranslateY = svgCenterY - state.config.centerY;
    state.currentZoom = 1;
    
    updateZoom();
}

// Mostra un indicatore di caricamento
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
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loadingDiv);
}

// Nasconde l'indicatore di caricamento
function hideLoading() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Aggiorna il selettore di stagione
function updateSeasonSelector() {
    const seasonSelector = document.getElementById('season-selector');
    if (seasonSelector) {
        seasonSelector.innerHTML = '';
        
        const seasons = new Set();
        state.data.links.forEach(link => {
            if (link.seasons) {
                Object.keys(link.seasons).forEach(season => {
                    seasons.add(season);
                });
            }
        });
        
        Array.from(seasons).sort().forEach(season => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = `Stagione ${season}`;
            if (season === state.selectedSeason) {
                option.selected = true;
            }
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

// Aggiorna le dimensioni basate sulla finestra - CORRETTO
function updateDimensions() {
    state.config.width = 800;
    state.config.height = 600;
    state.config.centerX = 400;
    state.config.centerY = 300;
    
    state.svg.setAttribute('viewBox', `0 0 ${state.config.width} ${state.config.height}`);
    
    const minDimension = Math.min(state.config.width, state.config.height);
    
    // IMPORTANTE: L'ordine corretto dei raggi dal centro verso l'esterno
    state.config.labelRadius = (minDimension / 2) * 0.45 * state.config.scaleFactor;     // Interno: label
    state.config.arcRadius = (minDimension / 2) * 0.65 * state.config.scaleFactor;      // Medio: archi
    state.config.externalLabelRadius = (minDimension / 2) * 0.85 * state.config.scaleFactor; // Esterno: nomi
    
    // Mantieni compatibilità
    state.config.outerRadius = state.config.arcRadius;
    state.config.innerRadius = state.config.labelRadius;
}

// Elabora i dati per creare la struttura necessaria - COMPLETAMENTE RISCRITTA
function processData() {
    if (!state.data) return;
    
    const characters = state.data.nodes.map(node => node.id);
    
    // Reset arrays
    state.characterNodes = [];
    state.characteristicNodes = [];
    state.thoughtNodes = [];
    state.connections = [];
    state.groupedConnections = [];
    
    // Prima passata: raccoglie dati per ogni personaggio
    const characterData = characters.map(character => {
        const incomingLabels = [];
        const labelSources = {};
        
        state.data.links.forEach(link => {
            if (link.target === character && 
                link.seasons && 
                link.seasons[state.selectedSeason] && 
                link.seasons[state.selectedSeason].labels &&
                link.seasons[state.selectedSeason].labels.length > 0) {
                
                link.seasons[state.selectedSeason].labels.forEach(label => {
                    if (!incomingLabels.some(item => item.label === label)) {
                        incomingLabels.push({
                            label: label,
                            source: link.source,
                            judgment: link.seasons[state.selectedSeason].judgment
                        });
                    }
                    
                    if (!labelSources[label]) {
                        labelSources[label] = [];
                    }
                    labelSources[label].push(link.source);
                });
            }
        });
        
        const hasOutgoingThoughts = state.data.links.some(link => 
            link.source === character && 
            link.seasons && 
            link.seasons[state.selectedSeason] && 
            link.seasons[state.selectedSeason].labels &&
            link.seasons[state.selectedSeason].labels.length > 0
        );
        
        return {
            id: character,
            labelsCount: incomingLabels.length,
            hasThoughts: hasOutgoingThoughts,
            incomingLabels: incomingLabels,
            labelSources: labelSources
        };
    });
    
    // Distribuisci i personaggi ottimalmente
    const characterPositions = distributeCharactersOptimally(characterData);
    
    // Crea i nodi dei personaggi
    characterPositions.forEach(charData => {
        // Nome esterno del personaggio
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
        
        // Calcola posizioni per elementi interni (nome rosso + label)
        const totalElements = charData.labelsCount + (charData.hasThoughts ? 1 : 0);
        if (totalElements > 0) {
            const availableSpan = charData.endAngle - charData.startAngle - 0.02; // Sottrai padding
            const elementSpacing = availableSpan / (totalElements + 1);
            
            let elementIndex = 1;
            
            // Crea il nodo pensiero (nome rosso) PRIMA delle caratteristiche
            if (charData.hasThoughts) {
                const thoughtAngle = charData.startAngle + 0.01 + elementIndex * elementSpacing;
                const thoughtX = state.config.centerX + state.config.labelRadius * Math.cos(thoughtAngle);
                const thoughtY = state.config.centerY + state.config.labelRadius * Math.sin(thoughtAngle);
                
                state.thoughtNodes.push({
                    id: `${charData.id}_thoughts`,
                    character: charData.id,
                    x: thoughtX,
                    y: thoughtY,
                    angle: thoughtAngle,
                    type: 'thought',
                    label: charData.id
                });
                
                elementIndex++;
            }
            
            // Crea i nodi delle caratteristiche DOPO il nome rosso
            charData.incomingLabels.forEach((labelData) => {
                const angle = charData.startAngle + 0.01 + elementIndex * elementSpacing;
                const x = state.config.centerX + state.config.labelRadius * Math.cos(angle);
                const y = state.config.centerY + state.config.labelRadius * Math.sin(angle);
                
                state.characteristicNodes.push({
                    id: `${charData.id}_${labelData.label}`,
                    character: charData.id,
                    x: x,
                    y: y,
                    angle: angle,
                    type: 'characteristic',
                    label: labelData.label,
                    sources: charData.labelSources[labelData.label],
                    judgment: labelData.judgment
                });
                
                elementIndex++;
            });
        }
    });

    // Crea le connessioni raggruppate
    state.characterNodes.forEach(charNode => {
        const targetChar = charNode.id;
        
        const labelGroups = {};
        state.data.links.forEach(link => {
            if (link.target === targetChar && 
                link.seasons && 
                link.seasons[state.selectedSeason] && 
                link.seasons[state.selectedSeason].labels &&
                link.seasons[state.selectedSeason].labels.length > 0) {
                
                link.seasons[state.selectedSeason].labels.forEach(label => {
                    if (!labelGroups[label]) {
                        labelGroups[label] = [];
                    }
                    labelGroups[label].push({
                        sourceCharacter: link.source,
                        targetCharacter: link.target,
                        label: label,
                        judgment: link.seasons[state.selectedSeason].judgment
                    });
                });
            }
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
                            label: label,
                            judgment: connections[0].judgment
                        });
                    }
                });
            }
        });
    });

    // Mantieni le connessioni originali per il tracking
    state.data.links.forEach(link => {
        if (link.seasons && 
            link.seasons[state.selectedSeason] && 
            link.seasons[state.selectedSeason].labels &&
            link.seasons[state.selectedSeason].labels.length > 0) {
            
            link.seasons[state.selectedSeason].labels.forEach(label => {
                state.connections.push({
                    sourceCharacter: link.source,
                    targetCharacter: link.target,
                    label: label,
                    judgment: link.seasons[state.selectedSeason].judgment
                });
            });
        }
    });
}

// Crea percorsi curvi per le connessioni
function createCurvedPath(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const sourceCharNode = state.characterNodes.find(n => n.id === source.character);
    const targetCharNode = state.characterNodes.find(n => n.id === target.character);
    
    if (!sourceCharNode || !targetCharNode) {
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }
    
    let angleDiff = Math.abs(targetCharNode.angle - sourceCharNode.angle);
    if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
    }
    
    const normalizedAngleDiff = angleDiff / Math.PI;
    const maxCurvature = 0.8;
    const minCurvature = 0.1;
    const curvatureIntensity = maxCurvature - (normalizedAngleDiff * (maxCurvature - minCurvature));
    
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    
    const centerX = state.config.centerX;
    const centerY = state.config.centerY;
    const towardsCenterX = centerX - midX;
    const towardsCenterY = centerY - midY;
    
    const controlDistance = distance * curvatureIntensity;
    
    const controlX = midX + (towardsCenterX / Math.sqrt(towardsCenterX * towardsCenterX + towardsCenterY * towardsCenterY)) * controlDistance;
    const controlY = midY + (towardsCenterY / Math.sqrt(towardsCenterX * towardsCenterX + towardsCenterY * towardsCenterY)) * controlDistance;
    
    return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

// Crea la visualizzazione SVG
function createVisualization() {
    if (!state.data) return;
    
    state.zoomGroup.innerHTML = '';

    // Crea le connessioni
    state.groupedConnections.forEach((connection, index) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createCurvedPath(connection.source, connection.target));
        path.setAttribute('class', 'connection-path');
        path.setAttribute('stroke', state.config.colors.defaultConnection);
        path.setAttribute('data-source', connection.sourceCharacter);
        path.setAttribute('data-target', connection.targetCharacter);
        path.setAttribute('data-label', connection.label);
        path.setAttribute('data-index', index);
        state.zoomGroup.appendChild(path);
    });

    // Crea archi SEPARATI per ogni personaggio
    state.characterNodes.forEach(node => {
        if (node.labelsCount > 0 || node.hasOutgoingThoughts) {
            // Crea l'arco per questo specifico personaggio
            const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            arc.setAttribute('d', createCharacterArc(node.startAngle, node.endAngle, state.config.arcRadius));
            arc.setAttribute('class', 'character-arc');
            arc.setAttribute('data-character', node.id);
            state.zoomGroup.appendChild(arc);
        }
        
        // Nome esterno del personaggio (SEMPRE al raggio più esterno)
        const externalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        externalText.setAttribute('x', node.x);
        externalText.setAttribute('y', node.y);
        externalText.setAttribute('class', 'character-external-text');
        externalText.setAttribute('font-size', 16 * state.config.scaleFactor);
        externalText.setAttribute('font-weight', 'bold');
        externalText.setAttribute('fill', '#333');
        const externalRotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        externalText.setAttribute('transform', `rotate(${externalRotation}, ${node.x}, ${node.y})`);
        externalText.textContent = node.id;
        state.zoomGroup.appendChild(externalText);
    });

    // Crea i testi delle caratteristiche (INTERNI agli archi)
    state.characteristicNodes.forEach(node => {
        const rotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'characteristic-text clickable-label');
        text.setAttribute('font-size', 13 * state.config.scaleFactor);
        text.setAttribute('data-character', node.character);
        text.setAttribute('data-label', node.label);
        text.setAttribute('data-sources', node.sources.join(','));
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });

    // Crea i nomi rossi dei pensieri (INTERNI agli archi)
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
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });
}

// Resto delle funzioni (zoom, event listeners, highlighting, etc.) rimangono uguali...
// Configura il sistema di zoom
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
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function updateZoom() {
    const transform = `translate(${state.currentTranslateX}, ${state.currentTranslateY}) scale(${state.currentZoom})`;
    state.zoomGroup.setAttribute('transform', transform);
}

function setupEventListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('character-arc') || e.target.classList.contains('character-external-text')) {
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
        resetHighlighting();
        return;
    }

    state.selectedCharacter = character;
    state.selectedLabel = null;
    state.selectedType = 'character';
    highlightCharacterConnections(character);
    updateInfoPanel(character);
}

function handleLabelClick(character, label) {
    if (state.selectedCharacter === character && state.selectedLabel === label && state.selectedType === 'label') {
        resetHighlighting();
        return;
    }

    state.selectedCharacter = character;
    state.selectedLabel = label;
    state.selectedType = 'label';
    highlightLabelConnections(character, label);
    updateInfoPanelForLabel(character, label);
}

function highlightCharacterConnections(character) {
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
    });

    const outgoingPaths = document.querySelectorAll(`[data-source="${character}"]`);
    outgoingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.outgoingLine;
    });

    const incomingPaths = document.querySelectorAll(`[data-target="${character}"]`);
    incomingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
    });

    const characterArcs = document.querySelectorAll('.character-arc');
    characterArcs.forEach(arc => {
        if (arc.getAttribute('data-character') === character) {
            arc.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        } else {
            arc.style.filter = 'none';
        }
    });
    
    const externalTexts = document.querySelectorAll('.character-external-text');
    externalTexts.forEach(text => {
        if (text.textContent === character) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(79, 195, 247, 0.8))';
        } else {
            text.style.filter = 'none';
        }
    });
}

function highlightLabelConnections(character, label) {
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
    });

    const specificPaths = document.querySelectorAll(`[data-target="${character}"][data-label="${label}"]`);
    specificPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
    });

    const characteristicTexts = document.querySelectorAll('.characteristic-text');
    characteristicTexts.forEach(text => {
        if (text.getAttribute('data-character') === character && text.getAttribute('data-label') === label) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.8))';
            text.style.fontWeight = 'bold';
        } else {
            text.style.filter = 'none';
            text.style.fontWeight = 'normal';
        }
    });

    const thoughtTexts = document.querySelectorAll('.thought-text');
    thoughtTexts.forEach(text => {
        if (text.getAttribute('data-character') === character && text.getAttribute('data-label') === label) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 107, 0.8))';
        } else {
            text.style.filter = 'none';
        }
    });

    const characterArcs = document.querySelectorAll('.character-arc');
    characterArcs.forEach(arc => {
        const nodeCharacter = arc.getAttribute('data-character');
        if (nodeCharacter === character) {
            arc.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        } else {
            const labelNode = state.characteristicNodes.find(n => 
                n.character === character && n.label === label
            );
            if (labelNode && labelNode.sources.includes(nodeCharacter)) {
                arc.style.filter = 'drop-shadow(0 0 20px rgba(255, 107, 107, 0.8))';
            } else {
                arc.style.filter = 'none';
            }
        }
    });
    
    const externalTexts = document.querySelectorAll('.character-external-text');
    externalTexts.forEach(text => {
        const nodeCharacter = text.textContent;
        if (nodeCharacter === character) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(79, 195, 247, 0.8))';
        } else {
            const labelNode = state.characteristicNodes.find(n => 
                n.character === character && n.label === label
            );
            if (labelNode && labelNode.sources.includes(nodeCharacter)) {
                text.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 107, 0.8))';
            } else {
                text.style.filter = 'none';
            }
        }
    });
}

function resetHighlighting() {
    state.selectedCharacter = null;
    state.selectedLabel = null;
    state.selectedType = null;
    
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.style.stroke = state.config.colors.defaultConnection;
    });

    const allArcs = document.querySelectorAll('.character-arc');
    allArcs.forEach(arc => {
        arc.style.filter = 'none';
    });

    const allTexts = document.querySelectorAll('.characteristic-text, .thought-text, .character-external-text');
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
        infoContent.innerHTML = `
            <strong>Istruzioni:</strong><br>
            Clicca su un arco esterno per evidenziare le relazioni del personaggio.<br>
            Clicca su una label interna per evidenziare solo gli archi che la puntano.<br>
            <span style="color: #ff6b6b;">Rosso</span>: Archi in uscita<br>
            <span style="color: #4fc3f7;">Blu</span>: Archi in entrata<br>
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

    infoContent.innerHTML = `
        <strong>${character}</strong><br>
        <strong>Stagione:</strong> ${state.selectedSeason}<br>
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
        infoContent.innerHTML = `
            <strong>Label selezionata:</strong><br>
            "${label}"<br>
            <strong>Personaggio:</strong> ${character}<br>
            <strong>Stagione:</strong> ${state.selectedSeason}<br>
            <strong>Pensato da:</strong> ${labelNode.sources.join(', ')}<br>
            <strong>Numero di fonti:</strong> ${labelNode.sources.length}<br>
            <br>
            <small>Clicca altrove per deselezionare</small>
        `;
    }
}

document.addEventListener('DOMContentLoaded', init);