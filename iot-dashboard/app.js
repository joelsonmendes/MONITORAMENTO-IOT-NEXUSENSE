// Importa as configurações MQTT
// Supondo que config.js seja carregado antes deste script no HTML
// e que MQTT_CONFIG esteja disponível globalmente

// Capacidades configuráveis
const capacidadeReservatorio = 10000;
const capacidadeCisterna = 5000;

// Variáveis para status de conexão dos sensores
let isReservatorioConnected = false;
let isCisternaConnected = false;
let reservatorioTimeout = null;
let cisternaTimeout = null;
const CONNECTION_TIMEOUT = 15000; // 15 segundos para considerar desconectado

// Cliente MQTT
const client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    reconnectPeriod: 5000 // tenta reconectar a cada 5 segundos
});


// Armazenamento dos dados de consumo com timestamp
const dadosConsumoReservatorio = [];
const dadosConsumoCisterna = [];


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

function updateConnectionStatus(sensor, isConnected) {
    let wifiIcon;
    let timeoutId;

    if (sensor === 'reservatorio') {
        wifiIcon = document.getElementById('wifi-reservatorio');
        timeoutId = reservatorioTimeout;
    } else if (sensor === 'cisterna') {
        wifiIcon = document.getElementById('wifi-cisterna');
        timeoutId = cisternaTimeout;
    } else {
        return;
    }

    if (isConnected) {
        if (sensor === 'reservatorio') {
            isReservatorioConnected = true;
            clearTimeout(reservatorioTimeout);
            reservatorioTimeout = setTimeout(() => {
                updateConnectionStatus('reservatorio', false);
            }, CONNECTION_TIMEOUT);
        } else if (sensor === 'cisterna') {
            isCisternaConnected = true;
            clearTimeout(cisternaTimeout);
            cisternaTimeout = setTimeout(() => {
                updateConnectionStatus('cisterna', false);
            }, CONNECTION_TIMEOUT);
        }
        wifiIcon.classList.remove('wifi-disconnected');
        wifiIcon.classList.add('wifi-connected');
    } else {
        if (sensor === 'reservatorio') {
            isReservatorioConnected = false;
            clearTimeout(reservatorioTimeout);
        } else if (sensor === 'cisterna') {
            isCisternaConnected = false;
            clearTimeout(cisternaTimeout);
        }
        wifiIcon.classList.remove('wifi-connected');
        wifiIcon.classList.add('wifi-disconnected');
    }
}

function updateReservatorio(volume) {
    const percentual = ((volume / capacidadeReservatorio) * 100).toFixed(1);
    document.getElementById('volume-reservatorio').textContent = volume + ' L';
    document.getElementById('percentual-reservatorio').textContent = percentual + ' %';
    document.getElementById('progress-reservatorio').style.height = percentual + '%';
    document.getElementById('metric-reservatorio').textContent = percentual + '%';

    if (percentual < 50) {
        if (!updateReservatorio.notified) {
            sendWhatsAppNotification('Reservatório abaixo de 50%: ' + percentual + '%');
            sendEmailNotification('Reservatório abaixo de 50%', 'O nível do reservatório está em ' + percentual + '%.');
            updateReservatorio.notified = true;
        }
    } else {
        updateReservatorio.notified = false;
    }
}

function updateCisterna(volume) {
    const percentual = ((volume / capacidadeCisterna) * 100).toFixed(1);
    document.getElementById('volume-cisterna').textContent = volume + ' L';
    document.getElementById('percentual-cisterna').textContent = percentual + ' %';
    document.getElementById('progress-cisterna').style.height = percentual + '%';
    document.getElementById('metric-cisterna').textContent = percentual + '%';

    if (percentual < 50) {
        if (!updateCisterna.notified) {
            sendWhatsAppNotification('Cisterna abaixo de 50%: ' + percentual + '%');
            sendEmailNotification('Cisterna abaixo de 50%', 'O nível da cisterna está em ' + percentual + '%.');
            updateCisterna.notified = true;
        }
    } else {
        updateCisterna.notified = false;
    }
}

function sendWhatsAppNotification(message) {
    fetch(NOTIFICATION_CONFIG.whatsappApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + NOTIFICATION_CONFIG.whatsappApiKey
        },
        body: JSON.stringify({
            to: 'whatsapp:+5511999999999', // Número de destino no formato internacional
            message: message
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erro ao enviar notificação WhatsApp:', response.statusText);
        }
    })
    .catch(error => {
        console.error('Erro na requisição WhatsApp:', error);
    });
}

