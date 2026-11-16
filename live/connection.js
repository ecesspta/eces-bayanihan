/* Where this app finds its server. The key is the public "anon" key, which is safe to publish. */
(function () {
  var c = {
  "api": "https://fjbmejltekdfdbvpwqnm.supabase.co/functions/v1/eces",
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
