// 最新异常事件时间轴（替代散点图）
async function loadAnomalyTimeline() {
    const container = document.getElementById('anomalyTimeline');
    if (!container) return;

    try {
        // 获取所有设备
        const devicesRes = await fetch(`${API_BASE}/devices`);
        if (!devicesRes.ok) throw new Error('获取设备列表失败');
        const devices = await devicesRes.json();

        // 收集所有异常事件
        let allAnomalies = [];
        for (const device of devices) {
            try {
                const detailRes = await fetch(`${API_BASE}/devices/${device.id}`);
                if (!detailRes.ok) continue;
                const detail = await detailRes.json();
                const anomalies = detail.recent_anomalies || [];
                anomalies.forEach(anom => {
                    allAnomalies.push({
                        deviceName: device.name,
                        deviceId: device.id,
                        time: anom.time,
                        type: anom.type,
                        severity: anom.severity,
                        value: anom.value
                    });
                });
            } catch (err) {
                console.warn(`获取设备 ${device.id} 异常失败`, err);
            }
        }

        // 按时间倒序排序（最新在上）
        allAnomalies.sort((a, b) => new Date(b.time) - new Date(a.time));
        // 只显示最近10条
        const latest = allAnomalies.slice(0, 10);

        if (latest.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">暂无异常事件</div>';
            return;
        }

        // 生成HTML列表
        const html = latest.map(anom => {
            let severityClass = '';
            let severityText = '';
            if (anom.severity === 'error') {
                severityClass = 'severity-error';
                severityText = '严重';
            } else if (anom.severity === 'warning') {
                severityClass = 'severity-warning';
                severityText = '警告';
            } else {
                severityClass = 'severity-info';
                severityText = '信息';
            }
            return `
                <div class="timeline-item ${severityClass}" style="border-left: 4px solid ${severityClass === 'severity-error' ? '#ca3727' : (severityClass === 'severity-warning' ? '#c9861b' : '#4096ff')}; margin-bottom: 12px; padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color:#fff;">${anom.deviceName}</strong>
                        <span style="color:#ccc; font-size:12px;">${anom.time}</span>
                    </div>
                    <div style="margin-top: 6px;">
                        <span style="color:#fff;">异常类型：${anom.type}</span>
                        <span style="margin-left: 12px; color:${severityClass === 'severity-error' ? '#ca3727' : (severityClass === 'severity-warning' ? '#c9861b' : '#4096ff')};">[${severityText}]</span>
                        ${anom.value ? `<span style="margin-left: 12px; color:#aaa;">异常值: ${anom.value}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (err) {
        console.error('加载异常时间轴失败', err);
        container.innerHTML = '<div style="color:#ca3727; text-align:center; padding:20px;">加载失败，请刷新页面</div>';
    }
}

// 页面加载时执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAnomalyTimeline);
} else {
    loadAnomalyTimeline();
}