/* ========================================
   Enterprise Smart Customer Service - JS
   ======================================== */

const API = '';
const PINNED_SESSIONS_KEY = 'smartcs-pinned-sessions';
const ARCHIVED_SESSIONS_KEY = 'smartcs-archived-sessions';

function readStorageArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (e) {
        return [];
    }
}

const state = {
    sessionId: null,
    loading: false,
    enableRag: true,
    enableFC: true,
    currentPage: 'chat',
    theme: localStorage.getItem('theme') || 'light',
    selectedFile: null,
    sessions: [],
    sessionView: 'all',
    pinnedSessionIds: readStorageArray(PINNED_SESSIONS_KEY),
    archivedSessionIds: readStorageArray(ARCHIVED_SESSIONS_KEY),
    messageCount: 0,
    activeSessions: 0,
    totalDocs: 0,
    lastCostTime: null,
    knowledgeDocs: [],
    selectedKnowledgeDocIds: [],
    activeKnowledgeDocId: null,
    knowledgeSortOrder: 'updated_desc',
    monitorAutoRefresh: true,
    monitorRefreshInterval: 15,
    monitorRefreshIn: 15,
    monitorMetrics: {},
    monitorMetricSearch: '',
    monitorMetricSort: 'avg_desc',
    activityFeed: [],
    activityToneFilter: 'all',
    commandResults: [],
    commandActiveIndex: 0,
    sessionSearchKeyword: '',
    appAlertVisible: false,
    lastUiErrorAt: 0,
    pendingConfirmAction: null,
    activeModalId: null,
    modalRestoreFocus: null
};

const DRAFT_KEY = 'smartcs-chat-draft';

const MODAL_FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

const welcomeTemplate = `
    <div class="welcome-screen" id="welcomeScreen">
        <div class="welcome-logo">
            <svg width="40" height="40" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
                <circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>
            </svg>
        </div>
        <h2>企业智能客服助手</h2>
        <p>基于 DeepSeek 大模型 + RAG 检索增强生成技术，为您提供精准的企业知识问答与业务查询服务</p>
        <div class="welcome-cards">
            <button type="button" class="welcome-card" onclick="quickAsk('请介绍一下你能为我提供哪些服务？')" aria-label="了解服务能力">
                <span class="welcome-card-icon blue" aria-hidden="true">💡</span>
                <span class="welcome-card-title">了解服务能力</span>
                <span class="welcome-card-desc">查看系统支持的全部功能</span>
            </button>
            <button type="button" class="welcome-card" onclick="quickAsk('帮我查询订单 ORD20240101 的状态')" aria-label="订单状态查询">
                <span class="welcome-card-icon green" aria-hidden="true">📦</span>
                <span class="welcome-card-title">订单状态查询</span>
                <span class="welcome-card-desc">查询订单物流与配送信息</span>
            </button>
            <button type="button" class="welcome-card" onclick="quickAsk('请问退换货的具体政策和流程是什么？')" aria-label="售后政策咨询">
                <span class="welcome-card-icon orange" aria-hidden="true">📋</span>
                <span class="welcome-card-title">售后政策咨询</span>
                <span class="welcome-card-desc">了解退换货规则与流程</span>
            </button>
            <button type="button" class="welcome-card" onclick="quickAsk('有什么热门产品推荐吗？')" aria-label="产品推荐">
                <span class="welcome-card-icon purple" aria-hidden="true">🛒</span>
                <span class="welcome-card-title">产品推荐</span>
                <span class="welcome-card-desc">获取热门产品信息与推荐</span>
            </button>
        </div>
    </div>
`;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
    hydrateStateFromUrl();
    applyTheme(state.theme);
    initSessionViewAccessibility();
    initPrimaryNavigationAccessibility();
    initWorkspaceNavigationAccessibility();
    initErrorBoundary();
    refreshStats();
    refreshSessions();
    setInterval(refreshStats, 15000);
    setInterval(refreshSessions, 20000);
    setInterval(tickMonitorRefresh, 1000);
    setInterval(updateWorkspaceClock, 1000);
    updateWorkspaceClock();
    updateWorkspaceSummary();
    updateMonitorRefreshLabel();
    restoreDraft();
    initCommandPalette();
    pushActivity('工作台已就绪', '系统已加载完成，可开始对话、上传知识或查看监控。', 'success');

    // Textarea auto resize
    const ta = document.getElementById('chatInput');
    ta.addEventListener('input', () => {
        autoResize(ta);
        updateDraftState();
    });
    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // File drag & drop
    setupFileDrop();
    document.addEventListener('keydown', handleGlobalShortcuts);
    document.addEventListener('focusin', enforceActiveModalFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);
    applyKnowledgeFilters();
    switchPage(state.currentPage);
});

// ========== Theme ==========
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    state.theme = t;
    localStorage.setItem('theme', t);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerHTML = t === 'dark' ? icons.sun : icons.moon;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', t === 'dark' ? '#0f1117' : '#f0f2f5');
    }
}

function toggleTheme() {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
    pushActivity('界面主题已切换', `当前主题：${state.theme === 'light' ? '浅色' : '深色'}模式`, 'info');
}

function toggleCapability(type) {
    if (type === 'rag') {
        state.enableRag = !state.enableRag;
        document.getElementById('toggleRagBtn')?.classList.toggle('active', state.enableRag);
        toast(state.enableRag ? '已开启 RAG 检索增强' : '已关闭 RAG 检索增强', 'info');
        updateWorkspaceSummary();
        pushActivity('能力开关更新', state.enableRag ? '已开启 RAG 检索增强。' : '已关闭 RAG 检索增强。', 'info');
        return;
    }

    state.enableFC = !state.enableFC;
    document.getElementById('toggleFcBtn')?.classList.toggle('active', state.enableFC);
    toast(state.enableFC ? '已开启 Function Calling' : '已关闭 Function Calling', 'info');
    updateWorkspaceSummary();
    pushActivity('能力开关更新', state.enableFC ? '已开启业务函数调用能力。' : '已关闭业务函数调用能力。', 'info');
}

// ========== Sidebar ==========
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ========== Pages ==========
function switchPage(page) {
    state.currentPage = page;
    clearAppAlert();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    syncPrimaryNavigation(page);

    const titles = { chat: '智能对话', knowledge: '知识库管理', monitor: '系统监控' };
    document.getElementById('headerTitle').textContent = titles[page] || '';
    announcePageChange(page);

    if (page === 'knowledge') refreshKnowledgePage();
    if (page === 'monitor') refreshMonitorPage();
    updateWorkspaceSummary();
    updateMonitorRefreshLabel();
    syncUrlState();
}

