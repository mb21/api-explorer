'use strict';

var config = {
    label: "API Explorer",
    appName: "apiExplorer",
    proxy: "http://localhost:8000/proxy/",
    host: "http://localhost:3000/api",
    hostBase: "http://localhost:3000",

    curies: [{ "name": "ns", "href": "https://github.com/mb21/api-explorer#{rel}", "templated": true }],
    maxHttpIters: 100,
    httpDelay: 5000,

    // only needed for export to www.silk.co
    silkApi: "http://api.silk.co",
    silkUser: "", //your silk email
    silkPassword: "" //your silk password
};

module.exports = config;

if (typeof window !== 'undefined') {
    app.factory('config', function() {
        return config;
    });
}
