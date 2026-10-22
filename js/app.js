/* =============================================================
 * app.js — 界面与交互逻辑
 * 视图：首页 / 练习 / 错题本 / 统计（单页切换，无路由）
 * 练习流程：随机出题 -> 键盘/实体键输入 -> 即时校验 ->
 *           答对自动下一题，答错记入错题本并展示正确答案
 * ============================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 视图切换 ---------- */
  var VIEWS = ['home', 'practice', 'wrong', 'stats'];
  var currentView = 'home';

  function show(name) {
    VIEWS.forEach(function (v) {
      $('view-' + v).classList.toggle('active', v === name);
    });
    currentView = name;
    window.scrollTo(0, 0);
  }

  /* ---------- 难度推荐：按各级正确率自动匹配 ---------- */
  function recommendLevel() {
    var stats = Store.getStats();
    if (stats.overall.attempted < 10) return 1;
    for (var i = 1; i <= QGen.LEVELS.length; i++) {
      var st = stats.byLevel[i];
      if (!st || st.attempted < 10) return i;      // 该级练习量不足，从这里练起
      if (st.correct / st.attempted < 0.85) return i; // 尚未熟练，继续练本级
    }
    return QGen.LEVELS.length;
  }

  function levelStat(id) {
    var st = Store.getStats().byLevel[id];
    return st || { attempted: 0, correct: 0 };
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    var list = $('level-list');
    list.innerHTML = '';
    var rec = recommendLevel();

    QGen.LEVELS.forEach(function (lv) {
      var st = levelStat(lv.id);
      var acc = st.attempted ? Math.round(st.correct / st.attempted * 100) : null;
      var card = document.createElement('button');
      card.className = 'level-card c' + lv.id;
      card.innerHTML =
        '<span class="lv-num">' + lv.id + '</span>' +
        '<span class="lv-info">' +
          '<span class="lv-name">' + lv.name +
            (lv.id === rec ? '<i class="lv-rec">推荐</i>' : '') +
          '</span>' +
          '<span class="lv-desc">' + lv.desc + '</span>' +
          '<span class="lv-meta">' + (acc === null ? '未开始' : '已练 ' + st.attempted + ' 题 · 正确率 ' + acc + '%') + '</span>' +
        '</span>' +
        '<span class="lv-tag">' + lv.tag + '</span>';
      card.addEventListener('click', function () { startPractice(lv.id); });
      list.appendChild(card);
    });

    $('wrong-count').textContent = Store.getWrong().length;
  }

  /* ---------- 练习状态 ---------- */
  var P = {
    mode: 'normal',   // normal 普通练习 | wrong 错题重练
    levelId: 1,
    queue: [],        // 错题重练的题目队列
    qi: 0,
    cur: null,        // 当前题 {text, answer, answerText, level}
    input: '',
    locked: false,    // 提交后锁定键盘
    finished: false,  // 错题重练完成
    sessionId: 0,     // 会话序号，用于失效旧的自动跳题定时器
    answered: 0, correct: 0, streak: 0, history: []
  };

  function resetSession() {
    P.answered = 0; P.correct = 0; P.streak = 0; P.history = [];
    P.input = ''; P.locked = false; P.finished = false; P.qi = 0;
    P.sessionId++;
    var b = $('btn-next');
    b.textContent = '下一题';
    b.classList.add('hidden');
    hideFeedback();
    renderStreak();
    renderDots();
    updateSessionBar();
  }

  function startPractice(levelId) {
    P.mode = 'normal';
    P.levelId = levelId;
    P.queue = [];
    resetSession();
    $('practice-title').textContent = 'L' + levelId + ' · ' + QGen.LEVELS[levelId - 1].name;
    show('practice');
    nextQuestion();
  }

  function startWrongPractice() {
    var list = Store.getWrong();
    if (!list.length) return;
    P.mode = 'wrong';
    P.queue = list.map(function (w) {
      return { text: w.text, answer: w.answer, level: w.level || 1 };
    });
    resetSession();
    $('practice-title').textContent = '错题重练';
    show('practice');
    renderQuestionFromQueue();
  }

  function nextQuestion() {
    P.cur = QGen.gen(P.levelId);
    renderQuestion();
  }

  function renderQuestionFromQueue() {
    if (P.qi >= P.queue.length) { finishWrongRun(); return; }
    P.cur = P.queue[P.qi++];
    renderQuestion();
  }

  function finishWrongRun() {
    P.finished = true;
    P.locked = true;
    $('q-expression').textContent = '重练完成';
    $('q-input-text').textContent = '';
    $('q-progress').textContent = '';
    showFeedback(true, '本次重练 ' + P.answered + ' 题，答对 ' + P.correct + ' 题');
    var b = $('btn-next');
    b.textContent = '完 成';
    b.classList.remove('hidden');
  }

  function renderQuestion() {
    P.input = '';
    P.locked = false;
    $('q-expression').textContent = P.cur.text + ' =';
    $('q-input-text').textContent = '';
    $('q-progress').textContent = '第 ' + (P.answered + 1) + ' 题';
    $('btn-next').classList.add('hidden');
    hideFeedback();
  }

  function advance() {
    if (P.finished) { renderHome(); show('home'); return; }
    if (P.mode === 'normal') nextQuestion();
    else renderQuestionFromQueue();
  }

  /* ---------- 键盘输入 ---------- */
  function pressKey(k) {
    if (k === 'confirm') { confirmAnswer(); return; }
    if (P.locked) return;

    if (k === 'back') {
      P.input = P.input.slice(0, -1);
    } else if (k === 'clear') {
      P.input = '';
    } else if (k === 'dot') {
      if (P.input.indexOf('.') === -1) P.input = (P.input === '' ? '0.' : P.input + '.');
    } else if (/^\d$/.test(k)) {
      if (P.input === '0') {
        P.input = k; // 去掉无意义的前导零
      } else {
        var dot = P.input.indexOf('.');
        if (dot === -1) {
          if (P.input.length < 6) P.input += k; // 整数部分最多 6 位
        } else if (P.input.length - dot - 1 < 2) {
          P.input += k; // 小数部分最多 2 位
        }
      }
    }
    $('q-input-text').textContent = P.input;
  }

  /* ---------- 即时校验 ---------- */
  function confirmAnswer() {
    if (P.locked) return;
    if (P.input === '' || P.input === '0.' || /\.$/.test(P.input)) { shake(); return; }

    var val = parseFloat(P.input);
    if (isNaN(val)) { shake(); return; }

    P.locked = true;
    var isOk = Math.abs(val - P.cur.answer) < 1e-6;
    Store.record(P.cur.level, isOk);
    P.answered++;
    P.history.push(isOk);
    if (P.history.length > 10) P.history.shift();
    updateSessionBar();
    renderDots();

    var sid = P.sessionId;
    if (isOk) {
      P.correct++;
      P.streak++;
      renderStreak();
      showFeedback(true, '回答正确');
      setTimeout(function () { if (sid === P.sessionId) advance(); }, 650);
    } else {
      P.streak = 0;
      renderStreak();
      if (P.mode === 'normal') {
        Store.addWrong({ text: P.cur.text, answer: P.cur.answer, userAnswer: val, level: P.cur.level, ts: Date.now() });
      }
      // 错题重练中答错：保留在错题本中
      showFeedback(false, '答错了，正确答案是 ' + P.cur.answerText);
      $('btn-next').classList.remove('hidden');
    }
  }

  /* 答对自动跳题 / 答错手动下一题 */
  function onNextClick() { advance(); }

  /* ---------- 练习页小部件 ---------- */
  function updateSessionBar() {
    var acc = P.answered ? Math.round(P.correct / P.answered * 100) : 0;
    $('session-bar').textContent = '本次已答 ' + P.answered + ' 题 · 答对 ' + P.correct + ' · 正确率 ' + acc + '%';
  }

  function renderStreak() {
    var el = $('streak');
    el.textContent = '连对 ' + P.streak;
    el.classList.toggle('hot', P.streak >= 3);
  }

  function renderDots() {
    var box = $('dots');
    box.innerHTML = '';
    P.history.forEach(function (ok) {
      var d = document.createElement('span');
      d.className = 'dot ' + (ok ? 'ok' : 'bad');
      box.appendChild(d);
    });
  }

  function showFeedback(ok, msg) {
    var f = $('q-feedback');
    f.className = 'q-feedback ' + (ok ? 'ok' : 'bad');
    f.textContent = msg;
  }

  function hideFeedback() {
    var f = $('q-feedback');
    f.className = 'q-feedback';
    f.textContent = '';
  }

  function shake() {
    var el = $('q-input');
    el.classList.remove('wrong-shake');
    void el.offsetWidth; // 重启动画
    el.classList.add('wrong-shake');
    setTimeout(function () { el.classList.remove('wrong-shake'); }, 400);
  }

  /* ---------- 错题本 ---------- */
  function renderWrong() {
    var list = Store.getWrong();
    $('wrong-total').textContent = list.length;
    var box = $('wrong-list');
    box.innerHTML = '';

    if (!list.length) {
      box.innerHTML = '<div class="empty">太棒了，暂无错题！</div>';
    }
    list.forEach(function (w) {
      var div = document.createElement('div');
      div.className = 'wrong-item';
      div.innerHTML =
        '<div class="wi-q">' + esc(w.text) + ' = <b>' + esc(String(round2(w.answer))) + '</b></div>' +
        '<div class="wi-a">你的答案：' + esc(String(w.userAnswer)) + ' · ' + fmtTime(w.ts) + '</div>';
      box.appendChild(div);
    });
    $('btn-wrong-start').disabled = !list.length;
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    var stats = Store.getStats();
    var o = stats.overall;
    $('st-attempted').textContent = o.attempted;
    $('st-correct').textContent = o.correct;
    $('st-acc').textContent = (o.attempted ? Math.round(o.correct / o.attempted * 100) : 0) + '%';

    var box = $('stats-levels');
    box.innerHTML = '';
    QGen.LEVELS.forEach(function (lv) {
      var st = stats.byLevel[lv.id] || { attempted: 0, correct: 0 };
      var acc = st.attempted ? Math.round(st.correct / st.attempted * 100) : 0;
      var row = document.createElement('div');
      row.className = 'st-row';
      row.innerHTML =
        '<div class="st-head">' +
          '<span class="st-name">L' + lv.id + ' ' + lv.name + '</span>' +
          '<span class="st-num">' + st.attempted + ' 题 · ' + acc + '%</span>' +
        '</div>' +
        '<div class="st-bar"><i style="width:' + acc + '%"></i></div>';
      box.appendChild(row);
    });
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- 实体键盘支持 ---------- */
  function onKey(e) {
    if (currentView !== 'practice') return;
    if (/^[0-9]$/.test(e.key)) { pressKey(e.key); e.preventDefault(); }
    else if (e.key === '.') { pressKey('dot'); e.preventDefault(); }
    else if (e.key === 'Backspace') { pressKey('back'); e.preventDefault(); }
    else if (e.key === 'Escape') { pressKey('clear'); }
    else if (e.key === 'Enter') {
      if (P.finished || (P.locked && !$('btn-next').classList.contains('hidden'))) advance();
      else if (!P.locked) confirmAnswer();
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    $('btn-back').addEventListener('click', function () { show('home'); });
    $('btn-wrong').addEventListener('click', function () { renderWrong(); show('wrong'); });
    $('btn-stats').addEventListener('click', function () { renderStats(); show('stats'); });
    $('btn-wrong-back').addEventListener('click', function () { show('home'); });
    $('btn-stats-back').addEventListener('click', function () { show('home'); });

    $('btn-wrong-start').addEventListener('click', startWrongPractice);
    $('btn-wrong-clear').addEventListener('click', function () {
      if (Store.getWrong().length && confirm('确定清空错题本吗？')) {
        Store.clearWrong();
        renderWrong();
      }
    });
    $('btn-stats-clear').addEventListener('click', function () {
      if (confirm('确定清空所有练习统计数据吗？')) {
        Store.clearStats();
        renderStats();
      }
    });

    $('btn-next').addEventListener('click', onNextClick);
    $('keypad').addEventListener('click', function (e) {
      var k = e.target.closest('.key');
      if (k) pressKey(k.getAttribute('data-key'));
    });
    document.addEventListener('keydown', onKey);

    renderHome();
    show('home');
  }

  init();
})();
