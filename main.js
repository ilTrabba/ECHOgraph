class ECHOGraphMain {
    constructor() {
        this.selectedSeasons = new Set();
        this.currentView = 'graph'; // 'graph' o 'chord'
        this.graphInstance = null;
        this.chordInstance = null;
        
        this.init();
    }
    
    init() {
        this.initializeSeasonFilter();
        this.initializeToggle();
        this.loadView('graph'); // Carica il grafo di default
    }
    
    // Inizializza il filtro stagioni
    initializeSeasonFilter() {
        const seasonDotsContainer = d3.select("#season-dots");
        
        // Crea i dot delle stagioni
        for (let i = 1; i <= 6; i++) {
            seasonDotsContainer.append("div")
                .attr("class", "season-dot")
                .attr("data-season", i)
                .text(i)
                .on("click", (event) => {
                    const season = String(i);
                    
                    if (this.selectedSeasons.has(season)) {
                        this.selectedSeasons.delete(season);
                        d3.select(event.target).classed("selected", false);
                    } else {
                        this.selectedSeasons.add(season);
                        d3.select(event.target).classed("selected", true);
                    }
                    
                    // Aggiorna la vista corrente
                    this.updateCurrentView();
                });
        }
        
        // Reset button
        seasonDotsContainer.append("div")
            .attr("class", "reset-button")
            .text("↻")
            .on("click", () => {
                this.selectedSeasons.clear();
                seasonDotsContainer.selectAll(".season-dot").classed("selected", false);
                this.updateCurrentView();
            });
    }
    
    // Inizializza il toggle switch
    initializeToggle() {
        const mainToggle = document.getElementById('mainToggle');
        
        mainToggle.addEventListener('change', (e) => {
            const newView = e.target.checked ? 'chord' : 'graph';
            this.switchView(newView);
        });
    }
    
    // Cambia vista
    switchView(view) {
        if (this.currentView === view) return;
        
        // Animazione di fade out
        const container = document.getElementById('main-container');
        container.classList.add('view-transition');
        
        setTimeout(() => {
            this.loadView(view);
        }, 150);
    }
    
    // Carica una vista specifica
    async loadView(view) {
        this.currentView = view;
        const container = document.getElementById('main-container');
        
        // Pulisci il contenitore
        container.innerHTML = '';
        
        if (view === 'graph') {
            await this.loadGraphView();
        } else if (view === 'chord') {
            await this.loadChordView();
        }
        
        // Animazione di fade in
        setTimeout(() => {
            container.classList.remove('view-transition');
            container.classList.add('active');
        }, 50);
    }
    
    // Carica la vista grafo
    async loadGraphView() {
        const container = document.getElementById('main-container');
        
        // Crea il contenuto del grafo
        container.innerHTML = `
            <div id="graph-container">
                <svg width="100%" height="100%">
                    <defs>
                        <marker id="arrow-positive" viewBox="0 -5 10 10" refX="20" refY="0"
                            markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M0,-5L10,0L0,5" fill="#4CAF50" />
                        </marker>
                        <marker id="arrow-negative" viewBox="0 -5 10 10" refX="20" refY="0"
                            markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M0,-5L10,0L0,5" fill="#F44336" />
                        </marker>
                        <marker id="arrow-ambiguous" viewBox="0 -5 10 10" refX="20" refY="0"
                            markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M0,-5L10,0L0,5" fill="#FFC107" />
                        </marker>
                        <marker id="arrow-neutral" viewBox="0 -5 10 10" refX="20" refY="0"
                            markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M0,-5L10,0L0,5" fill="#c9c9c9ff" />
                        </marker>
                    </defs>
                    <g id="zoom-group"></g>
                </svg>
            </div>
        `;
        
        // Carica e inizializza il codice del grafo
        await this.loadScript('GRAPH/graph.js');
        
        // Inizializza il grafo con le stagioni selezionate
        if (window.GraphVisualization) {
            this.graphInstance = new window.GraphVisualization(this.selectedSeasons);
        }
    }
    
    // Carica la vista chord
    async loadChordView() {
        const container = document.getElementById('main-container');
        
        // Crea il contenuto del chord
        container.innerHTML = `
            <div class="chord-container">
                <svg id="chord-visualization" width="100%" height="100%" viewBox="0 0 800 600">
                    <g id="chord-zoom-group"></g>
                </svg>
                
                <div id="chord-info-panel" class="chord-info-panel">
                    <div class="zoom-controls">
                        <button id="chord-zoom-in">+</button>
                        <button id="chord-zoom-out">-</button>
                        <button id="chord-zoom-reset">Reset</button>
                    </div>
                    <hr>
                    <div id="chord-info-content">
                        <strong>Chord Diagram</strong><br>
                        Clicca su un personaggio per evidenziare le sue relazioni.<br>
                        Usa il filtro Chapters per selezionare i capitoli.<br>
                        <br>
                        <strong>Controlli:</strong><br>
                        • Rotella mouse: Zoom<br>
                        • Trascina: Pan<br>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi CSS specifico per chord
        this.addChordCSS();
        
        // Carica e inizializza il codice del chord
        await this.loadScript('CHORD/chord.js');
        
        // Inizializza il chord con le stagioni selezionate
        if (window.ChordVisualization) {
            this.chordInstance = new window.ChordVisualization(this.selectedSeasons);
        }
    }
    
    // Aggiorna la vista corrente quando cambiano le stagioni
    updateCurrentView() {
        if (this.currentView === 'graph' && this.graphInstance) {
            this.graphInstance.updateForSeasons(this.selectedSeasons);
        } else if (this.currentView === 'chord' && this.chordInstance) {
            this.chordInstance.updateForSeasons(this.selectedSeasons);
        }
    }
    
    // Carica uno script dinamicamente
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Rimuovi script precedente se esiste
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                existingScript.remove();
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Aggiunge CSS specifico per chord
    addChordCSS() {
        const chordCSS = `
            .chord-container {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .chord-info-panel {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                min-width: 200px;
                z-index: 1000;
            }
            
            .zoom-controls {
                display: flex;
                gap: 5px;
                margin-bottom: 10px;
            }
            
            .zoom-controls button {
                padding: 5px 10px;
                border: 1px solid #ccc;
                background: white;
                cursor: pointer;
                border-radius: 4px;
            }
            
            .zoom-controls button:hover {
                background: #f0f0f0;
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = chordCSS;
        document.head.appendChild(style);
    }
}

// Inizializza l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    window.echoGraphMain = new ECHOGraphMain();
});

// Event listener per il dialogue box
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-btn')) {
        const dialogueBox = document.getElementById('dialogue-box');
        dialogueBox.classList.remove('visible');
    }
});