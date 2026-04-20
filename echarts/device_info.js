// ========== 设备详情弹窗及图表 ==========
let currentDeviceId = null;
let currentRealTimeData = null;      // 原始实时数据
let currentImputedData = null;       // 补全后的数据
let currentChart = null;              // ECharts 实例
let currentTimeRange = 6;            // 默认 6 小时（与按钮高亮一致）
let currentPredictions = null;        // 预测数据 { timestamps, temperatures }

// DOM 元素
const deviceModalOverlay = document.getElementById('deviceModal');
const modalTitle = document.getElementById('modalTitle');
const detailDeviceName = document.getElementById('detailDeviceName');
const detailDeviceId = document.getElementById('detailDeviceId');
const detailHealthScore = document.getElementById('detailHealthScore');
const faultTableBody = document.getElementById('faultTableBody');
const recoveryStatus = document.getElementById('recoveryStatus');
const maintenanceAdvice = document.getElementById('maintenanceAdvice');

// 获取设备阈值（从 localStorage 读取）
function getDeviceThreshold(deviceId) {
    const stored = localStorage.getItem('deviceThresholds');
    if (stored) {
        try {
            const thresholds = JSON.parse(stored);
            if (thresholds[deviceId] !== undefined) return thresholds[deviceId];
        } catch (e) { console.warn(e); }
    }
    // 默认阈值（单位与设备数据单位一致）
    return 4;
}

// 根据设备ID返回温度系列的名称
function getTemperatureSeriesName(deviceId) {
    const id = Number(deviceId);
    if (id === 3) return '用电量';
    if (id === 4) return '电力负荷';
    if (id === 5) return '流量';
    if (id === 6) return '气温';
    return '油温';
}

// 是否显示压力系列（仅设备1、2）
function shouldShowPressure(deviceId) {
    const id = Number(deviceId);
    return id === 1 || id === 2;
}

// 获取温度轴名称（带单位）
function getTemperatureAxisName(deviceId) {
    const name = getTemperatureSeriesName(deviceId);
    if (name === '电力负荷') return '电力负荷 (瓦特)';
    if (name === '用电量') return '用电量 (瓦时)';
    if (name === '流量') return '流量 (方/时)';
    if (name === '气温') return '气温 (℃)';
    return '油温 (℃)';
}

