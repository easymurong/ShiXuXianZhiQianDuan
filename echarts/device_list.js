// device_list.js - 设备列表管理（后端集成 + 维护记录保存修复 + 空行占位）
const deviceList = (function () {
    let devices = [];
    let currentEditDeviceId = null;
    let currentMaintenances = [];
    let maintenanceStorage = {};

    // ================== 辅助函数 ==================
    function getLastMaintain(deviceId) {
        const records = maintenanceStorage[deviceId] || [];
        if (records.length === 0) return '-';
        const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
        return sorted[0].date;
    }

    function getPredictMaintain(deviceId) {
        const device = devices.find(d => d.id == deviceId);
        if (!device) return '-';
        const score = device.health_score || 0;
        if (score < 40) return '立即';
        if (score < 70) return '7天内';
        return '30天内';
    }

    function loadMaintenanceFromLocal() {
        const stored = localStorage.getItem('device_maintenances');
        if (stored) {
            try {
                maintenanceStorage = JSON.parse(stored);
            } catch (e) { maintenanceStorage = {}; }
        } else {
            maintenanceStorage = {};
        }
    }

    function saveMaintenanceToLocal() {
        localStorage.setItem('device_maintenances', JSON.stringify(maintenanceStorage));
    }

    function saveDevicesToLocal() {
        localStorage.setItem('industrial_devices', JSON.stringify(devices));
    }

    // 刷新设备详情（重新获取所有设备的详情，并更新 enrichedDevices）
    async function refreshDeviceList() {
        const success = await fetchDevices();
        if (success) {
            const enriched = [];
            for (const dev of devices) {
                const enrichedDev = await enrichDeviceDetails(dev);
                enriched.push(enrichedDev);
            }
            enrichedDevices = enriched;
            renderDeviceTable();
        }
    }

    // ================== 后端数据获取 ==================
    async function fetchDevices() {
        try {
            const res = await fetch(`${API_BASE}/devices`);
            if (!res.ok) throw new Error('获取设备列表失败');
            devices = await res.json();
            devices.forEach(dev => {
                if (!maintenanceStorage[dev.id]) maintenanceStorage[dev.id] = [];
            });
            saveDevicesToLocal();
            return true;
        } catch (err) {
            console.error('获取设备列表失败', err);
            return false;
        }
    }

    async function enrichDeviceDetails(device) {
        try {
            const res = await fetch(`${API_BASE}/devices/${device.id}`);
            if (!res.ok) throw new Error('获取设备详情失败');
            const detail = await res.json();
            const anomalies = detail.recent_anomalies || [];
            const exceptionCount = anomalies.length;
            const lastException = anomalies.length > 0 ? anomalies[0].time : '-';
            const faultRecord = anomalies.length > 0 ? anomalies[0].type : '-';
            let status = '正常';
            if (device.health_score < 60) status = '异常';
            else if (device.health_score < 80) status = '警告';
            return {
                ...device,
                status,
                exceptionCount,
                lastException,
                faultRecord,
                lastMaintain: getLastMaintain(device.id),
                predictMaintain: getPredictMaintain(device.id)
            };
        } catch (err) {
            console.error(`设备 ${device.id} 详情获取失败`, err);
            let status = '正常';
            if (device.health_score < 60) status = '异常';
            else if (device.health_score < 80) status = '警告';
            return {
                ...device,
                status,
                exceptionCount: 0,
                lastException: '-',
                faultRecord: '-',
                lastMaintain: getLastMaintain(device.id),
                predictMaintain: getPredictMaintain(device.id)
            };
        }
    }

    // ================== 渲染表格和首页卡片 ==================
    let enrichedDevices = [];

    async function renderDeviceTable() {
        const tbody = document.getElementById('deviceTableBody');
        if (!tbody) return;

        const keyword = document.getElementById('deviceSearchInput')?.value.toLowerCase() || '';
        const filtered = enrichedDevices.filter(dev =>
            dev.name.toLowerCase().includes(keyword) ||
            dev.id.toString().includes(keyword)
        );

        tbody.innerHTML = '';
        // 渲染设备数据行
        for (const dev of filtered) {
            const statusClass = dev.status === '正常' ? 'status-normal' : (dev.status === '警告' ? 'status-warning' : 'status-abnormal');
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${dev.name}</td>
                <td>${dev.id}</td>
                <td><span class="${statusClass}">${dev.status}</span></td>
                <td>${dev.health_score}%</td>
                <td>${dev.lastException || '-'}</td>
                <td>${dev.faultRecord || '-'}</td>
                <td>${dev.lastMaintain || '-'}</td>
                <td>${dev.predictMaintain || '-'}</td>
                <td>${dev.exceptionCount || 0}</td>
                <td>
                    <div class="dropdown">
                        <button onclick="event.stopPropagation(); deviceList.toggleDropdown(this)">详情</button>
                        <div class="dropdown-content">
                            <button onclick="deviceList.openEdit('${dev.id}')">编辑</button>
                            <button onclick="deviceList.openEditWithMaintenance('${dev.id}')">维护记录</button>
                            <button onclick="deviceList.showDeviceDetailModal('${dev.id}')">设备详情</button>
                        </div>
                    </div>
                </td>
            `;
        }

        // 新增：添加三个空行（占位）
        for (let i = 0; i < 3; i++) {
            const emptyRow = tbody.insertRow();
            emptyRow.innerHTML = `
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td></td>
            `;
            // 可选：添加样式，使空行与普通行区分（如背景半透明）
            emptyRow.style.opacity = '0.6';
        }

        renderHomeCards();
    }

    function renderHomeCards() {
        const container = document.querySelector("#home .box1-1 ul");
        if (!container) return;
        container.innerHTML = "";
        enrichedDevices.forEach(dev => {
            let statusEn = "Normal", iconSrc = "./photo/normal_point.png";
            let barClass = "health-bar";
            let textClass = "";
            if (dev.status === "警告") {
                statusEn = "Warning";
                iconSrc = "./photo/warning_point.png";
                barClass = "health-bar orange";
                textClass = "orange";
            } else if (dev.status === "异常") {
                statusEn = "Abnormal";
                iconSrc = "./photo/abnormal_point.png";
                barClass = "health-bar red";
                textClass = "red";
            }
            const healthScore = dev.health_score || 0;
            const li = document.createElement("li");
            li.setAttribute("data-device-id", dev.id);
            // 根据设备 ID 生成不同的图片路径
            const deviceImgSrc = `./photo/device_${dev.id}.png`;
            li.innerHTML = `
            <div class="device_img"><img src="${deviceImgSrc}" alt="设备图片"></div>
            <div class="device_health">
                <div class="name">
                    <h4>${dev.name}</h4>
                    <h2 class="${textClass}">${healthScore}</h2>
                    <p class="${textClass}">%</p>
                </div>
                <div class="score">
                    <div class="${barClass}" style="width: ${healthScore}%;"></div>
                </div>
                <div class="judge-1">
                    <h5>健康状态：</h5>
                    <div class="judge">
                        <img src="${iconSrc}">
                        <p class="${textClass}">${statusEn}</p>
                    </div>
                </div>
            </div>
        `;
            li.addEventListener('click', (e) => { e.stopPropagation(); showDeviceDetailById(dev.id); });
            container.appendChild(li);
        });
    }

    // ================== 设备详情弹窗 ==================
    function showDeviceDetailById(deviceId) {
        if (typeof openDeviceModal === 'function') {
            const device = enrichedDevices.find(d => d.id == deviceId);
            if (device) openDeviceModal(deviceId, device.name);
        } else {
            console.warn('openDeviceModal 未定义');
            showLegacyDeviceDetail(deviceId);
        }
    }

    function showLegacyDeviceDetail(deviceId) { /* 原有降级逻辑保持不变 */ }

    // ================== 编辑与维护记录（修复删除） ==================
    function openEdit(deviceId) {
        const dev = enrichedDevices.find(d => d.id == deviceId);
        if (!dev) return;
        currentEditDeviceId = deviceId;
        document.getElementById('editDeviceName').value = dev.name;
        document.getElementById('editDeviceId').value = dev.id;
        currentMaintenances = maintenanceStorage[deviceId] ? [...maintenanceStorage[deviceId]] : [];
        renderMaintenanceList();
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('editPage').classList.add('active');
    }

    function openEditWithMaintenance(deviceId) { openEdit(deviceId); }

    function renderMaintenanceList() {
        const container = document.getElementById('maintenanceList');
        if (!container) return;
        if (!currentMaintenances.length) {
            container.innerHTML = '<div style="text-align:center; color:#aaa; padding:15px;">暂无维护记录</div>';
            return;
        }
        container.innerHTML = '';
        currentMaintenances.forEach((rec, idx) => {
            const div = document.createElement('div');
            div.className = 'maint-item';
            div.innerHTML = `
                <div><span>${rec.date || ''}</span> | <strong>${rec.type}</strong> | ${rec.content} | ${rec.person} | 结果:${rec.result}</div>
                <button class="delete-maint" data-idx="${idx}">🗑️</button>
            `;
            // 绑定删除事件（修复：删除后立即保存）
            const delBtn = div.querySelector('.delete-maint');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 删除当前记录
                currentMaintenances.splice(idx, 1);
                // 立即保存到 localStorage
                maintenanceStorage[currentEditDeviceId] = [...currentMaintenances];
                saveMaintenanceToLocal();
                // 重新渲染维护记录列表
                renderMaintenanceList();
                // 更新设备详情中的最新维护日期
                const devIndex = enrichedDevices.findIndex(d => d.id == currentEditDeviceId);
                if (devIndex !== -1) {
                    enrichedDevices[devIndex].lastMaintain = getLastMaintain(currentEditDeviceId);
                }
                // 刷新设备表格以显示最新维护日期
                renderDeviceTable();
            });
            container.appendChild(div);
        });
    }

    // 添加维护记录
    function addMaintenanceRecord() {
        const date = document.getElementById('newMaintDate').value;
        const type = document.getElementById('newMaintType').value.trim();
        const content = document.getElementById('newMaintContent').value.trim();
        const person = document.getElementById('newMaintPerson').value.trim();
        const result = document.getElementById('newMaintResult').value.trim();
        if (!type || !content) { alert("请至少填写类型和内容"); return; }
        const newRecord = {
            date: date || new Date().toISOString().slice(0, 10),
            type, content, person,
            result: result || '待确认'
        };
        currentMaintenances.push(newRecord);
        // 立即保存到本地存储
        maintenanceStorage[currentEditDeviceId] = [...currentMaintenances];
        saveMaintenanceToLocal();
        // 更新 enrichedDevices 中对应设备的 lastMaintain
        const devIndex = enrichedDevices.findIndex(d => d.id == currentEditDeviceId);
        if (devIndex !== -1) {
            enrichedDevices[devIndex].lastMaintain = getLastMaintain(currentEditDeviceId);
        }
        renderMaintenanceList();
        // 清空输入框
        document.getElementById('newMaintType').value = '';
        document.getElementById('newMaintContent').value = '';
        document.getElementById('newMaintPerson').value = '';
        document.getElementById('newMaintResult').value = '';
        // 刷新设备表格以显示最新维护日期
        renderDeviceTable();
    }

    // 保存编辑
    function saveEdit() {
        const newName = document.getElementById('editDeviceName').value.trim();
        const newCode = document.getElementById('editDeviceId').value.trim();
        if (!newName || !newCode) { alert("设备名称和编号不能为空"); return; }
        const devIndex = enrichedDevices.findIndex(d => d.id === currentEditDeviceId);
        if (devIndex !== -1) {
            const conflict = enrichedDevices.some((d, idx) => idx !== devIndex && d.id == newCode);
            if (conflict) { alert("设备编号已存在，请更换"); return; }
            enrichedDevices[devIndex].name = newName;
            enrichedDevices[devIndex].id = newCode;
            const baseDev = devices.find(d => d.id == currentEditDeviceId);
            if (baseDev) {
                baseDev.name = newName;
                baseDev.id = newCode;
            }
            saveDevicesToLocal();
            // 维护记录存储的 key 可能变化
            if (currentEditDeviceId !== newCode) {
                maintenanceStorage[newCode] = maintenanceStorage[currentEditDeviceId];
                delete maintenanceStorage[currentEditDeviceId];
            } else {
                maintenanceStorage[currentEditDeviceId] = [...currentMaintenances];
            }
            saveMaintenanceToLocal();
            // 更新 enrichedDevices 中的 lastMaintain
            const updatedDevIndex = enrichedDevices.findIndex(d => d.id == newCode);
            if (updatedDevIndex !== -1) {
                enrichedDevices[updatedDevIndex].lastMaintain = getLastMaintain(newCode);
            }
            renderDeviceTable();
        }
        backToDeviceList();
    }

    function backToDeviceList() {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('device').classList.add('active');
        renderDeviceTable();
    }

    function search() { renderDeviceTable(); }
    function resetSearch() {
        const input = document.getElementById('deviceSearchInput');
        if (input) input.value = '';
        renderDeviceTable();
    }

    function toggleDropdown(btn) {
        const content = btn.nextElementSibling;
        document.querySelectorAll('.dropdown-content').forEach(d => { if (d !== content) d.style.display = 'none'; });
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    }
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.style.display = 'none');
        }
    });

    // ================== 初始化 ==================
    async function init() {
        loadMaintenanceFromLocal();
        const success = await fetchDevices();
        if (success) {
            const enriched = [];
            for (const dev of devices) {
                const enrichedDev = await enrichDeviceDetails(dev);
                enriched.push(enrichedDev);
            }
            enrichedDevices = enriched;
            renderDeviceTable();
        } else {
            const local = localStorage.getItem('industrial_devices');
            if (local) {
                try {
                    devices = JSON.parse(local);
                    enrichedDevices = devices.map(d => ({ ...d, status: '正常', exceptionCount: 0, lastException: '-', faultRecord: '-' }));
                } catch (e) { }
            }
            renderDeviceTable();
        }
        const viewAllBtn = document.querySelector('.home-box1 .box1-head p');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                const deviceMenuItem = document.querySelector('.menu-item[data-page="device"]');
                if (deviceMenuItem) deviceMenuItem.click();
            });
        }
    }

    // 对外接口
    return {
        init,
        search,
        resetSearch,
        openEdit,
        openEditWithMaintenance,
        addMaintenanceRecord,
        saveEdit,
        backToDeviceList,
        toggleDropdown,
        showDeviceDetailModal: showDeviceDetailById
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    deviceList.init();
});