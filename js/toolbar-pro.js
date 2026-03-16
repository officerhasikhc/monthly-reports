/**
 * toolbar-pro.js v4.1
 * شريط أدوات نظام التقارير الشهرية
 * المديرية العامة للخدمات الصحية بمحافظة ظفار
 */

const ToolbarPro = (function(){
    'use strict';

    let _config = {};
    let _autoSaveTimer = null;
    let _printing = false;

    // ======== CSS ========
    function injectStyles(){
        if(document.getElementById('toolbar-pro-css')) return;
        const s = document.createElement('style');
        s.id = 'toolbar-pro-css';
        s.textContent = `
/* ========== الشريط ========== */
.toolbar-pro {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    display: flex; align-items: center;
    background: linear-gradient(180deg, #0d2137 0%, #183654 100%);
    height: 40px; padding: 0 14px; gap: 0;
    direction: rtl; user-select: none;
    font-family: 'Segoe UI', 'Cairo', 'Tajawal', sans-serif;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,.3);
}
.tb-title {
    font-weight: 700; font-size: 13px;
    color: #fff; padding: 0 10px;
    white-space: nowrap; letter-spacing: .2px;
}
.tb-sep {
    width: 1px; height: 20px;
    background: rgba(255,255,255,.12);
    margin: 0 5px; flex-shrink: 0;
}
.tb-group {
    display: flex; align-items: center; gap: 3px;
    padding: 0 3px;
}
.tb-lbl {
    font-size: 10px; color: #7ea8c8;
    padding: 0 3px; white-space: nowrap;
}
.tb-select {
    padding: 2px 5px; border-radius: 3px;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(0,0,0,.25); color: #c8dde8;
    font-size: 11px; font-family: inherit;
    cursor: pointer; outline: none;
    transition: border-color .15s;
}
.tb-select:hover { border-color: rgba(255,255,255,.3); }
.tb-select:focus { border-color: #5a9fd4; }
.tb-select option { background: #15314f; color: #fff; }
.tb-btn {
    background: none; color: #b0c8dc; border: none;
    padding: 4px 10px; border-radius: 3px; cursor: pointer;
    font-size: 11px; font-family: inherit;
    white-space: nowrap; transition: all .12s;
}
.tb-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.tb-btn:active { background: rgba(255,255,255,.18); }
.tb-btn-save {
    background: #2a6496; color: #fff; font-weight: 600;
    padding: 4px 14px;
}
.tb-btn-save:hover { background: #3578b0; }
.tb-spacer { flex: 1; }
.tb-info {
    font-size: 10px; color: #5d8fac;
    padding: 0 5px; display: flex; align-items: center; gap: 4px;
}
.tb-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #2ea55d; display: inline-block;
}

/* ========== شريط الحالة ========== */
.status-bar-pro {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: #0d2137; color: #5d8fac;
    font-size: 10px; padding: 3px 14px;
    display: flex; justify-content: space-between;
    align-items: center; z-index: 1000;
    font-family: 'Segoe UI','Cairo', sans-serif;
    border-top: 1px solid rgba(255,255,255,.06);
    direction: rtl;
}

/* ========== إشعار ========== */
.tb-notify {
    position: fixed; top: 48px; left: 50%;
    transform: translateX(-50%);
    background: #0d2137; color: #d0e0ec;
    padding: 8px 22px; border-radius: 4px;
    font-size: 12px; font-family: 'Segoe UI','Cairo', sans-serif;
    box-shadow: 0 3px 12px rgba(0,0,0,.35);
    z-index: 3000; direction: rtl;
    border-right: 3px solid #2ea55d;
    animation: tb-in .2s ease;
}
.tb-notify.warn { border-right-color: #c89030; }
.tb-notify.err  { border-right-color: #b83030; }
.tb-notify-out  { animation: tb-out .2s ease forwards; }

@keyframes tb-in { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes tb-out { from { opacity:1; } to { opacity:0; } }

/* ========== طباعة ========== */
@media print {
    .toolbar-pro, .status-bar-pro, .tb-notify, .no-print { display: none !important; }
    .form-container { box-shadow: none !important; margin-top: 0 !important; }
    .overlay .fld { border: none !important; background: transparent !important; }
}

body.tb-active .form-container {
    margin-top: 50px !important;
}
        `;
        document.head.appendChild(s);
    }

    // ======== إشعار ========
    function toast(msg, type, duration){
        duration = duration || 2500;
        type = type || 'ok';
        const t = document.createElement('div');
        t.className = 'tb-notify' + (type==='warn'?' warn':'') + (type==='err'?' err':'');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(()=>{
            t.classList.add('tb-notify-out');
            setTimeout(()=> t.remove(), 250);
        }, duration);
    }

    // ======== حفظ تلقائي ========
    function startAutoSave(saveFn, ms){
        stopAutoSave();
        _autoSaveTimer = setInterval(()=>{
            try { saveFn(); } catch(e){}
        }, ms || 30000);
    }
    function stopAutoSave(){
        if(_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
    }

    // ======== طباعة ========
    function printReport(){
        _printing = true;
        setTimeout(()=>{ window.print(); _printing = false; }, 100);
    }

    // ======== اختصارات ========
    function initShortcuts(){
        document.addEventListener('keydown', (e)=>{
            if(e.ctrlKey && !e.shiftKey && !e.altKey){
                if(e.key.toLowerCase()==='s'){ e.preventDefault(); if(_config.onSave) _config.onSave(); }
                if(e.key.toLowerCase()==='p'){ e.preventDefault(); printReport(); }
            }
        });
    }

    // ======== بناء الشريط ========
    function buildToolbar(config){
        _config = config;
        injectStyles();
        document.body.classList.add('tb-active');

        const tb = document.createElement('div');
        tb.className = 'toolbar-pro no-print';
        tb.id = 'toolbarPro';

        let html = '';
        html += `<span class="tb-title">${config.title||'تقرير'}</span>`;
        html += `<span class="tb-sep"></span>`;

        html += `<span class="tb-group">`;
        html += `<span class="tb-lbl">الشهر:</span>`;
        html += `<select class="tb-select" id="selMonth"></select>`;
        html += `<span class="tb-lbl">السنة:</span>`;
        html += `<select class="tb-select" id="selYear"></select>`;
        html += `</span>`;
        html += `<span class="tb-sep"></span>`;

        html += `<button class="tb-btn tb-btn-save" onclick="ToolbarPro._save()">حفظ</button>`;
        html += `<span class="tb-sep"></span>`;
        html += `<button class="tb-btn" onclick="ToolbarPro.printReport()">طباعة</button>`;

        if(config.extraButtons){
            html += `<span class="tb-sep"></span>`;
            config.extraButtons.forEach(btn=>{
                html += `<button class="tb-btn" onclick="${btn.onclick}">${btn.text}</button>`;
            });
        }

        html += `<span class="tb-spacer"></span>`;
        html += `<span class="tb-info"><span class="tb-dot"></span> حفظ تلقائي</span>`;
        html += `<span class="tb-sep"></span>`;
        html += `<span class="tb-info" id="tbHijri"></span>`;
        html += `<span class="tb-sep"></span>`;
        html += `<button class="tb-btn" onclick="location.href='index.html'">الرئيسية</button>`;

        tb.innerHTML = html;
        document.body.prepend(tb);

        buildStatusBar();
        startClock();
        initShortcuts();

        if(config.onSave){
            startAutoSave(()=>{ config.onSave(true); }, 30000);
        }
        window.addEventListener('beforeunload', ()=>{
            if(!_printing && config.onSave) config.onSave(true);
        });
    }

    // ======== شريط الحالة ========
    function buildStatusBar(){
        const old = document.querySelector('.status-bar-pro');
        if(old) old.remove();
        const sb = document.createElement('div');
        sb.className = 'status-bar-pro no-print';
        sb.innerHTML = `<span id="sts">جاهز</span><span id="lastSave">آخر حفظ: --</span>`;
        document.body.appendChild(sb);
    }

    // ======== التاريخ الهجري ========
    function startClock(){
        function update(){
            const el = document.getElementById('tbHijri');
            if(!el) return;
            try {
                const now = new Date();
                const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{
                    day:'numeric', month:'long', year:'numeric'
                }).formatToParts(now);
                const d = parts.find(p=>p.type==='day');
                const m = parts.find(p=>p.type==='month');
                const y = parts.find(p=>p.type==='year');
                if(d&&m&&y) el.textContent = d.value+' '+m.value+' '+y.value+' هـ';
            } catch(e){ el.textContent = ''; }
        }
        update();
        setInterval(update, 60000);
    }

    // ======== إجراءات داخلية ========
    function _save(silent){ if(_config.onSave) _config.onSave(silent); }

    function sts(msg){
        const el = document.getElementById('sts');
        if(el) el.textContent = msg;
    }

    function updateLastSave(){
        const el = document.getElementById('lastSave');
        if(el) el.textContent = 'آخر حفظ: ' + new Date().toLocaleTimeString('ar-OM');
    }

    // ======== API ========
    return {
        build: buildToolbar,
        toast, printReport,
        sts, updateLastSave, _save,
        startAutoSave, stopAutoSave
    };
})();
