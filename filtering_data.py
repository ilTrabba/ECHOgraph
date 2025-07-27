import json

def filter_seasons(input_file='data.json', output_file='data_filtered.json'):
    """
    Filtra il file JSON mantenendo solo le stagioni 1, 2 e 3
    ed eliminando le stagioni 4, 5 e 6 da tutti i link.
    
    Args:
        input_file (str): Nome del file JSON di input
        output_file (str): Nome del file JSON di output
    """
    
    # Leggi il file JSON originale
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Errore: Il file {input_file} non è stato trovato.")
        return
    except json.JSONDecodeError:
        print(f"Errore: Il file {input_file} non è un JSON valido.")
        return
    
    # Mantieni i nodes invariati
    filtered_data = {
        "nodes": data["nodes"],
        "links": []
    }
    
    # Stagioni da mantenere
    seasons_to_keep = ["1", "2", "3"]
    
    # Processa ogni link
    for link in data["links"]:
        # Crea una copia del link
        filtered_link = {
            "source": link["source"],
            "target": link["target"],
            "seasons": {}
        }
        
        # Filtra le stagioni, mantenendo solo 1, 2 e 3
        for season in seasons_to_keep:
            if season in link["seasons"]:
                filtered_link["seasons"][season] = link["seasons"][season]
        
        # Aggiungi il link filtrato alla lista
        filtered_data["links"].append(filtered_link)
    
    # Salva il file filtrato
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ File filtrato salvato con successo come '{output_file}'")
        print(f"📊 Statistiche:")
        print(f"   - Nodi: {len(filtered_data['nodes'])}")
        print(f"   - Link processati: {len(filtered_data['links'])}")
        print(f"   - Stagioni mantenute: 1, 2, 3")
        print(f"   - Stagioni rimosse: 4, 5, 6")
        
    except Exception as e:
        print(f"Errore durante il salvataggio: {e}")

if __name__ == "__main__":
    # Esegui il filtro
    filter_seasons()