// public/js/map.js (Versión completamente actualizada)

document.addEventListener('DOMContentLoaded', () => {

    // --- DATOS DE LAS REGIONES DE CHILE (Coordenadas y Zoom) ---
    const REGIONES_CHILE = [
        { id: '15', nombre: 'Arica y Parinacota', lat: -18.529, lng: -70.1, zoom: 11 },
        { id: '1', nombre: 'Tarapacá', lat: -20.246, lng: -70, zoom: 11 },
        { id: '2', nombre: 'Antofagasta', lat: -23.634, lng: -70.34, zoom: 10 },
        { id: '3', nombre: 'Atacama', lat: -27.366, lng: -70.33, zoom: 9 },
        { id: '4', nombre: 'Coquimbo', lat: -30, lng: -71.21, zoom: 10 },
        { id: '5', nombre: 'Valparaíso', lat: -33.047, lng: -71.5, zoom: 12 },
        { id: '13', nombre: 'Metropolitana de Santiago', lat: -33.456, lng: -70.648, zoom: 12 },
        { id: '6', nombre: 'O\'Higgins', lat: -34.364, lng: -71.07, zoom: 11 },
        { id: '7', nombre: 'Maule', lat: -35.427, lng: -71.65, zoom: 11 },
        { id: '16', nombre: 'Ñuble', lat: -36.608, lng: -72.10, zoom: 10 },
        { id: '8', nombre: 'Biobío', lat: -37.472, lng: -72.35, zoom: 9 },
        { id: '9', nombre: 'La Araucanía', lat: -38.739, lng: -72.59, zoom: 11 },
        { id: '14', nombre: 'Los Ríos', lat: -40, lng: -73.24, zoom: 10 },
        { id: '10', nombre: 'Los Lagos', lat: -41.4, lng: -72.94, zoom: 11 },
        { id: '11', nombre: 'Aysén', lat: -45.571, lng: -72.06, zoom: 10 },
        { id: '12', nombre: 'Magallanes', lat: -53.163, lng: -70.91, zoom: 10 }
    ];

    // --- 4. MAPA CENTRADO EN SANTIAGO POR DEFECTO ---
    const santiago = REGIONES_CHILE.find(r => r.id === '13');
    const map = L.map('map').setView([santiago.lat, santiago.lng], santiago.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- 3. LÓGICA DEL SELECTOR DE REGIÓN ---
    const selector = document.getElementById('region-selector');

    // Poblar el selector con las regiones
    REGIONES_CHILE.forEach((region, index) => {
        const option = document.createElement('option');
        option.value = index; // Usamos el índice del array como valor
        option.textContent = region.nombre;
        selector.appendChild(option);
    });

    // Añadir el evento que mueve el mapa
    selector.addEventListener('change', (e) => {
        const selectedIndex = e.target.value;
        if (selectedIndex) {
            const region = REGIONES_CHILE[selectedIndex];
            // Usamos flyTo para una animación suave
            map.flyTo([region.lat, region.lng], region.zoom);
        } else {
            // Si selecciona "-- Todas --", volvemos a la vista de Santiago o a una vista general
            map.flyTo([santiago.lat, santiago.lng], 5); // Zoom más alejado para ver Chile
        }
    });

    // Cargar los datos de las farmacias (esta parte no cambia)
    fetch('/api/farmacias')
        .then(response => {
            if (!response.ok) throw new Error(`Error en la respuesta del servidor: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // ... (el resto del código que procesa y muestra las farmacias es el mismo)

            const farmacias = data.farmacias || [];
            
            farmacias.forEach(farmacia => {
                if (farmacia.lat && farmacia.lng) {
                    const lat = parseFloat(farmacia.lat);
                    const lng = parseFloat(farmacia.lng);

                    const comuna = farmacia.cm_nombre || 'No especificada';

                    const popupContent = `
                        <b>${farmacia.nm}</b><br>
                        ${farmacia.dr}<br>
                        <hr style="margin: 5px 0;">
                        Comuna: ${comuna}<br>
                        Horario Turno: <b>${farmacia.horario_turno || 'No disponible'}</b>
                    `;

                    L.marker([lat, lng]).addTo(map)
                        .bindPopup(popupContent);
                }
            });

            const farmaciasCount = farmacias.length;
            console.log(`Se cargaron ${farmaciasCount} farmacias en el mapa.`);
        })
        .catch(error => {
            console.error('Error al cargar los datos de las farmacias:', error);
            const infoBox = document.getElementById('info-box');
            infoBox.innerHTML = `<p style="color: red;">No se pudieron cargar los datos. Por favor, intenta de nuevo más tarde.</p>`;
        });
});
