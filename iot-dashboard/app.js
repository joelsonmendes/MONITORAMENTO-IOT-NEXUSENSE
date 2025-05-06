// Importa as configurações MQTT
// Supondo que config.js seja carregado antes deste script no HTML
// e que MQTT_CONFIG esteja disponível globalmente

// Capacidades configuráveis
const capacidadeReservatorio = 10000;
const capacidadeCisterna = 5000;

function updateConnectionStatus(sensor, isConnected) {
    const wifiIcon = document.getElementById(`wifi-${sensor}`);
    if (!wifiIcon) return;

    if (isConnected) {
        wifiIcon.classList.remove('wifi-disconnected');
        wifiIcon.classList.add('wifi-connected');
        wifiIcon.title = 'Sensor conectado';
    } else {
        wifiIcon.classList.remove('wifi-connected');
        wifiIcon.classList.add('wifi-disconnected');
        wifiIcon.title = 'Sensor desconectado';
    }
}

function updateReservatorio(volume) {
    const volumeElement = document.getElementById('volume-reservatorio');
    const percentualElement = document.getElementById('percentual-reservatorio');
    const metricElement = document.getElementById('metric-reservatorio');
    const progressFill = document.getElementById('progress-reservatorio');

    if (volumeElement) volumeElement.textContent = `${volume.toFixed(2)} L`;
    if (percentualElement) {
        const percentual = (volume / capacidadeReservatorio) * 100;
        percentualElement.textContent = `${percentual.toFixed(2)} %`;
    }
    if (metricElement) {
        const percentual = (volume / capacidadeReservatorio) * 100;
        metricElement.textContent = `${percentual.toFixed(2)}%`;
    }
    if (progressFill) {
        const percentual = (volume / capacidadeReservatorio) * 100;
        progressFill.style.width = `${percentual}%`;
    }
}

function updateCisterna(volume) {
    const volumeElement = document.getElementById('volume-cisterna');
    const percentualElement = document.getElementById('percentual-cisterna');
    const metricElement = document.getElementById('metric-cisterna');
    const progressFill = document.getElementById('progress-cisterna');

    if (volumeElement) volumeElement.textContent = `${volume.toFixed(2)} L`;
    if (percentualElement) {
        const percentual = (volume / capacidadeCisterna) * 100;
        percentualElement.textContent = `${percentual.toFixed(2)} %`;
    }
    if (metricElement) {
        const percentual = (volume / capacidadeCisterna) * 100;
        metricElement.textContent = `${percentual.toFixed(2)}%`;
    }
    if (progressFill) {
        const percentual = (volume / capacidadeCisterna) * 100;
        progressFill.style.width = `${percentual}%`;
    }
}

// Variáveis para status de conexão dos sensores
let isReservatorioConnected = false;
let isCisternaConnected = false;
let reservatorioTimeout = null;
let cisternaTimeout = null;
const CONNECTION_TIMEOUT = 15000; // 15 segundos para considerar desconectado

// Armazenamento dos dados de consumo com timestamp
const dadosConsumoReservatorio = [];
const dadosConsumoCisterna = [];

// Dados de demonstração para gráficos
function gerarDadosDemo() {
    const now = new Date();
    for (let i = 10; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 3600 * 1000); // a cada hora nas últimas 10 horas
        dadosConsumoReservatorio.push({
            volume: 5000 + Math.random() * 3000, // volume entre 5000 e 8000 L
            timestamp: timestamp
        });
        dadosConsumoCisterna.push({
            volume: 2000 + Math.random() * 2000, // volume entre 2000 e 4000 L
            timestamp: timestamp
        });
    }
}

let client = null;

