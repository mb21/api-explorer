# Silk JavaScript API Client

## Installation

The latest release can be found on [npm](https://www.npmjs.org/)


```shell
$ npm install silk-api-client
```

## Example Usage

```javascript
var SilkApi = require("silk-api-client");
var Silk = new SilkApi("http://api.silk.co");

Silk.User.signin({ email : "me@example.com", password : "mypassword" }
                , function () { console.log("success"); }
                , function () { console.warn("error"); }
                );
```

## Contributing

This client has been automatically generated with the [Rest](http://silkapp.github.io/rest/) project, thus any changes to the JavaScript code need to be made externally from this project. Sending pull requests for package metadata updates and opening issues is still encouraged!
