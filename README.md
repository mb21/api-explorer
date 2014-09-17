# API Explorer

1. Install:
    1. [Node.js](http://nodejs.org/)
    2. [MongoDB](https://www.mongodb.org).
    3. [OpenResty](http://openresty.org) – Nginx with modules: used as a proxy server to circumvent the browser's same-origin policy
2. Start `mongod`
3. Start OpenResty with the provided config: `openresty -c ./openresty.conf`
4. `npm start`
5. Point your web browser to `http://localhost:3000`, map an existing legacy Web API through the GUI and click the "Save API" button.
6. Point your HAL-browser to `http://localhost:3000/api/` to access the legacy API as if it were a HAL Hypermedia API.
