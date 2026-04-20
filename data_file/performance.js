document.addEventListener('DOMContentLoaded', function () {
    const apiUrl = 'http://localhost:5000/api/performance'; // 后端接口地址

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 更新 Correlation Score
            const correlationEl = document.getElementById('correlation_score');
            if (correlationEl) correlationEl.textContent = data.correlation_score;

            // 更新 Predictive Score
            const predictionEl = document.getElementById('prediction_score');
            if (predictionEl) predictionEl.textContent = data.prediction_score;

            // 更新 Multits Score
            const multitsEl = document.getElementById('multits_score');
            if (multitsEl) multitsEl.textContent = data.multits_score;

            // 更新 Generated Sequences
            const generatedEl = document.getElementById('generated_sequences');
            if (generatedEl) generatedEl.textContent = data.generated_sequences;
        })
        .catch(error => {
            console.error('获取数据失败:', error);
            // 可选：将所有数值显示为错误标记
            const ids = ['correlation_score', 'perdiction_score', 'multits_score', 'generated_sequences'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '错误';
            });
        });
});