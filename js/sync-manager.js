/**
 * sync-manager.js
 * Middleware layer for syncing report data between tabs/windows.
 * Uses localStorage events to detect changes in other tabs and
 * provides hooks for future server sync (e.g., Google Sheets API).
 */

const SyncManager = (function(){
    'use strict';

    const _listeners = {};
    let _enabled = true;

    /**
     * Initialize sync manager - listen for storage changes from other tabs
     */
    function init(){
        window.addEventListener('storage', function(e){
            if(!_enabled) return;
            if(!e.key || !e.key.startsWith('moh_')) return;

            // Determine which report module this key belongs to
            const module = detectModule(e.key);
            if(module && _listeners[module]){
                _listeners[module].forEach(fn => {
                    try { fn(e.key, e.newValue); } catch(err){
                        console.warn('[SyncManager] Listener error:', err);
                    }
                });
            }

            // Fire global listeners
            if(_listeners['*']){
                _listeners['*'].forEach(fn => {
                    try { fn(e.key, e.newValue); } catch(err){}
                });
            }
        });
    }

    /**
     * Detect which report module a storage key belongs to
     */
    function detectModule(key){
        if(key.startsWith('moh_salary_')) return 'salary';
        if(key.startsWith('moh_clean_')) return 'clean';
        if(key.startsWith('moh_rentveh_')) return 'rentveh';
        if(key.startsWith('moh_employees')) return 'employees';
        if(key.startsWith('moh_workplace')) return 'workplace';
        return null;
    }

    /**
     * Register a listener for changes in a specific module
     * @param {string} module - Module name ('salary','clean','rentveh','*' for all)
     * @param {Function} callback - fn(key, newValue)
     */
    function on(module, callback){
        if(!_listeners[module]) _listeners[module] = [];
        _listeners[module].push(callback);
    }

    /**
     * Remove a listener
     */
    function off(module, callback){
        if(!_listeners[module]) return;
        _listeners[module] = _listeners[module].filter(fn => fn !== callback);
    }

    /**
     * Broadcast a change notification to other tabs
     * (Triggers storage event in other tabs automatically via localStorage)
     * @param {string} key
     * @param {*} data
     */
    function broadcast(key, data){
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch(e){
            console.warn('[SyncManager] Broadcast failed:', e.message);
        }
    }

    /**
     * Enable/disable sync
     */
    function enable(){ _enabled = true; }
    function disable(){ _enabled = false; }

    /**
     * Get last sync timestamp for a key
     */
    function getLastSync(key){
        const data = localStorage.getItem(key);
        if(data){
            try {
                const parsed = JSON.parse(data);
                return parsed.at || parsed.savedAt || null;
            } catch(e){}
        }
        return null;
    }

    /**
     * Future: sync with Google Sheets
     * Placeholder for server sync integration
     */
    function syncToServer(reportType, month, year, data){
        // TODO: Implement Google Sheets API integration
        console.log('[SyncManager] Server sync placeholder:', reportType, month, year);
        return Promise.resolve({status:'local_only'});
    }

    return {
        init, on, off, broadcast,
        enable, disable,
        getLastSync, syncToServer,
        detectModule
    };
})();

// Auto-initialize
if(typeof window !== 'undefined'){
    SyncManager.init();
}

if(typeof module !== 'undefined') module.exports = SyncManager;
