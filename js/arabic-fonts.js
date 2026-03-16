/**
 * Arabic & English Fonts Registry v1.0
 * ملف شامل للخطوط العربية والإنجليزية
 * يسهل الإضافة المستقبلية - فقط أضف خطاً جديداً في المصفوفة المناسبة
 * 
 * الاستخدام:
 *   ArabicFonts.all        → كل الخطوط
 *   ArabicFonts.arabic     → خطوط عربية
 *   ArabicFonts.english    → خطوط إنجليزية
 *   ArabicFonts.system     → خطوط النظام
 *   ArabicFonts.loadGoogle() → تحميل خطوط Google Fonts
 */
const ArabicFonts = (function(){
    'use strict';

    // ======== خطوط النظام (متوفرة دائماً) ========
    const SYSTEM_FONTS = [
        { name:'الافتراضي',           family:'inherit',                    cat:'system' },
        { name:'Arial',              family:'Arial, sans-serif',           cat:'system' },
        { name:'Tahoma',             family:'Tahoma, sans-serif',          cat:'system' },
        { name:'Times New Roman',    family:'"Times New Roman", serif',    cat:'system' },
        { name:'Courier New',        family:'"Courier New", monospace',    cat:'system' },
        { name:'Georgia',            family:'Georgia, serif',              cat:'system' },
        { name:'Verdana',            family:'Verdana, sans-serif',         cat:'system' },
        { name:'Trebuchet MS',       family:'"Trebuchet MS", sans-serif',  cat:'system' },
        { name:'Segoe UI',           family:'"Segoe UI", sans-serif',      cat:'system' },
    ];

    // ======== خطوط عربية (Google Fonts) ========
    const ARABIC_FONTS = [
        { name:'Cairo',              family:'"Cairo", sans-serif',              cat:'arabic', google:'Cairo:wght@400;700' },
        { name:'Tajawal',            family:'"Tajawal", sans-serif',            cat:'arabic', google:'Tajawal:wght@400;700' },
        { name:'Amiri',              family:'"Amiri", serif',                   cat:'arabic', google:'Amiri:wght@400;700' },
        { name:'Noto Naskh Arabic',  family:'"Noto Naskh Arabic", serif',      cat:'arabic', google:'Noto+Naskh+Arabic:wght@400;700' },
        { name:'Noto Kufi Arabic',   family:'"Noto Kufi Arabic", sans-serif',  cat:'arabic', google:'Noto+Kufi+Arabic:wght@400;700' },
        { name:'Almarai',            family:'"Almarai", sans-serif',            cat:'arabic', google:'Almarai:wght@400;700' },
        { name:'El Messiri',         family:'"El Messiri", sans-serif',         cat:'arabic', google:'El+Messiri:wght@400;700' },
        { name:'Changa',             family:'"Changa", sans-serif',             cat:'arabic', google:'Changa:wght@400;700' },
        { name:'Harmattan',          family:'"Harmattan", sans-serif',          cat:'arabic', google:'Harmattan:wght@400;700' },
        { name:'Lateef',             family:'"Lateef", serif',                  cat:'arabic', google:'Lateef:wght@400;700' },
        { name:'Scheherazade New',   family:'"Scheherazade New", serif',        cat:'arabic', google:'Scheherazade+New:wght@400;700' },
        { name:'Reem Kufi',          family:'"Reem Kufi", sans-serif',          cat:'arabic', google:'Reem+Kufi:wght@400;700' },
        { name:'Markazi Text',       family:'"Markazi Text", serif',            cat:'arabic', google:'Markazi+Text:wght@400;700' },
        { name:'Mada',               family:'"Mada", sans-serif',               cat:'arabic', google:'Mada:wght@400;700' },
        { name:'Katibeh',            family:'"Katibeh", serif',                 cat:'arabic', google:'Katibeh' },
        { name:'Aref Ruqaa',         family:'"Aref Ruqaa", serif',             cat:'arabic', google:'Aref+Ruqaa:wght@400;700' },
        { name:'Rakkas',             family:'"Rakkas", serif',                  cat:'arabic', google:'Rakkas' },
        { name:'Lalezar',            family:'"Lalezar", cursive',               cat:'arabic', google:'Lalezar' },
        { name:'Baloo Bhaijaan 2',   family:'"Baloo Bhaijaan 2", cursive',     cat:'arabic', google:'Baloo+Bhaijaan+2:wght@400;700' },
        { name:'IBM Plex Sans Arabic', family:'"IBM Plex Sans Arabic", sans-serif', cat:'arabic', google:'IBM+Plex+Sans+Arabic:wght@400;700' },
    ];

    // ======== خطوط إنجليزية (Google Fonts) ========
    const ENGLISH_FONTS = [
        { name:'Roboto',             family:'"Roboto", sans-serif',             cat:'english', google:'Roboto:wght@400;700' },
        { name:'Open Sans',          family:'"Open Sans", sans-serif',          cat:'english', google:'Open+Sans:wght@400;700' },
        { name:'Lato',               family:'"Lato", sans-serif',               cat:'english', google:'Lato:wght@400;700' },
        { name:'Montserrat',         family:'"Montserrat", sans-serif',         cat:'english', google:'Montserrat:wght@400;700' },
        { name:'Poppins',            family:'"Poppins", sans-serif',            cat:'english', google:'Poppins:wght@400;700' },
        { name:'Playfair Display',   family:'"Playfair Display", serif',        cat:'english', google:'Playfair+Display:wght@400;700' },
        { name:'Oswald',             family:'"Oswald", sans-serif',             cat:'english', google:'Oswald:wght@400;700' },
        { name:'Raleway',            family:'"Raleway", sans-serif',            cat:'english', google:'Raleway:wght@400;700' },
    ];

    let googleLoaded = false;

    // تحميل خطوط Google Fonts
    function loadGoogle(){
        if(googleLoaded) return;
        googleLoaded = true;

        const allGoogle = [...ARABIC_FONTS, ...ENGLISH_FONTS].filter(f=>f.google);
        if(!allGoogle.length) return;

        const families = allGoogle.map(f=>f.google).join('&family=');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
        document.head.appendChild(link);

        console.log(`[ArabicFonts] تم تحميل ${allGoogle.length} خط من Google Fonts`);
    }

    // API
    return {
        get system()  { return [...SYSTEM_FONTS]; },
        get arabic()  { return [...ARABIC_FONTS]; },
        get english() { return [...ENGLISH_FONTS]; },
        get all()     { return [...SYSTEM_FONTS, ...ARABIC_FONTS, ...ENGLISH_FONTS]; },
        loadGoogle,

        // إضافة خط مخصص (للاستخدام المستقبلي)
        addFont(font){
            if(font.cat === 'arabic') ARABIC_FONTS.push(font);
            else if(font.cat === 'english') ENGLISH_FONTS.push(font);
            else SYSTEM_FONTS.push(font);
        }
    };
})();