// ========== Chat ==========
async function sendMessage() {
    const ta = document.getElementById('chatInput');
    const msg = ta.value.trim();
    if (!msg || state.loading) return;

    hideWelcome();
    appendMsg('user', msg);
    ta.value = '';
    autoResize(ta);
    updateDraftState();
    setComposerStatus('正在生成回复，请稍候...', '模型处理中');
    pushActivity('发送新消息', `已向智能助手提交一条新的会话请求。`, 'info');

    state.loading = true;
    document.getElementById('btnSend').disabled = true;
    const loadId = showTyping();

    try {
        const res = await fetch(`${API}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                sessionId: state.sessionId,
                enableRag: state.enableRag,
                enableFunctionCalling: state.enableFC
            })
        });
        const json = await res.json();
        removeTyping(loadId);

        if (json.code === 200 && json.data) {
            const d = json.data;
            state.sessionId = d.sessionId;
            state.lastCostTime = d.costTime || null;
            appendMsg('ai', d.answer, {
                ragUsed: d.ragUsed,
                functionCalled: d.functionCalled,
                functionName: d.functionCalled ? '业务查询' : null,
                costTime: d.costTime,
                sources: d.sources
            });
            refreshSessions();
            updateWorkspaceSummary();
            setComposerStatus('回答已生成，可继续追问或总结会话。', d.costTime ? `最近响应 ${d.costTime}ms` : '回答完成');
            pushActivity('收到智能回复', `${d.costTime || 0}ms · ${d.ragUsed ? '已使用知识增强' : '未使用知识增强'}${d.functionCalled ? ' · 已触发业务查询' : ''}`, 'success');
        } else {
            appendMsg('ai', '本次请求未成功，请稍后重试或调整问题后再次发送。');
            setComposerStatus('本次请求未成功，请调整问题后重试。', '请求失败');
        }
    } catch (e) {
        appendMsg('ai', '抱歉，当前服务暂时不可用，请稍后重试。');
        setComposerStatus('网络连接异常，请检查服务或稍后重试。', '网络错误');
    } finally {
        state.loading = false;
        document.getElementById('btnSend').disabled = false;
    }
}

function appendMsg(role, content, meta = {}) {
    const area = document.getElementById('messagesArea');
    const id = 'msg-' + (++state.messageCount);
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    const renderedContent = role === 'ai'
        ? renderMarkdown(content)
        : escapeHtml(content).replace(/\n/g, '<br>');

    let footerHtml = '';
    if (role === 'ai') {
        let tags = '';
        if (meta.ragUsed) tags += `<span class="msg-tag rag">${icons.db14} RAG</span>`;
        if (meta.functionCalled) tags += `<span class="msg-tag func">${icons.zap14} ${meta.functionName}</span>`;

        let sourcesHtml = '';
        if (meta.sources && meta.sources.length > 0) {
            let rows = meta.sources.map(s => `
                <div class="source-row">
                    <div class="source-row-title">
                        ${icons.file14} ${s.documentName || '未知文档'}
                        <span class="source-score">${(s.score * 100).toFixed(1)}%</span>
                    </div>
                    <p>${escapeHtml(s.content).substring(0, 120)}...</p>
                </div>
            `).join('');
            sourcesHtml = `
                <div class="msg-sources" id="src-${id}">
                    <div class="msg-sources-header" onclick="document.getElementById('src-${id}').classList.toggle('open')">
                        ${icons.chevron} 引用来源 (${meta.sources.length})
                    </div>
                    <div class="msg-sources-body">${rows}</div>
                </div>`;
        }

        footerHtml = `
            <div class="msg-footer">
                ${tags}
                <span class="msg-time">${time}${meta.costTime ? ' · ' + meta.costTime + 'ms' : ''}</span>
                <div class="msg-actions">
                    <button class="msg-action-btn" onclick="copyText(this)" title="复制">${icons.copy}</button>
                    <button class="msg-action-btn" onclick="feedback(this, 'up')" title="有用">${icons.thumbUp}</button>
                    <button class="msg-action-btn" onclick="feedback(this, 'down')" title="无用">${icons.thumbDown}</button>
                </div>
            </div>
            ${sourcesHtml}`;
    } else {
        footerHtml = `<div class="msg-footer"><span class="msg-time">${time}</span></div>`;
    }

    const html = `
        <div class="msg ${role}" id="${id}">
            <div class="msg-avatar">${role === 'ai' ? icons.bot : icons.user}</div>
            <div class="msg-body">
                <div class="msg-bubble">${renderedContent}</div>
                ${footerHtml}
            </div>
        </div>`;

    area.insertAdjacentHTML('beforeend', html);
    area.scrollTop = area.scrollHeight;
}

function showTyping() {
    const area = document.getElementById('messagesArea');
    const id = 'typing-' + Date.now();
    area.insertAdjacentHTML('beforeend', `
        <div class="msg ai" id="${id}">
            <div class="msg-avatar">${icons.bot}</div>
            <div class="msg-body">
                <div class="msg-bubble">
                    <div class="typing-dots"><span></span><span></span><span></span></div>
                </div>
            </div>
        </div>
    `);
    area.scrollTop = area.scrollHeight;
    return id;
}

function removeTyping(id) {
    document.getElementById(id)?.remove();
}

function hideWelcome() {
    const w = document.getElementById('welcomeScreen');
    if (w) w.style.display = 'none';
}

function quickAsk(text) {
    document.getElementById('chatInput').value = text;
    updateDraftState();
    sendMessage();
}

function applyPromptChip(text) {
    const input = document.getElementById('chatInput');
    input.value = text;
    input.focus();
    autoResize(input);
    updateDraftState();
}

function clearDraft() {
    const input = document.getElementById('chatInput');
    input.value = '';
    input.focus();
    autoResize(input);
    updateDraftState();
    toast('草稿已清空', 'info');
}

function copyText(btn) {
    const bubble = btn.closest('.msg-body').querySelector('.msg-bubble');
    navigator.clipboard.writeText(bubble.innerText)
        .then(() => toast('已复制到剪贴板', 'success'))
        .catch(() => toast('复制失败，请手动复制', 'error'));
}

function feedback(btn, type) {
    btn.style.color = type === 'up' ? 'var(--success)' : 'var(--danger)';
    toast(type === 'up' ? '感谢反馈！' : '我们会持续改进', 'info');
}

function exportChat() {
    const msgs = document.querySelectorAll('#messagesArea .msg');
    if (msgs.length === 0) { toast('没有对话记录', 'info'); return; }

    let text = '智能客服对话记录\n' + '='.repeat(40) + '\n\n';
    msgs.forEach(m => {
        const role = m.classList.contains('user') ? '用户' : 'AI助手';
        const content = m.querySelector('.msg-bubble')?.innerText || '';
        text += `[${role}]\n${content}\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    toast('对话已导出', 'success');
    pushActivity('导出对话记录', '已将当前会话导出为本地文本文件。', 'success');
}

// ========== Sessions ==========
function newSession() {
    state.sessionId = null;
    state.messageCount = 0;
    const area = document.getElementById('messagesArea');
    area.innerHTML = welcomeTemplate;
    document.querySelectorAll('.session-item').forEach(s => s.classList.remove('active'));
    switchPage('chat');
    setComposerStatus('已创建新会话，欢迎继续提问。', '新会话');
    pushActivity('新建会话', '已创建一个新的空白对话会话。', 'success');
}

async function refreshSessions() {
    const hadSessions = state.sessions.length > 0;
    if (hadSessions) {
        setBusyState('sessionList', true);
    } else {
        renderSessionListLoading();
    }
    try {
        const res = await fetch(`${API}/api/chat/sessions`);
        const json = await res.json();
        if (json.code === 200 && json.data) {
            state.sessions = json.data;
            const sessionIds = new Set(state.sessions.map(session => session.sessionId));
            state.pinnedSessionIds = state.pinnedSessionIds.filter(id => sessionIds.has(id));
            state.archivedSessionIds = state.archivedSessionIds.filter(id => sessionIds.has(id));
            persistSessionGovernance();
            state.activeSessions = json.data.length;
            renderSessions();
            updateWorkspaceSummary();
        } else {
            throw new Error('session_list_unavailable');
        }
    } catch (e) {
        if (hadSessions) {
            renderSessions();
        } else {
            renderSessionListState({
                title: '历史会话暂不可用',
                description: '会话记录暂时无法同步，请稍后重试。',
                actionLabel: '重新加载',
                action: 'refreshSessions()'
            });
        }
    }
}

function persistSessionGovernance() {
    localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify(state.pinnedSessionIds));
    localStorage.setItem(ARCHIVED_SESSIONS_KEY, JSON.stringify(state.archivedSessionIds));
    syncUrlState();
}

function requestResetMetrics() {
    openConfirmModal({
        title: '重置性能指标',
        description: '确认重置当前性能统计指标？这会清空接口调用次数与平均耗时统计。',
        actionLabel: '确认重置',
        onConfirm: () => resetMetrics()
    });
}

async function resetMetrics() {
     try {
         const res = await fetch(`${API}/api/monitor/metrics/reset`, { method: 'POST' });
         const json = await res.json();
         if (json.code === 200) {
             toast('性能指标已重置', 'success');
             refreshMonitorPage();
             pushActivity('重置监控指标', '已清空接口性能统计，监控面板将重新累积数据。', 'warning');
         } else {
             toast('重置失败，请稍后重试', 'error');
         }
     } catch (e) {
         toast('重置失败，请稍后重试', 'error');
     }
 }

 function renderSessions() {
     const list = document.getElementById('sessionList');
     const sessions = getFilteredSessions();
     const groups = getSessionGroups();
     setBusyState('sessionList', false);
     syncSessionViewSwitch();

     if (sessions.length === 0) {
         const emptyStateMap = {
             all: {
                 title: '暂无对话记录',
                 description: '点击上方“新建对话”开始首次协作，会话将在这里沉淀。',
                 actionLabel: '新建对话',
                 action: 'newSession()'
             },
             pinned: {
                 title: '暂无收藏会话',
                 description: '把高频会话加入收藏后，这里会形成稳定的治理视图。',
                 actionLabel: '查看全部',
                 action: "setSessionView('all')"
             },
             archived: {
                 title: '暂无归档会话',
                 description: '归档后的历史记录会集中展示在这里，便于批量回溯。',
                 actionLabel: '查看全部',
                 action: "setSessionView('all')"
             }
         };
         if (state.sessionSearchKeyword.trim()) {
             renderSessionListState({
                 title: '没有匹配的会话',
                 description: '可以调整关键词，或清空当前筛选后查看全部历史会话。',
                 actionLabel: '清空筛选',
                 action: 'clearSessionSearch()'
            });
            updateSessionListSummary();
            return;
         }
         renderSessionListState(emptyStateMap[state.sessionView] || emptyStateMap.all);
         updateSessionListSummary();
         return;
     }
     list.innerHTML = groups.map(group => `
        <div class="session-group">
            <div class="session-group-title">${group.title}</div>
            ${group.sessions.map(renderSessionRow).join('')}
        </div>
    `).join('');
    updateSessionListSummary();
}

function updateSessionListSummary() {
    const meta = document.getElementById('sessionListMeta');
    const status = document.getElementById('sessionListStatus');
    const sessions = getFilteredSessions();
    const keyword = state.sessionSearchKeyword.trim();
    const activeSession = sessions.find(session => session.sessionId === state.sessionId);
    const viewLabelMap = {
        all: '全部会话',
        pinned: '收藏会话',
        archived: '归档会话'
    };
    const viewLabel = viewLabelMap[state.sessionView] || viewLabelMap.all;

    if (meta) {
        meta.textContent = keyword
            ? `${viewLabel} · 关键词“${keyword}” · ${sessions.length} 条`
            : `${viewLabel} · ${sessions.length} 条`;
    }

    if (status) {
        if (!sessions.length) {
            status.textContent = keyword
                ? `当前没有与“${keyword}”匹配的${viewLabel}。`
                : `当前${viewLabel}为空。`;
            return;
        }

        status.textContent = `${keyword ? `当前显示 ${sessions.length} 条${viewLabel}搜索结果。` : `当前显示 ${sessions.length} 条${viewLabel}。`}${activeSession ? ` 已选中会话 ${activeSession.title || activeSession.sessionId.slice(0, 8)}。` : ''}`;
    }
}

function getFilteredSessions() {
    const keyword = state.sessionSearchKeyword.trim().toLowerCase();
    return state.sessions.filter(session => {
        const archived = isArchivedSession(session.sessionId);
        const matchesView = state.sessionView === 'archived'
            ? archived
            : state.sessionView === 'pinned'
                ? isPinnedSession(session.sessionId) && !archived
                : !archived;
        const matchesKeyword = !keyword
            || (session.title || '').toLowerCase().includes(keyword)
            || (session.sessionId || '').toLowerCase().includes(keyword);
        return matchesView && matchesKeyword;
    });
}

function getSessionGroups() {
    const sessions = getFilteredSessions();
    if (state.sessionView === 'all') {
        const pinned = sessions.filter(session => isPinnedSession(session.sessionId));
        const recent = sessions.filter(session => !isPinnedSession(session.sessionId));
        return [
            { title: '收藏会话', sessions: pinned },
            { title: '最近会话', sessions: recent }
        ].filter(group => group.sessions.length);
    }
    if (state.sessionView === 'pinned') {
        return [{ title: '收藏会话', sessions }].filter(group => group.sessions.length);
    }
    return [{ title: '归档会话', sessions }].filter(group => group.sessions.length);
}

function renderSessionRow(session) {
    const pinned = isPinnedSession(session.sessionId);
    const archived = isArchivedSession(session.sessionId);
    return `
        <div class="session-row">
            <button type="button" class="session-item ${session.sessionId === state.sessionId ? 'active' : ''}" ${session.sessionId === state.sessionId ? 'aria-current="true"' : ''}
                 onclick="loadSession('${session.sessionId}')">
                ${icons.msgCircle}
                <span class="session-item-text">${escapeHtml(session.title)}</span>
            </button>
            <div class="session-actions">
                <button type="button" class="session-icon-btn ${pinned ? 'active' : ''}" onclick="togglePinSession('${session.sessionId}')" title="${pinned ? '取消收藏' : '收藏会话'}" aria-label="${pinned ? '取消收藏会话 ' : '收藏会话 '}${escapeHtml(session.title)}">${getSessionPinIcon()}</button>
                <button type="button" class="session-icon-btn archive ${archived ? 'active' : ''}" onclick="toggleArchiveSession('${session.sessionId}')" title="${archived ? '移出归档' : '归档会话'}" aria-label="${archived ? '移出归档会话 ' : '归档会话 '}${escapeHtml(session.title)}">${getSessionArchiveIcon()}</button>
                <button type="button" class="session-delete" onclick="requestDeleteSession('${session.sessionId}')" title="删除会话" aria-label="删除会话 ${escapeHtml(session.title)}">
                    ${icons.x14}
                </button>
            </div>
        </div>
    `;
}

function getSessionPinIcon() {
    return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
}

function getSessionArchiveIcon() {
    return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"></path><path d="M10 12h4"></path></svg>';
}

function isPinnedSession(sid) {
    return state.pinnedSessionIds.includes(sid);
}

function isArchivedSession(sid) {
    return state.archivedSessionIds.includes(sid);
}

function setSessionView(view) {
    if (!['all', 'pinned', 'archived'].includes(view)) return;
    state.sessionView = view;
    renderSessions();
    syncUrlState();
}

function initSessionViewAccessibility() {
    const switcher = document.querySelector('.session-view-switch');
    if (!switcher) return;
    switcher.addEventListener('keydown', event => {
        const tabs = [...switcher.querySelectorAll('.session-view-btn')];
        const currentIndex = tabs.findIndex(button => button.dataset.sessionView === state.sessionView);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = tabs[(currentIndex + 1) % tabs.length];
            if (next) {
                setSessionView(next.dataset.sessionView);
                next.focus();
            }
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
            if (prev) {
                setSessionView(prev.dataset.sessionView);
                prev.focus();
            }
        }
        if (event.key === 'Home') {
            event.preventDefault();
            const first = tabs[0];
            if (first) {
                setSessionView(first.dataset.sessionView);
                first.focus();
            }
        }
        if (event.key === 'End') {
            event.preventDefault();
            const last = tabs[tabs.length - 1];
            if (last) {
                setSessionView(last.dataset.sessionView);
                last.focus();
            }
        }
    });
}

function initPrimaryNavigationAccessibility() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    syncPrimaryNavigation(state.currentPage);
    nav.addEventListener('keydown', event => {
        const items = [...nav.querySelectorAll('.nav-item')];
        const trigger = event.target.closest('.nav-item');
        if (!trigger) return;

        const currentIndex = items.indexOf(trigger);
        if (currentIndex === -1) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            items[(currentIndex + 1) % items.length]?.focus();
            return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            items[(currentIndex - 1 + items.length) % items.length]?.focus();
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            items[0]?.focus();
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            items[items.length - 1]?.focus();
        }
    });
}

function syncPrimaryNavigation(page) {
    document.querySelectorAll('.nav-item').forEach(button => {
        const active = button.dataset.page === page;
        button.classList.toggle('active', active);
        if (active) {
            button.setAttribute('aria-current', 'page');
        } else {
            button.removeAttribute('aria-current');
        }
    });
}