async function init() {
    // Solicitar usuário e senha para autenticação básica (exemplo simples)
    const authUser = prompt('Usuário para configuração MQTT:');
    const authPass = prompt('Senha para configuração MQTT:');

    await fetchConfig(authUser, authPass);

    if (!MQTT_CONFIG.brokerUrl || !MQTT_CONFIG.username || !MQTT_CONFIG.password) {
        console.error('Configuração MQTT inválida. Verifique as credenciais.');
        return;
    }

    client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        reconnectPeriod: 5000 // tenta reconectar a cada 5 segundos
    });

    client.on('connect', () => {
        console.log('Conectado ao broker MQTT Adafruit IO');
        client.subscribe([MQTT_CONFIG.topicReservatorio, MQTT_CONFIG.topicCisterna], (err) => {
            if (err) {
                console.error('Erro ao se inscrever nos tópicos:', err);
            }
        });
        // Considera sensores conectados ao conectar ao broker
        updateConnectionStatus('reservatorio', true);
        updateConnectionStatus('cisterna', true);
    });

    client.on('reconnect', () => {
        console.log('Tentando reconectar ao broker MQTT...');
        // Considera sensores desconectados ao tentar reconectar
        updateConnectionStatus('reservatorio', false);
        updateConnectionStatus('cisterna', false);
    });

    client.on('error', (error) => {
        console.error('Erro no cliente MQTT:', error);
        client.end();
        // Considera sensores desconectados em caso de erro
        updateConnectionStatus('reservatorio', false);
        updateConnectionStatus('cisterna', false);
    });

    client.on('message', (topic, message) => {
        const volume = parseFloat(message.toString());
        const timestamp = new Date();
        if (topic === MQTT_CONFIG.topicReservatorio) {
            updateReservatorio(volume);
            dadosConsumoReservatorio.push({ volume, timestamp });
            updateConnectionStatus('reservatorio', true);
        } else if (topic === MQTT_CONFIG.topicCisterna) {
            updateCisterna(volume);
            dadosConsumoCisterna.push({ volume, timestamp });
            updateConnectionStatus('cisterna', true);
        }
    });
}

function gerarRelatorioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório de Consumo de Água', 14, 22);
    doc.setFontSize(12);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

    let y = 40;

    doc.setFontSize(14);
    doc.text('Reservatório:', 14, y);
    y += 6;

    if (dadosConsumoReservatorio.length === 0) {
        doc.text('Nenhum dado disponível.', 14, y);
        y += 10;
    } else {
        dadosConsumoReservatorio.forEach((entry, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${index + 1}. ${entry.timestamp.toLocaleString()} - ${entry.volume.toFixed(2)} L`, 14, y);
            y += 6;
        });
    }

    y += 10;
    doc.setFontSize(14);
    doc.text('Cisterna:', 14, y);
    y += 6;

    if (dadosConsumoCisterna.length === 0) {
        doc.text('Nenhum dado disponível.', 14, y);
        y += 10;
    } else {
        dadosConsumoCisterna.forEach((entry, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${index + 1}. ${entry.timestamp.toLocaleString()} - ${entry.volume.toFixed(2)} L`, 14, y);
            y += 6;
        });
    }

    doc.save('relatorio_consumo_agua.pdf');
}

// Funções updateConnectionStatus, updateReservatorio, updateCisterna, sendWhatsAppNotification, sendEmailNotification, gerarRelatorioPDF permanecem inalteradas

