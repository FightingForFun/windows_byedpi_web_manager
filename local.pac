function FindProxyForURL(url, host) {
    var servers = [
    {
        "ip": "127.0.0.1",
        "port": 20001,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20002,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20003,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20004,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20005,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20006,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20007,
        "domains": []
    },
    {
        "ip": "127.0.0.1",
        "port": 20008,
        "domains": []
    }
];

    var exactMap = {};
    var suffixRules = [];
    
    for (var i = 0; i < servers.length; i++) {
        var server = servers[i];
        var domains = server.domains;
        for (var j = 0; j < domains.length; j++) {
            var domain = domains[j].toLowerCase();
            exactMap[domain] = server;
            suffixRules.push({ domain: "." + domain, server: server });
        }
    }
    
    if (Object.keys(exactMap).length === 0 && suffixRules.length === 0) {
        return "DIRECT";
    }
    
    suffixRules.sort(function(a, b) {
        return b.domain.length - a.domain.length;
    });
    
    var lowerHost = host.toLowerCase();
    
    if (exactMap.hasOwnProperty(lowerHost)) {
        var server = exactMap[lowerHost];
        return "SOCKS5 " + server.ip + ":" + server.port;
    }
    
    for (var k = 0; k < suffixRules.length; k++) {
        var rule = suffixRules[k];
        if (dnsDomainIs(lowerHost, rule.domain)) {
            return "SOCKS5 " + rule.server.ip + ":" + rule.server.port;
        }
    }
    
    return "DIRECT";
}