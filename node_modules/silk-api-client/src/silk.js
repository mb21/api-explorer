(function (window) {

var isNodeJs = typeof module === "object" && module && typeof module.exports === "object";

var SilkApi =
  function (url, secureUrl, modifyRequest)
  {
    var self = this;
    var postfix          = '/v' + this.version + '/';
    var contextUrl       = url + postfix;
    var secureContextUrl = (secureUrl || url.replace(/^http:/, "https:")) + postfix;

    this.cookieJar = isNodeJs ? require('request').jar() : undefined;

    if(!modifyRequest) modifyRequest = function(req) { return req; };

    var finalModifyRequest = function(req)
    {
      if (isNodeJs) req.jar = self.cookieJar;
      return modifyRequest(req);
    }

    SilkApi.setContext(this, contextUrl, secureContextUrl, finalModifyRequest);
  };

if (isNodeJs)
{
  // Export as Node module.
  module.exports = SilkApi;

  SilkApi.ajaxCall = nodeRequest;
}
else
{
  if (typeof define === "function" && define.amd)
    // Export as AMD.
    define("SilkApi", [], function () { return SilkApi; });

  else
    // Export as global.
    window.SilkApi = SilkApi;

  SilkApi.ajaxCall = jQueryRequest;
}

SilkApi.addObject = function (obj1, obj2)
{
  for (var fld in obj2)
    obj1[fld] = obj2[fld];
};

SilkApi.defaultAjaxOptions = {};
SilkApi.defaultHeaders = {};

function jQueryRequest (method, url, params, success, error, contentType, acceptHeader, data, callOpts, modifyRequest)
{
  var q = window.Q || function (a) { return a };

  var headers = $.extend(true, {}, SilkApi.defaultHeaders);
  SilkApi.addObject(headers, { Accept : acceptHeader });

  var callData =
    { type        : method
    , url         : url + (params ? '?' + $.param(params) : '')
    , cache       : false
    , success     : success || function () {}
    , error       : error || function () {}
    , contentType : contentType
    , headers     : headers
    , xhrFields   : { withCredentials: true }
    , data        : data || []
    };

  callData = modifyRequest(callData);

  SilkApi.addObject(callData, SilkApi.defaultAjaxOptions);
  SilkApi.addObject(callData, callOpts);

  return q($.ajax(callData));
}

function nodeRequest (method, url, params, onSuccess, onError, contentType, acceptHeader, data, callOpts, modifyRequest)
{
  var allParams = {};
  SilkApi.addObject(allParams, params);

  if (method === "GET" || method === "HEAD")
    // Avoid cached API responses.
    allParams._ = Date.now();

  var headers = { "Content-type" : contentType
                , "Accept"       : acceptHeader
                };

  SilkApi.addObject(headers, SilkApi.defaultHeaders);

  var callData =
    { url     : url
    , qs      : allParams
    , method  : method
    , headers : headers
    };

  if (data) callData.body = data;

  callData = modifyRequest(callData);

  SilkApi.addObject(callData, SilkApi.defaultAjaxOptions);
  SilkApi.addObject(callData, callOpts);

  return require("q").Promise(function (resolve, reject)
  {
    require("request")(callData, callback);

    function callback (error, message, body)
    {
      if (message && message.statusCode >= 200 && message.statusCode < 300)
      {
        var parsedResponse = parse(body);
        onSuccess && onSuccess(parsedResponse, message);
        resolve(parsedResponse)
      }
      else
      {
        if (!error)
        {
          error = new Error("HTTP request error");
          error.statusCode = message.statusCode;
          error.responseBody = body;
        }

        error.response = parse(body);

        if (onError)
          onError(error);

        reject(error);
      }
    }
  });

  function parse (response)
  {
    if (acceptHeader.split(";").indexOf('text/json') >= 0)
    {
      var r = response;
      try
      {
        r = JSON.parse(response);
      }
      catch (e)
      {
        return r;
      }
      return r;
    }
    else return response;
  }
}

SilkApi.setContext =
  function (obj, url, secureUrl, modifyRequest)
  {
    obj.contextUrl = url;
    obj.secureContextUrl = secureUrl;
    obj.modifyRequest = modifyRequest;
    for (var fld in obj)
    {
      if (obj[fld] != undefined && obj[fld].apiObjectType != undefined && obj[fld].apiObjectType == 'resourceDir')
      {
        var postfix = fld.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '/';
        SilkApi.setContext(obj[fld], url + postfix, secureUrl + postfix, modifyRequest);
      }
    }
  };SilkApi.prototype.version = "1.13.4";
SilkApi.prototype.Site =
  function Site (url, secureUrl, modifyRequest)
  {
    if (this instanceof Site)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Site.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.apiObjectType = "resourceDir";
SilkApi.prototype.Site.byUri =
  function (repositoryURI)
  {
    var postfix = 'uri/' + encodeURIComponent(repositoryURI) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.listBySearch =
  function (string, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'search/' + encodeURIComponent(string) + '/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.saveByUri =
  function (repositoryURI, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'uri/' + encodeURIComponent(repositoryURI) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.saveManyByUri =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'uri/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.available =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'available/', params, success, error, "text/plain", "text/json", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.suggest =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'suggest/', params, success, error, "text/plain", "text/plain,text/json", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.remove =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.secureContextUrl + '', params, success, error, "text/plain", "text/json", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.getImportStatus =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'import-status/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.enrich =
  function (xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'enrich/', params, success, error, "text/xml", "text/xml", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.query =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'query/', params, success, error, "text/plain", "text/xml", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.wipe =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.secureContextUrl + 'wipe/', params, success, error, "text/plain", "text/json", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.File =
  function File (url, secureUrl, modifyRequest)
  {
    if (this instanceof File)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return File.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.File.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.File.byId =
  function (uuid)
  {
    var postfix = 'id/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json,application/octet-stream", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.File.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.File.saveById =
  function (uuid, file, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(uuid) + '/', params, success, error, "application/octet-stream", "text/json", file, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.File.create =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + '', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.File.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Geodata =
  function Geodata (url, secureUrl, modifyRequest)
  {
    if (this instanceof Geodata)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Geodata.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Geodata.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Geodata.save =
  function (string, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + '' + encodeURIComponent(string) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Geodata.saveMany =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + '', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import =
  function Import (url, secureUrl, modifyRequest)
  {
    if (this instanceof Import)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Import.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Import.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Import.byId =
  function (uuid)
  {
    var postfix = 'id/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Import.latest =
  function ()
  {
    var postfix = 'latest/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Import.saveById =
  function (uuid, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(uuid) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.saveManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.removeManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.saveLatest =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'latest/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.upload =
  function (file, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'upload/', params, success, error, "application/octet-stream", "text/json", file, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.uploadJson =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'upload-json/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.uploadUrl =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'upload-url/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.prototype.getPreview =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'preview/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.prototype.getProgress =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'progress/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.prototype.start =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'start/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Import.prototype.reset =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'reset/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite =
  function Invite (url, secureUrl, modifyRequest)
  {
    if (this instanceof Invite)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Invite.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Invite.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Invite.byEmail =
  function (emailaddress)
  {
    var postfix = 'email/' + encodeURIComponent(emailaddress) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Invite.byCode =
  function (uuid)
  {
    var postfix = 'code/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Invite.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.saveByEmail =
  function (emailaddress, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/' + encodeURIComponent(emailaddress) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.saveManyByEmail =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.removeManyByEmail =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'email/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.saveByCode =
  function (uuid, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'code/' + encodeURIComponent(uuid) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.saveManyByCode =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'code/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.removeManyByCode =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'code/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.prototype.accept =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'accept/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Invite.prototype.resend =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'resend/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page =
  function Page (url, secureUrl, modifyRequest)
  {
    if (this instanceof Page)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Page.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Page.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Page.access =
  function (name)
  {
    var postfix = '' + encodeURIComponent(name) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Page.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.save =
  function (name, xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + '' + encodeURIComponent(name) + '/', params, success, error, "text/xml", "text/json", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.removeMany =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.getTransformed =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'transformed/', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.getPinned =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'pinned/', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.getTransformedPinned =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'transformed-pinned/', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave =
  function Autosave (url, secureUrl, modifyRequest)
  {
    if (this instanceof Autosave)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Autosave.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.byId =
  function (uuid)
  {
    var postfix = 'id/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.current =
  function ()
  {
    var postfix = 'current/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.saveById =
  function (uuid, xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(uuid) + '/', params, success, error, "text/xml", "text/json", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.removeManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.saveCurrent =
  function (xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'current/', params, success, error, "text/xml", "text/json", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Autosave.prototype.getTransformed =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'transformed/', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Version =
  function Version (url, secureUrl, modifyRequest)
  {
    if (this instanceof Version)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Version.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Page.prototype.Version.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Page.prototype.Version.byId =
  function (integer)
  {
    var postfix = 'id/' + encodeURIComponent(integer) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Page.prototype.Version.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Version.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Page.prototype.Version.prototype.restore =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'restore/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission =
  function Permission (url, secureUrl, modifyRequest)
  {
    if (this instanceof Permission)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Permission.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Permission.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Permission.current =
  function ()
  {
    var postfix = 'current/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Permission.byId =
  function (account)
  {
    var postfix = 'id/' + encodeURIComponent(account) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Permission.byEmail =
  function (emailaddress)
  {
    var postfix = 'email/' + encodeURIComponent(emailaddress) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Permission.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.saveCurrent =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'current/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.saveById =
  function (account, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(account) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.saveManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.removeManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.saveByEmail =
  function (emailaddress, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/' + encodeURIComponent(emailaddress) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.saveManyByEmail =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.removeManyByEmail =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'email/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Permission.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin =
  function Pin (url, secureUrl, modifyRequest)
  {
    if (this instanceof Pin)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Pin.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Pin.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Pin.byCollection =
  function (name)
  {
    var postfix = 'collection/' + encodeURIComponent(name) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Pin.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.saveByCollection =
  function (name, xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'collection/' + encodeURIComponent(name) + '/', params, success, error, "text/xml", "text/json", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.removeManyByCollection =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'collection/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.prototype.Version =
  function Version (url, secureUrl, modifyRequest)
  {
    if (this instanceof Version)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Version.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Pin.prototype.Version.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Pin.prototype.Version.byId =
  function (integer)
  {
    var postfix = 'id/' + encodeURIComponent(integer) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Pin.prototype.Version.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.prototype.Version.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Pin.prototype.Version.prototype.restore =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'restore/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription =
  function Subscription (url, secureUrl, modifyRequest)
  {
    if (this instanceof Subscription)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Subscription.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Subscription.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Subscription.byId =
  function (uuid)
  {
    var postfix = 'id/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Subscription.current =
  function ()
  {
    var postfix = 'current/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Subscription.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription.saveById =
  function (uuid, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(uuid) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription.saveManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription.removeManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription.saveCurrent =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'current/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Subscription.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag =
  function Tag (url, secureUrl, modifyRequest)
  {
    if (this instanceof Tag)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Tag.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Tag.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Tag.access =
  function (name)
  {
    var postfix = '' + encodeURIComponent(name) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Tag.save =
  function (name, xml, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + '' + encodeURIComponent(name) + '/', params, success, error, "text/xml", "text/json", xml, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.removeMany =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.prototype.remove =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.prototype.Version =
  function Version (url, secureUrl, modifyRequest)
  {
    if (this instanceof Version)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Version.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Tag.prototype.Version.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Tag.prototype.Version.byId =
  function (integer)
  {
    var postfix = 'id/' + encodeURIComponent(integer) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.Site.prototype.Tag.prototype.Version.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.prototype.Version.prototype.getMetadata =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'metadata/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Tag.prototype.Version.prototype.restore =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'restore/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.Site.prototype.Taglist =
  function Taglist (url, secureUrl, modifyRequest)
  {
    if (this instanceof Taglist)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Taglist.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.Site.prototype.Taglist.apiObjectType = "resourceDir";
SilkApi.prototype.Site.prototype.Taglist.access =
  function ()
  {
    var postfix = '';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/xml", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User =
  function User (url, secureUrl, modifyRequest)
  {
    if (this instanceof User)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return User.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.User.apiObjectType = "resourceDir";
SilkApi.prototype.User.byId =
  function (uuid)
  {
    var postfix = 'id/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User.byEmail =
  function (emailaddress)
  {
    var postfix = 'email/' + encodeURIComponent(emailaddress) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User.byResetCode =
  function (uuid)
  {
    var postfix = 'reset-code/' + encodeURIComponent(uuid) + '/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User.current =
  function ()
  {
    var postfix = 'current/';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.listBySearch =
  function (string, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + 'search/' + encodeURIComponent(string) + '/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveById =
  function (uuid, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/' + encodeURIComponent(uuid) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveManyById =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'id/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveByEmail =
  function (emailaddress, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/' + encodeURIComponent(emailaddress) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveManyByEmail =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'email/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveByResetCode =
  function (uuid, json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'reset-code/' + encodeURIComponent(uuid) + '/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveManyByResetCode =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'reset-code/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.saveCurrent =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("PUT", this.contextUrl + 'current/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.signin =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'signin/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.requestPassword =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'request-password/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.resetPassword =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'reset-password/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.getSessionMigration =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'get-session-migration/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.useSessionMigration =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'use-session-migration/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.unsubscribeDigests =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'unsubscribe-digests/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.unsubscribeNews =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'unsubscribe-news/', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.create =
  function (json, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.secureContextUrl + '', params, success, error, "text/json", "text/json", JSON.stringify(json), callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.prototype.remove =
  function (text, success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("DELETE", this.secureContextUrl + '', params, success, error, "text/plain", "text/json", text, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.prototype.signout =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'signout/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.prototype.become =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("POST", this.contextUrl + 'become/', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.prototype.Autosave =
  function Autosave (url, secureUrl, modifyRequest)
  {
    if (this instanceof Autosave)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Autosave.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.User.prototype.Autosave.apiObjectType = "resourceDir";
SilkApi.prototype.User.prototype.Autosave.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };
SilkApi.prototype.User.prototype.Permission =
  function Permission (url, secureUrl, modifyRequest)
  {
    if (this instanceof Permission)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Permission.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.User.prototype.Permission.apiObjectType = "resourceDir";
SilkApi.prototype.User.prototype.Permission.access =
  function ()
  {
    var postfix = '';
    var accessor = new this(this.contextUrl + postfix, this.secureContextUrl + postfix, this.modifyRequest);
    accessor.get =
      function (success, error, params, callOpts)
      {
        return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
      };
    return accessor;
  };
SilkApi.prototype.User.prototype.Subscription =
  function Subscription (url, secureUrl, modifyRequest)
  {
    if (this instanceof Subscription)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Subscription.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.User.prototype.Subscription.apiObjectType = "resourceDir";
SilkApi.prototype.User.prototype.Subscription.prototype.Site =
  function Site (url, secureUrl, modifyRequest)
  {
    if (this instanceof Site)
    {
      SilkApi.setContext(this, url, secureUrl, modifyRequest);
    }
    else
    {
      return Site.access(url, secureUrl, modifyRequest);
    }
  };
SilkApi.prototype.User.prototype.Subscription.prototype.Site.apiObjectType = "resourceDir";
SilkApi.prototype.User.prototype.Subscription.prototype.Site.list =
  function (success, error, params, callOpts)
  {
    return SilkApi.ajaxCall("GET", this.contextUrl + '', params, success, error, "text/plain", "text/json", undefined, callOpts, this.modifyRequest);
  };

})(this);
