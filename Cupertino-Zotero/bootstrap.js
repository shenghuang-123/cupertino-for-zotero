/* Cupertino for Zotero · bootstrap.js
 * 样式：AUTHOR_SHEET 注入（make-it-red 官方模式），即时生效
 * v1.7.3 条目展开/收起动画实现说明：
 *   twisty 开合由官方 itemTree.js 在 mouseup 时触发；windowed-list
 *   的 invalidate() 会原地复用旧行元素置换内容，展开时通常没有
 *   新增 .row 节点，靠 addedNodes 无法识别子行。因此改为：
 *   1. mouseup 捕获阶段（先于官方监听器）快照行布局；
 *   2. MutationObserver 波次结束后，按 aria-level 圈出插入的子行
 *      播放级联入场动画；
 *   3. 对因插入/移除而平移的行，按快照 top 做 FLIP 位移。
 *   v1.7.3 修复部分条目无动画/动画错乱：
 *   - windowed-list 滚动重渲染的新行是 appendChild 到 DOM 末尾的，
 *     向上滚动后 DOM children 顺序与视觉顺序脱钩，旧版基于
 *     "DOM 顺序 == 行逻辑顺序" 的位置算术全部失效；
 *   - 改为快照按 style.top 空间排序（视觉顺序），FLIP 按元素身份
 *     匹配新旧 top（每个幸存行自己比自己），彻底免疫 DOM 乱序；
 *   - 级联间隔 55→65ms、封顶 330→520ms（多附件条目后段不再同时
 *     入场出现"一块整体"感）。
 */

var registeredSheets = [];
var windowListener = null;

var ROW_ANIM_CLASS = "cupertino-row-in";
var ROW_SHIFT_CLASS = "cupertino-row-shift";
var TWISTY_WINDOW_MS = 2000;

function getStyleService() {
	return Components.classes["@mozilla.org/content/style-sheet-service;1"]
		.getService(Components.interfaces.nsIStyleSheetService);
}

/* ---------- 条目展开动画 ---------- */

function onRowAnimationEnd(event) {
	var row = event.currentTarget;
	row.classList.remove(ROW_ANIM_CLASS);
	row.classList.remove(ROW_SHIFT_CLASS);
	row.style.removeProperty("--cupertino-row-delay");
	row.style.removeProperty("--cupertino-row-shift");
}

function trackRowAnimation(row) {
	row.addEventListener("animationend", onRowAnimationEnd, { once: true });
	row.addEventListener("animationcancel", onRowAnimationEnd, { once: true });
}

function animateNewRows(rows) {
	for (var i = 0; i < rows.length; i++) {
		rows[i].style.setProperty("--cupertino-row-delay", Math.min(i * 65, 520) + "ms");
		rows[i].classList.add(ROW_ANIM_CLASS);
		trackRowAnimation(rows[i]);
	}
}

function animateShiftedRows(entries) {
	for (var i = 0; i < entries.length; i++) {
		entries[i].row.style.setProperty("--cupertino-row-shift", entries[i].offset + "px");
		entries[i].row.classList.add(ROW_SHIFT_CLASS);
		trackRowAnimation(entries[i].row);
	}
}

function rowLevel(row) {
	return parseInt(row.getAttribute("aria-level"), 10) || 0;
}

function rowTop(row) {
	return parseFloat(row.style.top) || 0;
}

// 收集渲染窗口内所有行并按 style.top 排序（空间/视觉顺序）。
// DOM children 顺序在滚动重渲染后与视觉顺序脱钩（新行 appendChild
// 到末尾），必须用 top 排序做位置算术。
function snapshotRows(inner) {
	var out = [];
	var children = inner.children;
	for (var i = 0; i < children.length; i++) {
		var c = children[i];
		out.push({ elem: c, top: rowTop(c), level: rowLevel(c) });
	}
	out.sort(function (a, b) { return a.top - b.top; });
	return out;
}

function findRowPos(rows, elem) {
	for (var i = 0; i < rows.length; i++) {
		if (rows[i].elem === elem) return i;
	}
	return -1;
}

// 消费 pending 快照；返回 true 表示已应用动画（调用方负责清空 pending）
function applyTreeChangeAnimation(tree) {
	var pending = tree._cupertinoPendingExpand;
	if (!pending) return false;
	var now = snapshotRows(pending.inner);
	// 父行元素已不存在（滚出渲染范围）才真正放弃
	var parentNowPos = findRowPos(now, pending.row);
	if (parentNowPos < 0) {
		tree._cupertinoPendingExpand = null;
		return false;
	}
	var parentOldPos = findRowPos(pending.rows, pending.row);
	if (parentOldPos < 0) {
		tree._cupertinoPendingExpand = null;
		return false;
	}

	// 旧快照中紧随父行且层级更深的行 = 原本已展开的后代（本次是收起）
	var oldDescendants = 0;
	for (var d = parentOldPos + 1; d < pending.rows.length; d++) {
		if (pending.rows[d].level <= pending.parentLevel) break;
		oldDescendants++;
	}

	// 按元素身份建立旧 top 映射，FLIP 与 DOM 顺序无关
	var oldTopMap = new Map();
	for (var m = 0; m < pending.rows.length; m++) {
		oldTopMap.set(pending.rows[m].elem, pending.rows[m].top);
	}

	if (oldDescendants === 0) {
		// 展开：新快照中紧随父行的深层行即插入的子行
		var childRows = [];
		for (var i = parentNowPos + 1; i < now.length; i++) {
			if (now[i].level <= pending.parentLevel) break;
			childRows.push(now[i].elem);
		}
		if (!childRows.length) return false;
		var childSet = new Set(childRows);
		var shifted = [];
		for (var s = 0; s < now.length; s++) {
			var r = now[s];
			if (childSet.has(r.elem)) continue;
			var ot = oldTopMap.get(r.elem);
			if (ot === undefined || ot === r.top) continue;
			shifted.push({ row: r.elem, offset: ot - r.top });
		}
		animateNewRows(childRows);
		animateShiftedRows(shifted);
		return true;
	}

	// 收起：幸存行按元素身份从旧位置上滑归位
	var collapsed = [];
	for (var s2 = 0; s2 < now.length; s2++) {
		var r2 = now[s2];
		var ot2 = oldTopMap.get(r2.elem);
		if (ot2 === undefined || ot2 === r2.top) continue;
		collapsed.push({ row: r2.elem, offset: ot2 - r2.top });
	}
	if (collapsed.length) {
		animateShiftedRows(collapsed);
		return true;
	}
	return false;
}

