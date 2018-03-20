this.addEventListener("fetch", function(n){
    var e = n.request,
    t = e.url,
    c = false,
    o = /^(?:(?:(?:([A-Za-z]+:)\/{2})|\/{2})([0-9\-A-Za-z]+[0-9.\-A-Za-z]+)(?::(\d+))?)?(?:(\/[^?#]*))?(?:(\?[^#]*))?(?:(#.*))?$/gi,
    s = null;
    "GET" === e.method && (s = o.exec(t));
    var u = /\_[a-zA-Z0-9]{7}\.(?:png|jpg|gif|css|js|swf)$/gi;
    s && s[4] && u.test(s[4]) && n.respondWith(caches.match(e)
    .then(function(n) {
        return n instanceof Response
            ? (c = true, n) 
            : fetch(e)
    })
    .then(function(n){
        return!c && n.ok && caches.open("md5-resource")
    .then(function(t){
        t.put(e, n)
    })
    .then(function() {},function() {}),n.clone()},function() {
        return fetch(e)
    }))
});