/* Where this app finds its server. The key is the public "anon" key, which is safe to publish. */
(function () {
  // Refuse to be shown inside another website's frame.
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location; } catch (e) {}
  }
  var c = {
  "api": "",
  "key": ""
};
  [['eces-api', c.api], ['eces-key', c.key]].forEach(function (p) {
    if (!p[1]) return;
    var m = document.createElement('meta');
    m.name = p[0];
    m.content = p[1];
    document.head.appendChild(m);
  });
})();