async function openDeviceModal(deviceId, deviceName) {
    currentDeviceId = deviceId;
    deviceModalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    modalTitle.textContent = `${deviceName} 详情`;

    // 隐藏图表下方信息区域中的设备名称行（避免与标题重复）
    const deviceNameSpan = document.getElementById('detailDeviceName');
    if (deviceNameSpan) {
        const parentDiv = deviceNameSpan.closest('div');
        if (parentDiv && parentDiv.parentElement) {
            const deviceNameRow = parentDiv.parentElement.querySelector('div:first-child');
            if (deviceNameRow && deviceNameRow.innerHTML.includes('设备名称')) {
                deviceNameRow.style.display = 'none';
            }
        }
    }

    detailDeviceId.textContent = deviceId;
    detailHealthScore.textContent = '--%';
    faultTableBody.innerHTML = '.<td colspan="3" style="text-align:center;">加载中...<\/td><\/tr>';
    recoveryStatus.textContent = '加载中...';
    maintenanceAdvice.textContent = '加载中...';

    if (currentChart) {
        currentChart.dispose();
        currentChart = null;
    }

    try {
        const detailRes = await fetch(`${API_BASE}/devices/${deviceId}`);
        if (!detailRes.ok) throw new Error('设备详情请求失败');
        const detailData = await detailRes.json();

        let healthScore = detailData.health_score;
        if (healthScore === undefined || healthScore === null) healthScore = 0;
        detailHealthScore.textContent = `${healthScore}%`;

        if (detailData.recent_anomalies && detailData.recent_anomalies.length > 0) {
            faultTableBody.innerHTML = '';
            detailData.recent_anomalies.forEach(anomaly => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 6px; border: 1px solid #ddd;">${anomaly.type}<\/td>
                    <td style="padding: 6px; border: 1px solid #ddd;">${anomaly.time}<\/td>
                    <td style="padding: 6px; border: 1px solid #ddd;">异常值: ${anomaly.value}<\/td>
                `;
                faultTableBody.appendChild(row);
            });
        } else {
            faultTableBody.innerHTML = '.<td colspan="3" style="text-align:center;">暂无故障记录<\/td><\/tr>';
        }

        if (detailData.health_score >= 70) {
            recoveryStatus.textContent = '设备运行正常';
            maintenanceAdvice.textContent = '建议定期检查，无需立即维护。';
        } else if (detailData.health_score >= 40) {
            recoveryStatus.textContent = '设备存在轻微异常，需关注';
            maintenanceAdvice.textContent = '建议安排预防性维护，检查关键部件。';
        } else {
            recoveryStatus.textContent = '设备严重异常，需立即处理';
            maintenanceAdvice.textContent = '建议停机检修，及时更换损坏部件。';
        }
    } catch (err) {
        console.error('获取设备详情失败', err);
        detailHealthScore.textContent = '--%';
        faultTableBody.innerHTML = '.<td colspan="3" style="text-align:center;">加载失败<\/td><\/tr>';
        recoveryStatus.textContent = '加载失败';
        maintenanceAdvice.textContent = '加载失败';
    }

    // 请求实时数据并自动补全
    try {
        const realtimeRes = await fetch(`${API_BASE}/devices/${deviceId}/realtime`);
        if (!realtimeRes.ok) throw new Error('实时数据请求失败');
        currentRealTimeData = await realtimeRes.json();
        await autoImputeTemperature(currentRealTimeData);
        initDeviceChartWithRealData('deviceChart', currentImputedData || currentRealTimeData);

        if (!window.timeBtnBound) {
            bindTimeBtnEventWithRealData();
            window.timeBtnBound = true;
        }
        if (!window.predictBtnBound) {
            bindPredictButtons();
            window.predictBtnBound = true;
        }
    } catch (err) {
        console.error('获取实时数据失败', err);
    }
}

// 自动补全温度零值（仅设备5生效）
async function autoImputeTemperature(realData) {
    if (Number(currentDeviceId) !== 5) {
        console.log(`设备 ${currentDeviceId} 不启用自动补全，跳过`);
        currentImputedData = null;
        return;
    }

    if (!realData || !realData.length) return;
    try {
        const imputeRes = await fetch(`${API_BASE}/impute/${currentDeviceId}?ratio=0.6`);
        if (!imputeRes.ok) throw new Error(`补全请求失败: ${imputeRes.status}`);
        const imputeResult = await imputeRes.json();
        const imputedDataArray = imputeResult.imputed_data;
        if (!imputedDataArray || imputedDataArray.length === 0) {
            console.warn('补全数据为空，跳过自动补全');
            currentImputedData = null;
            return;
        }

        const fixedImputeValue = imputedDataArray[0][1];
        if (fixedImputeValue === undefined || fixedImputeValue === null) {
            console.warn('补全值无效，跳过自动补全');
            currentImputedData = null;
            return;
        }

        const imputed = JSON.parse(JSON.stringify(realData));
        let replacedCount = 0;
        for (let i = 0; i < realData.length; i++) {
            if (realData[i].temperature === 0) {
                imputed[i].temperature = fixedImputeValue;
                replacedCount++;
            }
        }
        console.log(`设备5自动补全完成：共替换 ${replacedCount} 个温度零值点，使用固定补全值 ${fixedImputeValue}`);
        currentImputedData = imputed;
    } catch (err) {
        console.error('自动补全失败', err);
        currentImputedData = null;
    }
}

// 初始化图表
function initDeviceChartWithRealData(containerId, data) {
    const chartDom = document.getElementById(containerId);
    if (!chartDom) return;
    if (currentChart) currentChart.dispose();
    currentChart = echarts.init(chartDom);
    updateChartWithData(data);
    window.addEventListener('resize', () => currentChart.resize());
}

// 更新图表（含异常点标记和故障记录）
function updateChartWithData(data) {
    if (!data || !data.length) return;
    if (!currentDeviceId) return;

    const deviceId = Number(currentDeviceId);
    const showPressure = shouldShowPressure(deviceId);
    const tempSeriesName = getTemperatureSeriesName(deviceId);
    const tempAxisName = getTemperatureAxisName(deviceId);

    // 根据当前时间范围过滤数据
    let filtered = data;
    if (currentTimeRange < 24) {
        const step = Math.ceil(data.length / 24);
        const count = currentTimeRange * step;
        filtered = data.slice(-count);
    }

    const allTimes = filtered.map(item => item.timestamp);
    const tempReal = filtered.map(item => item.temperature);
    const pressReal = showPressure ? filtered.map(item => item.pressure) : [];

    // 获取当前设备的阈值，并筛选异常点（温度低于阈值）
    const threshold = getDeviceThreshold(deviceId);
    const anomalyPoints = [];
    const anomalyRecords = []; // 用于故障记录表格
    for (let i = 0; i < filtered.length; i++) {
        if (tempReal[i] < threshold) {
            anomalyPoints.push({
                xAxis: i,
                yAxis: tempReal[i],
                value: tempReal[i]
            });
            anomalyRecords.push({
                time: allTimes[i],
                value: tempReal[i]
            });
        }
    }
    // 取前四个异常点显示在故障记录中
    const topAnomalies = anomalyRecords.slice(0, 4);

    // 更新故障记录表格
    if (topAnomalies.length > 0) {
        faultTableBody.innerHTML = '';
        topAnomalies.forEach(rec => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 6px; border: 1px solid #ddd;">阈值异常</td>
                <td style="padding: 6px; border: 1px solid #ddd;">${rec.time}</td>
                <td style="padding: 6px; border: 1px solid #ddd;">数值: ${rec.value.toFixed(2)} (低于阈值 ${threshold})</td>
            `;
            faultTableBody.appendChild(row);
        });
    } else {
        faultTableBody.innerHTML = '.<td colspan="3" style="text-align:center;">暂无故障记录<\/td><\/tr>';
    }

    // 预测数据处理
    let predTimes = [];
    let predTemps = [];
    if (currentPredictions && currentPredictions.temperatures.length) {
        predTimes = currentPredictions.timestamps;
        predTemps = currentPredictions.temperatures;
        const extendedTimes = [...allTimes, ...predTimes];
        const tempData = new Array(extendedTimes.length).fill(null);
        const pressData = showPressure ? new Array(extendedTimes.length).fill(null) : null;
        const predTempData = new Array(extendedTimes.length).fill(null);

        for (let i = 0; i < filtered.length; i++) {
            tempData[i] = tempReal[i];
            if (showPressure) pressData[i] = pressReal[i];
        }

        if (predTemps.length) {
            const lastRealIdx = filtered.length - 1;
            if (lastRealIdx >= 0) predTempData[lastRealIdx] = tempReal[lastRealIdx];
            for (let i = 0; i < predTemps.length; i++) {
                const idx = filtered.length + i;
                if (idx < extendedTimes.length) predTempData[idx] = predTemps[i];
            }
        }

        const series = [
            {
                name: tempSeriesName,
                type: 'line',
                data: tempData,
                yAxisIndex: 0,
                smooth: true,
                lineStyle: { color: '#4096ff', width: 2 },
                itemStyle: { color: '#4096ff' },
                symbol: 'circle',
                symbolSize: 4,
                connectNulls: false,
                markPoint: {
                    data: anomalyPoints.map(p => ({ coord: [p.xAxis, p.yAxis], value: p.value, name: '异常点' })),
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: { color: '#ff4d4f', borderColor: '#fff', borderWidth: 1 },
                    label: { show: false }
                }
            }
        ];

        if (showPressure && pressData) {
            series.push({
                name: '压力',
                type: 'line',
                data: pressData,
                yAxisIndex: 1,
                smooth: true,
                lineStyle: { color: '#ff7a45', width: 2 },
                itemStyle: { color: '#ff7a45' },
                symbol: 'circle',
                symbolSize: 4,
                connectNulls: false
            });
        }

        if (predTemps.length) {
            series.push({
                name: `预测${tempSeriesName}`,
                type: 'line',
                data: predTempData,
                yAxisIndex: 0,
                lineStyle: { color: '#4096ff', width: 2, type: 'dashed' },
                symbol: 'none',
                smooth: false,
                connectNulls: true
            });
        }

        const yAxisConfig = [
            {
                type: 'value',
                name: tempAxisName,
                nameTextStyle: { color: '#4096ff' },
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#4096ff' } },
                splitLine: { lineStyle: { color: '#f0f0f0' } },
                min: Math.min(...tempReal, ...predTemps) - 2,
                max: Math.max(...tempReal, ...predTemps) + 2
            }
        ];

        if (showPressure && pressReal.length) {
            const pressMin = Math.min(...pressReal);
            const pressMax = Math.max(...pressReal);
            yAxisConfig.push({
                type: 'value',
                name: '压力 (MPa)',
                nameTextStyle: { color: '#ff7a45' },
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ff7a45' } },
                splitLine: { show: false },
                min: pressMin - 0.1,
                max: pressMax + 0.1
            });
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    let html = `${extendedTimes[params[0].dataIndex]}<br/>`;
                    params.forEach(item => {
                        if (item.value !== null) {
                            let unit = '';
                            if (item.seriesName === tempSeriesName) {
                                if (tempSeriesName === '用电量') unit = ' 瓦时';
                                else if (tempSeriesName === '电力负荷') unit = ' 瓦特';
                                else if (tempSeriesName === '流量') unit = ' 方/时';
                                else if (tempSeriesName === '气温') unit = ' ℃';
                                else if (tempSeriesName === '油温') unit = ' ℃';
                            }
                            if (item.seriesName === '压力') unit = ' MPa';
                            if (item.seriesName.includes('预测')) unit = '';
                            html += `${item.seriesName}：${item.value}${unit}<br/>`;
                        }
                    });
                    return html;
                }
            },
            legend: {
                data: series.map(s => s.name),
                textStyle: { color: '#333' },
                top: 0
            },
            grid: {
                left: '5%',
                right: showPressure ? '5%' : '5%',
                bottom: '10%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: extendedTimes,
                axisLabel: { color: '#666', fontSize: 11, rotate: 30 },
                axisLine: { lineStyle: { color: '#ccc' } }
            },
            yAxis: yAxisConfig,
            series: series
        };
        currentChart.setOption(option);
    } else {
        // 无预测时
        const tempData = [...tempReal];
        const pressData = showPressure ? [...pressReal] : null;
        const series = [
            {
                name: tempSeriesName,
                type: 'line',
                data: tempData,
                yAxisIndex: 0,
                smooth: true,
                lineStyle: { color: '#4096ff', width: 2 },
                itemStyle: { color: '#4096ff' },
                symbol: 'circle',
                symbolSize: 4,
                markPoint: {
                    data: anomalyPoints.map(p => ({ coord: [p.xAxis, p.yAxis], value: p.value, name: '异常点' })),
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: { color: '#ff4d4f', borderColor: '#fff', borderWidth: 1 },
                    label: { show: false }
                }
            }
        ];
        if (showPressure && pressData) {
            series.push({
                name: '压力',
                type: 'line',
                data: pressData,
                yAxisIndex: 1,
                smooth: true,
                lineStyle: { color: '#ff7a45', width: 2 },
                itemStyle: { color: '#ff7a45' },
                symbol: 'circle',
                symbolSize: 4
            });
        }

        const yAxisConfig = [
            {
                type: 'value',
                name: tempAxisName,
                nameTextStyle: { color: '#4096ff' },
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#4096ff' } },
                splitLine: { lineStyle: { color: '#f0f0f0' } },
                min: Math.min(...tempReal) - 2,
                max: Math.max(...tempReal) + 2
            }
        ];
        if (showPressure && pressReal.length) {
            const pressMin = Math.min(...pressReal);
            const pressMax = Math.max(...pressReal);
            yAxisConfig.push({
                type: 'value',
                name: '压力 (MPa)',
                nameTextStyle: { color: '#ff7a45' },
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ff7a45' } },
                splitLine: { show: false },
                min: pressMin - 0.1,
                max: pressMax + 0.1
            });
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    let html = `${allTimes[params[0].dataIndex]}<br/>`;
                    params.forEach(item => {
                        if (item.value !== null) {
                            let unit = '';
                            if (item.seriesName === tempSeriesName) {
                                if (tempSeriesName === '用电量') unit = ' 瓦时';
                                else if (tempSeriesName === '电力负荷') unit = ' 瓦特';
                                else if (tempSeriesName === '流量') unit = ' 方/时';
                                else if (tempSeriesName === '气温') unit = ' ℃';
                                else if (tempSeriesName === '油温') unit = ' ℃';
                            }
                            if (item.seriesName === '压力') unit = ' MPa';
                            html += `${item.seriesName}：${item.value}${unit}<br/>`;
                        }
                    });
                    return html;
                }
            },
            legend: {
                data: series.map(s => s.name),
                textStyle: { color: '#333' },
                top: 0
            },
            grid: {
                left: '5%',
                right: showPressure ? '5%' : '5%',
                bottom: '10%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: allTimes,
                axisLabel: { color: '#666', fontSize: 11, rotate: 30 },
                axisLine: { lineStyle: { color: '#ccc' } }
            },
            yAxis: yAxisConfig,
            series: series
        };
        currentChart.setOption(option);
    }
}

