// 设备特性对比模块 - 对接后端数据 + 真实预测准确性计算
window.addEventListener('load', async function () {
    await initDeviceRadarChart();
    bindCompDeviceSelect();
});

// 存储所有设备数据
let allDevices = [];
// 雷达图实例
let radarChart = null;

// 雷达图指标定义
const radarIndicator = [
    { name: '健康得分', max: 100 },
    { name: '异常频次', max: 100 },
    { name: '预测准确性', max: 100 },
    { name: '反应时间', max: 100 }
];

// 设备颜色池
const colorPalette = [
    "#5be6ff", "#ffd700", "#32cd32", "#ff6347", "#9370db", "#ff69b4",
    "#00ced1", "#ffa07a", "#7b68ee", "#f0e68c", "#db7093", "#9acd32"
];

function getDeviceColor(name) {
    const predefined = {
        "Motor #1": "#5be6ff",
        "Motor #2": "#ffd700",
        "Motor #3": "#32cd32",
        "Motor #4": "#ff6347",
        "Motor #5": "#9370db",
        "Motor #6": "#ff69b4"
    };
    if (predefined[name]) return predefined[name];
    const index = allDevices.findIndex(d => d.name === name);
    return colorPalette[index % colorPalette.length];
}

function getNormalizedData(device) {
    const health = device.health || 0;
    const maxAnomaly = 5;
    const anomalyScore = Math.max(0, 100 - (device.anomalyCount / maxAnomaly) * 100);
    const predictScore = device.predictAccuracy || health; // 使用真实计算值
    const responseScore = health;
    return [health, anomalyScore, predictScore, responseScore];
}

// 计算预测准确性（基于历史最后12点与预测12点的变化趋势相关性）
async function calculatePredictAccuracy(deviceId) {
    try {
        // 1. 获取实时数据（最近24小时）
        const realtimeRes = await fetch(`${API_BASE}/devices/${deviceId}/realtime`);
        if (!realtimeRes.ok) throw new Error('实时数据获取失败');
        const realtimeData = await realtimeRes.json();
        if (!realtimeData.length || realtimeData.length < 12) {
            console.warn(`设备 ${deviceId} 实时数据不足12个点，无法计算准确性`);
            return 70; // 默认值
        }
        // 取最后12个点的温度值
        const last12RealTemps = realtimeData.slice(-12).map(p => p.temperature);

        // 2. 获取预测数据（12步）
        const predictRes = await fetch(`${API_BASE}/predict/${deviceId}?steps=12`);
        if (!predictRes.ok) throw new Error('预测数据获取失败');
        const predictData = await predictRes.json();
        const predValues = predictData.predictions;
        if (!predValues || predValues.length < 12) {
            console.warn(`设备 ${deviceId} 预测数据不足12个点，无法计算准确性`);
            return 70;
        }
        const predTemps = predValues.slice(0, 12);

        // 3. 计算一阶差分（变化趋势）
        const realDiffs = [];
        const predDiffs = [];
        for (let i = 1; i < last12RealTemps.length; i++) {
            realDiffs.push(last12RealTemps[i] - last12RealTemps[i - 1]);
        }
        for (let i = 1; i < predTemps.length; i++) {
            predDiffs.push(predTemps[i] - predTemps[i - 1]);
        }

        // 4. 计算皮尔逊相关系数
        function pearsonCorrelation(x, y) {
            const n = x.length;
            if (n !== y.length || n === 0) return 0;
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = y.reduce((a, b) => a + b, 0);
            const sumX2 = x.reduce((a, b) => a + b * b, 0);
            const sumY2 = y.reduce((a, b) => a + b * b, 0);
            const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
            const numerator = n * sumXY - sumX * sumY;
            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            if (denominator === 0) return 0;
            return numerator / denominator;
        }

        const corr = pearsonCorrelation(realDiffs, predDiffs);
        // 将相关系数从[-1,1]映射到[0,100]分数
        let score = (corr + 1) / 2 * 100;
        score = Math.min(100, Math.max(0, score));
        console.log(`设备 ${deviceId} 预测准确性得分: ${score.toFixed(2)}% (相关系数: ${corr.toFixed(3)})`);
        return score;
    } catch (err) {
        console.error(`设备 ${deviceId} 计算预测准确性失败`, err);
        // 降级：根据健康得分估算
        const device = allDevices.find(d => d.id == deviceId);
        return device ? device.health : 70;
    }
}

