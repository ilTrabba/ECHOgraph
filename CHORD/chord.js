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
        centerX: 0,
        centerY: 0,
        scaleFactor: 1.5,
        colors: {
            character: '#ffffff',
            characterStroke: '#4fc3f7',
            characteristic: '#333',
            thoughtNode: '#ff6b6b',
            outgoingLine: '#ff6b6b',
            incomingLine: '#4fc3f7',
            defaultConnection: '#444444' // Grigio molto scuro per gli archi di default
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
        // Mostra un errore all'utente
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

// Inizializzazione
async function init() {
    // Mostra un loading indicator
    showLoading();
    
    // Carica i dati prima di inizializzare
    const dataLoaded = await loadData();
    
    // Nasconde il loading indicator
    hideLoading();
    
    if (!dataLoaded) {
        return; // Fermati se i dati non sono stati caricati
    }
    
    state.svg = document.getElementById('visualization');
    state.zoomGroup = document.getElementById('zoom-group');
    
    // Aggiorna il selettore di stagione
    updateSeasonSelector();
    
    // Calcola dimensioni dinamiche
    updateDimensions();
    
    processData();
    createVisualization();
    
    // Centra la visualizzazione inizialmente
    centerVisualization();
    
    setupEventListeners();
    setupZoom();
    
    // Aggiorna dimensioni al resize
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
    
    // Centra il gruppo zoom sul centro dell'SVG
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
        
        // Trova tutte le stagioni disponibili
        const seasons = new Set();
        state.data.links.forEach(link => {
            if (link.seasons) {
                Object.keys(link.seasons).forEach(season => {
                    seasons.add(season);
                });
            }
        });
        
        // Crea le opzioni
        Array.from(seasons).sort().forEach(season => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = `Stagione ${season}`;
            if (season === state.selectedSeason) {
                option.selected = true;
            }
            seasonSelector.appendChild(option);
        });
        
        // Aggiungi event listener per il cambio stagione
        seasonSelector.addEventListener('change', (e) => {
            state.selectedSeason = e.target.value;
            processData();
            createVisualization();
            resetHighlighting();
        });
    }
}

// Aggiorna le dimensioni basate sulla finestra
function updateDimensions() {
    const container = document.querySelector('.visualization-container');
    const rect = container.getBoundingClientRect();
    
    // Usa dimensioni fisse per il sistema di coordinate interno
    state.config.width = 800;
    state.config.height = 600;
    state.config.centerX = 400;
    state.config.centerY = 300;
    
    // Aggiorna il viewBox dell'SVG
    state.svg.setAttribute('viewBox', `0 0 ${state.config.width} ${state.config.height}`);
    
    // Calcola raggi basati sulla dimensione fissa
    const minDimension = Math.min(state.config.width, state.config.height);
    state.config.outerRadius = (minDimension / 2) * 0.9 * state.config.scaleFactor;
    state.config.innerRadius = (minDimension / 2) * 0.65 * state.config.scaleFactor;
}

