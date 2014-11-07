# API Explorer

This is a tool which provides a web-based GUI to map any JSON-based REST-like API within minutes, and subsequently access the mapped APIs through a HAL-compliant wrapper hypermedia API, and thus in a uniform manner.

Read the whole thesis: 
[HTML](http://mb21.github.io/api-explorer/a-web-based-tool-to-semi-automatically-import-data-from-generic-rest-apis.html),
[PDF](http://mb21.github.io/api-explorer/a-web-based-tool-to-semi-automatically-import-data-from-generic-rest-apis.pdf).

![Screenshot](http://mb21.github.io/api-explorer/images/screenshot.jpg)

### Getting started

1. Install:
    1. [Node.js](http://nodejs.org/)
    2. [MongoDB](https://www.mongodb.org).
    3. [OpenResty](http://openresty.org) – Nginx with modules: used as a proxy server to circumvent the browser's same-origin policy
2. Start `mongod`
3. Start OpenResty with the provided config: `openresty -c /absolute/path/to/openresty.conf`
4. Have a look at `config.js` and see whether the settings match your setup.
5. If you have made any changes: `npm install` and `npm compile`.
6. Finally: `npm start`
7. Point your web browser to `http://localhost:3000`, map an existing legacy Web API through the GUI and click the "Save API" button.
8. Point your HAL-browser to `http://localhost:3000/api/` to access the legacy API as if it were a HAL Hypermedia API.
