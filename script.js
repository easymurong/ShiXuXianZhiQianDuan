// 获取所有菜单和页面
const menuItems = document.querySelectorAll('.menu-item');
const pages = document.querySelectorAll('.page');

// 为每个菜单添加点击事件
menuItems.forEach(item => {
    item.addEventListener('click', () => {
        // 切换菜单高亮
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // 获取对应页面ID
        const pageId = item.getAttribute('data-page');

        // 切换页面显示
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    });
});



function renderCurrentDate() {
    // 获取日期容器
    const dateElement = document.querySelector('.current-date');
    if (!dateElement) return;

    // 获取当前日期
    const now = new Date();
    // 定义英文月份缩写（固定顺序）
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // 提取年、月（缩写）、日
    const year = now.getFullYear();
    const month = monthAbbr[now.getMonth()]; // 月份从0开始，对应数组索引
    const day = now.getDate(); // 日期无需补零，和示例格式一致

    // 拼接成目标格式：Apr 24,2024
    const dateStr = `${month} ${day}, ${year}`;
    // 插入到页面
    dateElement.textContent = dateStr;
}

// 页面加载时执行一次（无需定时更新，因为日期只变一次/天）
renderCurrentDate();



// ========== 新增：设置页面交互逻辑 ==========
// 1. 初始化DOM元素
const accountForm = document.getElementById('accountForm');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const avatarUpload = document.getElementById('avatarUpload');
const avatarPreview = document.getElementById('avatarPreview');
const userInfoElement = document.querySelector('.user-info h3'); // 侧边栏用户名
const userImgElement = document.querySelector('.user-img img'); // 侧边栏头像

// ========== 扩展：通知设置逻辑 ==========
// 1. 新增DOM元素获取
const exceptionNotifySwitch = document.getElementById('exceptionNotifySwitch');
const notifyTypeRadios = document.querySelectorAll('input[name="notifyType"]');

// 2. 扩展初始化用户信息函数（新增通知设置）
const initUserInfo = () => {
    const currentUserSession = sessionStorage.getItem('currentUser');
    let currentUserId = null;
    let currentUsername = 'Admin';
    let currentEmail = 'admin@example.com';

    if (currentUserSession) {
        const sessionUser = JSON.parse(currentUserSession);
        currentUserId = sessionUser.id;
        currentUsername = sessionUser.username;
        currentEmail = sessionUser.email || currentEmail;
    }

    // 从用户列表获取最新信息（如果有 id）
    let userFromList = null;
    if (currentUserId) {
        const userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];
        userFromList = userList.find(u => u.id === currentUserId);
    }
    if (userFromList) {
        currentUsername = userFromList.username;
        currentEmail = userFromList.email;
    }

    // 从 userInfo 加载个性化设置
    const savedUser = localStorage.getItem('userInfo');
    let userInfo = {};
    if (savedUser) {
        userInfo = JSON.parse(savedUser);
    }

    // 合并：用户名、邮箱以用户列表为准，个性化设置以 userInfo 为准
    const mergedUser = {
        username: currentUsername,
        email: currentEmail,
        avatar: userInfo.avatar || './photo/admin.png', // 默认头像
        notifySwitch: userInfo.notifySwitch !== undefined ? userInfo.notifySwitch : true,
        notifyType: userInfo.notifyType || 'sms'
    };

    // 更新页面元素
    usernameInput.value = mergedUser.username;
    emailInput.value = mergedUser.email;
    if (mergedUser.avatar) {
        avatarPreview.src = mergedUser.avatar;
        userImgElement.src = mergedUser.avatar;
    }
    userInfoElement.textContent = mergedUser.username;

    // 通知设置
    exceptionNotifySwitch.checked = mergedUser.notifySwitch;
    notifyTypeRadios.forEach(radio => {
        if (radio.value === mergedUser.notifyType) {
            radio.checked = true;
        }
    });

    // 保存合并后的信息回 userInfo，保持一致性
    localStorage.setItem('userInfo', JSON.stringify(mergedUser));
};