// 时间按钮事件
function bindTimeBtnEventWithRealData() {
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const hour = parseInt(btn.getAttribute('data-hour'));
            currentTimeRange = hour;
            const dataToShow = currentImputedData || currentRealTimeData;
            if (dataToShow) updateChartWithData(dataToShow);
        });
    });
}

// 预测按钮绑定
function bindPredictButtons() {
    const chartContainer = document.getElementById('deviceChart');
    if (!chartContainer) return;
    if (document.getElementById('predictButtonRow')) return;

    const buttonRow = document.createElement('div');
    buttonRow.id = 'predictButtonRow';
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '8px';
    buttonRow.style.marginBottom = '10px';
    buttonRow.innerHTML = `
        <button class="predict-btn" data-steps="12">预测12步</button>
        <button class="predict-btn" data-steps="16">预测16步</button>
        <button class="predict-btn" data-steps="24">预测24步</button>
        <button id="clearPredictBtn" style="background:#aaa;">清除预测</button>
    `;
    chartContainer.parentNode.insertBefore(buttonRow, chartContainer);

    document.querySelectorAll('.predict-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const steps = parseInt(btn.getAttribute('data-steps'));
            await loadPredictions(steps);
        });
    });
    document.getElementById('clearPredictBtn')?.addEventListener('click', () => {
        currentPredictions = null;
        const dataToShow = currentImputedData || currentRealTimeData;
        if (dataToShow) updateChartWithData(dataToShow);
    });
}

