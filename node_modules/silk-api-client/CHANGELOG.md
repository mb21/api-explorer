# Changelog

## 2.0.0

Breaking changes:
* The `cookieJar` instance member is no longer available on sub resources. It can still be accessed on the top-level api object.

Additions:
* You can now optionally supply `modifyRequest(RequestObject) : RequestObject` as a third argument to `SilkApi`. This function, if present, will be called before every request and lets you modify the request object.

## 1.0.0

* Initial release, using API version `1.13.4`.
