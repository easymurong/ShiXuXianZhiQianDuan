// 异常检测模块：双饼图（使用固定数据，不依赖后端）
async function initAnomalyPieCharts() {
    const chartDom = document.getElementById('chart1');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom);

    // 固定数据
    const normalCount = 635754;
    const anomalyCount = 73371;
    const anomalyPercentage = 10.34;  // 右下角显示百分比

    // 异常类型细分固定数据（百分比转数值，总和100%）
    const typeList = [
        { type: '油温过低', percent: 25.97 },
        { type: '系统过程故障', percent: 49.23 },
        { type: '电力故障', percent: 24.80 }
    ];
    // 计算异常类型具体数量（基于异常总数按比例分配）
    const typeData = typeList.map(item => ({
        name: item.type,
        value: (item.percent / 100) * anomalyCount,
        itemStyle: { color: getColorByType(item.type) }
    }));

    // 更新页面中的异常百分比显示
    const anomalyPercentElement = document.querySelector('.home-box2 .box2-3 h4');
    if (anomalyPercentElement) {
        anomalyPercentElement.textContent = `${anomalyPercentage}%`;
    }

    // 左侧饼图数据（正常/异常）
    const leftPieData = [
        { name: '正常数据', value: normalCount, itemStyle: { color: '#1e6b14' } },
        { name: '异常数据', value: anomalyCount, itemStyle: { color: '#ca3727' } }
    ].filter(item => item.value > 0);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{a}<br/>{b}: {c} ({d}%)' },
        legend: {
            show: true,
            orient: 'horizontal',
            left: 'center',
            top: 'bottom',
            textStyle: { color: '#fff', fontSize: 12 },
            data: [...leftPieData.map(d => d.name), ...typeData.map(d => d.name)]
        },
        series: [
            {
                name: '整体统计',
                type: 'pie',
                radius: '30%',
                center: ['25%', '40%'],
                data: leftPieData,
                label: { show: true, formatter: '{b}: {d}%', color: '#fff' },
                labelLine: { lineStyle: { color: '#fff' } },
                emphasis: { scale: true }
            },
            {
                name: '异常类型细分',
                type: 'pie',
                radius: '30%',
                center: ['75%', '40%'],
                data: typeData,
                label: { show: true, formatter: '{b}: {d}%', color: '#fff' },
                labelLine: { lineStyle: { color: '#fff' } },
                emphasis: { scale: true }
            }
        ],
        graphic: [
            { type: 'text', left: '25%', top: '70%', style: { text: '总体分布', fill: '#fff', fontSize: 14, fontWeight: 'bold' }, z: 100 },
            { type: 'text', left: '75%', top: '70%', style: { text: '异常类型细分', fill: '#fff', fontSize: 14, fontWeight: 'bold' }, z: 100 }
        ]
    };
    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());

    // 更新右侧设备列表中的设备名称（保持之前逻辑，仅名称从后端获取指定ID）
    await updateDeviceNames();
}

// 根据异常类型返回固定颜色（可自行调整）
function getColorByType(type) {
    const colorMap = {
        '油温过低': '#5be6ff',
        '系统过程故障': '#ffd700',
        '电力故障': '#ff6347'
    };
    return colorMap[type] || '#9370db';
}

// 从后端获取设备列表，更新指定ID（1,2,5,6）的设备名称到静态列表
async function updateDeviceNames() {
    try {
        const res = await fetch(`${API_BASE}/devices`);
        if (!res.ok) throw new Error('获取设备列表失败');
        const devices = await res.json();
        const targetIds = [1, 2, 5, 6];
        const targetDevices = targetIds.map(id => devices.find(d => d.id === id)).filter(d => d);
        const items = document.querySelectorAll('#anomalyDeviceList li');
        items.forEach((li, index) => {
            if (index < targetDevices.length) {
                const nameSpan = li.querySelector('.device-name');
                if (nameSpan) nameSpan.textContent = targetDevices[index].name;
                li.setAttribute('data-device-id', targetDevices[index].id);
            }
        });
    } catch (err) {
        console.error('更新设备名称失败', err);
    }
}

// 确保在 DOM 加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnomalyPieCharts);
} else {
    initAnomalyPieCharts();
}