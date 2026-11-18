(function (root) {
  'use strict';
  const shapes = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    layout:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    lightbulb:'<path d="M9 18h6m-5 4h4m-6-8a7 7 0 1 1 8 0l-1 3H9z"/>',
    flag:'<path d="M4 22V4m0 1c4-3 8 3 12 0 2-1 3-1 4-1v12c-5-2-8 3-12 0-2-1-3-1-4-1"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    heart:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/>',
    chart:'<path d="M3 3v18h18M7 17v-5h3v5M13 17V7h3v10M19 17v-7h2v7"/>',
    message:'<path d="M21 11a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.8-5A9 9 0 1 1 21 11z"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m16 16 5 5"/>',
    refresh:'<path d="M20 11A8 8 0 0 0 6 6L3 9m0-6v6h6M4 13a8 8 0 0 0 14 5l3-3m0 6v-6h-6"/>',
    settings:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19 13.5 21 12l-2-1.5-.3-2.5-2.5-.3L14.5 5l-2.5 1-2.5-1L8 7.7l-2.5.3L5.2 10.5 3 12l2.2 1.5.3 2.5 2.5.3L9.5 19l2.5-1 2.5 1 1.5-2.7 2.5-.3z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    book:'<path d="M12 6c-3-2-6-2-9-2v15c3 0 6 0 9 2 3-2 6-2 9-2V4c-3 0-6 0-9 2zm0 0v15"/>',
    droplets:'<path d="M12 22c-4 0-7-3-7-7 0-4 7-13 7-13s7 9 7 13c0 4-3 7-7 7z"/>',
    sprout:'<path d="M12 22V12M12 12C5 12 4 8 4 4c5 0 8 3 8 8zm0 4c0-6 3-9 8-9 0 5-2 9-8 9z"/>',
    inbox:'<path d="M4 4h16v14H4zM4 13h5l2 3h2l2-3h5M7 21h10"/>',
    send:'<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:'<path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5.6 19 2 12 2 12a18 18 0 0 1 4.1-5.1M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    spark:'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8zM19 18l.6 2.4L22 21l-2.4.6L19 24l-.6-2.4L16 21l2.4-.6z"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    megaphone:'<path d="m3 11 15-7v16L3 13zM3 11v2M7 14l2 7h3l-3-8"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    workflow:'<rect x="2" y="3" width="7" height="6" rx="1"/><rect x="15" y="3" width="7" height="6" rx="1"/><rect x="9" y="15" width="7" height="6" rx="1"/><path d="M9 6h6M6 9v9h3m10-9v9h-3"/>',
    alert:'<path d="m12 2 10 18H2zM12 9v4m0 4h.01"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>'
  };
  function icon(name, size) {return '<svg aria-hidden="true" class="icon'+(size?' '+size:'')+'" viewBox="0 0 24 24">'+(shapes[name]||shapes.info)+'</svg>';}
  function esc(value) {return String(value == null?'':value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  root.ECESDesign = { icon, esc };
})(globalThis);
