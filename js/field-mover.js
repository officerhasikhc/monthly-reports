/**
 * FieldMover v2 - أداة تحريك وتغيير حجم الحقول
 * ملف منفصل يُربط بجميع صفحات التقارير
 * 
 * الميزات:
 *   - سحب وإفلات سلس لنقل الحقول
 *   - تغيير الحجم من 8 اتجاهات (أركان + حواف)
 *   - تغيير حجم الخط بـ Ctrl+عجلة الماوس
 *   - تراجع (Ctrl+Z) يدعم عدة خطوات
 *   - خطوط محاذاة ذكية (snap guides)
 *   - لوحة إحداثيات مع زر نسخ
 *   - اختصارات: Ctrl+Shift+M للتبديل، Ctrl+Z للتراجع
 */
const FieldMover = (function(){
    'use strict';

    let enabled = false;
    let overlayRect = null;
    let infoBar = null;
    let toggleBtn = null;
    let coordsPanel = null;
    let guidesContainer = null;
    let selectedEl = null;   // الحقل المحدد حالياً (للتأثيرات)

    // ======== DRAG STATE ========
    let dragEl = null;
    let dragStartX = 0, dragStartY = 0;
    let dragStartRight = 0, dragStartTop = 0;

    // ======== RESIZE STATE ========
    let resizeEl = null;
    let resizeHandle = '';   // 'n','s','e','w','ne','nw','se','sw'
    let resizeStartX = 0, resizeStartY = 0;
    let resizeStartTop = 0, resizeStartRight = 0;
    let resizeStartW = 0, resizeStartH = 0;

    // ======== UNDO HISTORY ========
    const undoStack = [];
    const MAX_UNDO = 50;

    function pushUndo(el){
        undoStack.push({
            id: el.id,
            top: el.style.top,
            right: el.style.right,
            width: el.style.width,
            height: el.style.height,
            fontSize: el.style.fontSize,
            color: el.style.color,
            fontFamily: el.style.fontFamily,
            textAlign: el.style.textAlign,
            justifyContent: el.style.justifyContent
        });
        if(undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function popUndo(){
        if(!undoStack.length) return;
        const state = undoStack.pop();
        const el = document.getElementById(state.id);
        if(!el) return;
        el.style.top = state.top;
        el.style.right = state.right;
        el.style.width = state.width;
        el.style.height = state.height;
        el.style.fontSize = state.fontSize;
        if(state.color !== undefined) el.style.color = state.color;
        if(state.fontFamily !== undefined) el.style.fontFamily = state.fontFamily;
        if(state.textAlign !== undefined) el.style.textAlign = state.textAlign;
        if(state.justifyContent !== undefined) el.style.justifyContent = state.justifyContent;
        showCoords(el);
        updateInfoFromEl(el);
        flashElement(el, '#ff9800');
        saveFieldStyles();
    }

    function flashElement(el, color){
        el.style.outline = `3px solid ${color}`;
        setTimeout(()=>{ if(enabled) el.style.outline = '1px solid rgba(26,35,126,.35)'; }, 400);
    }

    // ======== HELPERS ========
    function getOverlay(){ return document.querySelector('.overlay'); }
    function pf(v){ return parseFloat(v)||0; }

    function updateInfoFromEl(el){
        const t = pf(el.style.top), r = pf(el.style.right);
        const w = pf(el.style.width), h = pf(el.style.height);
        updateInfoBar(el.id, t.toFixed(2), r.toFixed(2), w.toFixed(2), h.toFixed(2));
    }

    function refreshOverlayRect(){
        const ov = getOverlay();
        if(ov) overlayRect = ov.getBoundingClientRect();
    }

    // ======== حفظ واستعادة تخصيصات الحقول تلقائياً ========
    const FM_STORE_KEY = 'fm_field_styles_' + location.pathname.replace(/[^a-z0-9]/gi,'_');

    function saveFieldStyles(){
        const ov = getOverlay();
        if(!ov) return;
        const data = {};
        ov.querySelectorAll('.fld[id]').forEach(el=>{
            if(!el.id) return;
            data[el.id] = {
                top: el.style.top,
                right: el.style.right,
                width: el.style.width,
                height: el.style.height,
                fontSize: el.style.fontSize,
                color: el.style.color,
                fontFamily: el.style.fontFamily,
                textAlign: el.style.textAlign,
                justifyContent: el.style.justifyContent,
                fontWeight: el.style.fontWeight
            };
        });
        try {
            localStorage.setItem(FM_STORE_KEY, JSON.stringify(data));
            console.log('[FieldMover] 💾 تم حفظ تخصيصات الحقول');
        } catch(e){ console.warn('[FieldMover] فشل الحفظ:', e); }
    }

    function applyFieldStyles(){
        try {
            const raw = localStorage.getItem(FM_STORE_KEY);
            if(!raw) return false;
            const data = JSON.parse(raw);
            let count = 0;
            Object.keys(data).forEach(id=>{
                const el = document.getElementById(id);
                if(!el) return;
                const s = data[id];
                if(s.top) el.style.top = s.top;
                if(s.right) el.style.right = s.right;
                if(s.width) el.style.width = s.width;
                if(s.height) el.style.height = s.height;
                if(s.fontSize) el.style.fontSize = s.fontSize;
                if(s.color) el.style.color = s.color;
                if(s.fontFamily) el.style.fontFamily = s.fontFamily;
                if(s.textAlign) el.style.textAlign = s.textAlign;
                if(s.justifyContent) el.style.justifyContent = s.justifyContent;
                if(s.fontWeight) el.style.fontWeight = s.fontWeight;
                count++;
            });
            console.log(`[FieldMover] ✅ تم استعادة تخصيصات ${count} حقل`);
            return count > 0;
        } catch(e){
            console.warn('[FieldMover] فشل الاستعادة:', e);
            return false;
        }
    }

    function resetFieldStyles(){
        localStorage.removeItem(FM_STORE_KEY);
        console.log('[FieldMover] 🗑️ تم مسح التخصيصات المحفوظة');
    }

    // ======== UI: شريط المعلومات ========
    function createInfoBar(){
        if(infoBar) return;
        infoBar = document.createElement('div');
        infoBar.id = 'fm-infobar';
        infoBar.style.cssText = `
            position:fixed; top:42px; left:50%; transform:translateX(-50%);
            background:linear-gradient(135deg,#1a237e,#283593); color:#fff;
            padding:6px 20px; border-radius:0 0 8px 8px; font-size:13px;
            font-family:'Segoe UI',Tahoma,sans-serif; z-index:10001;
            box-shadow:0 3px 12px rgba(0,0,0,.3); display:none;
            direction:ltr; text-align:center; min-width:420px;
            transition: opacity .2s;
        `;
        document.body.appendChild(infoBar);
    }

    function updateInfoBar(id, top, right, w, h, extra){
        if(!infoBar) return;
        infoBar.style.display = 'block';
        infoBar.innerHTML = `
            <b style="color:#90caf9">${id||'?'}</b> &nbsp;|&nbsp;
            t:<b>${top}</b> &nbsp; r:<b>${right}</b> &nbsp;
            w:<b>${w}</b> &nbsp; h:<b>${h}</b>${extra||''}
        `;
    }

    function hideInfoBar(){ if(infoBar) infoBar.style.display = 'none'; }

    // ======== UI: زر التبديل العائم ========
    function createToggleBtn(){
        if(toggleBtn) return;
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'fm-toggle';
        toggleBtn.style.cssText = `
            position:fixed; bottom:40px; left:20px; z-index:10002;
            width:50px; height:50px; border-radius:50%;
            border:none; cursor:pointer; font-size:22px;
            box-shadow:0 3px 14px rgba(0,0,0,.35);
            transition: all .3s ease; display:none;
        `;
        toggleBtn.title = 'تبديل وضع تحريك الحقول (Ctrl+Shift+M)';
        toggleBtn.addEventListener('click', toggle);
        document.body.appendChild(toggleBtn);
        updateToggleBtnStyle();
    }

    function updateToggleBtnStyle(){
        if(!toggleBtn) return;
        if(enabled){
            toggleBtn.textContent = '🔓';
            toggleBtn.style.background = 'linear-gradient(135deg,#c62828,#e53935)';
            toggleBtn.style.color = '#fff';
        } else {
            toggleBtn.textContent = '🔒';
            toggleBtn.style.background = 'linear-gradient(135deg,#2e7d32,#43a047)';
            toggleBtn.style.color = '#fff';
        }
    }

    function showToggleBtn(){ if(toggleBtn) toggleBtn.style.display = 'block'; }

    // ======== UI: لوحة الإحداثيات ========
    let coordsCollapsed = false;
    function createCoordsPanel(){
        if(coordsPanel) return;
        coordsPanel = document.createElement('div');
        coordsPanel.id = 'fm-coords';
        coordsPanel.style.cssText = `
            position:fixed; bottom:8px; left:8px; z-index:10002;
            background:rgba(255,255,255,.95); border:1.5px solid #1a237e; border-radius:8px;
            padding:0; font-size:11px; font-family:'Courier New',monospace;
            box-shadow:0 2px 10px rgba(0,0,0,.18); display:none;
            direction:ltr; min-width:200px; max-width:240px;
        `;
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid #e0e0e0;cursor:pointer;';
        header.innerHTML = `
            <b style="font-size:11px;color:#1a237e;">📋 إحداثيات</b>
            <span style="display:flex;gap:4px;">
                <button id="fm-copy-btn" style="background:#1a237e;color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">نسخ</button>
                <button id="fm-coords-toggle" style="background:none;border:none;cursor:pointer;font-size:13px;color:#1a237e;padding:0 2px;" title="طي/توسيع">▾</button>
            </span>
        `;
        coordsPanel.appendChild(header);

        const body = document.createElement('pre');
        body.id = 'fm-coords-body';
        body.style.cssText = 'margin:0;white-space:pre-wrap;color:#333;line-height:1.5;padding:6px 8px;font-size:10px;';
        coordsPanel.appendChild(body);

        document.body.appendChild(coordsPanel);

        // Toggle collapse
        header.querySelector('#fm-coords-toggle').addEventListener('click', (e)=>{
            e.stopPropagation();
            coordsCollapsed = !coordsCollapsed;
            body.style.display = coordsCollapsed ? 'none' : 'block';
            header.querySelector('#fm-coords-toggle').textContent = coordsCollapsed ? '▸' : '▾';
        });

        header.querySelector('#fm-copy-btn').addEventListener('click', (e)=>{
            e.stopPropagation();
            const text = document.getElementById('fm-coords-body').textContent;
            navigator.clipboard.writeText(text).then(()=>{
                header.querySelector('#fm-copy-btn').textContent = '✓';
                setTimeout(()=>{ header.querySelector('#fm-copy-btn').textContent = 'نسخ'; }, 1200);
            });
        });
    }

    function showCoords(el){
        if(!coordsPanel) return;
        const t = pf(el.style.top), r = pf(el.style.right);
        const w = pf(el.style.width), h = pf(el.style.height);
        const fs = el.style.fontSize||'?';
        const align = el.style.textAlign||'center';
        const clr = el.style.color||'';
        const ff = el.style.fontFamily||'';

        const body = document.getElementById('fm-coords-body');
        body.textContent =
            `id:     ${el.id}\n` +
            `top:    ${t.toFixed(2)}%\n` +
            `right:  ${r.toFixed(2)}%\n` +
            `width:  ${w.toFixed(2)}%\n` +
            `height: ${h.toFixed(2)}%\n` +
            `fs:     ${fs}\n` +
            `color:  ${clr}\n` +
            `font:   ${ff}\n` +
            `align:  ${align}`;

        coordsPanel.style.display = 'block';
    }

    function hideCoords(){ if(coordsPanel) coordsPanel.style.display = 'none'; }

    // ======== RESIZE HANDLES ========
    // 8 مقابض: 4 أركان + 4 حواف
    const HANDLE_SIZE = 8; // px
    const HANDLES = ['n','s','e','w','ne','nw','se','sw'];

    const CURSOR_MAP = {
        n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
        ne:'nesw-resize', sw:'nesw-resize', nw:'nwse-resize', se:'nwse-resize'
    };

    function addResizeHandles(fld){
        // Remove old handles if any
        fld.querySelectorAll('.fm-handle').forEach(h=>h.remove());

        HANDLES.forEach(dir=>{
            const h = document.createElement('div');
            h.className = 'fm-handle';
            h.dataset.dir = dir;
            h.style.cssText = `
                position:absolute; z-index:10;
                width:${HANDLE_SIZE}px; height:${HANDLE_SIZE}px;
                background:#1a237e; border:1px solid #fff;
                border-radius:${dir.length===2?'50%':'1px'};
                cursor:${CURSOR_MAP[dir]};
                pointer-events:auto;
            `;
            // Position based on direction
            if(dir.includes('n')) h.style.top = `-${HANDLE_SIZE/2}px`;
            if(dir.includes('s')) h.style.bottom = `-${HANDLE_SIZE/2}px`;
            if(dir.includes('w')) h.style.left = `-${HANDLE_SIZE/2}px`;
            if(dir.includes('e')) h.style.right = `-${HANDLE_SIZE/2}px`;

            // Center edge handles
            if(dir === 'n' || dir === 's'){
                h.style.left = '50%'; h.style.marginLeft = `-${HANDLE_SIZE/2}px`;
                h.style.width = `${HANDLE_SIZE*2}px`;
            }
            if(dir === 'e' || dir === 'w'){
                h.style.top = '50%'; h.style.marginTop = `-${HANDLE_SIZE/2}px`;
                h.style.height = `${HANDLE_SIZE*2}px`;
            }

            fld.appendChild(h);
        });
    }

    function removeResizeHandles(fld){
        fld.querySelectorAll('.fm-handle').forEach(h=>h.remove());
    }

    // ======== SNAP GUIDES (خطوط محاذاة) ========
    function createGuidesContainer(){
        if(guidesContainer) return;
        guidesContainer = document.createElement('div');
        guidesContainer.id = 'fm-guides';
        guidesContainer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:9998;';
        const ov = getOverlay();
        if(ov) ov.appendChild(guidesContainer);
    }

    function clearGuides(){ if(guidesContainer) guidesContainer.innerHTML = ''; }

    function showSnapGuides(el){
        clearGuides();
        if(!guidesContainer) return;
        const t = pf(el.style.top);
        // Horizontal guide at current top
        const hLine = document.createElement('div');
        hLine.style.cssText = `position:absolute;top:${t}%;left:0;right:0;height:1px;background:#e53935;opacity:0.5;`;
        guidesContainer.appendChild(hLine);
    }

    // ======== CORE: MOUSE DOWN DISPATCHER ========
    const DRAG_THRESHOLD = 4; // px - أقل من هذا يعتبر نقرة وليس سحب
    let pendingClickEl = null;
    let didDrag = false;

    function onMouseDown(e){
        if(!enabled) return;

        // Ignore clicks on the mini toolbar itself
        if(miniToolbar && miniToolbar.contains(e.target)) return;
        // Ignore clicks on coords panel
        if(coordsPanel && coordsPanel.contains(e.target)) return;

        // Check if it's a resize handle
        const handle = e.target.closest('.fm-handle');
        if(handle){
            const fld = handle.closest('.fld');
            if(fld) startResize(e, fld, handle.dataset.dir);
            return;
        }

        // Check if it's a field
        const fld = e.target.closest('.fld');
        if(!fld){
            // Clicked outside any field → deselect + hide toolbar
            hideMiniToolbar();
            if(selectedEl){
                selectedEl.style.outline = '1px solid rgba(26,35,126,.35)';
                selectedEl.style.boxShadow = '';
            }
            selectedEl = null;
            return;
        }

        // Start potential drag (will distinguish click vs drag on mouseup)
        e.preventDefault();
        e.stopPropagation();

        pendingClickEl = fld;
        didDrag = false;
        dragEl = fld;
        refreshOverlayRect();

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTop = pf(fld.style.top);
        dragStartRight = pf(fld.style.right);

        // Disable editing during potential drag
        fld.contentEditable = 'false';
        const sel = fld.querySelector('select');
        if(sel) sel.style.pointerEvents = 'none';

        document.addEventListener('mousemove', onDragMove, {passive:false});
        document.addEventListener('mouseup', onDragUp);
    }

    // ======== DRAG ========
    function enterDragMode(el){
        // Called when movement exceeds threshold - real drag begins
        didDrag = true;
        pushUndo(el);
        selectedEl = el;

        el.style.zIndex = '9999';
        el.style.outline = '2px solid #e53935';
        el.style.cursor = 'grabbing';
        el.style.boxShadow = '0 4px 16px rgba(229,57,53,.3)';

        hideMiniToolbar();
        createGuidesContainer();
    }

    function onDragMove(e){
        if(!dragEl || !overlayRect) return;
        e.preventDefault();

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        // Check threshold before starting real drag
        if(!didDrag){
            if(Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            enterDragMode(dragEl);
        }

        const dpRight = -(dx / overlayRect.width) * 100;
        const dpTop = (dy / overlayRect.height) * 100;

        let newRight = dragStartRight + dpRight;
        let newTop = dragStartTop + dpTop;

        dragEl.style.right = newRight.toFixed(2) + '%';
        dragEl.style.top = newTop.toFixed(2) + '%';

        showSnapGuides(dragEl);
        updateInfoFromEl(dragEl);
    }

    function onDragUp(e){
        if(!dragEl) return;

        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);

        const el = dragEl;
        dragEl = null;

        // Re-enable editing
        if(el.classList.contains('fld-editable')) el.contentEditable = 'true';
        const sel = el.querySelector('select');
        if(sel) sel.style.pointerEvents = '';

        if(didDrag){
            // === Real drag ended ===
            el.style.zIndex = '';
            el.style.outline = '2px solid #43a047';
            el.style.cursor = 'grab';
            el.style.boxShadow = '0 0 8px rgba(67,160,71,.3)';
            selectedEl = el;

            showCoords(el);
            showMiniToolbar(el);
            clearGuides();

            const t = pf(el.style.top).toFixed(2);
            const r = pf(el.style.right).toFixed(2);
            console.log(`[FieldMover] MOVE ${el.id}: t:${t}, r:${r}`);
            saveFieldStyles();
        } else {
            // === Click (no drag) → toggle toolbar ===
            if(selectedEl === el && miniToolbar && miniToolbar.style.display !== 'none'){
                // Same field clicked again while toolbar visible → hide toolbar, keep selected for arrow keys
                hideMiniToolbar();
                el.style.outline = '2px solid #43a047';
                el.style.boxShadow = '0 0 8px rgba(67,160,71,.3)';
            } else {
                // New field or toolbar was hidden → select + show toolbar
                if(selectedEl && selectedEl !== el){
                    selectedEl.style.outline = '1px solid rgba(26,35,126,.35)';
                    selectedEl.style.boxShadow = '';
                }
                selectedEl = el;
                el.style.outline = '2px solid #43a047';
                el.style.boxShadow = '0 0 8px rgba(67,160,71,.3)';
                showCoords(el);
                showMiniToolbar(el);
            }
        }

        pendingClickEl = null;
        didDrag = false;
    }

    // ======== ARROW KEY MOVEMENT (دقة عالية) ========
    // خطوة صغيرة = 0.05% ، مع Shift = 0.5%
    function onArrowKey(e){
        if(!enabled || !selectedEl) return;
        // Only handle arrow keys
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
        // Don't interfere if user is editing a field's text
        if(document.activeElement && document.activeElement.isContentEditable &&
           document.activeElement.closest('.fld') === selectedEl &&
           miniToolbar && miniToolbar.style.display !== 'none') return;

        e.preventDefault();
        e.stopPropagation();

        const step = e.shiftKey ? 0.50 : 0.05; // Shift = خطوة كبيرة
        let t = pf(selectedEl.style.top);
        let r = pf(selectedEl.style.right);

        // Push undo only on first arrow (not on every tiny move)
        if(!selectedEl._arrowUndoPushed){
            pushUndo(selectedEl);
            selectedEl._arrowUndoPushed = true;
            // Reset after 1 second of no arrows
            clearTimeout(selectedEl._arrowTimer);
        }
        clearTimeout(selectedEl._arrowTimer);
        selectedEl._arrowTimer = setTimeout(()=>{ selectedEl._arrowUndoPushed = false; }, 1000);

        switch(e.key){
            case 'ArrowUp':    t -= step; break; // أعلى = ينقل للأعلى
            case 'ArrowDown':  t += step; break; // أسفل = ينقل للأسفل
            case 'ArrowRight': r += step; break; // يمين = ينقل لليمين (RTL: increase right%)
            case 'ArrowLeft':  r -= step; break; // يسار = ينقل لليسار (RTL: decrease right%)
        }

        selectedEl.style.top = t.toFixed(2) + '%';
        selectedEl.style.right = r.toFixed(2) + '%';

        // Visual feedback
        selectedEl.style.outline = '2px solid #43a047';
        showCoords(selectedEl);
        updateInfoFromEl(selectedEl);
        saveFieldStyles();
    }

    // ======== RESIZE ========
    function startResize(e, el, dir){
        e.preventDefault();
        e.stopPropagation();

        pushUndo(el);

        resizeEl = el;
        selectedEl = el;
        resizeHandle = dir;
        refreshOverlayRect();

        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartTop = pf(el.style.top);
        resizeStartRight = pf(el.style.right);
        resizeStartW = pf(el.style.width);
        resizeStartH = pf(el.style.height);

        el.style.zIndex = '9999';
        el.style.outline = '2px solid #ff6f00';
        el.style.boxShadow = '0 4px 16px rgba(255,111,0,.3)';

        el.contentEditable = 'false';
        const sel = el.querySelector('select');
        if(sel) sel.style.pointerEvents = 'none';

        createGuidesContainer();

        document.addEventListener('mousemove', onResizeMove, {passive:false});
        document.addEventListener('mouseup', onResizeUp);
    }

    function onResizeMove(e){
        if(!resizeEl || !overlayRect) return;
        e.preventDefault();

        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;

        // Convert to percentage
        const dpx = (dx / overlayRect.width) * 100;
        const dpy = (dy / overlayRect.height) * 100;

        let newTop = resizeStartTop;
        let newRight = resizeStartRight;
        let newW = resizeStartW;
        let newH = resizeStartH;

        const dir = resizeHandle;

        // RTL: right increases leftward. dragging mouse right = dx>0 = moving element left = right decreases
        // Width: dragging right edge rightward (dx>0) = width increases in LTR, but in our RTL right-based layout:
        //   - 'w' handle (left edge in visual) = dragging left: dx<0 increases width, adjusts right
        //   - 'e' handle (right edge in visual) = dragging right: dx>0 increases width (no right change)

        // North (top edge): dy<0 = expand up
        if(dir.includes('n')){
            newTop = resizeStartTop + dpy;
            newH = resizeStartH - dpy;
        }
        // South (bottom edge): dy>0 = expand down
        if(dir.includes('s')){
            newH = resizeStartH + dpy;
        }
        // East handle (visually RIGHT side in RTL): in RTL layout, "right" is the start.
        // The east handle is the LEFT visual side. Dragging it left (dx<0) increases width.
        if(dir.includes('e')){
            // e = left visual edge in RTL. Moving left (dx<0) => more width, no change to right
            newW = resizeStartW - dpx;
        }
        // West handle (visually LEFT side in RTL → actually the right side):
        // Dragging right (dx>0) = shrink width, increase right
        if(dir.includes('w')){
            newRight = resizeStartRight - dpx;
            newW = resizeStartW + dpx;
        }

        // Clamp minimums
        if(newW < 1) newW = 1;
        if(newH < 0.3) newH = 0.3;

        resizeEl.style.top = newTop.toFixed(2) + '%';
        resizeEl.style.right = newRight.toFixed(2) + '%';
        resizeEl.style.width = newW.toFixed(2) + '%';
        resizeEl.style.height = newH.toFixed(2) + '%';

        showSnapGuides(resizeEl);
        updateInfoFromEl(resizeEl);
    }

    function onResizeUp(e){
        if(!resizeEl) return;

        resizeEl.style.zIndex = '';
        resizeEl.style.outline = '2px solid #43a047';
        resizeEl.style.boxShadow = '0 0 8px rgba(67,160,71,.3)';
        resizeEl.style.cursor = 'grab';
        selectedEl = resizeEl;

        if(resizeEl.classList.contains('fld-editable')) resizeEl.contentEditable = 'true';
        const sel = resizeEl.querySelector('select');
        if(sel) sel.style.pointerEvents = '';

        showCoords(resizeEl);
        showMiniToolbar(resizeEl);
        clearGuides();

        const t = pf(resizeEl.style.top).toFixed(2);
        const r = pf(resizeEl.style.right).toFixed(2);
        const w = pf(resizeEl.style.width).toFixed(2);
        const h = pf(resizeEl.style.height).toFixed(2);
        console.log(`[FieldMover] RESIZE ${resizeEl.id}: t:${t}, r:${r}, w:${w}, h:${h}`);
        saveFieldStyles();

        resizeEl = null;
        resizeHandle = '';
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeUp);
    }

    // ======== FONT SIZE (Ctrl+عجلة الماوس) ========
    function onWheel(e){
        if(!enabled) return;
        if(!e.ctrlKey) return;
        const fld = e.target.closest('.fld');
        if(!fld) return;

        e.preventDefault();
        e.stopPropagation();

        pushUndo(fld);

        let fs = parseFloat(fld.style.fontSize) || 12;
        const delta = e.deltaY > 0 ? 1 : -1; // تمرير لأسفل = تكبير، لأعلى = تصغير
        fs = Math.max(6, Math.min(60, fs + delta));

        fld.style.fontSize = fs + 'px';
        // Also update inner select if exists
        const sel = fld.querySelector('select');
        if(sel) sel.style.fontSize = fs + 'px';

        showCoords(fld);
        updateInfoFromEl(fld);
        flashElement(fld, '#2196f3');
        console.log(`[FieldMover] FONT ${fld.id}: fs:${fs}px`);
        saveFieldStyles();
    }

    // ======== TOUCH SUPPORT ========
    function onTouchStart(e){
        if(!enabled) return;
        const el = e.target.closest('.fld');
        if(!el) return;

        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches[0];

        // Check handle → resize
        const handle = e.target.closest('.fm-handle');
        if(handle){
            const fakeE = {
                clientX: touch.clientX, clientY: touch.clientY,
                target: e.target,
                preventDefault:()=>{}, stopPropagation:()=>{}
            };
            startResize(fakeE, el, handle.dataset.dir);
        } else {
            // Touch always starts a real drag immediately
            pushUndo(el);
            dragEl = el;
            didDrag = true;
            selectedEl = el;
            refreshOverlayRect();
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            dragStartTop = pf(el.style.top);
            dragStartRight = pf(el.style.right);
            el.style.zIndex = '9999';
            el.style.outline = '2px solid #e53935';
            el.style.cursor = 'grabbing';
            el.style.boxShadow = '0 4px 16px rgba(229,57,53,.3)';
            el.contentEditable = 'false';
            hideMiniToolbar();
            createGuidesContainer();
        }

        document.addEventListener('touchmove', onTouchMove, {passive:false});
        document.addEventListener('touchend', onTouchEnd);
    }

    function onTouchMove(e){
        const touch = e.touches[0];
        const fakeE = { clientX:touch.clientX, clientY:touch.clientY, preventDefault:()=>e.preventDefault() };
        if(dragEl) onDragMove(fakeE);
        if(resizeEl) onResizeMove(fakeE);
    }

    function onTouchEnd(e){
        if(dragEl) onDragUp({});
        if(resizeEl) onResizeUp({});
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    }

    // ======== تأثيرات CSS ========
    function applyMoveStyles(){
        const fields = document.querySelectorAll('.overlay .fld');
        fields.forEach(f=>{
            f.dataset.fmOrigCursor = f.style.cursor||'';
            f.dataset.fmOrigOutline = f.style.outline||'';
            f.dataset.fmOrigBg = f.style.background||'';
            f.style.cursor = 'grab';
            f.style.outline = '1px solid rgba(26,35,126,.35)';
            f.style.background = 'rgba(255,255,255,.15)';
            f.style.transition = 'outline .15s, box-shadow .15s';
            f.style.position = 'absolute'; // ensure
            addResizeHandles(f);
        });
    }

    function removeMoveStyles(){
        const fields = document.querySelectorAll('.overlay .fld');
        fields.forEach(f=>{
            f.style.cursor = f.dataset.fmOrigCursor||'';
            f.style.outline = f.dataset.fmOrigOutline||'';
            f.style.background = f.dataset.fmOrigBg||'';
            f.style.transition = '';
            f.style.boxShadow = '';
            delete f.dataset.fmOrigCursor;
            delete f.dataset.fmOrigOutline;
            delete f.dataset.fmOrigBg;
            removeResizeHandles(f);
        });
    }

    // ======== HOVER HIGHLIGHT ========
    function onMouseOverFld(e){
        if(!enabled || dragEl || resizeEl) return;
        const fld = e.target.closest('.fld');
        if(fld && fld !== selectedEl){
            fld.style.boxShadow = '0 0 8px rgba(26,35,126,.25)';
        }
    }
    function onMouseOutFld(e){
        if(!enabled || dragEl || resizeEl) return;
        const fld = e.target.closest('.fld');
        if(fld && fld !== dragEl && fld !== resizeEl){
            fld.style.boxShadow = '';
        }
    }

    // ======== MINI TOOLBAR (تبويبات: حجم | لون | خط | محاذاة) ========
    let miniToolbar = null;
    let toolbarTarget = null;
    let currentTab = 0;
    let tbUserMoved = false; // user manually dragged toolbar
    const TAB_NAMES = ['حجم','لون','خط','محاذاة'];
    const TAB_ICONS = ['Aa','🎨','ف','☰'];

    function createMiniToolbar(){
        if(miniToolbar) return;

        // Load Google Fonts if ArabicFonts is available
        if(typeof ArabicFonts !== 'undefined') ArabicFonts.loadGoogle();

        miniToolbar = document.createElement('div');
        miniToolbar.id = 'fm-mini-toolbar';
        miniToolbar.style.cssText = `
            position:fixed; z-index:10003; display:none;
            background:rgba(255,255,255,.97); border:1.5px solid #1a237e; border-radius:10px;
            box-shadow:0 6px 24px rgba(0,0,0,.22);
            font-family:'Segoe UI',Tahoma,sans-serif;
            user-select:none; direction:rtl; min-width:260px; max-width:310px;
            transition:opacity .15s;
        `;

        miniToolbar.innerHTML = `
            <div id="fm-tb-nav" style="display:flex;align-items:center;border-bottom:1px solid #e0e0e0;padding:0;cursor:grab;">
                <button id="fm-tb-prev" class="fm-nav-arrow" title="السابق">‹</button>
                <div id="fm-tb-tab-label" style="flex:1;text-align:center;font-size:13px;font-weight:bold;color:#1a237e;padding:6px 0;cursor:grab;">⠿</div>
                <button id="fm-tb-next" class="fm-nav-arrow" title="التالي">›</button>
            </div>
            <div id="fm-tb-content" style="padding:8px 10px;min-height:38px;"></div>
        `;

        // Styles
        const style = document.createElement('style');
        style.id = 'fm-toolbar-styles';
        style.textContent = `
            .fm-nav-arrow {
                width:30px; height:30px; border:none; background:transparent;
                cursor:pointer; font-size:22px; color:#1a237e; line-height:1;
                display:flex; align-items:center; justify-content:center;
                transition: background .15s; border-radius:6px;
            }
            .fm-nav-arrow:hover { background:#e8eaf6; }
            .fm-tb-btn2 {
                height:28px; border:1px solid #ccc; border-radius:5px;
                background:#f5f5f5; cursor:pointer; font-size:13px; line-height:1;
                display:inline-flex; align-items:center; justify-content:center;
                color:#333; transition:all .12s; padding:0 8px;
            }
            .fm-tb-btn2:hover { background:#1a237e; color:#fff; border-color:#1a237e; }
            .fm-tb-btn2.active { background:#1a237e; color:#fff; border-color:#1a237e; }
            .fm-color-swatch {
                width:24px; height:24px; border-radius:50%; border:2px solid #ddd;
                cursor:pointer; transition:transform .12s, border-color .12s;
                display:inline-block;
            }
            .fm-color-swatch:hover { transform:scale(1.2); border-color:#1a237e; }
            .fm-color-swatch.active { border-color:#1a237e; border-width:3px; }
            #fm-font-select {
                width:100%; height:30px; border:1px solid #ccc; border-radius:5px;
                font-size:13px; padding:2px 6px; cursor:pointer; direction:rtl;
                background:#fafafa;
            }
            #fm-font-select:focus { border-color:#1a237e; outline:none; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(miniToolbar);

        // ---- Navigation arrows ----
        miniToolbar.querySelector('#fm-tb-prev').addEventListener('click', ()=>{
            currentTab = (currentTab - 1 + TAB_NAMES.length) % TAB_NAMES.length;
            renderTab();
        });
        miniToolbar.querySelector('#fm-tb-next').addEventListener('click', ()=>{
            currentTab = (currentTab + 1) % TAB_NAMES.length;
            renderTab();
        });

        // ---- Toolbar dragging (drag from nav bar to reposition) ----
        let tbDragging = false, tbDragX = 0, tbDragY = 0;
        const navBar = miniToolbar.querySelector('#fm-tb-nav');

        navBar.addEventListener('mousedown', (e)=>{
            // Don't drag if clicking the arrow buttons
            if(e.target.closest('.fm-nav-arrow')) return;
            e.preventDefault();
            tbDragging = true;
            tbDragX = e.clientX - miniToolbar.offsetLeft;
            tbDragY = e.clientY - miniToolbar.offsetTop;
            navBar.style.cursor = 'grabbing';
            miniToolbar.style.transition = 'none';

            const onTbMove = (ev)=>{
                if(!tbDragging) return;
                let nx = ev.clientX - tbDragX;
                let ny = ev.clientY - tbDragY;
                // Clamp to viewport
                const w = miniToolbar.offsetWidth, h = miniToolbar.offsetHeight;
                if(nx < 0) nx = 0;
                if(ny < 0) ny = 0;
                if(nx + w > window.innerWidth) nx = window.innerWidth - w;
                if(ny + h > window.innerHeight) ny = window.innerHeight - h;
                miniToolbar.style.left = nx + 'px';
                miniToolbar.style.top = ny + 'px';
            };
            const onTbUp = ()=>{
                tbDragging = false;
                tbUserMoved = true; // user manually positioned toolbar
                navBar.style.cursor = 'grab';
                miniToolbar.style.transition = 'opacity .15s';
                document.removeEventListener('mousemove', onTbMove);
                document.removeEventListener('mouseup', onTbUp);
            };
            document.addEventListener('mousemove', onTbMove);
            document.addEventListener('mouseup', onTbUp);
        });

        // Prevent toolbar clicks from triggering field drag
        miniToolbar.addEventListener('mousedown', (e)=>{ e.stopPropagation(); });
    }

    function renderTab(){
        if(!miniToolbar) return;
        const label = miniToolbar.querySelector('#fm-tb-tab-label');
        const content = miniToolbar.querySelector('#fm-tb-content');
        label.textContent = TAB_ICONS[currentTab] + ' ' + TAB_NAMES[currentTab];

        switch(currentTab){
            case 0: renderSizeTab(content); break;
            case 1: renderColorTab(content); break;
            case 2: renderFontTab(content); break;
            case 3: renderAlignTab(content); break;
        }
    }

    // ---- TAB 0: حجم الخط ----
    function renderSizeTab(container){
        const el = toolbarTarget;
        const fs = el ? (parseFloat(el.style.fontSize)||12) : 12;
        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;direction:ltr;">
                <button class="fm-tb-btn2" id="fm-fs-dn">−</button>
                <input type="range" id="fm-fs-slider" min="6" max="60" step="0.5" value="${fs}"
                    style="flex:1;height:5px;cursor:pointer;accent-color:#1a237e;">
                <button class="fm-tb-btn2" id="fm-fs-up">+</button>
                <span id="fm-fs-val" style="font-size:12px;color:#1a237e;font-weight:bold;min-width:40px;text-align:center;">${fs.toFixed(1)}</span>
            </div>
        `;
        const slider = container.querySelector('#fm-fs-slider');
        const valSpan = container.querySelector('#fm-fs-val');
        const applyFs = (v)=>{
            if(!toolbarTarget) return;
            toolbarTarget.style.fontSize = v + 'px';
            const sel = toolbarTarget.querySelector('select');
            if(sel) sel.style.fontSize = v + 'px';
            slider.value = v;
            valSpan.textContent = v.toFixed(1);
            showCoords(toolbarTarget);
        };
        slider.addEventListener('input', ()=>{ applyFs(parseFloat(slider.value)); saveFieldStyles(); });
        container.querySelector('#fm-fs-up').addEventListener('click', ()=>{
            if(!toolbarTarget) return; pushUndo(toolbarTarget);
            applyFs(Math.min(60, (parseFloat(toolbarTarget.style.fontSize)||12) + 0.5));
            saveFieldStyles();
        });
        container.querySelector('#fm-fs-dn').addEventListener('click', ()=>{
            if(!toolbarTarget) return; pushUndo(toolbarTarget);
            applyFs(Math.max(6, (parseFloat(toolbarTarget.style.fontSize)||12) - 0.5));
            saveFieldStyles();
        });
    }

    // ---- TAB 1: لون الخط ----
    const PRESET_COLORS = [
        '#000000','#333333','#666666','#999999',
        '#c00000','#e53935','#ff6f00','#f9a825',
        '#2e7d32','#43a047','#1565c0','#1a237e',
        '#6a1b9a','#ad1457','#00695c','#4e342e',
    ];

    function renderColorTab(container){
        const el = toolbarTarget;
        const currentColor = el ? (el.style.color||'#000000') : '#000000';
        let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:6px;">';
        PRESET_COLORS.forEach(c=>{
            const active = currentColor.toLowerCase() === c.toLowerCase() || rgbToHex(currentColor) === c;
            html += `<span class="fm-color-swatch${active?' active':''}" data-color="${c}" style="background:${c};" title="${c}"></span>`;
        });
        html += '</div>';
        html += `<div style="display:flex;align-items:center;gap:6px;direction:rtl;margin-top:4px;">
            <label style="font-size:11px;color:#666;">مخصص:</label>
            <input type="color" id="fm-custom-color" value="${rgbToHex(currentColor)}"
                style="width:32px;height:26px;border:1px solid #ccc;border-radius:4px;cursor:pointer;padding:0;">
        </div>`;
        container.innerHTML = html;

        // Swatch clicks
        container.querySelectorAll('.fm-color-swatch').forEach(sw=>{
            sw.addEventListener('click', ()=>{
                if(!toolbarTarget) return;
                pushUndo(toolbarTarget);
                toolbarTarget.style.color = sw.dataset.color;
                container.querySelectorAll('.fm-color-swatch').forEach(s=>s.classList.remove('active'));
                sw.classList.add('active');
                showCoords(toolbarTarget);
                saveFieldStyles();
            });
        });
        // Custom color input
        container.querySelector('#fm-custom-color').addEventListener('input', (e)=>{
            if(!toolbarTarget) return;
            pushUndo(toolbarTarget);
            toolbarTarget.style.color = e.target.value;
            container.querySelectorAll('.fm-color-swatch').forEach(s=>s.classList.remove('active'));
            showCoords(toolbarTarget);
            saveFieldStyles();
        });
    }

    function rgbToHex(rgb){
        if(!rgb) return '#000000';
        if(rgb.startsWith('#')) return rgb.length===4 ?
            '#'+rgb[1]+rgb[1]+rgb[2]+rgb[2]+rgb[3]+rgb[3] : rgb;
        const m = rgb.match(/\d+/g);
        if(!m || m.length<3) return '#000000';
        return '#'+((1<<24)+(+m[0]<<16)+(+m[1]<<8)+(+m[2])).toString(16).slice(1);
    }

    // ---- TAB 2: الخطوط ----
    function renderFontTab(container){
        const el = toolbarTarget;
        const currentFont = el ? (el.style.fontFamily||'') : '';
        let html = '<select id="fm-font-select">';

        if(typeof ArabicFonts !== 'undefined'){
            html += '<optgroup label="خطوط النظام">';
            ArabicFonts.system.forEach(f=>{
                const sel = currentFont.includes(f.name) || currentFont === f.family ? ' selected' : '';
                html += `<option value='${f.family}' style="font-family:${f.family}"${sel}>${f.name}</option>`;
            });
            html += '</optgroup><optgroup label="خطوط عربية">';
            ArabicFonts.arabic.forEach(f=>{
                const sel = currentFont.includes(f.name) ? ' selected' : '';
                html += `<option value='${f.family}' style="font-family:${f.family}"${sel}>${f.name}</option>`;
            });
            html += '</optgroup><optgroup label="خطوط إنجليزية">';
            ArabicFonts.english.forEach(f=>{
                const sel = currentFont.includes(f.name) ? ' selected' : '';
                html += `<option value='${f.family}' style="font-family:${f.family}"${sel}>${f.name}</option>`;
            });
            html += '</optgroup>';
        } else {
            ['inherit','Arial','Tahoma','Times New Roman','Courier New'].forEach(f=>{
                const sel = currentFont.includes(f) ? ' selected' : '';
                html += `<option value="${f}"${sel}>${f}</option>`;
            });
        }
        html += '</select>';
        html += `<div id="fm-font-preview" style="margin-top:6px;padding:4px 8px;border:1px solid #e0e0e0;border-radius:5px;font-size:16px;text-align:center;min-height:26px;color:#333;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;"
            >معاينة الخط - Preview</div>`;
        container.innerHTML = html;

        const select = container.querySelector('#fm-font-select');
        const preview = container.querySelector('#fm-font-preview');
        preview.style.fontFamily = select.value;

        select.addEventListener('change', ()=>{
            if(!toolbarTarget) return;
            pushUndo(toolbarTarget);
            toolbarTarget.style.fontFamily = select.value;
            const sel = toolbarTarget.querySelector('select');
            if(sel) sel.style.fontFamily = select.value;
            preview.style.fontFamily = select.value;
            showCoords(toolbarTarget);
            saveFieldStyles();
        });
    }

    // ---- TAB 3: المحاذاة ----
    function renderAlignTab(container){
        const el = toolbarTarget;
        const currentAlign = el ? (el.style.textAlign||'center') : 'center';
        container.innerHTML = `
            <div style="display:flex;gap:6px;justify-content:center;">
                <button class="fm-tb-btn2 fm-align2${currentAlign==='right'?' active':''}" data-align="right" title="يمين" style="flex:1;">▐ يمين</button>
                <button class="fm-tb-btn2 fm-align2${currentAlign==='center'?' active':''}" data-align="center" title="وسط" style="flex:1;">☰ وسط</button>
                <button class="fm-tb-btn2 fm-align2${currentAlign==='left'?' active':''}" data-align="left" title="يسار" style="flex:1;">▌ يسار</button>
            </div>
        `;
        container.querySelectorAll('.fm-align2').forEach(btn=>{
            btn.addEventListener('click', ()=>{
                if(!toolbarTarget) return;
                pushUndo(toolbarTarget);
                const align = btn.dataset.align;
                const jcMap = { left:'flex-start', center:'center', right:'flex-end' };
                toolbarTarget.style.justifyContent = jcMap[align]||'center';
                toolbarTarget.style.textAlign = align;
                const sel = toolbarTarget.querySelector('select');
                if(sel) sel.style.textAlign = align;
                container.querySelectorAll('.fm-align2').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                showCoords(toolbarTarget);
                saveFieldStyles();
            });
        });
    }

    function showMiniToolbar(el){
        if(!miniToolbar) createMiniToolbar();

        // If switching to a different field, reset manual position
        if(toolbarTarget !== el) tbUserMoved = false;
        toolbarTarget = el;

        miniToolbar.style.display = 'block';
        renderTab();

        // Skip repositioning if user manually dragged toolbar
        if(tbUserMoved) return;

        // Measure toolbar after render
        const tbH = miniToolbar.offsetHeight || 90;
        const tbW = miniToolbar.offsetWidth || 280;
        const rect = el.getBoundingClientRect();
        const GAP = 6;

        // Always above the field - clamp to minimum 4px from top
        let top = rect.top - tbH - GAP;
        if(top < 4) top = 4;
        let left = rect.left + rect.width/2 - tbW/2;

        // Clamp horizontal
        if(left < 10) left = 10;
        if(left + tbW > window.innerWidth - 10) left = window.innerWidth - tbW - 10;

        miniToolbar.style.top = top + 'px';
        miniToolbar.style.left = left + 'px';
    }

    function hideMiniToolbar(){
        if(miniToolbar) miniToolbar.style.display = 'none';
        toolbarTarget = null;
        tbUserMoved = false;
    }

    // ======== API العامة ========
    function enable(){
        if(enabled) return;
        enabled = true;

        createInfoBar();
        createToggleBtn();
        createCoordsPanel();
        createMiniToolbar();
        showToggleBtn();
        updateToggleBtnStyle();
        applyMoveStyles();

        document.addEventListener('mousedown', onMouseDown, true);
        document.addEventListener('touchstart', onTouchStart, {passive:false, capture:true});
        document.addEventListener('wheel', onWheel, {passive:false, capture:true});
        document.addEventListener('keydown', onArrowKey, true);
        document.addEventListener('mouseover', onMouseOverFld);
        document.addEventListener('mouseout', onMouseOutFld);

        const ov = getOverlay();
        if(ov) ov.style.outline = '3px solid #1a237e';

        console.log('[FieldMover] ✅ وضع التحريك + تغيير الحجم مفعّل');
    }

    function disable(){
        if(!enabled) return;
        enabled = false;

        removeMoveStyles();
        hideInfoBar();
        hideCoords();
        clearGuides();
        hideMiniToolbar();
        updateToggleBtnStyle();
        selectedEl = null;

        document.removeEventListener('mousedown', onMouseDown, true);
        document.removeEventListener('touchstart', onTouchStart, true);
        document.removeEventListener('wheel', onWheel, true);
        document.removeEventListener('keydown', onArrowKey, true);
        document.removeEventListener('mouseover', onMouseOverFld);
        document.removeEventListener('mouseout', onMouseOutFld);

        const ov = getOverlay();
        if(ov) ov.style.outline = '';

        console.log('[FieldMover] 🔒 تم إلغاء وضع التحريك');
    }

    function toggle(){ enabled ? disable() : enable(); }
    function isEnabled(){ return enabled; }

    // ======== تفعيل تلقائي عبر URL ========
    function checkAutoEnable(){
        const params = new URLSearchParams(window.location.search);
        if(params.get('fieldmover') === '1'){
            const go = ()=> setTimeout(enable, 300);
            if(document.readyState === 'loading')
                document.addEventListener('DOMContentLoaded', go);
            else go();
        }
    }

    checkAutoEnable();

    // ======== استعادة تلقائية عند تحميل الصفحة وعند إعادة بناء الحقول ========
    let _restoreTimer = null;
    function scheduleRestore(){
        clearTimeout(_restoreTimer);
        _restoreTimer = setTimeout(()=>{
            const ov = getOverlay();
            if(ov && ov.querySelectorAll('.fld[id]').length > 0){
                applyFieldStyles();
            }
        }, 150);
    }

    function startPersistentObserver(){
        // Watch for overlay content changes (buildFields rebuilds overlay)
        const watch = ()=>{
            const ov = getOverlay();
            if(!ov) return false;
            const obs = new MutationObserver(scheduleRestore);
            obs.observe(ov, { childList:true });
            scheduleRestore(); // apply now too
            return true;
        };

        if(watch()) return;

        // Overlay not yet in DOM — watch document until it appears
        const docObs = new MutationObserver(()=>{
            if(watch()) docObs.disconnect();
        });
        const target = document.body || document.documentElement;
        if(target) docObs.observe(target, { childList:true, subtree:true });
        setTimeout(()=> docObs.disconnect(), 15000);
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', ()=> setTimeout(startPersistentObserver, 50));
    } else {
        setTimeout(startPersistentObserver, 50);
    }

    // ======== اختصارات لوحة المفاتيح ========
    document.addEventListener('keydown', (e)=>{
        // Ctrl+Shift+M: toggle
        if(e.ctrlKey && e.shiftKey && e.key === 'M'){
            e.preventDefault();
            toggle();
        }
        // Ctrl+Z: undo
        if(e.ctrlKey && !e.shiftKey && e.key === 'z' && enabled){
            e.preventDefault();
            popUndo();
        }
    });

    return { enable, disable, toggle, isEnabled, applyFieldStyles, resetFieldStyles };
})();