function announcePageChange(page) {
    const region = document.getElementById('appPageStatus');
    if (!region) return;
    const labelMap = {
        chat: '已切换到智能对话页面。',
        knowledge: '已切换到知识库管理页面。',
        monitor: '已切换到系统监控页面。'
    };
    region.textContent = labelMap[page] || '页面已切换。';
}

function initWorkspaceNavigationAccessibility() {
    document.getElementById('sessionList')?.addEventListener('keydown', handleSessionListKeydown);
    document.getElementById('kbTableBody')?.addEventListener('keydown', handleKnowledgeTableKeydown);
}

function focusLinearNavigationItem(items, targetIndex) {
    const target = items[targetIndex];
    if (target) target.focus();
}

function handleSessionListKeydown(event) {
    const trigger = event.target.closest('.session-item');
    if (!trigger) return;

    const items = [...document.querySelectorAll('#sessionList .session-item')];
    const currentIndex = items.indexOf(trigger);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusLinearNavigationItem(items, Math.min(currentIndex + 1, items.length - 1));
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusLinearNavigationItem(items, Math.max(currentIndex - 1, 0));
        return;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        focusLinearNavigationItem(items, 0);
        return;
    }

    if (event.key === 'End') {
        event.preventDefault();
        focusLinearNavigationItem(items, items.length - 1);
    }
}

function handleKnowledgeTableKeydown(event) {
    const trigger = event.target.closest('.kb-doc-trigger');
    if (!trigger) return;

    const items = [...document.querySelectorAll('#kbTableBody .kb-doc-trigger')];
    const currentIndex = items.indexOf(trigger);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusLinearNavigationItem(items, Math.min(currentIndex + 1, items.length - 1));
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusLinearNavigationItem(items, Math.max(currentIndex - 1, 0));
        return;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        focusLinearNavigationItem(items, 0);
        return;
    }

    if (event.key === 'End') {
        event.preventDefault();
        focusLinearNavigationItem(items, items.length - 1);
    }
}

function initErrorBoundary() {
    window.addEventListener('error', () => {
        reportUiFailure('界面遇到异常，已自动保护当前工作台。');
    });
    window.addEventListener('unhandledrejection', event => {
        event.preventDefault();
        reportUiFailure('部分界面操作未完成，请重试当前模块。');
    });
}

function reportUiFailure(description) {
    const now = Date.now();
    if (now - state.lastUiErrorAt < 3000) return;
    state.lastUiErrorAt = now;
    showAppAlert({
        title: '前端工作台已进入保护模式',
        description,
        actionLabel: '重试当前页面',
        action: 'retryCurrentPage()'
    });
    toast('界面出现异常，已启用保护提示', 'error');
    pushActivity('前端异常保护', '检测到一次界面执行异常，已显示保护提示并建议重试当前页面。', 'warning');
}

function showAppAlert({ title, description, actionLabel = '', action = '' }) {
    const region = document.getElementById('appAlertRegion');
    if (!region) return;
    state.appAlertVisible = true;
    region.hidden = false;
    region.innerHTML = `
        <div class="app-alert-body">
            <div class="app-alert-copy">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(description)}</span>
            </div>
            <div class="app-alert-actions">
                ${actionLabel && action ? `<button type="button" class="btn btn-ghost" onclick="${action}">${escapeHtml(actionLabel)}</button>` : ''}
                <button type="button" class="btn btn-primary" onclick="clearAppAlert()">知道了</button>
            </div>
        </div>`;
}

function clearAppAlert() {
    const region = document.getElementById('appAlertRegion');
    if (!region || !state.appAlertVisible) return;
    region.hidden = true;
    region.innerHTML = '';
    state.appAlertVisible = false;
}

function retryCurrentPage() {
    clearAppAlert();
    if (state.currentPage === 'knowledge') {
        refreshKnowledgePage();
        return;
    }
    if (state.currentPage === 'monitor') {
        refreshMonitorPage();
        return;
    }
    refreshSessions();
}

function syncSessionViewSwitch() {
    document.querySelectorAll('.session-view-btn').forEach(button => {
        const active = button.dataset.sessionView === state.sessionView;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    });
}

function updateSessionSearch(value) {
    state.sessionSearchKeyword = value || '';
    renderSessions();
    syncUrlState();
}

function clearSessionSearch() {
    state.sessionSearchKeyword = '';
    const input = document.getElementById('sessionSearchInput');
    if (input) input.value = '';
    renderSessions();
    syncUrlState();
}

function togglePinSession(sid) {
    const target = state.sessions.find(session => session.sessionId === sid);
    const pinned = new Set(state.pinnedSessionIds);
    if (pinned.has(sid)) {
        pinned.delete(sid);
        toast('已取消收藏会话', 'info');
        pushActivity('取消收藏会话', `已取消收藏会话 ${target?.title || sid.slice(0, 8)}。`, 'info');
    } else {
        pinned.add(sid);
        toast('会话已加入收藏', 'success');
        pushActivity('收藏会话', `已收藏会话 ${target?.title || sid.slice(0, 8)}。`, 'success');
    }
    state.pinnedSessionIds = [...pinned];
    persistSessionGovernance();
    renderSessions();
}

function toggleArchiveSession(sid) {
    const target = state.sessions.find(session => session.sessionId === sid);
    const archived = new Set(state.archivedSessionIds);
    if (archived.has(sid)) {
        archived.delete(sid);
        toast('会话已移出归档', 'info');
        pushActivity('移出归档会话', `已移出归档会话 ${target?.title || sid.slice(0, 8)}。`, 'info');
    } else {
        archived.add(sid);
        toast('会话已归档', 'success');
        pushActivity('归档会话', `已归档会话 ${target?.title || sid.slice(0, 8)}。`, 'warning');
    }
    state.archivedSessionIds = [...archived];
    persistSessionGovernance();
    renderSessions();
}

function toggleCurrentSessionPin() {
    if (!state.sessionId) {
        toast('请先加载或创建一个会话', 'info');
        return;
    }
    togglePinSession(state.sessionId);
}

function toggleCurrentSessionArchive() {
    if (!state.sessionId) {
        toast('请先加载或创建一个会话', 'info');
        return;
    }
    toggleArchiveSession(state.sessionId);
}

async function loadSession(sid) {
    state.sessionId = sid;
    state.messageCount = 0;
    switchPage('chat');

    const area = document.getElementById('messagesArea');
    area.innerHTML = '';

    try {
        const res = await fetch(`${API}/api/chat/sessions/${sid}/messages`);
        const json = await res.json();
        if (json.code === 200 && json.data) {
            if (json.data.length === 0) {
                area.innerHTML = welcomeTemplate;
            } else {
                json.data.forEach(m => appendMsg(m.role === 'user' ? 'user' : 'ai', m.content));
            }
        }
    } catch (e) { toast('加载会话失败', 'error'); }

    renderSessions();
    setComposerStatus('历史会话已加载，可继续追问。', '会话已切换');
    pushActivity('切换历史会话', `已切换到会话 ${sid.slice(0, 8)}。`, 'info');
}

function requestDeleteSession(sid) {
    const target = state.sessions.find(item => item.sessionId === sid);
    openConfirmModal({
        title: '删除会话',
        description: `确认删除会话「${target?.title || sid.slice(0, 8)}」？该操作会清空当前会话上下文。`,
        actionLabel: '确认删除',
        onConfirm: () => performDeleteSession(sid)
    });
}

