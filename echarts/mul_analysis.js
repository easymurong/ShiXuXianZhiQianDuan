// 多设备-多传感器相关性分析（热力图）- 使用固定模拟数据（基于设备特性）
window.addEventListener('load', async function () {
    initCorrHeatmap();
});

function initCorrHeatmap() {
    const chartDom = document.getElementById('corrHeatmap');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom);
    chartDom.__echart_instance__ = myChart;

    // 设备名称（新数据集）
    const deviceNames = ['ETTh', 'ETTm1', 'Energy', 'Electricity', 'WTSD', 'Weather'];
    const sensorNames = ['温度', '压力', '振动', '转速', '电流'];

    // 固定的相关性矩阵（基于工业常识和论文描述）
    // 行：传感器（温度、压力、振动、转速、电流）
    // 列：设备（ETTh, ETTm1, Energy, Electricity, WTSD, Weather）
    const corrData = [
        [0.92, 0.88, 0.75, 0.82, 0.68, 0.71], // 温度与各设备
        [0.85, 0.80, 0.65, 0.78, 0.72, 0.69], // 压力
        [0.78, 0.82, 0.70, 0.85, 0.88, 0.76], // 振动
        [0.62, 0.68, 0.85, 0.70, 0.75, 0.80], // 转速
        [0.89, 0.86, 0.90, 0.88, 0.85, 0.82]  // 电流
    ];

    // 构建热力图数据格式
    const heatmapData = [];
    for (let i = 0; i < sensorNames.length; i++) {
        for (let j = 0; j < deviceNames.length; j++) {
            heatmapData.push({
                name: `${sensorNames[i]}-${deviceNames[j]}`,
                value: [j, i, corrData[i][j].toFixed(2)]
            });
        }
    }

    // 设备名称换行函数（避免过长）
    function formatDeviceName(name) {
        const maxChars = 8;
        if (name.length <= maxChars) return name;
        let result = '';
        for (let i = 0; i < name.length; i += maxChars) {
            result += name.slice(i, i + maxChars) + (i + maxChars < name.length ? '\n' : '');
        }
        return result;
    }

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                const sensor = sensorNames[params.data.value[1]];
                const device = deviceNames[params.data.value[0]];
                const val = parseFloat(params.data.value[2]);
                let desc = '';
                if (val > 0.7) desc = '强正相关';
                else if (val > 0.3) desc = '弱正相关';
                else if (val > -0.3) desc = '不相关';
                else if (val > -0.7) desc = '弱负相关';
                else desc = '强负相关';
                return `
                    <div style="color:#fff">
                        <strong>${device}</strong><br/>
                        <strong>${sensor}</strong><br/>
                        相关性: ${val} (${desc})
                    </div>
                `;
            },
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderColor: '#5be6ff',
            borderWidth: 1,
            textStyle: { color: '#fff' }
        },
        grid: {
            left: '6%',
            right: '4%',
            top: '10%',
            bottom: '20%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: deviceNames,
            axisLabel: {
                interval: 0,
                rotate: 0,
                color: '#c2c2c2',
                formatter: formatDeviceName
            },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        yAxis: {
            type: 'category',
            data: sensorNames,
            axisLabel: { color: '#c2c2c2' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        visualMap: {
            min: -1,
            max: 1,
            orient: 'horizontal',
            left: 'center',
            bottom: '2%',
            text: ['强相关', '弱相关'],
            textStyle: { color: '#fff' },
            calculable: true,
            inRange: {
                color: ['#ca3727', '#ffd700', '#1e6b14']
            }
        },
        series: [
            {
                name: '传感器-设备相关性',
                type: 'heatmap',
                data: heatmapData,
                label: {
                    show: true,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 'bold',
                    formatter: function (params) {
                        return params.data.value[2];
                    }
                },
                itemStyle: {
                    borderWidth: 2,
                    borderColor: 'rgba(40, 59, 77, 0.8)'
                }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
    const resizeObserver = new ResizeObserver(() => myChart.resize());
    resizeObserver.observe(chartDom);
}