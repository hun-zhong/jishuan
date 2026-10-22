/* =============================================================
 * generator.js — 题目生成模块
 * 六个难度等级，按数字范围、运算位数、运算类型递进：
 *   L1 10以内加减          L2 100以内加减 + 表内乘除
 *   L3 1000以内整数四则    L4 小数加减（一/两位小数）
 *   L5 小数乘除            L6 两步混合运算（含括号、小数）
 * 生成约束：减法不出负数；除法保证整除或商为有限小数；
 *           小数题用缩放整数运算，避免浮点误差；结果最多两位小数。
 * ============================================================= */
(function () {
  'use strict';

  /* ---------- 工具函数 ---------- */
  function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  function chance(p) { return Math.random() < p; }
  // 最多保留两位小数并去掉浮点误差：0.30000000004 -> 0.3
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmt(n) { return String(round2(n)); }

  /* ---------- L1：10以内加减 ---------- */
  function gen1() {
    if (chance(0.5)) {
      var a = ri(1, 9), b = ri(1, 10 - a); // 和不超过 10
      return mk(a + ' + ' + b, a + b);
    }
    var x = ri(2, 10), y = ri(1, x - 1);   // 差不小于 1
    return mk(x + ' - ' + y, x - y);
  }

  /* ---------- L2：100以内加减 + 表内乘除 ---------- */
  function gen2() {
    var t = pick(['add', 'sub', 'mul', 'div']);
    if (t === 'add') { var a = ri(11, 88), b = ri(2, 100 - a); return mk(a + ' + ' + b, a + b); }
    if (t === 'sub') { var c = ri(20, 100), d = ri(1, c - 1);  return mk(c + ' - ' + d, c - d); }
    if (t === 'mul') { var e = ri(2, 9), f = ri(2, 9);          return mk(e + ' × ' + f, e * f); }
    var g = ri(2, 9), q = ri(2, 9); // 表内除法：商与除数均为 2~9
    return mk((g * q) + ' ÷ ' + g, q);
  }

  /* ---------- L3：1000以内整数四则 ---------- */
  function gen3() {
    var t = pick(['add', 'sub', 'mul', 'div']);
    if (t === 'add') { var a = ri(105, 890), b = ri(15, 1000 - a); return mk(a + ' + ' + b, a + b); }
    if (t === 'sub') { var c = ri(210, 1000), d = ri(12, c - 10);  return mk(c + ' - ' + d, c - d); }
    if (t === 'mul') { var e = ri(12, 99), f = ri(2, 9);           return mk(e + ' × ' + f, e * f); }
    var g = ri(2, 9), q = ri(11, 99); // 两位数 ÷ 一位数，整除
    return mk((g * q) + ' ÷ ' + g, q);
  }

  /* ---------- L4：小数加减（一位/两位小数） ---------- */
  function gen4() {
    var dp = pick([1, 1, 2]);            // 小数位数：多为一位，少量两位
    var s = Math.pow(10, dp);            // 缩放为整数运算，避免浮点误差
    var a = ri(5, 500), b = ri(1, 500);  // 以 0.1 / 0.01 为单位的整数
    if (chance(0.5)) {
      return mk(fmt(a / s) + ' + ' + fmt(b / s), (a + b) / s);
    }
    if (b > a) { var t = a; a = b; b = t; } // 减法保证不为负
    if (a === b) { a += 1; }
    return mk(fmt(a / s) + ' - ' + fmt(b / s), (a - b) / s);
  }

  /* ---------- L5：小数乘除 ---------- */
  function gen5() {
    if (chance(0.5)) {
      // 乘法：一位小数 × 一位小数，或 整数 × 一位小数
      if (chance(0.5)) {
        var ai = ri(1, 99), bi = ri(1, 99); // 0.1 ~ 9.9
        return mk(fmt(ai / 10) + ' × ' + fmt(bi / 10), ai * bi / 100);
      }
      var a = ri(2, 20), b2 = ri(3, 99);
      return mk(a + ' × ' + fmt(b2 / 10), a * b2 / 10);
    }
    // 除法：保证商为整数或一位小数
    if (chance(0.5)) {
      var b = ri(2, 9), q = ri(2, 99); // 整数商
      return mk((b * q) + ' ÷ ' + b, q);
    }
    var d = ri(2, 9), qi = ri(1, 99);  // 一位小数商 0.1 ~ 9.9
    return mk(fmt(d * qi / 10) + ' ÷ ' + d, qi / 10);
  }

  /* ---------- L6：两步混合运算（含括号、小数） ---------- */
  function gen6() {
    var t = pick(['t1', 't2', 't3', 't4', 't5', 't6']);
    var a, b, c, q;
    switch (t) {
      case 't1': // a + b × c（先乘后加）
        a = ri(2, 60); b = ri(2, 12); c = ri(2, 9);
        return mk(a + ' + ' + b + ' × ' + c, a + b * c);
      case 't2': // (a + b) × c
        a = ri(2, 30); b = ri(2, 30); c = ri(2, 6);
        return mk('(' + a + ' + ' + b + ') × ' + c, (a + b) * c);
      case 't3': // a × b - c（保证不为负）
        a = ri(3, 12); b = ri(3, 12); c = ri(2, a * b - 1);
        return mk(a + ' × ' + b + ' - ' + c, a * b - c);
      case 't4': // a ÷ b + c（整除）
        b = ri(2, 9); q = ri(2, 20); c = ri(2, 60);
        return mk((b * q) + ' ÷ ' + b + ' + ' + c, q + c);
      case 't5': // 小数：(a + b) × 整数
        var ai = ri(5, 120), bi = ri(5, 120); c = ri(2, 6);
        return mk('(' + fmt(ai / 10) + ' + ' + fmt(bi / 10) + ') × ' + c, (ai + bi) * c / 10);
      case 't6': // 小数：a × b + c
        var ai2 = ri(11, 99), b2 = ri(2, 9), ci = ri(1, 200);
        return mk(fmt(ai2 / 10) + ' × ' + b2 + ' + ' + fmt(ci / 10), (ai2 * b2 + ci) / 10);
    }
  }

  function mk(text, answer) { return { text: text, answer: answer }; }

  /* ---------- 难度等级配置 ---------- */
  var LEVELS = [
    { id: 1, name: '入门加减', tag: '10以内',        desc: '10以内加法与减法',          gen: gen1 },
    { id: 2, name: '百内四则', tag: '100以内',       desc: '100以内加减法与表内乘除法', gen: gen2 },
    { id: 3, name: '整数四则', tag: '1000以内',      desc: '大数加减与两位数乘除法',    gen: gen3 },
    { id: 4, name: '小数加减', tag: '一位/两位小数', desc: '小数的加法与减法',          gen: gen4 },
    { id: 5, name: '小数乘除', tag: '小数点运算',    desc: '小数乘法与除法',            gen: gen5 },
    { id: 6, name: '混合运算', tag: '两步 · 括号',   desc: '整数小数两步混合运算',      gen: gen6 }
  ];

  /* 对外接口：按等级生成题目 */
  function genQuestion(levelId) {
    var lv = LEVELS[levelId - 1];
    var q = lv.gen();
    q.level = levelId;
    q.answer = round2(q.answer);
    q.answerText = fmt(q.answer);
    return q;
  }

  window.QGen = { LEVELS: LEVELS, gen: genQuestion };
})();
