const express = require('express');
const puppeteer = require('puppeteer'); // <- El completo para local
const puppeteerCore = require('puppeteer-core'); // <- El "core" para Render
const chromium = require('@sparticuz/chromium'); // <- El navegador para Render
const fs = require('fs');
const cron = require('node-cron');
const path = require('path');

const URL = 'https://seremienlinea.minsal.cl/asdigital/index.php?mfarmacias';
const API_URL = '/asdigital/mfarmacias/mapa.php';
const PORT = process.env.PORT || 3000;

// En server.js

async function fetchFromPage() {
    let browser; // Se declara afuera para que 'finally' pueda accederla
    console.log(`[${new Date().toLocaleString('es-CL')}] Iniciando scraping de farmacias...`);

    try {
        // --- INICIO DE LA MODIFICACIÓN ---
        // Este bloque decide qué versión de Puppeteer usar
        if (process.env.NODE_ENV === 'production') {
            // CÓDIGO PARA RENDER (PRODUCCIÓN)
            console.log('Modo Producción: Usando Chromium para Render.');
            browser = await puppeteerCore.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });
        } else {
            // CÓDIGO PARA TU PC (LOCAL)
            console.log('Modo Local: Usando la versión de Puppeteer instalada.');
            browser = await puppeteer.launch({
                headless: true // Cambialo a false si querés ver el navegador
            });
        }
        // --- FIN DE LA MODIFICACIÓN ---

        const page = await browser.newPage();
        await page.goto(URL, { waitUntil: 'networkidle2' });

        const now = new Date();
        const fecha = now.toISOString().slice(0, 10);
        const hora = encodeURIComponent(now.toTimeString().slice(0, 8));

        // PASO 1: Obtener la lista maestra
        console.log('Paso 1: Obteniendo la lista maestra de farmacias de turno...');
        const farmaciasDeTurnoCoords = [];
        for (let regionId = 1; regionId <= 16; regionId++) {
            const payloadCoordenadas = `func=region&filtro=turnos&fecha=${fecha}&region=${regionId}&hora=${hora}`;
            const coordsData = await page.evaluate(async (apiUrl, payload) => {
                const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload });
                return await res.json();
            }, API_URL, payloadCoordenadas);

            if (coordsData.correcto && Array.isArray(coordsData.respuesta.locales)) {
                coordsData.respuesta.locales.forEach(local => {
                    farmaciasDeTurnoCoords.push({ im: local.im, lat: local.lt, lng: local.lg });
                });
            }
        }
        console.log(`Se encontraron ${farmaciasDeTurnoCoords.length} farmacias de turno en la lista maestra.`);

        // PASO 2: Obtener detalles para CADA farmacia en paralelo
        console.log(`Paso 2: Obteniendo detalles para cada farmacia en paralelo...`);
        
        const promesasDeDetalles = farmaciasDeTurnoCoords.map(farmaciaBase => {
            return page.evaluate(async (apiUrl, farmacia) => {
                const payloadDetalle = `im=${farmacia.im}&lt=${farmacia.lat}&lg=${farmacia.lng}&tp=1&func=local&fecha=${new Date().toISOString().slice(0, 10)}`;
                const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payloadDetalle });
                const detalleData = await res.json();
                
                if (detalleData.correcto && detalleData.respuesta.local) {
                    const detalleLocal = Array.isArray(detalleData.respuesta.local) ? detalleData.respuesta.local[0] : detalleData.respuesta.local;
                    
                    const horarioInfo = detalleData.respuesta.horario;
                    let horarioTurno = 'No especificado';

                    if (horarioInfo && horarioInfo.turno) {
                        horarioTurno = horarioInfo.turno.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
                    }

                    return {
                        ...farmacia,
                        ...detalleLocal,
                        horario_turno: horarioTurno
                    };
                }
                return null;
            }, API_URL, farmaciaBase);
        });

        const resultados = await Promise.all(promesasDeDetalles);
        const farmaciasCompletas = resultados.filter(Boolean);
        
        console.log(`Paso 3: Se obtuvieron detalles completos para ${farmaciasCompletas.length} farmacias.`);

        // PASO 3: Guardar el JSON final
        const dataFinal = {
            fechaActualizacion: new Date().toISOString(),
            farmacias: farmaciasCompletas
        };
        fs.writeFileSync('farmacias.json', JSON.stringify(dataFinal, null, 2));
        console.log(`[${new Date().toLocaleString('es-CL')}] Datos guardados correctamente.`);

    } catch (error) {
        console.error("Ocurrió un error durante el scraping:", error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// ... El resto del server.js (cron, express app, etc.) sigue igual que antes ...

// Ejecutar al iniciar
fetchFromPage();

// Cron
cron.schedule('0 8,16 * * *', fetchFromPage, {
  timezone: "America/Santiago"
});

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/farmacias', (req, res) => {
  const farmaciasPath = path.join(__dirname, 'farmacias.json');
  if (!fs.existsSync(farmaciasPath)) {
    return res.status(503).json({ error: 'Los datos de las farmacias aún no están disponibles. Intente en unos momentos.' });
  }
  res.sendFile(farmaciasPath);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});