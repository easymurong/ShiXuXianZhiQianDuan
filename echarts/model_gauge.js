// 模型评价模块 - 对接后端数据
document.addEventListener('DOMContentLoaded', async function () {
    // 获取仪表盘容器
    const gaugeDom = document.getElementById('modelGauge');
    let gaugeChart = null;
    if (gaugeDom) {
        gaugeChart = echarts.init(gaugeDom);
        window.addEventListener('resize', () => gaugeChart && gaugeChart.resize());
    }

    // 获取展示数值的元素
    const predictionScoreEl = document.getElementById('predictionScore');
    const imputationScoreEl = document.getElementById('imputationScore');
    const anomalyScoreEl = document.getElementById('anomalyScore');
    const correlationScoreEl = document.getElementById('correlationScore');

    try {
        // 请求性能数据
        const response = await fetch(`${API_BASE}/performance`);
        if (!response.ok) throw new Error('获取性能数据失败');
        const perf = await response.json();

        // 更新四个指标
        if (predictionScoreEl) predictionScoreEl.textContent = perf.prediction_score?.toFixed(3) || '0.000';
        if (imputationScoreEl) imputationScoreEl.textContent = perf.correlation_score?.toFixed(3) || '0.000'; // 注意：原接口中只有 correlation_score, prediction_score, multits_score, generated_sequences，没有专门的补全和异常检测分数，此处可复用或按需
        if (anomalyScoreEl) anomalyScoreEl.textContent = perf.multits_score?.toFixed(3) || '0.000';
        if (correlationScoreEl) correlationScoreEl.textContent = perf.correlation_score?.toFixed(3) || '0.000';

        // 计算综合得分（可自定义，比如取四项平均）
        const overall = (perf.prediction_score + perf.correlation_score + perf.multits_score) / 3;
        const overallValue = Math.round(overall * 100); // 转为百分比

        // 如果仪表盘存在，更新
        if (gaugeChart) {
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    formatter: "{a} <br/>{c}%"
                },
                series: [
                    {
                        name: "模型综合得分",
                        type: "gauge",
                        radius: "80%",
                        center: ["50%", "50%"],
                        startAngle: 180,
                        endAngle: 0,
                        min: 0,
                        max: 100,
                        splitNumber: 8,
                        axisLine: {
                            lineStyle: {
                                width: 10,
                                color: [
                                    [0.3, "#ff6b6b"],
                                    [0.7, "#ffd93d"],
                                    [1, "#6dd181"]
                                ]
                            }
                        },
                        pointer: {
                            length: "55%",
                            width: 2,
                            color: "#333"
                        },
                        axisTick: { show: false },
                        splitLine: {
                            length: 5,
                            lineStyle: { color: "#c4c4c4" }
                        },
                        axisLabel: {
                            color: "#cacaca",
                            fontSize: 11
                        },
                        title: {
                            offsetCenter: [0, "30%"],
                            textStyle: {
                                color: "#dfdfdf",
                                fontSize: 18,
                                fontWeight: 500
                            }
                        },
                        detail: {
                            formatter: "{value}%",
                            offsetCenter: [0, "80%"],
                            textStyle: {
                                color: "#fff0f0",
                                fontSize: 30,
                                fontWeight: "bold"
                            }
                        },
                        data: [
                            { value: overallValue, name: "模型综合得分" }
                        ]
                    }
                ]
            };
            gaugeChart.setOption(option);
        }
    } catch (err) {
        console.error('加载模型评价数据失败', err);
        // 降级：显示默认值或错误提示
        if (predictionScoreEl) predictionScoreEl.textContent = '--';
        if (imputationScoreEl) imputationScoreEl.textContent = '--';
        if (anomalyScoreEl) anomalyScoreEl.textContent = '--';
        if (correlationScoreEl) correlationScoreEl.textContent = '--';
        if (gaugeChart) {
            gaugeChart.setOption({
                series: [{ data: [{ value: 0 }] }],
                title: { show: true, text: '数据加载失败', left: 'center', top: 'center', textStyle: { color: '#fff' } }
            });
        }
    }
});