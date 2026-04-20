// 全局元素获取
const modalMask = document.getElementById('modalMask');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginBtn = document.querySelector('.login span:last-child');
const registerBtn = document.querySelector('.login span:first-child');
const loginClose = document.getElementById('loginClose');
const registerClose = document.getElementById('registerClose');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTips = document.getElementById('loginTips');
const registerTips = document.getElementById('registerTips');
const tipsArea = document.querySelector('.tips');

// 初始化：页面一打开就强制未登录（关闭页面即退出）
checkLoginStatus();

// 打开登录弹窗
loginBtn.addEventListener('click', () => {
    modalMask.style.display = 'block';
    loginModal.style.display = 'block';
});

// 打开注册弹窗
registerBtn.addEventListener('click', () => {
    modalMask.style.display = 'block';
    registerModal.style.display = 'block';
});

// 关闭弹窗
function closeModal() {
    modalMask.style.display = 'none';
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
    loginTips.textContent = '';
    registerTips.textContent = '';
    loginForm.reset();
    registerForm.reset();
}

loginClose.addEventListener('click', closeModal);
registerClose.addEventListener('click', closeModal);
modalMask.addEventListener('click', closeModal);

[loginModal, registerModal].forEach(modal => {
    modal.addEventListener('click', (e) => e.stopPropagation());
});

// ==============================================
// 注册功能（关闭页面不保存登录状态）
// ==============================================
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const profession = document.getElementById('regProfession').value;
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPwd').value.trim();

    let users = JSON.parse(localStorage.getItem('industrialUsers')) || [];
    const exist = users.some(u => u.username === username);

    if (exist) {
        registerTips.textContent = '用户名已存在，请更换！';
        return;
    }

    // 保存用户（永久保存，注册的账号一直存在）
    users.push({
        id: Date.now().toString(),
        username,
        role: profession,   // ⭐ 关键：职业 → role
        email,
        password,
        avatar: './photo/admin.png'
    });
    localStorage.setItem('industrialUsers', JSON.stringify(users));

    // 保存刚刚注册的用户对象（不是整个数组）
    const newUser = users[users.length - 1];
    sessionStorage.setItem('currentUser', JSON.stringify(newUser));

    closeModal();
    checkLoginStatus();
    alert('注册成功！已自动登录，即将跳转...');
    window.location.href = '../index.html';
});

// ==============================================
// 登录功能（关闭页面自动退出）
// ==============================================
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPwd').value.trim();

    let users = JSON.parse(localStorage.getItem('industrialUsers')) || [];
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        loginTips.textContent = '用户名或密码错误！';
        return;
    }

    sessionStorage.setItem('currentUser', JSON.stringify(user));

    closeModal();
    checkLoginStatus();
    alert('登录成功！即将跳转...');
    window.location.href = '../index.html';
});

// ==============================================
// 检查登录状态（从 sessionStorage 读取）
// ==============================================
function checkLoginStatus() {
    const user = sessionStorage.getItem('currentUser');
    if (user) {
        const { username, role } = JSON.parse(user);
        document.querySelector('.login').style.display = 'none';
        tipsArea.className = 'tips login-status';
        tipsArea.innerHTML = `欢迎您，${role} - ${username}`;
    } else {
        document.querySelector('.login').style.display = 'flex';
        tipsArea.className = 'tips';
        tipsArea.innerHTML = '<span>请先登录后查看详情</span>';
    }
}


(function () {
    // 获取元素
    const heroSection = document.querySelector('.img-header');
    const contentSection = document.querySelector('.banner');
    const scrollHint = document.getElementById('scrollHint');

    // 状态锁，防止连续滚动触发多次
    let isScrolling = false;
    let scrollLockTimer = null;

    // 头部高度（与CSS中margin-top保持一致）
    const HEADER_HEIGHT = 80;

    // 定义顶部留白距离（单位 px），可根据需要调整
    const TOP_OFFSET = 100; // 留出50px空白

    function getScrollTarget(element) {
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        return absoluteTop - HEADER_HEIGHT - TOP_OFFSET;
    }

    // 平滑滚动到指定位置
    function smoothScrollTo(targetY) {
        if (isScrolling) return;
        isScrolling = true;

        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });

        // 滚动动画结束后解锁（约500ms后）
        if (scrollLockTimer) clearTimeout(scrollLockTimer);
        scrollLockTimer = setTimeout(() => {
            isScrolling = false;
        }, 600);
    }

    // 滚动到内容区（banner顶部）
    function scrollToContent() {
        if (!contentSection) return;
        const target = getScrollTarget(contentSection);
        // 边界处理：如果目标位置不合理，则取合理值
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const finalTarget = Math.min(Math.max(0, target), maxScroll);
        smoothScrollTo(finalTarget);
    }

    // 滚动回顶部图片区
    function scrollToTop() {
        smoothScrollTo(0);
    }

    // 判断当前是否在图片区（滚动距离小于图片区域高度的80%）
    function isAtHeroArea() {
        const heroHeight = heroSection ? heroSection.offsetHeight : window.innerHeight;
        // 由于头部fixed，实际可视内容偏移需考虑scrollY小于图片区域高度大部分
        return window.scrollY < heroHeight * 0.8;
    }

    // 判断当前是否在内容区（滚动位置已经超出图片区底部较多）
    function isPastHero() {
        const heroBottom = heroSection ? heroSection.offsetHeight : window.innerHeight;
        return window.scrollY >= heroBottom - 50;
    }

    // 滚轮事件处理（实现单次翻页）
    function handleWheel(e) {
        // 如果正在滚动动画中，暂时阻止新动作
        if (isScrolling) {
            e.preventDefault();
            return;
        }

        const deltaY = e.deltaY;
        const isDown = deltaY > 0;   // 向下滚动
        const isUp = deltaY < 0;      // 向上滚动

        if (isDown && !isPastHero() && isAtHeroArea()) {
            e.preventDefault();   // 阻止默认滚动跳跃
            scrollToContent();
        }
        else if (isUp && window.scrollY > 80 && !isAtHeroArea()) {
            const contentTop = contentSection ? getScrollTarget(contentSection) : window.innerHeight;
            if (window.scrollY < contentTop + 150) {
                e.preventDefault();
                scrollToTop();
            }
        }
    }

    // 绑定滚轮事件（注意使用 passive: false 才能调用 preventDefault）
    window.addEventListener('wheel', handleWheel, { passive: false });

    // 箭头点击事件：点击即滚动到内容区
    if (scrollHint) {
        scrollHint.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isScrolling) {
                scrollToContent();
            }
        });
    }
})();
