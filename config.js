'use strict';

var config = {
    label: "API Explorer",
    appName: "api-explorer",
    proxy: "http://localhost:8000/proxy/",
    host: "http://localhost:3000/api",
    hostBase: "http://localhost:3000",
    curies: [{ "name": "ns", "href": "https://github.com/mb21/api-explorer#{rel}", "templated": true }],
    maxHttpIters: 100
};

module.exports = config;

if (typeof window !== 'undefined') {
    app.factory('config', function() {
        return config;
    });
}