// Elabora i dati per creare la struttura necessaria
function processData() {
    if (!state.data) return;
    
    const characters = state.data.nodes.map(node => node.id);
    const characterCount = characters.length;
    
    // Reset arrays
    state.characterNodes = [];
    state.characteristicNodes = [];
    state.thoughtNodes = [];
    state.connections = [];
    state.groupedConnections = [];
    
    // Crea i nodi dei personaggi (anello esterno)
    state.characterNodes = characters.map((character, index) => {
        const angle = (index / characterCount) * 2 * Math.PI - Math.PI / 2; // Inizia dall'alto
        const x = state.config.centerX + state.config.outerRadius * Math.cos(angle);
        const y = state.config.centerY + state.config.outerRadius * Math.sin(angle);
        
        return {
            id: character,
            x: x,
            y: y,
            angle: angle,
            type: 'character'
        };
    });

    // Crea i nodi delle caratteristiche e dei pensieri per ogni personaggio
    state.characterNodes.forEach(charNode => {
        // Trova tutte le caratteristiche ricevute da questo personaggio per la stagione selezionata
        const incomingLabels = [];
        const labelSources = {}; // Mappa per tenere traccia delle fonti per ogni label
        
        state.data.links.forEach(link => {
            if (link.target === charNode.id && 
                link.seasons && 
                link.seasons[state.selectedSeason] && 
                link.seasons[state.selectedSeason].labels &&
                link.seasons[state.selectedSeason].labels.length > 0) {
                
                link.seasons[state.selectedSeason].labels.forEach(label => {
                    // Raggruppa per label solo per questo personaggio specifico
                    if (!incomingLabels.some(item => item.label === label)) {
                        incomingLabels.push({
                            label: label,
                            source: link.source,
                            judgment: link.seasons[state.selectedSeason].judgment
                        });
                    }
                    
                    // Tieni traccia di tutte le fonti per questa label per questo personaggio
                    if (!labelSources[label]) {
                        labelSources[label] = [];
                    }
                    labelSources[label].push(link.source);
                });
            }
        });

        // Verifica se ha pensieri in uscita per la stagione selezionata
        const hasOutgoingThoughts = state.data.links.some(link => 
            link.source === charNode.id && 
            link.seasons && 
            link.seasons[state.selectedSeason] && 
            link.seasons[state.selectedSeason].labels &&
            link.seasons[state.selectedSeason].labels.length > 0
        );
        
        // Crea un nodo per i pensieri in uscita solo se esistono (ora solo label)
        if (hasOutgoingThoughts) {
            const thoughtAngle = charNode.angle;
            const thoughtX = state.config.centerX + state.config.innerRadius * Math.cos(thoughtAngle);
            const thoughtY = state.config.centerY + state.config.innerRadius * Math.sin(thoughtAngle);
            
            const thoughtNode = {
                id: `${charNode.id}_thoughts`,
                character: charNode.id,
                x: thoughtX,
                y: thoughtY,
                angle: thoughtAngle,
                type: 'thought',
                label: charNode.id // Nome completo del personaggio
            };
            
            state.thoughtNodes.push(thoughtNode);
        }

        // Crea i nodi delle caratteristiche (solo testo, senza cerchi) - MAGGIORE DISTANZIAMENTO
        const totalNodes = incomingLabels.length;
        if (totalNodes > 0) {
            // Aumentato lo spazio angolare per maggiore distanziamento
            const angleSpan = (2 * Math.PI / characterCount) * 1.2; // Aumentato da 0.8 a 1.2
            const angleStep = angleSpan / (totalNodes + 1);
            const startAngle = charNode.angle - angleSpan / 2;

            incomingLabels.forEach((labelData, index) => {
                const angle = startAngle + (index + 1) * angleStep;
                const x = state.config.centerX + state.config.innerRadius * Math.cos(angle);
                const y = state.config.centerY + state.config.innerRadius * Math.sin(angle);
                
                const characteristicNode = {
                    id: `${charNode.id}_${labelData.label}`,
                    character: charNode.id,
                    x: x,
                    y: y,
                    angle: angle,
                    type: 'characteristic',
                    label: labelData.label,
                    sources: labelSources[labelData.label], // Tutte le fonti per questa label per questo personaggio
                    judgment: labelData.judgment
                };
                
                state.characteristicNodes.push(characteristicNode);
            });
        }
    });

    // Crea le connessioni raggruppate per personaggio e label
    state.characterNodes.forEach(charNode => {
        const targetChar = charNode.id;
        
        // Raggruppa le connessioni per label solo per questo personaggio specifico
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

        // Crea una connessione raggruppata per ogni label unica per questo personaggio
        Object.keys(labelGroups).forEach(label => {
            const connections = labelGroups[label];
            const targetCharacteristic = state.characteristicNodes.find(
                n => n.character === targetChar && n.label === label
            );
            
            if (targetCharacteristic && connections.length > 0) {
                // Per ogni fonte diversa, crea una connessione
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

// Crea percorsi curvi per le connessioni con curvatura adattiva basata sulla distanza
function createCurvedPath(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calcola la distanza angolare tra i due personaggi sull'anello esterno
    const sourceCharNode = state.characterNodes.find(n => n.id === source.character);
    const targetCharNode = state.characterNodes.find(n => n.id === target.character);
    
    if (!sourceCharNode || !targetCharNode) {
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }
    
    // Calcola la differenza angolare
    let angleDiff = Math.abs(targetCharNode.angle - sourceCharNode.angle);
    // Normalizza la differenza angolare (considera il percorso più breve)
    if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
    }
    
    // Normalizza la differenza angolare da 0 a 1 (0 = molto vicini, 1 = molto lontani)
    const normalizedAngleDiff = angleDiff / Math.PI;
    
    // Calcola l'intensità della curva in base alla distanza angolare
    // Vicini = più curvi, lontani = più diretti
    const maxCurvature = 0.8; // Massima curvatura per nodi vicini
    const minCurvature = 0.1; // Minima curvatura per nodi lontani
    
    // Usa una funzione inversa: nodi vicini (normalizedAngleDiff basso) = curvatura alta
    const curvatureIntensity = maxCurvature - (normalizedAngleDiff * (maxCurvature - minCurvature));
    
    // Calcola il punto medio
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    
    // Calcola la direzione verso il centro
    const centerX = state.config.centerX;
    const centerY = state.config.centerY;
    const towardsCenterX = centerX - midX;
    const towardsCenterY = centerY - midY;
    
    // Calcola la distanza del punto di controllo
    const controlDistance = distance * curvatureIntensity;
    
    // Calcola il punto di controllo
    const controlX = midX + (towardsCenterX / Math.sqrt(towardsCenterX * towardsCenterX + towardsCenterY * towardsCenterY)) * controlDistance;
    const controlY = midY + (towardsCenterY / Math.sqrt(towardsCenterX * towardsCenterX + towardsCenterY * towardsCenterY)) * controlDistance;
    
    return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

// Crea la visualizzazione SVG
function createVisualization() {
    if (!state.data) return;
    
    // Pulisce l'SVG
    state.zoomGroup.innerHTML = '';

    // Crea le connessioni raggruppate (percorsi curvi) - grigio scuro di default
    state.groupedConnections.forEach((connection, index) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createCurvedPath(connection.source, connection.target));
        path.setAttribute('class', 'connection-path');
        path.setAttribute('stroke', state.config.colors.defaultConnection); // Grigio scuro di default
        path.setAttribute('data-source', connection.sourceCharacter);
        path.setAttribute('data-target', connection.targetCharacter);
        path.setAttribute('data-label', connection.label);
        path.setAttribute('data-index', index);
        state.zoomGroup.appendChild(path);
    });

    // Crea i nodi dei personaggi (anello esterno)
    state.characterNodes.forEach(node => {
        // Cerchio del personaggio
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', 25 * state.config.scaleFactor);
        circle.setAttribute('fill', state.config.colors.character);
        circle.setAttribute('stroke', state.config.colors.characterStroke);
        circle.setAttribute('stroke-width', 4);
        circle.setAttribute('class', 'character-node');
        circle.setAttribute('data-character', node.id);
        state.zoomGroup.appendChild(circle);

        // Testo del personaggio (nome completo)
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y - (35 * state.config.scaleFactor));
        text.setAttribute('class', 'character-text');
        text.setAttribute('font-size', 16 * state.config.scaleFactor);
        text.textContent = node.id;
        state.zoomGroup.appendChild(text);
    });

    // Crea solo i testi delle caratteristiche (senza cerchi) - più grandi e ruotati
    state.characteristicNodes.forEach(node => {
        // Calcola l'angolo di rotazione basato sulla posizione rispetto al centro
        const rotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        
        // Solo testo della caratteristica completo e più grande
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'characteristic-text clickable-label');
        text.setAttribute('font-size', 14 * state.config.scaleFactor);
        text.setAttribute('data-character', node.character);
        text.setAttribute('data-label', node.label);
        text.setAttribute('data-sources', node.sources.join(','));
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });

    // Crea solo le label dei pensieri (senza cerchi) - nome completo in grassetto
    state.thoughtNodes.forEach(node => {
        // Calcola l'angolo di rotazione basato sulla posizione rispetto al centro
        const rotation = calculateTextRotation(node.x, node.y, state.config.centerX, state.config.centerY);
        
        // Solo testo del nome completo in grassetto
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'thought-text clickable-label');
        text.setAttribute('fill', state.config.colors.thoughtNode);
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-size', 14 * state.config.scaleFactor);
        text.setAttribute('data-character', node.character);
        text.setAttribute('data-label', node.label);
        text.setAttribute('transform', `rotate(${rotation}, ${node.x}, ${node.y})`);
        text.textContent = node.label;
        state.zoomGroup.appendChild(text);
    });
}

// Configura il sistema di zoom - COMPLETAMENTE RIPARATO
function setupZoom() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
    zoomInBtn.addEventListener('click', () => {
        state.currentZoom = Math.min(state.currentZoom * 1.3, 5);
        updateZoom();
    });
    
    zoomOutBtn.addEventListener('click', () => {
        state.currentZoom = Math.max(state.currentZoom / 1.3, 0.2);
        updateZoom();
    });
    
    zoomResetBtn.addEventListener('click', () => {
        centerVisualization();
    });
    
    // Zoom con rotella del mouse - ALGORITMO SEMPLIFICATO E FUNZIONANTE
    state.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Ottieni le coordinate del mouse rispetto all'SVG
        const rect = state.svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Converti le coordinate del mouse nel sistema di coordinate SVG
        const svgX = (mouseX / rect.width) * state.config.width;
        const svgY = (mouseY / rect.height) * state.config.height;
        
        // Calcola il punto nel mondo prima del zoom
        const worldX = (svgX - state.currentTranslateX) / state.currentZoom;
        const worldY = (svgY - state.currentTranslateY) / state.currentZoom;
        
        // Calcola il nuovo zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.2, Math.min(5, state.currentZoom * zoomFactor));
        
        // Calcola la nuova traslazione per mantenere il punto fisso
        const newTranslateX = svgX - worldX * newZoom;
        const newTranslateY = svgY - worldY * newZoom;
        
        // Aggiorna lo stato
        state.currentZoom = newZoom;
        state.currentTranslateX = newTranslateX;
        state.currentTranslateY = newTranslateY;
        
        updateZoom();
    });
    
    // Pan con trascinamento
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