// 3. 头像预览功能
avatarUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const imgUrl = event.target.result;
            avatarPreview.src = imgUrl;
            // 实时更新侧边栏头像预览
            userImgElement.src = imgUrl;
        };
        reader.readAsDataURL(file);
    }
});

// 4. 表单校验函数
const validateForm = () => {
    // 用户名非空
    if (!usernameInput.value.trim()) {
        showToast('用户名不能为空', 'error');
        return false;
    }
    // 邮箱格式校验
    const emailReg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailInput.value && !emailReg.test(emailInput.value.trim())) {
        showToast('请输入有效的邮箱地址', 'error');
        return false;
    }
    // 密码长度校验（如果填写了密码）
    if (passwordInput.value && passwordInput.value.length < 6) {
        showToast('密码长度不能少于6位', 'error');
        return false;
    }
    return true;
};

// 5. 提示框函数
const showToast = (message, type = 'success') => {
    // 创建提示框（如果不存在）
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    // 设置内容和样式
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    // 3秒后隐藏
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
};

accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const currentUserSession = sessionStorage.getItem('currentUser');
    if (!currentUserSession) {
        showToast('未检测到登录状态', 'error');
        return;
    }
    const sessionUser = JSON.parse(currentUserSession);
    const userId = sessionUser.id;

    const newUsername = usernameInput.value.trim();
    const newEmail = emailInput.value.trim();
    const newPassword = passwordInput.value.trim();

    // 更新用户列表
    let userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];
    const userIndex = userList.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        showToast('用户不存在', 'error');
        return;
    }

    // 检查用户名是否被其他用户占用
    const existingUser = userList.find(u => u.username === newUsername && u.id !== userId);
    if (existingUser) {
        showToast('用户名已存在', 'error');
        return;
    }

    // 更新用户对象
    const updatedUser = { ...userList[userIndex] };
    updatedUser.username = newUsername;
    updatedUser.email = newEmail;
    if (newPassword) {
        updatedUser.password = newPassword;
    }
    userList[userIndex] = updatedUser;
    localStorage.setItem('industrialUsers', JSON.stringify(userList));

    // 更新 sessionStorage 中的 currentUser
    const updatedSessionUser = { ...sessionUser, username: newUsername, email: newEmail };
    if (newPassword) {
        updatedSessionUser.password = newPassword;
    }
    sessionStorage.setItem('currentUser', JSON.stringify(updatedSessionUser));

    // 获取通知设置
    let selectedNotifyType = 'sms';
    notifyTypeRadios.forEach(radio => {
        if (radio.checked) selectedNotifyType = radio.value;
    });

    // 保存 userInfo（头像、通知设置）
    const userInfo = {
        username: newUsername,
        email: newEmail,
        avatar: avatarPreview.src,
        password: newPassword ? newPassword : undefined,
        notifySwitch: exceptionNotifySwitch.checked,
        notifyType: selectedNotifyType
    };
    localStorage.setItem('userInfo', JSON.stringify(userInfo));

    // 更新侧边栏
    userInfoElement.textContent = newUsername;
    userImgElement.src = avatarPreview.src;

    showToast('修改保存成功！');
    passwordInput.value = '';
});

// 7. 页面加载时初始化用户信息
window.addEventListener('load', initUserInfo);

// ========== 原有代码保持不变 ==========
// （注：将原有script.js代码保留，新增上述代码到script.js末尾）

// ========== 新增：用户管理功能 ==========
// 1. 获取DOM元素
const addUserBtn = document.getElementById('addUserBtn');
const userModalClose = document.getElementById('userModalClose');
const userForm = document.getElementById('userForm');
const userModalTitle = document.getElementById('userModalTitle');
const editUserId = document.getElementById('editUserId');
const newUsername = document.getElementById('newUsername');
const newEmail = document.getElementById('newEmail');
const userRoleRadios = document.querySelectorAll('input[name="userRole"]');
const userTableBody = document.getElementById('userTableBody');

// 2. 初始化用户列表（页面加载时渲染）
window.addEventListener('load', renderUserList);