// 加载预测数据
async function loadPredictions(steps) {
    if (!currentDeviceId) return;
    try {
        const res = await fetch(`${API_BASE}/predict/${currentDeviceId}?steps=${steps}`);
        if (!res.ok) throw new Error('预测请求失败');
        const data = await res.json();
        const predValues = data.predictions;
        if (!predValues || !predValues.length) throw new Error('无预测数据');

        const lastTimestamp = currentRealTimeData[currentRealTimeData.length - 1].timestamp;
        const predTimestamps = [];
        for (let i = 1; i <= predValues.length; i++) {
            const date = new Date(lastTimestamp);
            date.setHours(date.getHours() + i);
            const formatted = date.toISOString().slice(0, 16).replace('T', ' ');
            predTimestamps.push(formatted);
        }

        currentPredictions = {
            timestamps: predTimestamps,
            temperatures: predValues
        };
        const dataToShow = currentImputedData || currentRealTimeData;
        if (dataToShow) updateChartWithData(dataToShow);
    } catch (err) {
        console.error('加载预测数据失败', err);
        alert('预测数据加载失败');
    }
}

// 事件委托：设备卡片点击
const deviceListContainer = document.querySelector('.box1-1 ul');
if (deviceListContainer) {
    deviceListContainer.addEventListener('click', (e) => {
        const targetLi = e.target.closest('li');
        if (!targetLi) return;
        const deviceId = targetLi.getAttribute('data-device-id');
        if (!deviceId) return;
        const deviceName = targetLi.querySelector('.name h4').textContent.trim();
        openDeviceModal(deviceId, deviceName);
    });
}

// 弹窗关闭逻辑（增加清除预测）
const deviceModalCloseBtn = document.querySelector('#deviceModal .modal-close');
if (deviceModalCloseBtn) {
    deviceModalCloseBtn.addEventListener('click', () => {
        deviceModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
        currentPredictions = null;
    });
}
deviceModalOverlay?.addEventListener('click', (e) => {
    if (e.target === deviceModalOverlay) {
        deviceModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
        currentPredictions = null;
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deviceModalOverlay?.style.display === 'flex') {
        deviceModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
        currentPredictions = null;
    }
});