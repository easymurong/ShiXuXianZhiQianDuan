// 异常趋势模块 - 支持自定义故障阈值（针对不同设备的数据单位）
document.addEventListener('DOMContentLoaded', async function () {
    const anomalyListContainer = document.querySelector('.anomaly_trend ul');
    if (!anomalyListContainer) {
        console.warn('异常趋势列表容器未找到');
        return;
    }

    // 设备单位映射
    const deviceUnits = {
        1: { name: 'ETTh', unit: '℃', label: '油温' },
        2: { name: 'ETTm1', unit: '℃', label: '油温' },
        3: { name: 'Energy', unit: 'Wh', label: '用电量' },
        4: { name: 'Electricity', unit: 'W', label: '电力负荷' },
        5: { name: 'WTSD', unit: 'm³/h', label: '流量' },
        6: { name: 'Weather', unit: '℃', label: '气温' }
    };

    // 存储每个设备的用户自定义阈值（原始数值）
    let thresholds = {};

    // 加载本地存储的阈值
    function loadThresholds() {
        const stored = localStorage.getItem('deviceThresholds');
        if (stored) {
            try {
                thresholds = JSON.parse(stored);
            } catch (e) { console.warn(e); }
        }
    }

    // 保存阈值到本地
    function saveThresholds() {
        localStorage.setItem('deviceThresholds', JSON.stringify(thresholds));
    }

    // 设置阈值弹窗（根据设备单位提示）
    function setThreshold(deviceId, deviceName, currentThreshold) {
        const unit = deviceUnits[deviceId]?.unit || '';
        const label = deviceUnits[deviceId]?.label || '数值';
        const promptMsg = `请输入 ${deviceName} 的异常阈值（${label}低于此值视为异常）\n当前阈值：${currentThreshold} ${unit}`;
        const newThreshold = prompt(promptMsg, currentThreshold);
        if (newThreshold !== null && !isNaN(parseFloat(newThreshold))) {
            thresholds[deviceId] = parseFloat(newThreshold);
            saveThresholds();
            refreshDeviceList();
        } else if (newThreshold !== null) {
            alert('请输入有效的数字');
        }
    }

    // 根据阈值计算设备异常数量（从实时数据中统计 sensorValue < threshold 的点数）
    async function calculateAnomalyCount(deviceId, threshold) {
        try {
            const realtimeRes = await fetch(`${API_BASE}/devices/${deviceId}/realtime`);
            if (!realtimeRes.ok) throw new Error('实时数据获取失败');
            const realtimeData = await realtimeRes.json();
            if (!realtimeData.length) return 0;
            // 注意：后端实时数据中，所有设备的数值都放在 temperature 字段中
            let count = 0;
            for (const item of realtimeData) {
                if (item.temperature < threshold) count++;
            }
            return count;
        } catch (err) {
            console.error(`设备 ${deviceId} 实时数据获取失败`, err);
            return 0;
        }
    }

    // 刷新设备列表（重新计算所有设备的异常数量）
    async function refreshDeviceList() {
        if (!anomalyListContainer) return;
        anomalyListContainer.innerHTML = '<li style="text-align:center;">加载中...</li>';

        try {
            // 获取设备列表
            const devicesRes = await fetch(`${API_BASE}/devices`);
            if (!devicesRes.ok) throw new Error('获取设备列表失败');
            const devices = await devicesRes.json();

            // 为每个设备获取实时数据并计算异常数
            const deviceItems = [];
            for (const device of devices) {
                const unitInfo = deviceUnits[device.id] || { unit: '', label: '数值' };
                const threshold = thresholds[device.id] !== undefined ? thresholds[device.id] : 4; // 默认4（单位根据设备不同）
                const anomalyCount = await calculateAnomalyCount(device.id, threshold);
                deviceItems.push({
                    id: device.id,
                    name: device.name,
                    healthScore: device.health_score,
                    anomalyCount: anomalyCount,
                    threshold: threshold,
                    unit: unitInfo.unit,
                    label: unitInfo.label
                });
            }

            // 按异常次数降序排列
            deviceItems.sort((a, b) => b.anomalyCount - a.anomalyCount);

            // 生成 HTML
            anomalyListContainer.innerHTML = '';
            for (const device of deviceItems) {
                // 根据异常数量生成维护建议
                let suggestion = '';
                if (device.anomalyCount === 0) {
                    suggestion = '正常运行，建议常规检查';
                } else if (device.anomalyCount <= 5) {
                    suggestion = '存在轻微异常，建议关注';
                } else if (device.anomalyCount <= 20) {
                    suggestion = '存在潜在风险，建议检修';
                } else {
                    suggestion = '严重异常，需立即维护';
                }

                const li = document.createElement('li');
                li.innerHTML = `
                <div class="left">
                    <h4>${device.name}</h4>
                    <p>${suggestion}</p>
                </div>
                <div class="right">
                    <span style="font-size: 30px">${device.anomalyCount}</span>
                    <span style="margin-left: 20px;font-size: 16px;color: #fff">阈值设置:</span>
                    <button class="threshold-btn" data-id="${device.id}" data-name="${device.name}" data-threshold="${device.threshold}" style="background: none; border: none; cursor: pointer; font-size: 22px;" title="设置故障阈值（${device.label}低于X${device.unit}）">⚙️</button>
                </div>
            `;
                anomalyListContainer.appendChild(li);
            }

            // 绑定阈值按钮事件
            document.querySelectorAll('.threshold-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const deviceId = parseInt(btn.getAttribute('data-id'));
                    const deviceName = btn.getAttribute('data-name');
                    const currentThreshold = btn.getAttribute('data-threshold');
                    setThreshold(deviceId, deviceName, currentThreshold);
                });
            });
        } catch (err) {
            console.error('加载异常趋势数据失败', err);
            anomalyListContainer.innerHTML = '<li style="text-align:center;">数据加载失败</li>';
        }
    }

    // 初始化：加载阈值并刷新列表
    loadThresholds();
    await refreshDeviceList();
});