// 健康趋势模块 - 对接后端数据，根据设备ID动态调整图例和系列
document.addEventListener('DOMContentLoaded', function () {
    const expandBtn = document.querySelector('.device-expand-btn');
    const deviceList = document.querySelector('.device-list');
    const chartDom = document.getElementById('healthTrendChart');
    let myChart = null;

    if (chartDom) {
        myChart = echarts.init(chartDom);
        window.addEventListener('resize', () => myChart && myChart.resize());
    } else {
        console.warn('健康趋势图表容器未找到');
        return;
    }

    let devices = [];
    let currentDeviceId = null;

    // 根据设备ID获取温度系列名称（仅改变图例名称，数据仍为温度）
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

    async function fetchDevices() {
        try {
            const res = await fetch(`${API_BASE}/devices`);
            if (!res.ok) throw new Error('设备列表请求失败');
            devices = await res.json();
            if (!devices.length) throw new Error('无设备数据');

            deviceList.innerHTML = '';
            devices.forEach(device => {
                const li = document.createElement('li');
                li.setAttribute('data-device-id', device.id);
                li.textContent = device.name;
                deviceList.appendChild(li);
            });

            const firstDevice = devices[0];
            currentDeviceId = firstDevice.id;
            expandBtn.textContent = `${firstDevice.name} ▼`;
            const firstLi = deviceList.querySelector('li');
            if (firstLi) firstLi.classList.add('active');

            loadDeviceData(currentDeviceId);
        } catch (err) {
            console.error('获取设备列表失败', err);
            if (myChart) {
                myChart.setOption({
                    title: {
                        show: true,
                        text: '无法加载设备数据',
                        left: 'center',
                        top: 'center',
                        textStyle: { color: '#fff' }
                    }
                });
            }
        }
    }

    async function loadDeviceData(deviceId) {
        try {
            const detailRes = await fetch(`${API_BASE}/devices/${deviceId}`);
            if (!detailRes.ok) throw new Error('设备详情请求失败');
            const deviceDetail = await detailRes.json();
            const healthScore = deviceDetail.health_score || 0;

            const realtimeRes = await fetch(`${API_BASE}/devices/${deviceId}/realtime`);
            if (!realtimeRes.ok) throw new Error('实时数据请求失败');
            const realtimeData = await realtimeRes.json();

            if (!realtimeData.length) {
                myChart.setOption({
                    title: {
                        show: true,
                        text: '暂无该设备的实时数据',
                        left: 'center',
                        top: 'center',
                        textStyle: { color: '#fff' }
                    },
                    series: []
                });
                return;
            }

            const timestamps = realtimeData.map(item => item.timestamp);
            const temperatures = realtimeData.map(item => item.temperature);
            const pressures = realtimeData.map(item => item.pressure);
            const healthLine = new Array(timestamps.length).fill(healthScore);

            const deviceIdNum = Number(deviceId);
            const showPressure = shouldShowPressure(deviceIdNum);
            const tempSeriesName = getTemperatureSeriesName(deviceIdNum);
            const tempAxisName = getTemperatureAxisName(deviceIdNum);
            const tempLegendName = tempSeriesName;  // 图例显示名称

            // 构建图例数据
            const legendData = [tempLegendName];
            if (showPressure) legendData.push('压力');
            legendData.push('健康得分');

            // 构建系列
            const series = [
                {
                    name: tempLegendName,
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    lineStyle: { width: 3, color: '#ff6b6b' },
                    itemStyle: { color: '#ff6b6b', shadowBlur: 10 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255,107,107,0.4)' },
                            { offset: 1, color: 'rgba(255,107,107,0)' }
                        ])
                    },
                    data: temperatures,
                    yAxisIndex: 0
                }
            ];

            if (showPressure) {
                series.push({
                    name: '压力(MPa)',
                    type: 'line',
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    lineStyle: { width: 3, color: '#4dabf7' },
                    itemStyle: { color: '#4dabf7', shadowBlur: 10 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(77,171,247,0.4)' },
                            { offset: 1, color: 'rgba(77,171,247,0)' }
                        ])
                    },
                    data: pressures,
                    yAxisIndex: 1
                });
            }

            series.push({
                name: '健康得分',
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2, color: '#51cf66', type: 'dashed' },
                data: healthLine,
                yAxisIndex: showPressure ? 2 : 1
            });

            // 构建Y轴配置
            const yAxis = [
                {
                    name: tempAxisName,
                    nameTextStyle: { color: '#ff6b6b', padding: [0, 10] },
                    type: 'value',
                    position: 'left',
                    offset: 0,
                    axisLine: { lineStyle: { color: '#ff6b6b' } },
                    axisLabel: { color: '#ddd' }
                }
            ];

            if (showPressure) {
                yAxis.push({
                    name: '压力 (MPa)',
                    nameTextStyle: { color: '#4dabf7', padding: [0, 10] },
                    type: 'value',
                    position: 'left',
                    offset: 60,
                    axisLine: { lineStyle: { color: '#4dabf7' } },
                    axisLabel: { color: '#ddd' },
                    splitLine: { show: false }
                });
            }

            yAxis.push({
                name: '健康得分',
                nameTextStyle: { color: '#51cf66', padding: [0, 10] },
                type: 'value',
                position: 'right',
                min: 0,
                max: 100,
                axisLine: { lineStyle: { color: '#51cf66' } },
                axisLabel: { color: '#ddd' },
                splitLine: { show: false }
            });

            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(17, 18, 26, 0.85)',
                    borderColor: '#5865f2',
                    textStyle: { color: '#fff' },
                    padding: [10, 14],
                    borderWidth: 1,
                    formatter: function (params) {
                        let html = params[0].axisValue + '<br/>';
                        params.forEach(param => {
                            let value = param.value;
                            let seriesName = param.seriesName;
                            let unit = '';
                            if (seriesName === tempLegendName) {
                                if (tempSeriesName === '流量') unit = ' m³/h';
                                else if (tempSeriesName === '用电量') unit = ' W·h';
                                else if (tempSeriesName === '气温') unit = ' ℃';
                                else if (tempSeriesName === '电力负荷') unit = ' W';
                            } else if (seriesName === '压力(MPa)') {
                                unit = ' MPa';
                            }
                            html += `${seriesName}：${value}${unit}<br/>`;
                        });
                        return html;
                    }
                },
                legend: {
                    data: legendData,
                    textStyle: { color: '#eaeaea', fontSize: 13 },
                    top: 0,
                    right: 200
                },
                grid: {
                    left: '10%',
                    right: '10%',
                    bottom: '8%',
                    top: '12%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: timestamps,
                    axisLine: { lineStyle: { color: '#666' } },
                    axisLabel: { color: '#ddd', fontSize: 12, rotate: 30 },
                    boundaryGap: false
                },
                yAxis: yAxis,
                series: series
            };

            myChart.setOption(option, true);
            myChart.resize();
        } catch (err) {
            console.error('加载设备数据失败', err);
            myChart.setOption({
                title: {
                    show: true,
                    text: '数据加载失败',
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#fff' }
                },
                series: []
            });
        }
    }

    if (expandBtn && deviceList) {
        expandBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            deviceList.classList.toggle('show');
        });

        document.addEventListener('click', function () {
            deviceList.classList.remove('show');
        });
    }

    if (deviceList) {
        deviceList.addEventListener('click', function (e) {
            const target = e.target.closest('li');
            if (!target) return;
            const deviceId = target.getAttribute('data-device-id');
            if (!deviceId) return;

            const deviceName = target.textContent.trim();
            expandBtn.textContent = `${deviceName} ▼`;

            document.querySelectorAll('.device-list li').forEach(li => li.classList.remove('active'));
            target.classList.add('active');

            currentDeviceId = deviceId;
            loadDeviceData(currentDeviceId);
            deviceList.classList.remove('show');
        });
    }

    fetchDevices();
});