function ensureTreeObserver(win, tree) {
	if (tree._cupertinoObserver) return;
	var observer = new win.MutationObserver(function () {
		var pending = tree._cupertinoPendingExpand;
		if (!pending) return;
		if (Date.now() - pending.time > TWISTY_WINDOW_MS) {
			tree._cupertinoPendingExpand = null;
			return;
		}
		if (applyTreeChangeAnimation(tree)) {
			tree._cupertinoPendingExpand = null;
		}
	});
	observer.observe(tree, { childList: true, subtree: true });
	tree._cupertinoObserver = observer;
}

function observeItemsTrees(win) {
	if (!win.document) return;
	var trees = win.document.querySelectorAll("#zotero-items-tree");
	for (var i = 0; i < trees.length; i++) {
		ensureTreeObserver(win, trees[i]);
	}
}

function onWindowMouseUp(event) {
	if (event.button !== 0) return;
	var target = event.target;
	if (!target || !target.closest) return;
	var twisty = target.closest(".twisty");
	if (!twisty) return;
	var tree = twisty.closest("#zotero-items-tree");
	if (!tree) return;
	var row = twisty.closest(".row");
	var inner = row && row.parentElement;
	if (!inner) return;
	var level = rowLevel(row);
	if (!level) return;
	tree._cupertinoPendingExpand = {
		inner: inner,
		row: row,
		parentLevel: level,
		rows: snapshotRows(inner),
		time: Date.now()
	};
	// 兜底：若 tree 被销毁重建导致 observer 丢失，此处补挂
	ensureTreeObserver(target.ownerGlobal, tree);
}

// 用户滚动（滚轮/拖滚动条）后 windowed-list 重渲染，快照元素集合
// 大量失效，直接废弃避免错播
function onWindowScroll(event) {
	var node = event.target;
	while (node && node.nodeType === 1) {
		if (node.id === "zotero-items-tree") {
			node._cupertinoPendingExpand = null;
			return;
		}
		node = node.parentElement;
	}
}

/* ---------- 窗口生命周期 ---------- */

function attachToWindow(win) {
	if (win._cupertinoAttached) return;
	win._cupertinoAttached = true;
	win.addEventListener("mouseup", onWindowMouseUp, true);
	win.addEventListener("scroll", onWindowScroll, true);
	if (win.document && win.document.readyState === "complete") {
		observeItemsTrees(win);
	}
	else {
		win.addEventListener("load", function () {
			observeItemsTrees(win);
		}, { once: true });
	}
}

function detachFromWindow(win) {
	if (win._cupertinoAttached) {
		win.removeEventListener("mouseup", onWindowMouseUp, true);
		win.removeEventListener("scroll", onWindowScroll, true);
		win._cupertinoAttached = false;
	}
	if (win.document) {
		var trees = win.document.querySelectorAll("#zotero-items-tree");
		for (var i = 0; i < trees.length; i++) {
			if (trees[i]._cupertinoObserver) {
				trees[i]._cupertinoObserver.disconnect();
				trees[i]._cupertinoObserver = null;
			}
			trees[i]._cupertinoPendingExpand = null;
		}
	}
}

function forEachWindow(callback) {
	var enumerator = Services.wm.getEnumerator(null);
	while (enumerator.hasMoreElements()) {
		var win = enumerator.getNext();
		if (win.document) callback(win);
	}
}

/* ---------- 插件生命周期 ---------- */

function install(data, reason) {}

function startup({ id, version, resourceURI, rootURI = resourceURI.spec }, reason) {
	var styleService = getStyleService();
	var uri = Services.io.newURI(rootURI + "style.css");
	styleService.loadAndRegisterSheet(uri, styleService.AUTHOR_SHEET);
	registeredSheets.push({ uri, type: styleService.AUTHOR_SHEET });

	// 已打开的窗口立即挂载；后续新窗口在 load 后挂载
	forEachWindow(attachToWindow);
	windowListener = {
		onOpenWindow: function (aWindow) {
			var win = aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow);
			win.addEventListener("load", function () {
				attachToWindow(win);
			}, { once: true });
		},
		onCloseWindow: function () {},
		onWindowTitleChange: function () {}
	};
	Services.wm.addListener(windowListener);
}

function shutdown({ id, version, resourceURI, rootURI = resourceURI.spec }, reason) {
	var styleService = getStyleService();
	while (registeredSheets.length) {
		var sheet = registeredSheets.pop();
		if (styleService.sheetRegistered(sheet.uri, sheet.type)) {
			styleService.unregisterSheet(sheet.uri, sheet.type);
		}
	}
	if (windowListener) {
		Services.wm.removeListener(windowListener);
		windowListener = null;
	}
	forEachWindow(detachFromWindow);
}
