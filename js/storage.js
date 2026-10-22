/* =============================================================
 * storage.js — 本地数据存储模块（localStorage）
 * stats: 总体与分等级的答题数、正确数
 * wrong: 错题本（按题目文本去重，最新在前，最多 200 条）
 * ============================================================= */
(function () {
  'use strict';

  var STATS_KEY = 'ap_stats_v1';
  var WRONG_KEY = 'ap_wrong_v1';
  var WRONG_LIMIT = 200;

  function readJSON(key, def) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 存储不可用时静默降级 */ }
  }

  function defaultStats() {
    return { overall: { attempted: 0, correct: 0 }, byLevel: {} };
  }

  function getStats() {
    var s = readJSON(STATS_KEY, null);
    return s || defaultStats();
  }

  function levelStat(stats, id) {
    if (!stats.byLevel[id]) stats.byLevel[id] = { attempted: 0, correct: 0 };
    return stats.byLevel[id];
  }

  /* 记录一次作答 */
  function record(levelId, correct) {
    var s = getStats();
    s.overall.attempted++;
    if (correct) s.overall.correct++;
    var ls = levelStat(s, levelId || 1);
    ls.attempted++;
    if (correct) ls.correct++;
    writeJSON(STATS_KEY, s);
  }

  function getWrong() {
    var list = readJSON(WRONG_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  /* 加入错题本：同一题目只保留最新一条记录 */
  function addWrong(q) {
    var list = getWrong().filter(function (w) { return w.text !== q.text; });
    list.unshift(q);
    if (list.length > WRONG_LIMIT) list = list.slice(0, WRONG_LIMIT);
    writeJSON(WRONG_KEY, list);
  }

  /* 答对后从错题本移除 */
  function removeWrong(text) {
    var list = getWrong().filter(function (w) { return w.text !== text; });
    writeJSON(WRONG_KEY, list);
  }

  function clearWrong() { writeJSON(WRONG_KEY, []); }
  function clearStats() { writeJSON(STATS_KEY, defaultStats()); }

  window.Store = {
    getStats: getStats,
    record: record,
    getWrong: getWrong,
    addWrong: addWrong,
    removeWrong: removeWrong,
    clearWrong: clearWrong,
    clearStats: clearStats
  };
})();