// Aggiorna la trasformazione dello zoom
function updateZoom() {
    const transform = `translate(${state.currentTranslateX}, ${state.currentTranslateY}) scale(${state.currentZoom})`;
    state.zoomGroup.setAttribute('transform', transform);
}

// Configura gli event listener
function setupEventListeners() {
    // Click sui personaggi e sui nodi interni
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('character-node')) {
            const character = e.target.getAttribute('data-character');
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

// Gestisce il click su un personaggio
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

// Gestisce il click su una label interna
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

// Evidenzia le connessioni di un personaggio (SENZA evidenziare i nodi interni)
function highlightCharacterConnections(character) {
    // Reset di tutti i percorsi
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
    });

    // Evidenzia i percorsi in uscita (rossi)
    const outgoingPaths = document.querySelectorAll(`[data-source="${character}"]`);
    outgoingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.outgoingLine;
    });

    // Evidenzia i percorsi in entrata (blu)
    const incomingPaths = document.querySelectorAll(`[data-target="${character}"]`);
    incomingPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
    });

    // Evidenzia solo il personaggio selezionato
    const characterNodes = document.querySelectorAll('.character-node');
    characterNodes.forEach(node => {
        if (node.getAttribute('data-character') === character) {
            node.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        } else {
            node.style.filter = 'none';
        }
    });
}