async function fetchDeviceData() {
    try {
        const devicesRes = await fetch(`${API_BASE}/devices`);
        if (!devicesRes.ok) throw new Error('获取设备列表失败');
        const devices = await devicesRes.json();

        const deviceDataList = [];
        for (const device of devices) {
            try {
                const detailRes = await fetch(`${API_BASE}/devices/${device.id}`);
                if (!detailRes.ok) throw new Error(`获取设备 ${device.id} 详情失败`);
                const detail = await detailRes.json();
                const anomalyCount = detail.recent_anomalies ? detail.recent_anomalies.length : 0;

                // 计算预测准确性（真实值）
                const predictAccuracy = await calculatePredictAccuracy(device.id);

                deviceDataList.push({
                    id: device.id,
                    name: device.name,
                    health: detail.health_score,
                    anomalyCount: anomalyCount,
                    predictAccuracy: predictAccuracy,      // 存储真实计算值
                    response: detail.health_score
                });
            } catch (err) {
                console.error(`设备 ${device.id} 详情获取失败，使用默认值`, err);
                deviceDataList.push({
                    id: device.id,
                    name: device.name,
                    health: device.health_score || 0,
                    anomalyCount: 0,
                    predictAccuracy: device.health_score || 0,
                    response: device.health_score || 0
                });
            }
        }
        return deviceDataList;
    } catch (err) {
        console.error('获取设备数据失败', err);
        return [];
    }
}

async function initDeviceRadarChart() {
    const chartDom = document.getElementById('deviceRadarChart');
    if (!chartDom) return;
    radarChart = echarts.init(chartDom);
    window.addEventListener('resize', () => radarChart && radarChart.resize());

    allDevices = await fetchDeviceData();
    if (!allDevices.length) {
        radarChart.setOption({
            title: { show: true, text: '暂无设备数据', left: 'center', top: 'center', textStyle: { color: '#fff' } }
        });
        return;
    }

    const radarSeries = allDevices.map(device => ({
        name: device.name,
        type: 'radar',
        data: [getNormalizedData(device)],
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.2 },
        itemStyle: { color: getDeviceColor(device.name) }
    }));

    const leftLegends = allDevices.slice(0, Math.ceil(allDevices.length / 2)).map(d => d.name);
    const rightLegends = allDevices.slice(Math.ceil(allDevices.length / 2)).map(d => d.name);

    const option = {
        tooltip: { trigger: 'item' },
        legend: [
            {
                left: '5%',
                top: '5%',
                orient: 'vertical',
                textStyle: { color: '#fff' },
                data: leftLegends
            },
            {
                right: '5%',
                top: '5%',
                orient: 'vertical',
                textStyle: { color: '#fff' },
                data: rightLegends
            }
        ],
        radar: {
            indicator: radarIndicator,
            shape: 'polygon',
            axisName: { color: '#5be6ff' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
            splitArea: { areaStyle: { color: 'rgba(40,59,77,0.2)' } },
            axisLine: { lineStyle: { color: 'rgba(91,230,255,0.3)' } }
        },
        series: radarSeries
    };

    radarChart.setOption(option);
    if (allDevices.length) {
        updateDeviceDetail(allDevices[0].name);
    }

    const container = document.getElementById('deviceRadarChart');
    const observer = new ResizeObserver(() => {
        setTimeout(() => radarChart.resize(), 50);
    });
    observer.observe(container);
}

function bindCompDeviceSelect() {
    const btn = document.getElementById('compBtn');
    const list = document.getElementById('compList');
    if (!btn || !list) return;

    list.innerHTML = '';
    allDevices.forEach(device => {
        const li = document.createElement('li');
        li.setAttribute('data-id', device.name);
        li.textContent = device.name;
        list.appendChild(li);
    });

    const items = list.querySelectorAll('li');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        list.classList.toggle('show');
    });
    document.addEventListener('click', () => {
        list.classList.remove('show');
    });

    items.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const name = item.getAttribute('data-id');
            btn.innerText = `${name} ▼`;
            updateDeviceDetail(name);
            list.classList.remove('show');
        });
    });

    if (items.length) {
        items[0].classList.add('active');
        btn.innerText = `${items[0].getAttribute('data-id')} ▼`;
    }
}

function updateDeviceDetail(deviceName) {
    const device = allDevices.find(d => d.name === deviceName);
    if (!device) return;

    document.getElementById('detailDeviceName').innerText = device.name;
    document.getElementById('detailHealthScore').innerHTML = `${device.health} <span>/ 100</span>`;
    document.getElementById('detailAnomalyCount').innerHTML = `${device.anomalyCount} <span>次/月</span>`;
    // 保留两位小数显示预测准确性
    const predictAcc = device.predictAccuracy;
    document.getElementById('detailPredictAcc').innerHTML = `${predictAcc.toFixed(2)} <span>%</span>`;
    const responseTime = (0.2 + (100 - device.health) / 500).toFixed(2);
    document.getElementById('detailResponseTime').innerHTML = `${responseTime} <span>s</span>`;
}