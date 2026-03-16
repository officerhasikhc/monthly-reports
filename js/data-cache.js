/**
 * data-cache.js
 * Local data caching layer for the Monthly Reports system.
 * Provides fast read/write with localStorage + in-memory cache.
 * Separates each report module's data by prefix for maintainability.
 */

const DataCache = (function(){
    'use strict';

    // In-memory cache for hot reads
    const _mem = {};

    /**
     * Get data from cache (memory first, then localStorage)
     * @param {string} key - Storage key
     * @returns {*} Parsed data or null
     */
    function get(key){
        if(_mem[key] !== undefined) return _mem[key];
        const raw = localStorage.getItem(key);
        if(raw){
            try {
                const parsed = JSON.parse(raw);
                _mem[key] = parsed;
                return parsed;
            } catch(e){
                return null;
            }
        }
        return null;
    }

    /**
     * Set data to both memory cache and localStorage
     * @param {string} key - Storage key
     * @param {*} data - Data to store (will be JSON-serialized)
     */
    function set(key, data){
        _mem[key] = data;
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch(e){
            console.warn('[DataCache] localStorage write failed:', e.message);
        }
    }

    /**
     * Remove a key from both caches
     * @param {string} key
     */
    function remove(key){
        delete _mem[key];
        localStorage.removeItem(key);
    }

    /**
     * List all keys matching a prefix
     * @param {string} prefix
     * @returns {string[]} Matching keys
     */
    function keysWithPrefix(prefix){
        const result = [];
        for(let i=0; i<localStorage.length; i++){
            const k = localStorage.key(i);
            if(k && k.startsWith(prefix)) result.push(k);
        }
        return result;
    }

    /**
     * Get all saved reports for a given year
     * @param {string} prefix - Report storage prefix
     * @param {number} year
     * @returns {Array<{month:number, data:*}>}
     */
    function getYearReports(prefix, year){
        const reports = [];
        for(let m=1; m<=12; m++){
            const d = get(prefix + year + '_' + m);
            if(d) reports.push({month:m, data:d});
        }
        return reports;
    }

    /**
     * Export all data as a JSON blob (for backup)
     * @returns {string} JSON string
     */
    function exportAll(){
        const all = {};
        for(let i=0; i<localStorage.length; i++){
            const k = localStorage.key(i);
            if(k && k.startsWith('moh_')){
                all[k] = get(k);
            }
        }
        return JSON.stringify(all, null, 2);
    }

    /**
     * Import data from a JSON blob
     * @param {string} jsonStr
     * @returns {number} Number of keys imported
     */
    function importAll(jsonStr){
        const data = JSON.parse(jsonStr);
        let count = 0;
        for(const k in data){
            if(k.startsWith('moh_')){
                set(k, data[k]);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear memory cache (localStorage stays)
     */
    function clearMemory(){
        for(const k in _mem) delete _mem[k];
    }

    return {
        get, set, remove,
        keysWithPrefix,
        getYearReports,
        exportAll, importAll,
        clearMemory
    };
})();

if(typeof module !== 'undefined') module.exports = DataCache;
