/**
 * reliable-post.js
 * Ensures data persistence even when the browser/tab closes unexpectedly.
 * Uses beforeunload + visibilitychange to auto-save pending changes.
 * Also provides retry logic for future server POST operations.
 */

const ReliablePost = (function(){
    'use strict';

    const PENDING_KEY = 'moh_pending_saves';
    const _saveFns = {};

    /**
     * Register a save function for a report module.
     * Called automatically on page unload if there are unsaved changes.
     * @param {string} module - Module name
     * @param {Function} saveFn - Function that saves current state
     */
    function register(module, saveFn){
        _saveFns[module] = saveFn;
    }

    /**
     * Initialize auto-save on page events
     */
    function init(){
        // Save on page hide (works on mobile too)
        document.addEventListener('visibilitychange', function(){
            if(document.visibilityState === 'hidden'){
                autoSaveAll();
            }
        });

        // Save before unload
        window.addEventListener('beforeunload', function(){
            autoSaveAll();
        });

        // Retry any pending saves from previous session
        retryPending();
    }

    /**
     * Trigger all registered save functions
     */
    function autoSaveAll(){
        for(const mod in _saveFns){
            try {
                _saveFns[mod]();
            } catch(e){
                console.warn('[ReliablePost] Auto-save failed for:', mod, e.message);
                addPending(mod);
            }
        }
    }

    /**
     * Add a module to the pending retry queue
     */
    function addPending(module){
        const pending = getPendingList();
        if(!pending.includes(module)){
            pending.push(module);
            try {
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            } catch(e){}
        }
    }

    /**
     * Get list of modules with pending saves
     */
    function getPendingList(){
        try {
            return JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
        } catch(e){
            return [];
        }
    }

    /**
     * Retry pending saves
     */
    function retryPending(){
        const pending = getPendingList();
        if(pending.length === 0) return;

        const remaining = [];
        pending.forEach(mod => {
            if(_saveFns[mod]){
                try {
                    _saveFns[mod]();
                } catch(e){
                    remaining.push(mod);
                }
            }
        });

        if(remaining.length > 0){
            localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
        } else {
            localStorage.removeItem(PENDING_KEY);
        }
    }

    /**
     * Future: POST data to server with retry logic
     * @param {string} url - Server endpoint
     * @param {*} data - Data to POST
     * @param {number} maxRetries - Max retry attempts
     * @returns {Promise}
     */
    function postWithRetry(url, data, maxRetries = 3){
        let attempts = 0;

        function tryPost(){
            attempts++;
            return fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            }).then(res => {
                if(!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).catch(err => {
                if(attempts < maxRetries){
                    // Exponential backoff
                    const delay = Math.pow(2, attempts) * 500;
                    return new Promise(resolve => setTimeout(resolve, delay)).then(tryPost);
                }
                throw err;
            });
        }

        return tryPost();
    }

    return {
        init, register,
        autoSaveAll,
        postWithRetry,
        getPendingList
    };
})();

// Auto-initialize
if(typeof window !== 'undefined'){
    ReliablePost.init();
}

if(typeof module !== 'undefined') module.exports = ReliablePost;