// Evidenzia solo le connessioni che puntano a una specifica label
function highlightLabelConnections(character, label) {
    // Reset di tutti i percorsi
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.classList.add('dimmed');
    });

    // Evidenzia solo i percorsi che puntano a questa specifica label per questo personaggio
    const specificPaths = document.querySelectorAll(`[data-target="${character}"][data-label="${label}"]`);
    specificPaths.forEach(path => {
        path.classList.remove('dimmed');
        path.classList.add('highlighted');
        path.style.stroke = state.config.colors.incomingLine;
    });

    // Evidenzia solo la label selezionata
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

    // Evidenzia le label dei pensieri se è un nodo pensiero
    const thoughtTexts = document.querySelectorAll('.thought-text');
    thoughtTexts.forEach(text => {
        if (text.getAttribute('data-character') === character && text.getAttribute('data-label') === label) {
            text.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 107, 0.8))';
        } else {
            text.style.filter = 'none';
        }
    });

    // Evidenzia i personaggi coinvolti - considera tutte le fonti per questo personaggio specifico
    const characterNodes = document.querySelectorAll('.character-node');
    characterNodes.forEach(node => {
        const nodeCharacter = node.getAttribute('data-character');
        // Evidenzia il personaggio target
        if (nodeCharacter === character) {
            node.style.filter = 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.8))';
        }
        // Evidenzia tutti i personaggi source per questa specifica label per questo personaggio
        else {
            const labelNode = state.characteristicNodes.find(n => 
                n.character === character && n.label === label
            );
            if (labelNode && labelNode.sources.includes(nodeCharacter)) {
                node.style.filter = 'drop-shadow(0 0 20px rgba(255, 107, 107, 0.8))';
            } else {
                node.style.filter = 'none';
            }
        }
    });
}