async function performDeleteSession(sid) {
    try {
        const res = await fetch(`${API}/api/chat/session/${sid}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.code === 200) {
            if (state.sessionId === sid) newSession();
            refreshSessions();
            toast('会话已删除', 'success');
            pushActivity('删除会话', `已删除会话 ${sid.slice(0, 8)}。`, 'warning');
        } else {
            toast('删除失败，请稍后重试', 'error');
        }
    } catch (e) {
        toast('删除失败，请稍后重试', 'error');
    }
}

// ========== Knowledge ==========
async function refreshKnowledgePage() {
    const hadDocs = state.knowledgeDocs.length > 0;
    if (hadDocs) {
        setBusyState('kbTableRegion', true);
    } else {
        renderKnowledgeTableLoading();
    }
    try {
        const [statsResult, docsResult] = await Promise.allSettled([
            fetch(`${API}/api/knowledge/statistics`).then(r => r.json()),
            fetch(`${API}/api/knowledge/documents`).then(r => r.json())
        ]);
        const statsRes = statsResult.status === 'fulfilled' ? statsResult.value : null;
        const docsRes = docsResult.status === 'fulfilled' ? docsResult.value : null;

        if (statsRes?.code === 200 && statsRes.data) {
            const s = statsRes.data;
            document.getElementById('kbTotalDocs').textContent = s.totalDocuments || 0;
            document.getElementById('kbCompleted').textContent = s.completed || 0;
            document.getElementById('kbProcessing').textContent = s.processing || 0;
            document.getElementById('kbTotalChunks').textContent = s.totalChunks || 0;
        }

        if (docsRes?.code === 200 && docsRes.data) {
            state.knowledgeDocs = docsRes.data;
            state.selectedKnowledgeDocIds = state.selectedKnowledgeDocIds.filter(id => state.knowledgeDocs.some(doc => doc.id === id));
            renderDocTable(getFilteredDocs());
            updateKnowledgeFilterSummary();
            updateKnowledgeSelectionSummary();
            syncKnowledgeSelectionState();

            if (state.activeKnowledgeDocId) {
                const current = state.knowledgeDocs.find(doc => doc.id === state.activeKnowledgeDocId);
                if (current) {
                    renderKnowledgeDetail(current);
                } else {
                    closeKnowledgeDetail();
                }
            }
        } else {
            throw new Error('knowledge_docs_unavailable');
        }
    } catch (e) {
        if (hadDocs) {
            renderDocTable(getFilteredDocs());
            updateKnowledgeFilterSummary();
            updateKnowledgeSelectionSummary();
            syncKnowledgeSelectionState();
        } else {
            renderKnowledgeTableState({
                title: '知识文档暂不可用',
                description: '文档列表正在准备中，请稍后重新加载。',
                actionLabel: '重新加载',
                action: 'refreshKnowledgePage()'
            });
            const summary = document.getElementById('kbFilterSummary');
            const meta = document.getElementById('kbTableMeta');
            if (summary) summary.textContent = '知识文档暂不可用';
            if (meta) meta.textContent = '等待重新加载';
            updateKnowledgeSelectionSummary();
        }
    }
}

function getFilteredDocs() {
    const keyword = (document.getElementById('kbSearchInput')?.value || '').trim().toLowerCase();
    const status = document.getElementById('kbStatusFilter')?.value || 'all';
    const sortOrder = getKnowledgeSortOrder();
    state.knowledgeSortOrder = sortOrder;

    return [...(state.knowledgeDocs || [])]
        .filter(doc => {
            const matchesKeyword = !keyword
                || (doc.documentName || '').toLowerCase().includes(keyword)
                || (doc.category || '').toLowerCase().includes(keyword)
                || (doc.description || '').toLowerCase().includes(keyword);
            const matchesStatus = status === 'all' || (doc.status || '') === status;
            return matchesKeyword && matchesStatus;
        })
        .sort((a, b) => compareKnowledgeDocs(a, b, sortOrder));
}

function getKnowledgeSortOrder() {
    return document.getElementById('kbSortOrder')?.value || state.knowledgeSortOrder || 'updated_desc';
}

function compareKnowledgeDocs(a, b, sortOrder) {
    if (sortOrder === 'name_asc') {
        return (a.documentName || '').localeCompare(b.documentName || '', 'zh-CN');
    }
    if (sortOrder === 'chunks_desc') {
        return (b.chunkCount || 0) - (a.chunkCount || 0);
    }
    if (sortOrder === 'created_desc') {
        return getKnowledgeTimeValue(b, 'createTime') - getKnowledgeTimeValue(a, 'createTime');
    }
    return getKnowledgeTimeValue(b, 'updateTime') - getKnowledgeTimeValue(a, 'updateTime');
}

function getKnowledgeTimeValue(doc, field) {
    const value = doc?.[field] || doc?.createTime || 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function applyKnowledgeFilters() {
    state.knowledgeSortOrder = getKnowledgeSortOrder();
    renderDocTable(getFilteredDocs());
    updateKnowledgeFilterSummary();
    updateKnowledgeSelectionSummary();
    syncKnowledgeSelectionState();
    syncUrlState();
}

function clearKnowledgeFilters() {
    const search = document.getElementById('kbSearchInput');
    const status = document.getElementById('kbStatusFilter');
    const sortOrder = document.getElementById('kbSortOrder');
    if (search) search.value = '';
    if (status) status.value = 'all';
    if (sortOrder) sortOrder.value = 'updated_desc';
    state.knowledgeSortOrder = 'updated_desc';
    applyKnowledgeFilters();
}

function updateKnowledgeFilterSummary() {
    const summary = document.getElementById('kbFilterSummary');
    const meta = document.getElementById('kbTableMeta');
    if (!summary) return;
    const total = state.knowledgeDocs.length;
    const filtered = getFilteredDocs().length;
    summary.textContent = filtered === total ? `显示全部文档 · 共 ${total} 条` : `筛选结果 ${filtered} / ${total}`;
    if (meta) {
        const labelMap = {
            updated_desc: '按最近更新排序',
            created_desc: '按最近创建排序',
            chunks_desc: '按分片数量排序',
            name_asc: '按名称 A-Z 排序'
        };
        meta.textContent = labelMap[state.knowledgeSortOrder] || labelMap.updated_desc;
    }
    updateKnowledgeWorkspaceStatus();
}

function updateKnowledgeSelectionSummary() {
    const summary = document.getElementById('kbSelectionSummary');
    const bulkDeleteBtn = document.getElementById('kbBulkDeleteBtn');
    const count = state.selectedKnowledgeDocIds.length;
    if (summary) {
        summary.textContent = count ? `已选择 ${count} 条文档` : '未选择文档';
    }
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = count === 0;
    }
    updateKnowledgeWorkspaceStatus();
}

function updateKnowledgeWorkspaceStatus() {
    const status = document.getElementById('kbWorkspaceStatus');
    if (!status) return;

    const filteredDocs = getFilteredDocs();
    const total = state.knowledgeDocs.length;
    const selectedCount = state.selectedKnowledgeDocIds.length;
    const activeDoc = state.knowledgeDocs.find(doc => doc.id === state.activeKnowledgeDocId);

    if (!total) {
        status.textContent = '知识工作区当前没有文档，可上传新文档。';
        return;
    }

    if (!filteredDocs.length) {
        status.textContent = '当前筛选条件下没有匹配的知识文档。';
        return;
    }

    status.textContent = `当前显示 ${filteredDocs.length} / ${total} 条知识文档。${selectedCount ? ` 已选择 ${selectedCount} 条。` : ' 当前未选择文档。'}${activeDoc ? ` 已打开文档 ${activeDoc.documentName || activeDoc.id} 的详情。` : ''}`;
}

function syncKnowledgeSelectionState() {
    const selectAll = document.getElementById('kbSelectAll');
    if (!selectAll) return;
    const visibleIds = getFilteredDocs().map(doc => doc.id);
    if (!visibleIds.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }
    const selectedVisibleCount = visibleIds.filter(id => state.selectedKnowledgeDocIds.includes(id)).length;
    selectAll.checked = selectedVisibleCount > 0 && selectedVisibleCount === visibleIds.length;
    selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function renderDocTable(docs) {
    const tbody = document.getElementById('kbTableBody');
    setBusyState('kbTableRegion', false);
    if (!docs || docs.length === 0) {
        renderKnowledgeTableState(state.knowledgeDocs.length
            ? {
                title: '当前筛选条件下暂无知识文档',
                description: '可以调整筛选条件，或重置后查看全部文档。',
                actionLabel: '重置筛选',
                action: 'clearKnowledgeFilters()'
            }
            : {
                title: '暂无知识文档',
                description: '上传文档或新增文本知识后，这里会展示可筛选、可治理的文档列表。',
                actionLabel: '上传文档',
                action: 'showUploadModal()'
            });
        syncKnowledgeSelectionState();
        updateKnowledgeWorkspaceStatus();
        return;
    }
    tbody.innerHTML = docs.map(d => `
        <tr class="${d.id === state.activeKnowledgeDocId ? 'active' : ''}">
            <td><input type="checkbox" class="kb-row-check" aria-label="选择知识文档 ${escapeHtml(d.documentName || '')}" ${state.selectedKnowledgeDocIds.includes(d.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleKnowledgeDocSelection('${d.id}', this.checked)"></td>
            <td>
                <button type="button" class="kb-doc-trigger" ${d.id === state.activeKnowledgeDocId ? 'aria-current="true"' : ''} onclick="openKnowledgeDetail('${d.id}')">
                    <strong>${escapeHtml(d.documentName || '-')}</strong>
                    <span class="kb-doc-sub">${escapeHtml(d.description || '查看文档详情与内容预览')}</span>
                </button>
            </td>
            <td>${escapeHtml(d.category || '-')}</td>
            <td><span class="status-badge ${(d.status || '').toLowerCase()}">${d.status || '-'}</span></td>
            <td>${d.chunkCount || 0}</td>
            <td>${formatKnowledgeTime(d.createTime)}</td>
            <td>
                <div class="kb-row-actions">
                    <button type="button" class="btn-delete" onclick="event.stopPropagation(); requestDeleteDoc('${d.id}')" title="删除文档" aria-label="删除文档 ${escapeHtml(d.documentName || '')}">
                        ${icons.trash}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    syncKnowledgeSelectionState();
    updateKnowledgeWorkspaceStatus();
}

function toggleKnowledgeDocSelection(id, checked) {
    const selected = new Set(state.selectedKnowledgeDocIds);
    if (checked) selected.add(id);
    else selected.delete(id);
    state.selectedKnowledgeDocIds = [...selected];
    updateKnowledgeSelectionSummary();
    syncKnowledgeSelectionState();
}

function toggleSelectAllDocs(checked) {
    const visibleIds = getFilteredDocs().map(doc => doc.id);
    const selected = new Set(state.selectedKnowledgeDocIds);
    visibleIds.forEach(id => {
        if (checked) selected.add(id);
        else selected.delete(id);
    });
    state.selectedKnowledgeDocIds = [...selected];
    renderDocTable(getFilteredDocs());
    updateKnowledgeSelectionSummary();
}

function requestDeleteSelectedDocs() {
    const ids = state.selectedKnowledgeDocIds.slice();
    if (!ids.length) {
        toast('请先选择文档', 'info');
        return;
    }
    openConfirmModal({
        title: '批量删除知识文档',
        description: `确认删除已选择的 ${ids.length} 条知识文档？该操作不可撤销。`,
        actionLabel: '确认删除',
        onConfirm: () => deleteSelectedDocs(ids)
    });
}

async function deleteSelectedDocs(ids) {
    let successCount = 0;
    for (const id of ids) {
        try {
            const res = await fetch(`${API}/api/knowledge/documents/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.code === 200) {
                successCount += 1;
            }
        } catch (e) {
        }
    }
    if (!successCount) {
        toast('批量删除失败，请稍后重试', 'error');
        return;
    }
    state.selectedKnowledgeDocIds = state.selectedKnowledgeDocIds.filter(id => !ids.includes(id));
    if (ids.includes(state.activeKnowledgeDocId)) {
        closeKnowledgeDetail();
    }
    refreshKnowledgePage();
    refreshStats();
    toast(`已删除 ${successCount} 条知识文档`, 'success');
    pushActivity('批量删除知识文档', `已删除 ${successCount} 条知识文档记录。`, 'warning');
    if (successCount < ids.length) {
        toast('部分文档删除失败，请稍后检查', 'info');
    }
}

async function openKnowledgeDetail(id) {
    state.activeKnowledgeDocId = id;
    renderDocTable(getFilteredDocs());
    syncUrlState();

    const localDoc = state.knowledgeDocs.find(doc => doc.id === id);
    if (localDoc) {
        renderKnowledgeDetail(localDoc);
    }

    try {
        const res = await fetch(`${API}/api/knowledge/documents/${id}`);
        const json = await res.json();
        if (json.code === 200 && json.data) {
            upsertKnowledgeDoc(json.data);
            renderKnowledgeDetail(json.data);
        } else if (!localDoc) {
            toast('加载文档详情失败，请稍后重试', 'error');
            closeKnowledgeDetail();
        }
    } catch (e) {
        if (!localDoc) {
            toast('加载文档详情失败，请稍后重试', 'error');
            closeKnowledgeDetail();
        }
    }
}

function upsertKnowledgeDoc(doc) {
    const index = state.knowledgeDocs.findIndex(item => item.id === doc.id);
    if (index === -1) {
        state.knowledgeDocs.unshift(doc);
        return;
    }
    state.knowledgeDocs[index] = { ...state.knowledgeDocs[index], ...doc };
}

function renderKnowledgeDetail(doc) {
    if (!doc) {
        closeKnowledgeDetail();
        return;
    }

    state.activeKnowledgeDocId = doc.id;
    document.getElementById('kbDetailEmpty').hidden = true;
    document.getElementById('kbDetailContent').hidden = false;
    document.getElementById('kbDetailTitle').textContent = doc.documentName || '-';

    const statusEl = document.getElementById('kbDetailStatus');
    statusEl.className = `status-badge ${(doc.status || 'PENDING').toLowerCase()}`;
    statusEl.textContent = doc.status || 'PENDING';

    document.getElementById('kbDetailId').textContent = doc.id ? `ID ${doc.id}` : '-';
    document.getElementById('kbDetailCategory').textContent = doc.category || '-';
    document.getElementById('kbDetailChunks').textContent = String(doc.chunkCount || 0);
    document.getElementById('kbDetailFileType').textContent = doc.fileType || 'TEXT';
    document.getElementById('kbDetailUpdateTime').textContent = formatKnowledgeTime(doc.updateTime || doc.createTime);
    document.getElementById('kbDetailDescription').textContent = (doc.description || '').trim() || '暂无文档说明';
    document.getElementById('kbDetailPreview').textContent = getKnowledgePreview(doc);

    renderDocTable(getFilteredDocs());
    updateKnowledgeWorkspaceStatus();
    syncUrlState();
}

function getKnowledgePreview(doc) {
    const content = (doc.content || '').trim();
    if (!content) return '暂无内容预览';
    return content.length > 1200 ? `${content.slice(0, 1200)}…` : content;
}

function formatKnowledgeTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
}

function closeKnowledgeDetail() {
    state.activeKnowledgeDocId = null;
    document.getElementById('kbDetailEmpty').hidden = false;
    document.getElementById('kbDetailContent').hidden = true;
    renderDocTable(getFilteredDocs());
    updateKnowledgeWorkspaceStatus();
    syncUrlState();
}

function copyKnowledgePreview() {
    const preview = document.getElementById('kbDetailPreview')?.textContent?.trim();
    if (!preview || preview === '暂无内容预览') {
        toast('当前没有可复制的内容预览', 'info');
        return;
    }
    if (!navigator.clipboard?.writeText) {
        toast('当前环境不支持自动复制，请手动复制', 'info');
        return;
    }
    navigator.clipboard.writeText(preview)
        .then(() => toast('内容预览已复制', 'success'))
        .catch(() => toast('复制失败，请手动复制', 'error'));
}

function requestDeleteActiveDoc() {
    if (!state.activeKnowledgeDocId) {
        toast('请先选择文档', 'info');
        return;
    }
    requestDeleteDoc(state.activeKnowledgeDocId);
}

function requestDeleteDoc(id) {
    const target = state.knowledgeDocs.find(doc => doc.id === id);
    openConfirmModal({
        title: '删除知识文档',
        description: `确认删除知识文档「${target?.documentName || '未命名文档'}」？已生成的向量片段也会一并移除。`,
        actionLabel: '确认删除',
        onConfirm: () => deleteDoc(id)
    });
}

async function deleteDoc(id) {
    try {
        const res = await fetch(`${API}/api/knowledge/documents/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.code === 200) {
            state.selectedKnowledgeDocIds = state.selectedKnowledgeDocIds.filter(item => item !== id);
            if (state.activeKnowledgeDocId === id) {
                closeKnowledgeDetail();
            }
            toast('知识文档已删除', 'success');
            refreshKnowledgePage();
            refreshStats();
            updateKnowledgeSelectionSummary();
            pushActivity('删除知识文档', '已移除一条知识库文档记录。', 'warning');
        } else {
            toast('删除失败，请稍后重试', 'error');
        }
    } catch (e) {
        toast('删除失败，请稍后重试', 'error');
    }
}

// ========== Upload Modal ==========
function showUploadModal() {
    openModal('uploadModal');
    state.selectedFile = null;
    document.getElementById('uploadDocName').value = '';
    document.getElementById('uploadCategory').value = '';
    document.getElementById('uploadText').value = '';
    resetFileDrop();
    toggleUploadMode();
    setTimeout(() => focusModalElement('uploadModal', '#uploadMode'), 30);
}

function hideUploadModal() {
    closeModal('uploadModal');
}

function toggleUploadMode() {
    const mode = document.getElementById('uploadMode').value;
    document.getElementById('fileSection').style.display = mode === 'file' ? 'block' : 'none';
    document.getElementById('textSection').style.display = mode === 'text' ? 'block' : 'none';
}

function resetFileDrop() {
    const zone = document.getElementById('fileDropZone');
    zone.classList.remove('has-file');
    zone.setAttribute('aria-label', '点击或拖拽文件到此区域');
    zone.innerHTML = `
        ${icons.upload}
        <span class="file-drop-title">点击或拖拽文件到此区域</span>
        <span class="file-drop-meta">支持 PDF、Word、TXT、Markdown 格式，最大 50MB</span>
    `;
}

function handleFileSelected(file) {
    if (!file) return;
    state.selectedFile = file;
    const zone = document.getElementById('fileDropZone');
    zone.classList.add('has-file');
    zone.setAttribute('aria-label', `已选择文件 ${file.name}`);
    zone.innerHTML = `
        ${icons.fileCheck}
        <span class="file-drop-title" style="color:var(--success)">${escapeHtml(file.name)}</span>
        <span class="file-drop-meta">${(file.size / 1024).toFixed(1)} KB · 点击重新选择</span>
    `;
    if (!document.getElementById('uploadDocName').value) {
        document.getElementById('uploadDocName').value = file.name.replace(/\.[^/.]+$/, '');
    }
}

function setupFileDrop() {
    const zone = document.getElementById('fileDropZone');
    const input = document.getElementById('fileInput');

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => handleFileSelected(e.target.files[0]));

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileSelected(e.dataTransfer.files[0]);
    });
}

async function doUpload() {
    const mode = document.getElementById('uploadMode').value;
    const name = document.getElementById('uploadDocName').value.trim();
    const cat = document.getElementById('uploadCategory').value.trim();

    if (mode === 'file') {
        if (!state.selectedFile) { toast('请选择文件', 'error'); return; }
        const fd = new FormData();
        fd.append('file', state.selectedFile);
        if (name) fd.append('documentName', name);
        if (cat) fd.append('category', cat);

        try {
            const res = await fetch(`${API}/api/knowledge/upload`, { method: 'POST', body: fd });
            const json = await res.json();
            if (json.code === 200) {
                toast('文档上传成功，后台正在向量化处理...', 'success');
                hideUploadModal();
                refreshKnowledgePage();
                refreshStats();
                pushActivity('上传知识文档', `已提交文件 ${state.selectedFile?.name || '文档'}，系统正在处理。`, 'success');
            } else toast('上传失败，请稍后重试', 'error');
        } catch (e) { toast('上传失败，请稍后重试', 'error'); }
    } else {
        const content = document.getElementById('uploadText').value.trim();
        if (!name || !content) { toast('请填写文档名称和内容', 'error'); return; }

        try {
            const res = await fetch(`${API}/api/knowledge/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentName: name, content, category: cat || 'default' })
            });
            const json = await res.json();
            if (json.code === 200) {
                toast('知识上传成功！', 'success');
                hideUploadModal();
                refreshKnowledgePage();
                refreshStats();
                pushActivity('新增文本知识', `已新增知识文档「${name}」。`, 'success');
            } else toast('上传失败，请稍后重试', 'error');
        } catch (e) { toast('上传失败，请稍后重试', 'error'); }
    }
}

// ========== Monitor ==========
async function refreshMonitorPage() {
    const hadMetrics = Object.keys(state.monitorMetrics || {}).length > 0;
    if (hadMetrics) {
        setBusyState('perfMetrics', true);
        updateMonitorWorkspaceStatus('监控指标正在刷新。');
    } else {
        renderPerfMetricsLoading();
    }
    try {
        const res = await fetch(`${API}/api/monitor/overview`);
        const json = await res.json();
        if (json.code === 200 && json.data) {
            const d = json.data;
            document.getElementById('monSessions').textContent = d.activeSessions || 0;

            if (d.jvm) {
                document.getElementById('monMaxMem').textContent = d.jvm.maxMemory || '-';
                document.getElementById('monUsedMem').textContent = d.jvm.usedMemory || '-';
                document.getElementById('monFreeMem').textContent = d.jvm.freeMemory || '-';
                document.getElementById('monCPU').textContent = d.jvm.availableProcessors || '-';

                // Memory bar
                const used = parseInt(d.jvm.usedMemory) || 0;
                const max = parseInt(d.jvm.maxMemory) || 1;
                const pct = Math.round((used / max) * 100);
                document.getElementById('memBar').style.width = pct + '%';
                document.getElementById('memPct').textContent = pct + '%';
            }

            if (d.knowledgeBase) {
                const kb = d.knowledgeBase;
                document.getElementById('monDocs').textContent = kb.totalDocuments || 0;
                document.getElementById('monChunks').textContent = kb.totalChunks || 0;
                document.getElementById('monCompleted').textContent = kb.completed || 0;
                document.getElementById('monFailed').textContent = kb.failed || 0;
            }

            updateHealthPanel(d);
            updateMonitorWorkspaceStatus();
        }
    } catch (e) { /* silent */ }

    // Performance metrics
    try {
        const res = await fetch(`${API}/api/monitor/metrics`);
        const json = await res.json();
        if (json.code === 200 && json.data) {
            state.monitorMetrics = json.data;
            applyMonitorMetricFilters();
        } else {
            throw new Error('monitor_metrics_unavailable');
        }
    } catch (e) {
        if (hadMetrics) {
            renderPerfMetrics(getFilteredMonitorMetrics());
            updateMonitorMetricSummary();
        } else {
            renderPerfMetricsState({
                title: '性能指标暂不可用',
                description: '监控服务正在准备性能数据，请稍后重试。',
                actionLabel: '重新加载',
                action: 'refreshMonitorPage()'
            });
            const summary = document.getElementById('perfMetricSummary');
            if (summary) summary.textContent = '性能指标暂不可用';
            updateMonitorWorkspaceStatus('性能指标暂不可用，请稍后重试。');
        }
    }
}

function toggleMonitorAutoRefresh() {
    state.monitorAutoRefresh = !state.monitorAutoRefresh;
    if (state.monitorAutoRefresh) {
        state.monitorRefreshIn = state.monitorRefreshInterval;
    }
    updateMonitorRefreshLabel();
    updateMonitorWorkspaceStatus();
    syncUrlState();
    toast(state.monitorAutoRefresh ? '已开启监控自动刷新' : '已关闭监控自动刷新', 'info');
    pushActivity('监控刷新策略更新', state.monitorAutoRefresh ? '已开启自动刷新监控数据。' : '已关闭自动刷新监控数据。', 'info');
}

function setMonitorRefreshInterval(value) {
    const interval = Number(value);
    if (![15, 30, 60].includes(interval)) return;
    state.monitorRefreshInterval = interval;
    state.monitorRefreshIn = interval;
    updateMonitorRefreshLabel();
    updateMonitorWorkspaceStatus();
    syncUrlState();
    toast(`监控自动刷新间隔已调整为 ${interval}s`, 'info');
}

function applyMonitorMetricFilters() {
    const searchInput = document.getElementById('perfMetricSearch');
    const sortSelect = document.getElementById('perfMetricSort');
    if (searchInput) state.monitorMetricSearch = searchInput.value.trim();
    if (sortSelect) state.monitorMetricSort = sortSelect.value || 'avg_desc';
    renderPerfMetrics(getFilteredMonitorMetrics());
    updateMonitorMetricSummary();
    updateMonitorWorkspaceStatus();
    syncUrlState();
}

function clearMonitorMetricFilters() {
    const searchInput = document.getElementById('perfMetricSearch');
    const sortSelect = document.getElementById('perfMetricSort');
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'avg_desc';
    state.monitorMetricSearch = '';
    state.monitorMetricSort = 'avg_desc';
    applyMonitorMetricFilters();
}

function getFilteredMonitorMetrics() {
    const keyword = state.monitorMetricSearch.trim().toLowerCase();
    return Object.entries(state.monitorMetrics || {})
        .filter(([method]) => !keyword || method.toLowerCase().includes(keyword))
        .sort((a, b) => compareMonitorMetricEntries(a, b, state.monitorMetricSort));
}

function compareMonitorMetricEntries([methodA, metricA], [methodB, metricB], sortOrder) {
    if (sortOrder === 'name_asc') {
        return methodA.localeCompare(methodB, 'zh-CN');
    }
    if (sortOrder === 'max_desc') {
        return (metricB.maxTime || 0) - (metricA.maxTime || 0);
    }
    if (sortOrder === 'calls_desc') {
        return (metricB.callCount || 0) - (metricA.callCount || 0);
    }
    return (metricB.avgTime || 0) - (metricA.avgTime || 0);
}

function updateMonitorMetricSummary() {
    const summary = document.getElementById('perfMetricSummary');
    if (!summary) return;
    const labelMap = {
        avg_desc: '按平均耗时排序',
        max_desc: '按峰值耗时排序',
        calls_desc: '按调用次数排序',
        name_asc: '按接口名称排序'
    };
    const count = getFilteredMonitorMetrics().length;
    summary.textContent = `${labelMap[state.monitorMetricSort] || labelMap.avg_desc} · ${count} 项`;
}

function updateMonitorWorkspaceStatus(customMessage = '') {
    const status = document.getElementById('monitorWorkspaceStatus');
    if (!status) return;

    if (customMessage) {
        status.textContent = customMessage;
        return;
    }

    const metricCount = getFilteredMonitorMetrics().length;
    const activityCount = getFilteredActivities().length;
    const activityLabel = state.activityToneFilter === 'all' ? '全部活动' : `${state.activityToneFilter} 活动`;

    status.textContent = `当前监控页面显示 ${metricCount} 项性能指标，活动流显示 ${activityLabel}共 ${activityCount} 条。${state.monitorAutoRefresh ? ` 自动刷新已开启，间隔 ${state.monitorRefreshInterval} 秒。` : ' 自动刷新已暂停。'}`;
}

function renderPerfMetrics(entries) {
    const container = document.getElementById('perfMetrics');
    setBusyState('perfMetrics', false);
    if (entries.length === 0) {
        container.innerHTML = state.monitorMetricSearch
            ? buildStateMarkup({
                title: '当前筛选条件下暂无性能数据',
                description: '可以重置筛选条件，或稍后等待新的监控指标进入视图。',
                actionLabel: '重置筛选',
                action: 'clearMonitorMetricFilters()',
                compact: true
            })
            : buildStateMarkup({
                title: '暂无性能数据',
                description: '待接口调用产生统计后，这里会展示可搜索、可排序的性能指标。',
                compact: true
            });
        updateMonitorWorkspaceStatus();
        return;
    }

    container.innerHTML = entries.slice(0, 10).map(([method, m]) => {
        const shortName = method.split('.').pop();
        return `
            <div class="monitor-metric">
                <span class="monitor-metric-label" title="${escapeHtml(method)}">${escapeHtml(shortName)}</span>
                <span class="monitor-metric-value">${m.callCount || 0}次 · 平均${m.avgTime || 0}ms · 峰值${m.maxTime || 0}ms</span>
            </div>`;
    }).join('');
    updateMonitorWorkspaceStatus();
}

// ========== Stats ==========
async function refreshStats() {
    try {
        const [chatRes, kbRes] = await Promise.all([
            fetch(`${API}/api/chat/status`).then(r => r.json()).catch(() => null),
            fetch(`${API}/api/knowledge/statistics`).then(r => r.json()).catch(() => null)
        ]);

        if (chatRes?.data) {
            state.activeSessions = chatRes.data.activeSessions || 0;
            if (state.currentPage === 'monitor') {
                document.getElementById('monSessions').textContent = chatRes.data.activeSessions || 0;
            }
        }
        if (kbRes?.data) {
            state.totalDocs = kbRes.data.totalDocuments || 0;
            if (state.currentPage === 'knowledge') {
                document.getElementById('kbTotalDocs').textContent = kbRes.data.totalDocuments || 0;
                document.getElementById('kbCompleted').textContent = kbRes.data.completed || 0;
                document.getElementById('kbProcessing').textContent = kbRes.data.processing || 0;
                document.getElementById('kbTotalChunks').textContent = kbRes.data.totalChunks || 0;
            }
        }
        updateWorkspaceSummary();
    } catch (e) { /* silent */ }
}

// ========== Toast ==========
function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const id = 'toast-' + Date.now();
    const iconMap = {
        success: '<svg width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    container.insertAdjacentHTML('beforeend', `
        <div class="toast ${type}" id="${id}">
            <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
            <span class="toast-msg">${escapeHtml(msg)}</span>
        </div>
    `);
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }
    }, 3500);
}

// ========== Helpers ==========
function setBusyState(target, busy) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    element.setAttribute('aria-busy', busy ? 'true' : 'false');
}

function buildStateMarkup({ title, description = '', actionLabel = '', action = '', compact = false }) {
    return `
        <div class="ui-state ${compact ? 'compact' : ''}">
            <strong>${escapeHtml(title)}</strong>
            ${description ? `<p>${escapeHtml(description)}</p>` : ''}
            ${actionLabel && action ? `<div class="ui-state-actions"><button type="button" class="btn btn-ghost" onclick="${action}">${escapeHtml(actionLabel)}</button></div>` : ''}
        </div>`;
}

function renderSessionListLoading() {
    const list = document.getElementById('sessionList');
    if (!list) return;
    setBusyState(list, true);
    const meta = document.getElementById('sessionListMeta');
    const status = document.getElementById('sessionListStatus');
    if (meta) meta.textContent = '正在同步历史会话';
    if (status) status.textContent = '历史会话正在同步。';
    list.innerHTML = `
        <div class="session-skeleton-stack">
            ${Array.from({ length: 5 }, () => `
                <div class="session-skeleton-item">
                    <span class="skeleton skeleton-square"></span>
                    <span style="flex:1;display:flex;flex-direction:column;gap:8px">
                        <span class="skeleton skeleton-line lg"></span>
                        <span class="skeleton skeleton-line sm"></span>
                    </span>
                </div>`).join('')}
        </div>`;
}

function renderSessionListState(options) {
    const list = document.getElementById('sessionList');
    if (!list) return;
    setBusyState(list, false);
    const meta = document.getElementById('sessionListMeta');
    const status = document.getElementById('sessionListStatus');
    if (meta) meta.textContent = options.title;
    if (status) status.textContent = `${options.title}${options.description ? `，${options.description}` : ''}`;
    list.innerHTML = buildStateMarkup(options);
}

function renderKnowledgeTableLoading() {
    const tbody = document.getElementById('kbTableBody');
    if (!tbody) return;
    setBusyState('kbTableRegion', true);
    const status = document.getElementById('kbWorkspaceStatus');
    if (status) status.textContent = '知识文档正在加载。';
    tbody.innerHTML = Array.from({ length: 4 }, () => `
        <tr class="kb-skeleton-row">
            <td><span class="skeleton skeleton-square"></span></td>
            <td>
                <div class="kb-skeleton-main">
                    <span class="skeleton skeleton-line lg"></span>
                    <span class="skeleton skeleton-line md"></span>
                </div>
            </td>
            <td><span class="skeleton skeleton-line sm"></span></td>
            <td><span class="skeleton skeleton-line sm"></span></td>
            <td><span class="skeleton skeleton-line sm"></span></td>
            <td><span class="skeleton skeleton-line md"></span></td>
            <td><span class="skeleton skeleton-square"></span></td>
        </tr>`).join('');
}

function renderKnowledgeTableState(options) {
    const tbody = document.getElementById('kbTableBody');
    if (!tbody) return;
    setBusyState('kbTableRegion', false);
    const status = document.getElementById('kbWorkspaceStatus');
    if (status) status.textContent = `${options.title}${options.description ? `，${options.description}` : ''}`;
    tbody.innerHTML = `
        <tr class="kb-state-row">
            <td colspan="7" class="kb-state-cell">${buildStateMarkup({ ...options, compact: true })}</td>
        </tr>`;
}

function renderPerfMetricsLoading() {
    const container = document.getElementById('perfMetrics');
    if (!container) return;
    setBusyState(container, true);
    updateMonitorWorkspaceStatus('性能指标正在加载。');
    container.innerHTML = `
        <div class="monitor-skeleton-stack">
            ${Array.from({ length: 5 }, () => `
                <div class="monitor-skeleton-item">
                    <span class="skeleton skeleton-line md"></span>
                    <span class="skeleton skeleton-line sm"></span>
                </div>`).join('')}
        </div>`;
}

function renderPerfMetricsState(options) {
    const container = document.getElementById('perfMetrics');
    if (!container) return;
    setBusyState(container, false);
    updateMonitorWorkspaceStatus(`${options.title}${options.description ? `，${options.description}` : ''}`);
    container.innerHTML = buildStateMarkup({ ...options, compact: true });
}

function autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

function updateDraftState() {
    const ta = document.getElementById('chatInput');
    const text = ta?.value || '';
    localStorage.setItem(DRAFT_KEY, text);

    const count = document.getElementById('draftCount');
    const hint = document.getElementById('draftHint');
    if (count) count.textContent = `${text.length} 字`;
    if (hint) {
        hint.textContent = text.length > 120 ? '内容较长，建议分点提问以获得更稳定答案' : '支持 Enter 发送 / Ctrl+K 快捷操作';
    }
}

function restoreDraft() {
    const text = localStorage.getItem(DRAFT_KEY) || '';
    const ta = document.getElementById('chatInput');
    if (!ta) return;
    ta.value = text;
    autoResize(ta);
    updateDraftState();
}

function setComposerStatus(text, hint) {
    const status = document.getElementById('composerStatus');
    const draftHint = document.getElementById('draftHint');
    if (status) status.textContent = text;
    if (hint && draftHint) draftHint.textContent = hint;
}

function updateWorkspaceClock() {
    const el = document.getElementById('workspaceLiveTime');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateWorkspaceSummary() {
    const configs = {
        chat: {
            title: '欢迎使用 SmartCS 企业工作台',
            subtitle: '在一个界面中完成对话协同、知识沉淀与系统观测，提升客服与运营效率。',
            badge: '智能对话中'
        },
        knowledge: {
            title: '知识资产正在沉淀与增值',
            subtitle: '通过文档上传、文本录入与统一筛选能力，持续扩展企业知识库覆盖面。',
            badge: '知识库运营'
        },
        monitor: {
            title: '系统运行态势尽在掌控',
            subtitle: '通过监控指标、健康评分与活动流，快速掌握当前服务状态与瓶颈。',
            badge: '实时监控'
        }
    };

    const config = configs[state.currentPage] || configs.chat;
    const capabilities = [state.enableRag ? 'RAG' : null, state.enableFC ? 'Function' : null].filter(Boolean);

    document.getElementById('workspaceTitle').textContent = config.title;
    document.getElementById('workspaceSubtitle').textContent = config.subtitle;
    document.getElementById('workspaceModeBadge').textContent = config.badge;
    document.getElementById('workspaceSessions').textContent = state.activeSessions || 0;
    document.getElementById('workspaceDocs').textContent = state.totalDocs || 0;
    document.getElementById('workspaceLatency').textContent = state.lastCostTime ? `${state.lastCostTime}ms` : '--';
    document.getElementById('workspaceCapabilities').textContent = capabilities.length ? capabilities.join(' · ') : '基础问答';
}

function pushActivity(title, description, tone = 'info') {
    state.activityFeed.unshift({ title, description, tone, time: Date.now() });
    state.activityFeed = state.activityFeed.slice(0, 8);
    renderActivityFeed();
}

function getFilteredActivities() {
    return state.activityToneFilter === 'all'
        ? state.activityFeed
        : state.activityFeed.filter(item => item.tone === state.activityToneFilter);
}

function updateActivityFilter(value) {
    state.activityToneFilter = value || 'all';
    const filter = document.getElementById('activityToneFilter');
    if (filter && filter.value !== state.activityToneFilter) {
        filter.value = state.activityToneFilter;
    }
    renderActivityFeed();
    syncUrlState();
}

function requestClearActivityFeed() {
    openConfirmModal({
        title: '清空活动流',
        description: '确认清空当前工作台活动流记录？该操作仅影响当前页面中的前端活动视图。',
        actionLabel: '确认清空',
        onConfirm: () => clearActivityFeed()
    });
}

function clearActivityFeed() {
    state.activityFeed = [];
    renderActivityFeed();
    toast('活动流已清空', 'info');
}

function renderActivityFeed() {
    const feed = document.getElementById('activityFeed');
    const meta = document.getElementById('activityFeedMeta');
    if (!feed) return;

    const activities = getFilteredActivities();
    const filterLabelMap = {
        all: '显示全部活动',
        info: '仅显示信息活动',
        success: '仅显示成功活动',
        warning: '仅显示预警活动'
    };
    if (meta) {
        meta.textContent = `${filterLabelMap[state.activityToneFilter] || filterLabelMap.all} · ${activities.length} 条`;
    }

    if (!activities.length) {
        feed.innerHTML = state.activityFeed.length
            ? '<div class="activity-empty">当前筛选条件下暂无活动记录</div>'
            : '<div class="activity-empty">暂无活动记录</div>';
        updateMonitorWorkspaceStatus();
        return;
    }

    feed.innerHTML = activities.map(item => `
        <div class="activity-item">
            <span class="activity-dot ${item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : ''}"></span>
            <div class="activity-content">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.description)}</p>
                <div class="activity-meta">${formatRelativeTime(item.time)}</div>
            </div>
        </div>
    `).join('');
    updateMonitorWorkspaceStatus();
}

function formatRelativeTime(time) {
    const diff = Math.max(0, Math.round((Date.now() - time) / 1000));
    if (diff < 5) return '刚刚';
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    return `${Math.floor(diff / 3600)} 小时前`;
}

function updateHealthPanel(overview) {
    const kb = overview.knowledgeBase || {};
    const jvm = overview.jvm || {};
    const used = parseInt(jvm.usedMemory, 10) || 0;
    const max = parseInt(jvm.maxMemory, 10) || 1;
    const memUsage = Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
    let score = 100 - Math.min(45, Math.max(0, memUsage - 55));
    score -= Math.min(25, (kb.failed || 0) * 8);
    score -= Math.min(12, Math.max(0, (kb.processing || 0) - 3) * 3);
    score = Math.max(35, Math.min(100, score));

    const badge = document.getElementById('healthBadge');
    const scoreEl = document.getElementById('healthScore');
    const summary = document.getElementById('healthSummary');
    const bar = document.getElementById('healthBar');

    if (scoreEl) scoreEl.textContent = score;
    if (bar) bar.style.width = `${score}%`;

    if (badge) {
        badge.textContent = score >= 85 ? '稳定' : score >= 70 ? '关注中' : '需优化';
        badge.style.background = score >= 85 ? 'rgba(34,197,94,0.14)' : score >= 70 ? 'rgba(245,158,11,0.14)' : 'rgba(239,68,68,0.14)';
        badge.style.color = score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--warning)' : 'var(--danger)';
    }

    if (summary) {
        summary.textContent = score >= 85
            ? `内存使用约 ${memUsage}% ，整体状态稳定，适合继续联调与演示。`
            : score >= 70
                ? `当前内存使用约 ${memUsage}% ，建议关注知识处理堆积与性能指标。`
                : `当前健康评分偏低，建议优先检查内存占用、失败任务和接口性能。`;
    }
}

function tickMonitorRefresh() {
    if (!state.monitorAutoRefresh) {
        updateMonitorRefreshLabel();
        return;
    }

    state.monitorRefreshIn -= 1;
    if (state.monitorRefreshIn <= 0) {
        state.monitorRefreshIn = state.monitorRefreshInterval;
        if (state.currentPage === 'monitor') {
            refreshMonitorPage();
        }
    }
    updateMonitorRefreshLabel();
}

function updateMonitorRefreshLabel() {
    const label = document.getElementById('monitorAutoRefreshLabel');
    const hint = document.getElementById('monitorRefreshHint');
    const select = document.getElementById('monitorRefreshInterval');
    if (label) label.textContent = state.monitorAutoRefresh ? '自动刷新 ON' : '自动刷新 OFF';
    if (hint) hint.textContent = state.monitorAutoRefresh ? `下次自动刷新：${state.monitorRefreshIn}s · 当前间隔 ${state.monitorRefreshInterval}s` : '自动刷新已暂停';
    if (select) select.value = String(state.monitorRefreshInterval);
}

function initCommandPalette() {
    const input = document.getElementById('commandInput');
    if (!input) return;
    input.addEventListener('input', () => {
        state.commandActiveIndex = 0;
        renderCommandPalette();
    });
    input.addEventListener('keydown', handleCommandPaletteInputKeydown);
    renderCommandPalette();
}

function getCommandItems() {
    return [
        {
            title: '新建对话',
            description: '快速开始一个新的会话。',
            shortcut: 'N',
            keywords: '新建 对话 聊天 session',
            run: () => newSession()
        },
        {
            title: '切换到智能对话',
            description: '进入聊天工作台页面。',
            shortcut: 'Chat',
            keywords: '聊天 chat page',
            run: () => switchPage('chat')
        },
        {
            title: '切换到知识库',
            description: '管理知识文档与筛选信息。',
            shortcut: 'KB',
            keywords: '知识库 文档 knowledge',
            run: () => switchPage('knowledge')
        },
        {
            title: '切换到系统监控',
            description: '查看系统概览、健康评分和活动流。',
            shortcut: 'Mon',
            keywords: '监控 monitor metrics',
            run: () => switchPage('monitor')
        },
        {
            title: '上传知识文档',
            description: '打开知识上传弹窗。',
            shortcut: 'Upload',
            keywords: '上传 文档 knowledge upload',
            run: () => showUploadModal()
        },
        {
            title: '导出当前对话',
            description: '将当前聊天记录导出为本地文本。',
            shortcut: 'Export',
            keywords: '导出 export chat',
            run: () => exportChat()
        },
        {
            title: '清空会话筛选',
            description: '清除左侧历史会话搜索条件。',
            shortcut: 'Clear',
            keywords: '会话 搜索 筛选 清空 session filter',
            run: () => clearSessionSearch()
        },
        {
            title: '查看收藏会话',
            description: '切换到收藏会话视图。',
            shortcut: 'Pinned',
            keywords: '会话 收藏 pinned favorite',
            run: () => setSessionView('pinned')
        },
        {
            title: '查看归档会话',
            description: '切换到归档会话视图。',
            shortcut: 'Archive',
            keywords: '会话 归档 archived session',
            run: () => setSessionView('archived')
        },
        {
            title: state.sessionId && isPinnedSession(state.sessionId) ? '取消收藏当前会话' : '收藏当前会话',
            description: '将当前正在查看的会话加入或移出收藏。',
            shortcut: 'Star',
            keywords: '当前 会话 收藏 取消收藏 pin current',
            run: () => toggleCurrentSessionPin()
        },
        {
            title: state.sessionId && isArchivedSession(state.sessionId) ? '移出归档当前会话' : '归档当前会话',
            description: '归档当前会话，便于治理历史列表。',
            shortcut: 'Box',
            keywords: '当前 会话 归档 archive current',
            run: () => toggleCurrentSessionArchive()
        },
        {
            title: '切换监控自动刷新',
            description: '开启或关闭监控面板自动刷新。',
            shortcut: 'Auto',
            keywords: '监控 自动 刷新 auto refresh',
            run: () => toggleMonitorAutoRefresh()
        },
        {
            title: '设置监控为 30 秒刷新',
            description: '将监控自动刷新间隔调整为 30 秒。',
            shortcut: '30s',
            keywords: '监控 刷新 30秒 interval 30',
            run: () => setMonitorRefreshInterval(30)
        },
        {
            title: '设置监控为 60 秒刷新',
            description: '将监控自动刷新间隔调整为 60 秒。',
            shortcut: '60s',
            keywords: '监控 刷新 60秒 interval 60',
            run: () => setMonitorRefreshInterval(60)
        },
        {
            title: '查看预警活动',
            description: '将活动流筛选为预警项。',
            shortcut: 'Warn',
            keywords: '活动 预警 warning activity',
            run: () => {
                switchPage('monitor');
                updateActivityFilter('warning');
            }
        },
        {
            title: '清空活动流',
            description: '清空当前前端活动流视图。',
            shortcut: 'Flush',
            keywords: '活动 清空 feed clear',
            run: () => {
                switchPage('monitor');
                requestClearActivityFeed();
            }
        },
        {
            title: state.enableRag ? '关闭 RAG 检索' : '开启 RAG 检索',
            description: '控制知识增强能力是否参与回答。',
            shortcut: 'RAG',
            keywords: 'rag 检索 capability',
            run: () => toggleCapability('rag')
        },
        {
            title: state.enableFC ? '关闭业务查询' : '开启业务查询',
            description: '控制业务函数查询能力。',
            shortcut: 'Func',
            keywords: 'function fc 业务查询',
            run: () => toggleCapability('fc')
        },
        {
            title: '切换主题',
            description: '在浅色与深色主题间切换。',
            shortcut: 'Theme',
            keywords: '主题 深色 浅色 dark light',
            run: () => toggleTheme()
        },
        {
            title: '刷新监控数据',
            description: '立即刷新系统监控与性能指标。',
            shortcut: 'Refresh',
            keywords: '监控 刷新 metrics overview',
            run: () => refreshMonitorPage()
        },
        {
            title: '重置性能指标',
            description: '清空当前接口性能统计。',
            shortcut: 'Reset',
            keywords: '监控 重置 reset metrics',
            run: () => requestResetMetrics()
        }
    ];
}

function openCommandPalette() {
    const modal = document.getElementById('commandPalette');
    const input = document.getElementById('commandInput');
    if (!modal || !input) return;
    openModal('commandPalette');
    input.value = '';
    state.commandActiveIndex = 0;
    renderCommandPalette();
    setTimeout(() => focusModalElement('commandPalette', '#commandInput'), 30);
}

function closeCommandPalette() {
    const input = document.getElementById('commandInput');
    if (input) {
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }
    closeModal('commandPalette');
}

function handleCommandPaletteBackdrop(event) {
    if (event.target.id === 'commandPalette') {
        closeCommandPalette();
    }
}

function handleCommandPaletteInputKeydown(event) {
    if (getActiveModalId() !== 'commandPalette') return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        state.commandActiveIndex = Math.min(state.commandActiveIndex + 1, Math.max(0, state.commandResults.length - 1));
        renderCommandPalette();
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        state.commandActiveIndex = Math.max(0, state.commandActiveIndex - 1);
        renderCommandPalette();
        return;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        event.stopPropagation();
        state.commandActiveIndex = 0;
        renderCommandPalette();
        return;
    }

    if (event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        state.commandActiveIndex = Math.max(0, state.commandResults.length - 1);
        renderCommandPalette();
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        executeCommand(state.commandActiveIndex);
    }
}

function getCommandOptionId(index) {
    return `command-option-${index}`;
}

function syncCommandPaletteAccessibility(query, totalCount) {
    const input = document.getElementById('commandInput');
    const resultsMeta = document.getElementById('commandResultsMeta');
    const resultStatus = document.getElementById('commandResultStatus');
    if (!input) return;

    const isPaletteOpen = getActiveModalId() === 'commandPalette';
    input.setAttribute('aria-expanded', isPaletteOpen ? 'true' : 'false');

    if (isPaletteOpen && state.commandResults.length) {
        input.setAttribute('aria-activedescendant', getCommandOptionId(state.commandActiveIndex));
    } else {
        input.removeAttribute('aria-activedescendant');
    }

    if (resultsMeta) {
        resultsMeta.textContent = query
            ? `匹配 ${state.commandResults.length} / ${totalCount} 条快捷命令`
            : `显示全部 ${totalCount} 条快捷命令`;
    }

    if (resultStatus) {
        if (!state.commandResults.length) {
            resultStatus.textContent = query
                ? `没有找到与“${query}”相关的快捷命令。`
                : '当前没有可用的快捷命令。';
            return;
        }

        resultStatus.textContent = query
            ? `已找到 ${state.commandResults.length} 条与“${query}”相关的快捷命令，当前高亮第 ${state.commandActiveIndex + 1} 项。`
            : `已显示 ${state.commandResults.length} 条快捷命令，当前高亮第 ${state.commandActiveIndex + 1} 项。`;
    }
}

function ensureActiveCommandVisible() {
    if (getActiveModalId() !== 'commandPalette') return;
    const activeOption = document.getElementById(getCommandOptionId(state.commandActiveIndex));
    activeOption?.scrollIntoView({ block: 'nearest' });
}

function previewCommandOption(index) {
    if (index === state.commandActiveIndex) return;
    state.commandActiveIndex = index;
    document.querySelectorAll('#commandResults .command-item').forEach((button, buttonIndex) => {
        const active = buttonIndex === index;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    syncCommandPaletteAccessibility(document.getElementById('commandInput')?.value?.trim() || '', getCommandItems().length);
}

function renderCommandPalette() {
    const results = document.getElementById('commandResults');
    const input = document.getElementById('commandInput');
    if (!results || !input) return;

    const query = input.value.trim();
    const normalizedQuery = query.toLowerCase();
    const commandItems = getCommandItems();
    state.commandResults = commandItems.filter(item => {
        return !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery) || item.description.toLowerCase().includes(normalizedQuery) || item.keywords.includes(normalizedQuery);
    });

    if (state.commandActiveIndex >= state.commandResults.length) {
        state.commandActiveIndex = 0;
    }

    syncCommandPaletteAccessibility(query, commandItems.length);

    if (!state.commandResults.length) {
        results.innerHTML = '<div class="activity-empty" style="padding:20px" role="status">没有匹配的快捷命令</div>';
        return;
    }

    results.innerHTML = state.commandResults.map((item, index) => `
        <button id="${getCommandOptionId(index)}" type="button" role="option" aria-selected="${index === state.commandActiveIndex ? 'true' : 'false'}" tabindex="-1" class="command-item ${index === state.commandActiveIndex ? 'active' : ''}" onclick="executeCommand(${index})" onmouseenter="previewCommandOption(${index})">
            <div class="command-item-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.description)}</span>
            </div>
            <span class="command-item-shortcut">${escapeHtml(item.shortcut)}</span>
        </button>
    `).join('');

    ensureActiveCommandVisible();
}

function executeCommand(index) {
    const item = state.commandResults[index];
    if (!item) return;
    closeCommandPalette();
    item.run();
}

function handleGlobalShortcuts(event) {
    const activeModalId = getActiveModalId();
    const paletteOpen = activeModalId === 'commandPalette';
    const confirmOpen = activeModalId === 'confirmModal';
    const uploadOpen = activeModalId === 'uploadModal';

    if (activeModalId) {
        trapFocusWithinModal(event);
        if (event.key === 'Tab') return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (activeModalId && !paletteOpen) return;
        if (paletteOpen) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
        return;
    }

    if (event.key === 'Escape') {
        if (paletteOpen) {
            closeCommandPalette();
            return;
        }
        if (confirmOpen) {
            closeConfirmModal();
            return;
        }
        if (uploadOpen) {
            hideUploadModal();
            return;
        }
    }
}

function getActiveModalId() {
    if (!state.activeModalId) return null;
    const modal = document.getElementById(state.activeModalId);
    if (!modal || !modal.classList.contains('show')) {
        state.activeModalId = null;
        return null;
    }
    return state.activeModalId;
}

function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(MODAL_FOCUSABLE_SELECTOR))
        .filter(element => element.getClientRects().length > 0);
}

function focusModalElement(modalId, selector = '') {
    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains('show')) return;
    const container = modal.querySelector('[role="document"]') || modal;
    const focusableElements = getFocusableElements(container);
    const preferredElement = selector ? modal.querySelector(selector) : modal.querySelector('[data-modal-primary="true"]');
    const nextFocus = preferredElement && focusableElements.includes(preferredElement)
        ? preferredElement
        : focusableElements[0] || container;
    nextFocus?.focus();
}

function trapFocusWithinModal(event) {
    if (event.key !== 'Tab') return;
    const activeModalId = getActiveModalId();
    if (!activeModalId) return;

    const modal = document.getElementById(activeModalId);
    const container = modal?.querySelector('[role="document"]') || modal;
    if (!container) return;

    const focusableElements = getFocusableElements(container);
    if (!focusableElements.length) {
        event.preventDefault();
        container.focus();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (!container.contains(activeElement) || activeElement === container) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
    }

    if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function enforceActiveModalFocus(event) {
    const activeModalId = getActiveModalId();
    if (!activeModalId) return;
    const modal = document.getElementById(activeModalId);
    if (!modal || modal.contains(event.target)) return;
    focusModalElement(activeModalId);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    state.modalRestoreFocus = document.activeElement;
    state.activeModalId = id;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (state.activeModalId === id) {
        state.activeModalId = null;
    }
    const restoreTarget = state.modalRestoreFocus;
    state.modalRestoreFocus = null;
    if (restoreTarget && typeof restoreTarget.focus === 'function' && document.body.contains(restoreTarget)) {
        restoreTarget.focus();
    }
}

function openConfirmModal({ title, description, actionLabel, onConfirm }) {
    state.pendingConfirmAction = onConfirm;
    document.getElementById('confirmModalTitle').textContent = title || '确认操作';
    document.getElementById('confirmModalDescription').textContent = description || '确认执行当前操作？';
    document.getElementById('confirmModalAction').textContent = actionLabel || '确认';
    openModal('confirmModal');
    setTimeout(() => focusModalElement('confirmModal', '#confirmModalAction'), 30);
}

function closeConfirmModal() {
    state.pendingConfirmAction = null;
    closeModal('confirmModal');
}

function runConfirmAction() {
    const action = state.pendingConfirmAction;
    closeConfirmModal();
    if (typeof action === 'function') {
        action();
    }
}

function handleConfirmBackdrop(event) {
    if (event.target.id === 'confirmModal') {
        closeConfirmModal();
    }
}

function hydrateStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page && ['chat', 'knowledge', 'monitor'].includes(page)) {
        state.currentPage = page;
    }

    const sessionView = params.get('sessionView');
    if (sessionView && ['all', 'pinned', 'archived'].includes(sessionView)) {
        state.sessionView = sessionView;
    }

    const sessionSearch = params.get('sessionSearch');
    if (sessionSearch) {
        state.sessionSearchKeyword = sessionSearch;
    }

    const activityTone = params.get('activityTone');
    if (activityTone && ['all', 'info', 'success', 'warning'].includes(activityTone)) {
        state.activityToneFilter = activityTone;
    }

    const monitorAuto = params.get('monitorAuto');
    if (monitorAuto === 'off') {
        state.monitorAutoRefresh = false;
    }

    const monitorInterval = params.get('monitorInterval');
    if (monitorInterval && ['15', '30', '60'].includes(monitorInterval)) {
        state.monitorRefreshInterval = Number(monitorInterval);
        state.monitorRefreshIn = Number(monitorInterval);
    }

    const metricSearch = params.get('metricSearch');
    if (metricSearch) {
        state.monitorMetricSearch = metricSearch;
    }

    const metricSort = params.get('metricSort');
    if (metricSort && ['avg_desc', 'max_desc', 'calls_desc', 'name_asc'].includes(metricSort)) {
        state.monitorMetricSort = metricSort;
    }

    const kbSearch = params.get('kbSearch');
    const kbStatus = params.get('kbStatus');
    const kbSort = params.get('kbSort');
    const activeDocId = params.get('docId');
    if (kbSort && ['updated_desc', 'created_desc', 'chunks_desc', 'name_asc'].includes(kbSort)) {
        state.knowledgeSortOrder = kbSort;
    }
    if (activeDocId) {
        state.activeKnowledgeDocId = activeDocId;
    }
    const activityToneFilter = document.getElementById('activityToneFilter');
    const monitorRefreshInterval = document.getElementById('monitorRefreshInterval');
    const perfMetricSearch = document.getElementById('perfMetricSearch');
    const perfMetricSort = document.getElementById('perfMetricSort');
    const sessionSearchInput = document.getElementById('sessionSearchInput');
    const kbSearchInput = document.getElementById('kbSearchInput');
    const kbStatusFilter = document.getElementById('kbStatusFilter');
    const kbSortOrder = document.getElementById('kbSortOrder');
    if (activityToneFilter) activityToneFilter.value = state.activityToneFilter;
    if (monitorRefreshInterval) monitorRefreshInterval.value = String(state.monitorRefreshInterval);
    if (perfMetricSearch) perfMetricSearch.value = state.monitorMetricSearch;
    if (perfMetricSort) perfMetricSort.value = state.monitorMetricSort;
    if (sessionSearchInput && sessionSearch) sessionSearchInput.value = sessionSearch;
    if (kbSearchInput && kbSearch) kbSearchInput.value = kbSearch;
    if (kbStatusFilter && kbStatus) kbStatusFilter.value = kbStatus;
    if (kbSortOrder) kbSortOrder.value = state.knowledgeSortOrder;
    syncSessionViewSwitch();
}

function syncUrlState() {
    const url = new URL(window.location.href);
    url.searchParams.set('page', state.currentPage);

    if (state.sessionView && state.sessionView !== 'all') url.searchParams.set('sessionView', state.sessionView);
    else url.searchParams.delete('sessionView');

    const sessionSearch = state.sessionSearchKeyword.trim();
    if (sessionSearch) url.searchParams.set('sessionSearch', sessionSearch);
    else url.searchParams.delete('sessionSearch');

    if (state.activityToneFilter && state.activityToneFilter !== 'all') url.searchParams.set('activityTone', state.activityToneFilter);
    else url.searchParams.delete('activityTone');

    if (!state.monitorAutoRefresh) url.searchParams.set('monitorAuto', 'off');
    else url.searchParams.delete('monitorAuto');

    if (state.monitorRefreshInterval && state.monitorRefreshInterval !== 15) url.searchParams.set('monitorInterval', String(state.monitorRefreshInterval));
    else url.searchParams.delete('monitorInterval');

    if (state.monitorMetricSearch.trim()) url.searchParams.set('metricSearch', state.monitorMetricSearch.trim());
    else url.searchParams.delete('metricSearch');

    if (state.monitorMetricSort && state.monitorMetricSort !== 'avg_desc') url.searchParams.set('metricSort', state.monitorMetricSort);
    else url.searchParams.delete('metricSort');

    const kbSearch = document.getElementById('kbSearchInput')?.value?.trim();
    const kbStatus = document.getElementById('kbStatusFilter')?.value;
    const kbSort = getKnowledgeSortOrder();
    if (kbSearch) url.searchParams.set('kbSearch', kbSearch);
    else url.searchParams.delete('kbSearch');

    if (kbStatus && kbStatus !== 'all') url.searchParams.set('kbStatus', kbStatus);
    else url.searchParams.delete('kbStatus');

    if (kbSort && kbSort !== 'updated_desc') url.searchParams.set('kbSort', kbSort);
    else url.searchParams.delete('kbSort');

    if (state.activeKnowledgeDocId) url.searchParams.set('docId', state.activeKnowledgeDocId);
    else url.searchParams.delete('docId');

    history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`.replace(/\?$/, ''));
}

function handleBeforeUnload(event) {
    const draft = document.getElementById('chatInput')?.value?.trim();
    if (!draft) return;
    event.preventDefault();
    event.returnValue = '';
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function renderMarkdown(content) {
    if (!content) return '';

    const normalized = escapeHtml(content).replace(/\r\n?/g, '\n');
    const codeBlocks = [];
    const protectedText = normalized.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
        const language = (lang || 'text').trim();
        codeBlocks.push(
            `<pre><code class="lang-${language}">${code.trim()}</code></pre>`
        );
        return token;
    });

    const lines = protectedText.split('\n');
    const blocks = [];
    let paragraph = [];
    let listItems = [];
    let listType = null;
    let quoteLines = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        blocks.push(`<p>${paragraph.map(line => renderInlineMarkdown(line)).join('<br>')}</p>`);
        paragraph = [];
    };

    const flushList = () => {
        if (!listItems.length || !listType) return;
        blocks.push(`<${listType}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${listType}>`);
        listItems = [];
        listType = null;
    };

    const flushQuote = () => {
        if (!quoteLines.length) return;
        blocks.push(`<blockquote>${quoteLines.map(line => renderInlineMarkdown(line)).join('<br>')}</blockquote>`);
        quoteLines = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushList();
            flushQuote();
            continue;
        }

        if (/^@@CODE_BLOCK_\d+@@$/.test(line)) {
            flushParagraph();
            flushList();
            flushQuote();
            blocks.push(line);
            continue;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            flushQuote();
            const level = headingMatch[1].length;
            blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
            continue;
        }

        const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            flushQuote();
            if (listType && listType !== 'ul') {
                flushList();
            }
            listType = 'ul';
            listItems.push(unorderedMatch[1]);
            continue;
        }

        const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            flushQuote();
            if (listType && listType !== 'ol') {
                flushList();
            }
            listType = 'ol';
            listItems.push(orderedMatch[1]);
            continue;
        }

        const quoteMatch = line.match(/^>\s?(.*)$/);
        if (quoteMatch) {
            flushParagraph();
            flushList();
            quoteLines.push(quoteMatch[1]);
            continue;
        }

        flushQuote();
        paragraph.push(line);
    }

    flushParagraph();
    flushList();
    flushQuote();

    return blocks
        .join('')
        .replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)] || '');
}

function renderInlineMarkdown(text) {
    return text
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
}

// ========== SVG Icons ==========
const icons = {
    bot: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>',
    user: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    plus: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    menu: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    send: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    moon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    copy: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    thumbUp: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    thumbDown: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
    msgCircle: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    x14: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    db14: '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    zap14: '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    file14: '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chevron: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
    upload: '<svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    fileCheck: '<svg width="40" height="40" fill="none" stroke="#22c55e" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>',
    trash: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    download: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    chat: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    db: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    activity: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    uploadBtn: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    x: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};