function sendEmailNotification(subject, body) {
    fetch(NOTIFICATION_CONFIG.emailApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + NOTIFICATION_CONFIG.emailApiKey
        },
        body: JSON.stringify({
            to: NOTIFICATION_CONFIG.emailRecipient,
            subject: subject,
            body: body
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erro ao enviar notificação por email:', response.statusText);
        }
    })
    .catch(error => {
        console.error('Erro na requisição de email:', error);
    });
}

// Função para gerar o relatório em PDF (texto traduzido para português)
function gerarRelatorioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório de Consumo Mensal', 14, 22);
    doc.setFontSize(12);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

    let y = 40;
    doc.text('Reservatório:', 14, y);
    y += 8;
    doc.text('Data e Hora           Volume (L)', 14, y);
    y += 6;

    dadosConsumoReservatorio.forEach(entry => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        const dataHora = entry.timestamp.toLocaleString();
        const linha = `${dataHora}    ${entry.volume.toFixed(2)}`;
        doc.text(linha, 14, y);
        y += 6;
    });

    y += 10;
    doc.text('Cisterna:', 14, y);
    y += 8;
    doc.text('Data e Hora           Volume (L)', 14, y);
    y += 6;

    dadosConsumoCisterna.forEach(entry => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        const dataHora = entry.timestamp.toLocaleString();
        const linha = `${dataHora}    ${entry.volume.toFixed(2)}`;
        doc.text(linha, 14, y);
        y += 6;
    });

    doc.save('relatorio_consumo_mensal.pdf');
}

// Adiciona o event listener para o botão
document.addEventListener('DOMContentLoaded', () => {
    const btnRelatorio = document.getElementById('btn-gerar-relatorio');
    if (btnRelatorio) {
        btnRelatorio.addEventListener('click', gerarRelatorioPDF);
    }

    // Chart container and canvases
    const chartsContainer = document.querySelector('.charts-container');
    const chartReservatorioCanvas = document.getElementById('chart-reservatorio');
    const chartCisternaCanvas = document.getElementById('chart-cisterna');
    const closeChartBtn = document.getElementById('close-chart');

    // Chart.js chart instances
    let chartReservatorio = null;
    let chartCisterna = null;

    // Initialize Chart.js charts
    chartReservatorio = new Chart(chartReservatorioCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Volume Reservatório (L)',
                data: [],
                borderColor: '#00bfff',
                backgroundColor: 'rgba(0, 191, 255, 0.3)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        tooltipFormat: 'DD/MM/YYYY HH:mm',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'DD/MM',
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data e Hora'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Volume (L)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#cfd8dc'
                    }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                }
            }
        }
    });

    chartCisterna = new Chart(chartCisternaCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Volume Cisterna (L)',
                data: [],
                borderColor: '#1e90ff',
                backgroundColor: 'rgba(30, 144, 255, 0.3)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        tooltipFormat: 'DD/MM/YYYY HH:mm',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'DD/MM',
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data e Hora'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Volume (L)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#cfd8dc'
                    }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                }
            }
        }
    });

    // Function to update chart data
    function updateChart(sensor) {
        if (sensor === 'reservatorio' && chartReservatorio) {
            const labels = dadosConsumoReservatorio.map(entry => entry.timestamp);
            const data = dadosConsumoReservatorio.map(entry => entry.volume);
            chartReservatorio.data.labels = labels;
            chartReservatorio.data.datasets[0].data = data;
            chartReservatorio.update();
        } else if (sensor === 'cisterna' && chartCisterna) {
            const labels = dadosConsumoCisterna.map(entry => entry.timestamp);
            const data = dadosConsumoCisterna.map(entry => entry.volume);
            chartCisterna.data.labels = labels;
            chartCisterna.data.datasets[0].data = data;
            chartCisterna.update();
        }
    }

// Show chart container and display the selected chart
function showChart(sensor) {
    console.log('showChart called with sensor:', sensor);
    chartsContainer.style.display = 'flex';
    if (sensor === 'reservatorio') {
        chartReservatorioCanvas.parentElement.style.display = 'block';
        chartCisternaCanvas.parentElement.style.display = 'none';
        updateChart('reservatorio');
    } else if (sensor === 'cisterna') {
        chartCisternaCanvas.parentElement.style.display = 'block';
        chartReservatorioCanvas.parentElement.style.display = 'none';
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
});