// Reset dell'evidenziazione
function resetHighlighting() {
    state.selectedCharacter = null;
    state.selectedLabel = null;
    state.selectedType = null;
    
    const allPaths = document.querySelectorAll('.connection-path');
    allPaths.forEach(path => {
        path.classList.remove('highlighted', 'dimmed');
        path.style.stroke = state.config.colors.defaultConnection; // Torna al grigio scuro
    });

    const allNodes = document.querySelectorAll('.character-node');
    allNodes.forEach(node => {
        node.style.filter = 'none';
    });

    const allTexts = document.querySelectorAll('.characteristic-text, .thought-text');
    allTexts.forEach(text => {
        text.style.filter = 'none';
        if (text.classList.contains('characteristic-text')) {
            text.style.fontWeight = 'normal';
        }
    });

    updateInfoPanel(null);
}

// Aggiorna il pannello informazioni per i personaggi
function updateInfoPanel(character) {
    const infoPanel = document.getElementById('info-panel');
    
    if (!character) {
        infoPanel.innerHTML = `
            <strong>Istruzioni:</strong><br>
            Clicca su un personaggio per evidenziare le sue relazioni.<br>
            Clicca su una label interna per evidenziare solo gli archi che la puntano.<br>
            <span style="color: #ff6b6b;">Rosso</span>: Archi in uscita<br>
            <span style="color: #4fc3f7;">Blu</span>: Archi in entrata<br>
            <br>
            <strong>Controlli:</strong><br>
            • Rotella mouse: Zoom al cursore<br>
            • Trascina: Pan<br>
            • Bottoni: Zoom controlli<br>
            • Selettore: Cambia stagione
        `;
        return;
    }

    // Conta le connessioni raggruppate
    const outgoingConnections = state.groupedConnections.filter(c => 
        c.sourceCharacter === character
    );
    const incomingConnections = state.groupedConnections.filter(c => 
        c.targetCharacter === character
    );

    infoPanel.innerHTML = `
        <strong>${character}</strong><br>
        <strong>Stagione:</strong> ${state.selectedSeason}<br>
        Pensieri verso altri: ${outgoingConnections.length}<br>
        Caratteristiche ricevute: ${incomingConnections.length}<br>
        <br>
        <small>Clicca altrove per deselezionare</small>
    `;
}

// Aggiorna il pannello informazioni per le label
function updateInfoPanelForLabel(character, label) {
    const infoPanel = document.getElementById('info-panel');
    
    // Trova la label e tutte le sue fonti per questo personaggio specifico
    const labelNode = state.characteristicNodes.find(n => 
        n.character === character && n.label === label
    );

    if (labelNode) {
        infoPanel.innerHTML = `
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

// Avvia l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', init);