// 3. 打开添加用户弹窗
addUserBtn.addEventListener('click', () => {
    userModalTitle.textContent = '添加用户';
    userForm.reset(); // 重置表单
    editUserId.value = ''; // 清空编辑ID
    userModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
});

// 4. 关闭用户弹窗
const userModal = document.getElementById('userModal');
const userModalCloseBtn = document.querySelector('#userModal .modal-close');

userModalCloseBtn.addEventListener('click', () => {
    userModal.style.display = 'none';
    document.body.style.overflow = '';
});

userModal.addEventListener('click', (e) => {
    if (e.target === userModal) {
        userModal.style.display = 'none';
        document.body.style.overflow = '';
    }
});

userForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = newUsername.value.trim();
    const email = newEmail.value.trim();
    const passwordInput = document.getElementById('newPassword');
    const password = passwordInput ? passwordInput.value.trim() : '';
    let role = '管理员';
    userRoleRadios.forEach(radio => {
        if (radio.checked) role = radio.value;
    });

    // 表单校验
    if (!username) {
        showToast('用户名不能为空', 'error');
        return;
    }
    const emailReg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailReg.test(email)) {
        showToast('请输入有效的邮箱', 'error');
        return;
    }

    let userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];

    if (editUserId.value) {
        // 编辑用户
        const existingUser = userList.find(u => u.username === username && u.id !== editUserId.value);
        if (existingUser) {
            showToast('用户名已存在', 'error');
            return;
        }
        // 获取密码输入
        const newPassword = document.getElementById('newPassword').value.trim();
        // 更新用户
        userList = userList.map(user => {
            if (user.id === editUserId.value) {
                const updated = { ...user, username, role, email };
                if (newPassword) updated.password = newPassword; // 只有输入了新密码才更新
                return updated;
            }
            return user;
        });
        showToast('用户编辑成功', 'success');

        // 如果编辑的是当前登录用户，同步更新 sessionStorage 和 userInfo
        const currentUserSession = sessionStorage.getItem('currentUser');
        if (currentUserSession) {
            const sessionUser = JSON.parse(currentUserSession);
            if (sessionUser.id === editUserId.value) {
                const updatedSession = { ...sessionUser, username, role, email };
                if (newPassword) updatedSession.password = newPassword;
                sessionStorage.setItem('currentUser', JSON.stringify(updatedSession));

                const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
                userInfo.username = username;
                userInfo.email = email;
                localStorage.setItem('userInfo', JSON.stringify(userInfo));

                userInfoElement.textContent = username;
            }
        }
    } else {
        // 添加用户：需要密码
        if (!password) {
            showToast('密码不能为空', 'error');
            return;
        }
        // 检查用户名是否已存在
        if (userList.some(u => u.username === username)) {
            showToast('用户名已存在', 'error');
            return;
        }
        const newUser = {
            id: Date.now().toString(),
            username,
            role,
            email,
            password
        };
        userList.push(newUser);
        showToast('用户添加成功', 'success');
    }

    localStorage.setItem('industrialUsers', JSON.stringify(userList));
    renderUserList();
    closeUserModal();
});