// Adiciona o event listener para o botão e inicializa o app
document.addEventListener('DOMContentLoaded', () => {
    const btnRelatorio = document.getElementById('btn-gerar-relatorio');
    if (btnRelatorio) {
        btnRelatorio.addEventListener('click', gerarRelatorioPDF);
    }

    // Chart container and divs for ApexCharts
    const chartsContainer = document.querySelector('.charts-container');
    const chartReservatorioDiv = document.getElementById('chart-reservatorio');
    const chartCisternaDiv = document.getElementById('chart-cisterna');
    const closeChartBtn = document.getElementById('close-chart');

    // ApexCharts chart instances
    let chartReservatorio = null;
    let chartCisterna = null;

    // Dados de demonstração para gráficos
    function gerarDadosDemo() {
        const now = new Date();
        for (let i = 10; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - i * 3600 * 1000); // a cada hora nas últimas 10 horas
            dadosConsumoReservatorio.push({
                volume: 5000 + Math.random() * 3000, // volume entre 5000 e 8000 L
                timestamp: timestamp
            });
            dadosConsumoCisterna.push({
                volume: 2000 + Math.random() * 2000, // volume entre 2000 e 4000 L
                timestamp: timestamp
            });
        }
    }

    // Function to format date for ApexCharts tooltip and axis
    function formatDate(date) {
        return date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Initialize ApexCharts charts
    function initCharts() {
        const optionsReservatorio = {
            chart: {
                type: 'line',
                height: 300,
                animations: {
                    enabled: false
                }
            },
            series: [{
                name: 'Volume Reservatório (L)',
                data: []
            }],
            xaxis: {
                type: 'datetime',
                labels: {
                    datetimeUTC: false,
                    format: 'dd/MM HH:mm'
                },
                title: {
                    text: 'Data e Hora'
                }
            },
            yaxis: {
                title: {
                    text: 'Volume (L)'
                },
                min: 0
            },
            tooltip: {
                x: {
                    format: 'dd/MM/yyyy HH:mm:ss'
                }
            },
            stroke: {
                curve: 'smooth'
            },
            markers: {
                size: 4
            },
            colors: ['#00bfff']
        };

        const optionsCisterna = {
            chart: {
                type: 'line',
                height: 300,
                animations: {
                    enabled: false
                }
            },
            series: [{
                name: 'Volume Cisterna (L)',
                data: []
            }],
            xaxis: {
                type: 'datetime',
                labels: {
                    datetimeUTC: false,
                    format: 'dd/MM HH:mm'
                },
                title: {
                    text: 'Data e Hora'
                }
            },
            yaxis: {
                title: {
                    text: 'Volume (L)'
                },
                min: 0
            },
            tooltip: {
                x: {
                    format: 'dd/MM/yyyy HH:mm:ss'
                }
            },
            stroke: {
                curve: 'smooth'
            },
            markers: {
                size: 4
            },
            colors: ['#1e90ff']
        };

        chartReservatorio = new ApexCharts(chartReservatorioDiv, optionsReservatorio);
        chartCisterna = new ApexCharts(chartCisternaDiv, optionsCisterna);

        chartReservatorio.render();
        chartCisterna.render();
    }

    // Call gerarDadosDemo before initializing charts
    gerarDadosDemo();
    initCharts();

    // Function to update chart data
    function updateChart(sensor) {
        if (sensor === 'reservatorio' && chartReservatorio) {
            const data = dadosConsumoReservatorio.map(entry => [entry.timestamp.getTime(), entry.volume]);
            chartReservatorio.updateSeries([{
                data: data
            }]);
        } else if (sensor === 'cisterna' && chartCisterna) {
            const data = dadosConsumoCisterna.map(entry => [entry.timestamp.getTime(), entry.volume]);
            chartCisterna.updateSeries([{
                data: data
            }]);
        }
    }

    // Show chart container and display the selected chart
    function showChart(sensor) {
        chartsContainer.style.display = 'flex';
        if (sensor === 'reservatorio') {
            chartReservatorioDiv.style.display = 'block';
            chartCisternaDiv.style.display = 'none';
            updateChart('reservatorio');
        } else if (sensor === 'cisterna') {
            chartCisternaDiv.style.display = 'block';
            chartReservatorioDiv.style.display = 'none';
            updateChart('cisterna');
        }
    }

    // Hide chart container
    function hideChart() {
        chartsContainer.style.display = 'none';
    }

    // Add click event listeners to headings
    const reservatorioHeading = document.querySelector('#reservatorio h2');
    const cisternaHeading = document.querySelector('#cisterna h2');

    if (reservatorioHeading) {
        reservatorioHeading.addEventListener('click', () => {
            console.log('Reservatório heading clicked');
            showChart('reservatorio');
        });
    }

    if (cisternaHeading) {
        cisternaHeading.addEventListener('click', () => {
            console.log('Cisterna heading clicked');
            showChart('cisterna');
        });
    }

    // Close button event listener
    if (closeChartBtn) {
        closeChartBtn.addEventListener('click', hideChart);
    }

    // Inicializa a aplicação MQTT após carregar a configuração
    init();

    // Check for critical levels and send notifications
    function checkCriticalLevels(volumeReservatorio, volumeCisterna) {
        const limiteCriticoReservatorio = capacidadeReservatorio * 0.1; // 10% do reservatório
        const limiteCriticoCisterna = capacidadeCisterna * 0.1; // 10% da cisterna

        if (volumeReservatorio <= limiteCriticoReservatorio) {
            sendPushNotification('Alerta Reservatório', 'Nível crítico no reservatório!');
        }
        if (volumeCisterna <= limiteCriticoCisterna) {
            sendPushNotification('Alerta Cisterna', 'Nível crítico na cisterna!');
        }
    }

    // Function to send push notification using Firebase Messaging
    function sendPushNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification(title, {
                    body: body,
                    icon: 'icons/icon-192x192.png',
                    vibrate: [200, 100, 200]
                });
            });
        }
    }

    // Override updateReservatorio and updateCisterna to include critical level check
    const originalUpdateReservatorio = updateReservatorio;
    updateReservatorio = function(volume) {
        originalUpdateReservatorio(volume);
        checkCriticalLevels(volume, null);
    };

    const originalUpdateCisterna = updateCisterna;
    updateCisterna = function(volume) {
        originalUpdateCisterna(volume);
        checkCriticalLevels(null, volume);
    };
});
