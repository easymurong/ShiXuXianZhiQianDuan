// PCA 散点图 - 真实数据 vs 生成数据（支持设备切换）
let pcaChart = null;
let currentPcaDeviceId = null;

async function initPcaDeviceSelector() {
    const btn = document.getElementById('pcaDeviceBtn');
    const list = document.getElementById('pcaDeviceList');
    if (!btn || !list) return;

    try {
        const res = await fetch(`${API_BASE}/devices`);
        if (!res.ok) throw new Error('获取设备列表失败');
        const devices = await res.json();

        list.innerHTML = '';
        devices.forEach(device => {
            const li = document.createElement('li');
            li.setAttribute('data-id', device.id);
            li.textContent = device.name;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(li.getAttribute('data-id'));
                currentPcaDeviceId = id;
                btn.textContent = `${device.name} ▼`;
                list.style.display = 'none';
                loadPcaData(id);
                document.querySelectorAll('#pcaDeviceList li').forEach(l => l.classList.remove('active'));
                li.classList.add('active');
            });
            list.appendChild(li);
        });

        if (devices.length > 0) {
            const first = devices[0];
            currentPcaDeviceId = first.id;
            btn.textContent = `${first.name} ▼`;
            const firstLi = list.querySelector('li');
            if (firstLi) firstLi.classList.add('active');
            loadPcaData(first.id);
        } else {
            btn.textContent = '无设备 ▼';
        }
    } catch (err) {
        console.error('加载设备列表失败', err);
        btn.textContent = '加载失败';
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => {
        list.style.display = 'none';
    });
}

async function loadPcaData(deviceId) {
    const chartDom = document.getElementById('pcaChart');
    if (!chartDom) return;
    if (!pcaChart) {
        pcaChart = echarts.init(chartDom);
        window.addEventListener('resize', () => pcaChart && pcaChart.resize());
    }

    pcaChart.showLoading('default', { text: '加载中...', color: '#4096ff', textColor: '#fff' });

    try {
        // 修改1: 增加采样数量到 500
        const url = `${API_BASE}/visualization/pca/${deviceId}?num_samples=500`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`PCA 数据请求失败: ${res.status}`);
        const data = await res.json();

        const realPoints = data.real || [];
        let genPoints = data.generated || [];

        // 修改2: 删除对生成数据 x 坐标取绝对值的操作
        // 直接注释掉或删除下面这行
        // genPoints = genPoints.map(point => [Math.abs(point[0]), point[1]]);

        if (realPoints.length === 0 && genPoints.length === 0) {
            pcaChart.hideLoading();
            pcaChart.setOption({
                title: { show: true, text: '无数据', left: 'center', top: 'center', textStyle: { color: '#fff' } }
            });
            return;
        }

        const allPoints = [...realPoints, ...genPoints];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allPoints.forEach(p => {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
        });
        const xMargin = (maxX - minX) * 0.05;
        const yMargin = (maxY - minY) * 0.05;

        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item' },
            legend: {
                data: ['真实数据', '生成数据'],
                right: 90,
                top: 20,
                textStyle: { color: '#d4d4d4', fontSize: 14 }
            },
            grid: {
                left: 50,
                right: 30,
                bottom: 50,
                top: 60,
                containLabel: true
            },
            xAxis: {
                name: 'PC1',
                type: 'value',
                splitLine: { show: false },
                axisLabel: { color: '#fff', fontSize: 12 },
                nameTextStyle: { color: '#fff', fontSize: 14, fontWeight: 550 },
                axisLine: { lineStyle: { color: '#fff' } },
                nameLocation: 'middle',
                nameGap: 30,
                min: minX - xMargin,
                max: maxX + xMargin
            },
            yAxis: {
                name: 'PC2',
                type: 'value',
                splitLine: { show: false },
                axisLabel: { color: '#fff', fontSize: 12 },
                nameTextStyle: { color: '#fff', fontSize: 14, fontWeight: 550 },
                axisLine: { lineStyle: { color: '#fff' } },
                nameLocation: 'end',
                min: minY - yMargin,
                max: maxY + yMargin
            },
            series: [
                {
                    name: '真实数据',
                    type: 'scatter',
                    symbolSize: 6,
                    data: realPoints,
                    itemStyle: { color: '#4C84FF' }
                },
                {
                    name: '生成数据',
                    type: 'scatter',
                    symbolSize: 6,
                    data: genPoints,
                    itemStyle: { color: '#FF4D6D' }
                }
            ]
        };
        pcaChart.hideLoading();
        pcaChart.setOption(option, true);
        setTimeout(() => pcaChart.resize(), 100);
    } catch (err) {
        console.error('PCA 数据加载失败', err);
        pcaChart.hideLoading();
        pcaChart.setOption({
            title: { show: true, text: '数据加载失败', left: 'center', top: 'center', textStyle: { color: '#fff' } }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPcaDeviceSelector);
} else {
    initPcaDeviceSelector();
}