// 6. 渲染用户列表
function renderUserList() {
    let userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];
    userTableBody.innerHTML = ''; // 清空原有列表
    if (userList.length === 0) {
        // 无用户时显示提示
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4" style="color: #999;">暂无用户，请点击添加</td>';
        userTableBody.appendChild(tr);
        return;
    }
    // 遍历渲染每个用户
    userList.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${user.email}</td>
            <td>
                <button class="operate-btn edit-btn" data-id="${user.id}">编辑</button>
                <button class="operate-btn delete-btn" data-id="${user.id}">删除</button>
            </td>
        `;
        userTableBody.appendChild(tr);
    });
}

// 用户表格操作事件委托（编辑/删除）
userTableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('edit-btn')) {
        const userId = target.getAttribute('data-id');
        const userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];
        const user = userList.find(item => item.id === userId);
        if (!user) return;

        userModalTitle.textContent = '编辑用户';
        editUserId.value = user.id;
        newUsername.value = user.username;
        newEmail.value = user.email;
        document.getElementById('newPassword').value = ''; // 清空密码框
        userRoleRadios.forEach(radio => {
            if (radio.value === user.role) radio.checked = true;
        });

        userModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    else if (target.classList.contains('delete-btn')) {
        const userId = target.getAttribute('data-id');
        if (confirm('确定要删除该用户吗？删除后不可恢复')) {
            let userList = JSON.parse(localStorage.getItem('industrialUsers')) || [];
            const userIndex = userList.findIndex(u => u.id === userId);
            if (userIndex === -1) return;

            // 先移除用户
            userList.splice(userIndex, 1);
            localStorage.setItem('industrialUsers', JSON.stringify(userList));

            // 检查是否删除的是当前登录用户
            const currentUserSession = sessionStorage.getItem('currentUser');
            if (currentUserSession) {
                const sessionUser = JSON.parse(currentUserSession);
                if (sessionUser.id === userId) {
                    // 清除登录状态
                    sessionStorage.removeItem('currentUser');
                    localStorage.removeItem('userInfo');
                    alert('您的账号已被删除，请重新登录。');
                    window.location.href = './main-page/main-page.html';
                    return;
                }
            }

            // 非当前用户，刷新列表
            renderUserList();
            showToast('用户删除成功', 'success');
        }
    }
});

function closeUserModal() {
    userModal.style.display = 'none';
    document.body.style.overflow = '';
}



function updateAllDeviceHealth() {
    const items = document.querySelectorAll('.box1-1 li');

    items.forEach(li => {
        const percentText = li.querySelector('.name h2').textContent.trim();
        const percent = parseInt(percentText);

        const healthBar = li.querySelector('.health-bar');
        const num = li.querySelector('.name h2');
        const percentSign = li.querySelector('.name p');
        const judgeText = li.querySelector('.judge p');
        const judgeImg = li.querySelector('.judge img');

        healthBar.style.width = percent + '%';

        if (percent >= 70) {
            // 绿色
            healthBar.className = 'health-bar';
            num.className = '';
            percentSign.className = '';
            judgeText.className = '';
            judgeImg.src = "./photo/normal_point.png";
            judgeText.textContent = "Normal";
        }
        else if (percent >= 40) {
            // 橙色
            healthBar.className = "health-bar orange";
            num.className = "orange";
            percentSign.className = "orange";
            judgeText.className = "orange";
            judgeImg.src = "./photo/warning_point.png";
            judgeText.textContent = "Warning";
        }
        else {
            // 红色
            healthBar.className = "health-bar red";
            num.className = "red";
            percentSign.className = "red";
            judgeText.className = "red";
            judgeImg.src = "./photo/abnormal_point.png";
            judgeText.textContent = "Abnormal";
        }
    });
}



// 1. 获取系统更新按钮
const checkUpdateBtn = document.getElementById('checkUpdateBtn');

// 2. 绑定点击事件
if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', () => {
        // 模拟检查更新（实际项目可替换为接口请求）
        showToast('系统已是最新版本', 'success');
    });
}

// ========== 用户模块权限控制 ==========
// 检查当前用户是否为管理员，并控制用户模块的显示
// 应用角色权限限制（设置页面通知模块、设备列表操作列）
function applyRoleRestrictions() {
    const currentUserSession = sessionStorage.getItem('currentUser');
    if (!currentUserSession) return;
    const currentUser = JSON.parse(currentUserSession);
    const role = currentUser.role;

    // 1. 设置页面：通知模块（set-box2 下的 ul 添加遮罩，设备工程师和数据分析员不可修改）
    const notifyUl = document.querySelector('.set-box2 ul');
    if (notifyUl) {
        let overlay = notifyUl.querySelector('.permission-overlay');
        if (role === '管理员') {
            if (overlay) overlay.remove();
        } else {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'permission-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.background = 'rgba(255,255,255,0.5)';
                overlay.style.backdropFilter = 'blur(4px)';
                overlay.style.borderRadius = '8px';
                overlay.style.zIndex = '10';
                // 不添加任何文字内容
                notifyUl.style.position = 'relative';
                notifyUl.appendChild(overlay);
            }
        }
    }

    // 2. 设备列表页面：操作列遮罩（数据分析员不可操作）
    const deviceTable = document.getElementById('deviceTableBody');
    if (deviceTable && role === '数据分析员') {
        const rows = deviceTable.querySelectorAll('tr');
        rows.forEach(row => {
            const lastCell = row.lastElementChild;
            if (lastCell && !lastCell.querySelector('.operation-overlay')) {
                lastCell.style.position = 'relative';
                const overlay = document.createElement('div');
                overlay.className = 'operation-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.background = 'rgba(255,255,255,0.5)';
                overlay.style.backdropFilter = 'blur(4px)';
                overlay.style.borderRadius = '4px';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = '10';
                overlay.innerHTML = '<div style="background:rgba(0,0,0,0.6); padding:4px 8px; border-radius:4px; font-size:12px; color:#fff;">无权限</div>';
                lastCell.appendChild(overlay);
            }
        });
    } else if (deviceTable && role !== '数据分析员') {
        const overlays = deviceTable.querySelectorAll('.operation-overlay');
        overlays.forEach(overlay => overlay.remove());
        const cells = deviceTable.querySelectorAll('td:last-child');
        cells.forEach(cell => cell.style.position = '');
    }

    // 3. 用户模块权限控制（管理员可见）
    const userModule = document.querySelector('.user-module-wrapper');
    if (userModule) {
        const contentDiv = userModule.querySelector('.user-module-content');
        if (contentDiv) {
            let overlay = contentDiv.querySelector('.permission-overlay');
            if (role === '管理员') {
                if (overlay) overlay.remove();
            } else {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'permission-overlay';
                    contentDiv.style.position = 'relative';
                    contentDiv.appendChild(overlay);
                }
            }
        }
    }
}

// 将函数挂载到全局，供其他脚本调用
window.applyRoleRestrictions = applyRoleRestrictions;

// 在页面加载、菜单切换、用户信息更新时调用
function initRoleRestrictions() {
    applyRoleRestrictions();
}

// 监听菜单切换，当切换到设置或设备页面时重新应用限制
const originalMenuItemClick = (function () {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(applyRoleRestrictions, 50);
        });
    });
})();

// 页面加载时调用
document.addEventListener('DOMContentLoaded', () => {
    initRoleRestrictions();
});

// 在用户信息修改后（保存账户设置时）重新检查
const originalAccountSubmit = accountForm.onsubmit;
accountForm.onsubmit = async (e) => {
    if (originalAccountSubmit) await originalAccountSubmit(e);
    applyRoleRestrictions();
};

// 在渲染用户列表后重新检查权限（防止遮罩被意外清除）
const originalRenderUserList = renderUserList;
window.renderUserList = function () {
    originalRenderUserList();
    applyRoleRestrictions();
};

// 监听设置页面激活（通过菜单切换）
function onSettingPageActive() {
    applyRoleRestrictions();
}


// 页面初始化时检查
window.addEventListener('load', () => {
    applyRoleRestrictions();
    // 确保用户列表渲染后再次检查
    setTimeout(applyRoleRestrictions, 200);
});



// ========== 首页“查看全部”跳转到设备列表 ==========
const viewAllBtn = document.querySelector('.home-box1 .box1-head p');
if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
        // 获取“设备列表”对应的菜单项
        const deviceMenuItem = document.querySelector('.menu-item[data-page="device"]');
        if (deviceMenuItem) {
            deviceMenuItem.click();
        }
    });
}

// ========== 高级粒子背景（星座/数据网络风格） ==========
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
const PARTICLE_COUNT = 80;
const MAX_DISTANCE = 120;

const main = document.querySelector('.main');

function resizeCanvas() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    // 设置实际绘图尺寸（像素）
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 重新初始化粒子（适应新尺寸）
    init();
}

// 在加载和窗口大小改变时调用
window.addEventListener('load', () => {
    resizeCanvas();
    animate();
});
window.addEventListener('resize', resizeCanvas);

// 粒子类
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        // 分层：远近感
        this.size = Math.random() * 2 + 0.5;
        this.alpha = Math.random() * 0.5 + 0.8;

        // 非随机乱动，而是“缓慢漂移”
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // 边界反弹（更自然）
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        // 发光
        ctx.shadowColor = 'rgba(0,255,255,0.8)';
        ctx.shadowBlur = 8;

        ctx.fillStyle = `rgba(0,255,255,${this.alpha})`;
        ctx.fill();

        ctx.shadowBlur = 0; // 防止影响其他绘制
    }
}

// 初始化
function init() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }
}
init();

// 连线（关键优化：更柔和）
function connect() {
    for (let i = 0; i < particles.length; i++) {
        let connections = 0;

        for (let j = i + 1; j < particles.length; j++) {
            if (connections > 3) break; // 每个点最多3条线

            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < MAX_DISTANCE) {
                const opacity = 1 - dist / MAX_DISTANCE;

                ctx.strokeStyle = `rgba(0,255,255,${opacity * 0.6})`;
                ctx.lineWidth = 0.7;

                // 轻微发光
                ctx.shadowColor = 'rgba(0, 195, 255, 0.5)';
                ctx.shadowBlur = 4;

                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();

                ctx.shadowBlur = 0;

                connections++;
            }
        }
    }
}

// 动画
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
        p.update();
        p.draw();
    });

    connect();

    requestAnimationFrame(animate);
}

animate();

async function fetchDevicesAndRender() {
    try {
        const response = await fetch(`${API_BASE}/devices`);
        if (!response.ok) throw new Error('设备列表请求失败');
        const devices = await response.json();
        const container = document.querySelector('.box1-1 ul');
        if (!container) return;

        container.innerHTML = '';

        devices.forEach(device => {
            const li = document.createElement('li');
            li.setAttribute('data-device-id', device.id);
            li.setAttribute('data-device', `device${device.id}`);
            const healthScore = device.health_score || 0;

            // 根据设备 id 设置不同图片
            const imgSrc = `./photo/device_${device.id}.png`;

            li.innerHTML = `
                <div class="device_img">
                    <img src="${imgSrc}" alt="">
                </div>
                <div class="device_health">
                    <div class="name">
                        <h4>${device.name}</h4>
                        <h2>${healthScore}</h2>
                        <p>%</p>
                    </div>
                    <div class="score">
                        <div class="health-bar" style="width: ${healthScore}%;"></div>
                    </div>
                    <div class="judge-1">
                        <h5>健康状态：</h5>
                        <div class="judge">
                            <img src="./photo/normal_point.png" alt="">
                            <p></p>
                        </div>
                    </div>
                </div>
            `;

            // 根据健康得分设置颜色样式（原有逻辑保持不变）
            const healthBar = li.querySelector('.health-bar');
            const nameH2 = li.querySelector('.name h2');
            const nameP = li.querySelector('.name p');
            const judgeImg = li.querySelector('.judge img');
            const judgeP = li.querySelector('.judge p');

            if (healthScore >= 70) {
                healthBar.className = 'health-bar';
                nameH2.className = '';
                nameP.className = '';
                judgeImg.src = "./photo/normal_point.png";
                judgeP.textContent = "Normal";
            } else if (healthScore >= 40) {
                healthBar.className = "health-bar orange";
                nameH2.className = "orange";
                nameP.className = "orange";
                judgeImg.src = "./photo/warning_point.png";
                judgeP.textContent = "Warning";
            } else {
                healthBar.className = "health-bar red";
                nameH2.className = "red";
                nameP.className = "red";
                judgeImg.src = "./photo/abnormal_point.png";
                judgeP.textContent = "Abnormal";
            }

            container.appendChild(li);
        });
    } catch (err) {
        console.error('获取设备列表失败', err);
    }
}
