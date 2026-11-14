import json
import os

def generate_mock_stations():
    print("Overpass API yanıt vermediği için Hackathon Plan B (Statik JSON) devreye sokuluyor...")
    
    # Yusuf'un F6 Hikaye Modu demo bölgeleri için temsili istasyon verileri
    mock_stations = [
        # Muğla Bölgesi
        {"id": 101, "lat": 37.2153, "lon": 28.3636, "name": "Muğla Büyükşehir İtfaiyesi"},
        {"id": 102, "lat": 36.8965, "lon": 27.2889, "name": "Bodrum İtfaiye Grup Amirliği"},
        {"id": 103, "lat": 36.8550, "lon": 28.2740, "name": "Marmaris İtfaiye İstasyonu"},
        # Kaliforniya Bölgesi
        {"id": 201, "lat": 34.0522, "lon": -118.2437, "name": "LAFD Station 4 (Los Angeles)"},
        {"id": 202, "lat": 37.7749, "lon": -122.4194, "name": "SFFD Station 1 (San Francisco)"},
        {"id": 203, "lat": 38.5816, "lon": -121.4944, "name": "Sacramento Fire Dept"},
        # Amazon Bölgesi
        {"id": 301, "lat": -3.1190, "lon": -60.0217, "name": "Corpo de Bombeiros Manaus"},
        {"id": 302, "lat": -1.4550, "lon": -48.5024, "name": "Bombeiros Belém"},
        # Avustralya Bölgesi
        {"id": 401, "lat": -33.8688, "lon": 151.2093, "name": "NSW Fire and Rescue Sydney"},
        {"id": 402, "lat": -37.8136, "lon": 144.9631, "name": "MFB Station 1 Melbourne"},
        {"id": 403, "lat": -35.2809, "lon": 149.1300, "name": "ACT Fire & Rescue Canberra"}
    ]

    # Çıktıyı doğrudan web projesinin public/data klasörüne kaydet
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public", "data"))
    os.makedirs(output_dir, exist_ok=True)
    
    out_path = os.path.join(output_dir, "fire_stations.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(mock_stations, f, ensure_ascii=False, indent=2)
        
    print(f"İşlem tamam! Toplam {len(mock_stations)} istasyon şuraya kaydedildi: {out_path}")

if __name__ == "__main__":
    generate_mock_stations()