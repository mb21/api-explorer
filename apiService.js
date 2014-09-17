'use strict';

var httpinvoke = require('httpinvoke');
var _u = require('underscore');
var Q = require("q");
var UriTemplate = require('uritemplate');
var URI = require('URIjs');
var JSPath = require('jspath');
var jsonld = require('jsonld');

var config = require('./config')


var mimeTypes = ['application/json', 'application/ld+json', 'application/hal+json', 'text/javascript'];
var httpOpts = {
    headers: {
        'Accept': mimeTypes.join(", ")
    }
};

//custom Error
function NotJSONError(message) {
    this.message = message;
    this.stack = Error().stack;
    this.type = "NotJSONError";
}
NotJSONError.prototype = Object.create(Error.prototype);
NotJSONError.prototype.name = "NotJSONError";

// a new httpinvoke with a hook to fail on 4xx and 5xx statuses
httpinvoke = httpinvoke.hook('finished', function(err, output, status, headers) {
    if(err) {
        return arguments;
    }
    var res = {
        body: output,
        statusCode: status,
        headers: headers
    };
    if(status >= 400 && status <= 499) {
        res.error = new Error('Client error: ' + status);
        return [res];
    }
    if(status >= 500 && status <= 599) {
        res.error = new Error('Server error: ' + status);
        return [res];
    }
    var format = headers['content-type'].split(";")[0];
    if (mimeTypes.indexOf(format) === -1) {
        //response not JSON
        res.error = new NotJSONError('Format not JSON but '+ format.split("/")[1].toUpperCase());
        return [res];
    }
    return arguments;
});


/*
 * Private  Helper Functions
 */

var buildParams = function(apiDesc) {
    return keyValArrayToObject(apiDesc.parameters);
};
var deepCollect = function(obj, fn, maxDepth) {
    var list = fn(obj);
    if (maxDepth > 0 || maxDepth === undefined) {
        if (obj instanceof Object) {
            for (var key in obj) {
                list = list.concat( deepCollect(obj[key], fn, maxDepth-1) );
            }
        } else if (obj instanceof Array) {
            obj.forEach( function(item) {
                list = list.concat( deepCollect(item, fn, maxDepth-1) );
            });
        }
    }
    return list;
};

// condition must be a predicate function
// action must be a function returning a promise
// returns the promise returned by the last call to action
var promiseWhile = function(condition, action) {
    var deferred = Q.defer();
    var loop = function(result) {
        if (!condition()) {
            deferred.resolve(result);
        } else {
            // if we wanted to break the loop on an error:
            // return action().then(loop, deferred.reject);
            return action().then(loop, loop);
        }
    };
    loop();
    return deferred.promise;
};

// [{ "key": "country", "val": "us"}] -> {"country": "us"}
var keyValArrayToObject = function(parsArr) {
    var obj = {};
    parsArr = parsArr || [];
    parsArr.forEach( function(item) {
        obj[item.key] = item.val;
    });
    return obj;
};

//adds links to obj
var setLinks = function(apiDesc, obj, links) {
    if (links.length > 0 ) {
        obj._links = {
            "self": {}
        };
        links.forEach( function(link) {
            var template;
            var epId;
            var prefix = config.host +"/"+ apiDesc._id +"/";
            if (link.endpoint) {
                epId = link.endpoint;
                template = prefix + epId +"/"+ apiService.getEp(apiDesc, epId).url;
            } else {
                epId = "_";
            }
            obj._links[ link.rel ] = {
                href: prefix + epId +"/"+ link.link,
                "ns:template": template 
            };
        });
    }
};



/*
 * Public Functions
 */
var apiService = {};

//httpinvoke and other promise-using libraries otherwise silently
// swallow exceptions when we're executing in their callbacks
apiService.wrapInTryCatch = function(fn, errCb, args) {
    try {
        return fn.apply(undefined, args);
    } catch(e) {
        console.error(e, e.stack);
        if (errCb) {
            errCb(e);
        }
    }
};
apiService.buildUrl = function(url, params) {
    //see https://github.com/angular/angular.js/pull/3213
    var uri = URI(url);
    var pars = [];
    params = params || {};
    for (var key in params) {
        uri.addSearch(key, params[key]);
    };
    return uri.toString(url + "?" + pars.join(""));
};
apiService.cleanString = function(str) {
    //make str url-friendly
    return str.replace(/(\s|\.|\/)/g, "-").replace(/[^a-zA-Z0-9-_]/g, '');
};
apiService.getApiDesc = function(apisArr, id) {
    //returns object
    return _u.findWhere( apisArr, { "_id": id } );
};
apiService.deleteApiDesc = function(containingObj, key, id) {
    //only modifies containingObj
    var arr = _u.filter( containingObj[key], 
        function(apiDesc){ return apiDesc._id != id; } );
    containingObj[key] = arr;
};
apiService.getEp = function(apiDesc, epId) {
    //returns object
    return _u.findWhere( apiDesc._embedded["ns:endpoints"], { "_id": epId } );
};
apiService.deleteEp = function(apiDesc, epId) {
    //only modifies apiDesc
    apiDesc._embedded["ns:endpoints"] = _u.filter( apiDesc._embedded["ns:endpoints"], 
        function(ep){ return ep._id != epId; } );
};
apiService.getEntityClass = function(apiDesc, ecId) {
    //returns object
    return _u.findWhere( apiDesc.entityClasses, { "_id": ecId } );
};
apiService.deleteEntityClass = function(apiDesc, ecId) {
    //only modifies apiDesc
    apiDesc.entityClasses = _u.filter( apiDesc.entityClasses, 
        function(ec){ return ec._id != ecId; } );
};
//returns a string or false
apiService.getPaginationVarName = function(ep) {
    var variable = _u.findWhere( ep.variables, { "isPaginationVar": true } );
    return variable ? variable.key : false;
};

apiService.httpGet = function(url, apiDesc) {
    var proxyUrl;
    if (apiDesc) {
        proxyUrl = apiService.buildUrl(config.proxy + url, buildParams(apiDesc));
    } else {
        proxyUrl = config.proxy + url;
    }
    return httpinvoke(proxyUrl, "GET", httpOpts)
        .then( function(res) {
            return JSON.parse(res.body);
        });
};

// expands the URL from the URI Template in the specified endpoint
// variables is optional
apiService.endpointToUrl = function(ep, variables) {
    var template = UriTemplate.parse(ep.url);
    var vars = keyValArrayToObject(ep.variables);
    if (variables) {
        vars = _u.extend(vars, variables);
    }
    return template.expand(vars);
};

//returns the results, extracted from the response or false
apiService.extractResults = function(ep, response) {
    if (ep === undefined) {
        console.error("ep is undefined");
        return;
    }
    if (ep.resultsPath == undefined || ep.resultsPath.length <= 0) {
        return false
    } else {
        return JSPath.apply(ep.resultsPath, response);
    }
};

//return links in obj (which is an Entity)
apiService.getEntityClassLinks = function(ec, obj, currentUrl) {
    if (ec === undefined) {
        console.error("ec is undefined");
        return;
    }
    var links = [];

    //custom links defined in ec (EntityClass) description
    ec.links.forEach( function(link) {
        var vars = {};
        if (link.additionalVars) {
            _u.filter(link.additionalVars, function(item) { return item.val; }).forEach( function(item) {
                var res = JSPath.apply(item.val, obj);
                if (res.length > 1) {
                    console.warn("JSPath result supposed to be singleton but contained " + res.length + " elements.");
                }
                vars[ item.key ] = res[0];
            });
        }
        var template = UriTemplate.parse(link.val);
        _u.extend(vars, obj);

        //add currentUrl
        var path = currentUrl.split("/");
        for (var i=0; i<path.length; i++) {
            vars["_path" + i] = path[i];
        }

        links.push( {
            "rel": link.key,
            "link": template.expand(vars),
            "endpoint": link.endpoint
        });
    });

    return links;
};
// maxDepth is optional
apiService.getRegexLinks = function (apiDesc, obj, maxDepth) {
    var links = [];
    var regexStr = apiDesc.linksRegex ? apiDesc.linksRegex : ("^"+apiDesc.baseURL);
    if (regexStr != "^") {
        var regex = new RegExp(regexStr);
        deepCollect(obj, function(o) {
            for (var key in o) {
                var val = o[key];
                if ( regex.test(val) ) {
                    links.push( {
                        "rel": key,
                        "link": val,
                        "endpoint": undefined
                    });
                }
            }
            return [];
        }, maxDepth);
    }
    return links;
};
//get HAL-like links from linkObj
apiService.getHalLinks = function (obj, url) {
    var linkObj;
    if (obj._links) {
        linkObj = obj._links;
        //delete obj._links;
    } else {
        linkObj = obj.links;
        //delete obj.links;
    }
    var links = [];
    for (var key in linkObj) {
        var val = linkObj[key];
        if (typeof val == "string") {
            //simple link like Rotten Tomatoes
            links.push( {
                "rel": key,
                "link": val,
                "endpoint": undefined
            });
        } else if (val.href) {
            //HAL link
            //HAL spec currently doesn't say relative to what, assume to document URL
            links.push( {
                "rel": val.title ? val.title : key,
                "link": URI(val.href).absoluteTo(url+"/").toString(),
                "endpoint": undefined
            });
        }
    };
    return links;
};
// returns a Promise of an array of link objects
apiService.getJsonLdLinksPromise = function (obj, url) {
    var endsWith = function (str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    };

    //try to set baseUrl right
    var contextType = typeof obj["@context"];
    if (contextType === "string") {
        //external context
        var absoluteContext = URI(obj["@context"]).absoluteTo(url).toString();
        obj["@context"] = [
            absoluteContext, {
                "@base": url
            }
        ];
    } else if (contextType === "object") {
        //in-document context
        obj["@context"]["@base"] = url;
    }
    return jsonld.promises().expand(obj) //if this breaks, just redownload from url to get baseUrl etc. right
        .then( function(expanded) {
            var isId = function(val, key) { return key == "@id"; };
            var rawlinks = deepCollect(expanded, function(obj) {
                return _u.filter(obj, isId);
            });

            var links = [];
            rawlinks.forEach( function(link) {
                //try to find originial key of link to use as rel, bit hacky, doesn't always work
                var rel = link; 
                for( var key in obj) {
                    if ( endsWith(link, obj[key]) ) {
                        rel = key;
                        break;
                    }
                }
                //emit our links
                links.push( {
                    "rel": rel,
                    "link": link,
                    "endpoint": undefined
                });
            });
            return links;
        }, function(err) {
            console.error("Couldn't expand JSON-LD", err);
            throw err;
        });
};

apiService.getPaginationLinks = function(ep, url) {
    var varName = ep ? apiService.getPaginationVarName(ep) : false;
    if (varName) {
        var template = UriTemplate.parse(ep.url);
        var vars = keyValArrayToObject(ep.variables);

        //extract current pagination number from url
        var uri = new URI(url);
        var pageNr = parseInt( uri.search(true)[varName] ) || 0;
        vars[varName] = pageNr + 1;
        var links = [{
            "rel": "next",
            "link": template.expand(vars),
            "endpoint": undefined
        }];
        if (pageNr > _u.findWhere( ep.variables, { "isPaginationVar": true }).val ){
            //generate previous link if not falling under default
            vars[varName] = pageNr - 1;
            links.push({
                "rel": "previous",
                "link": template.expand(vars),
                "endpoint": undefined
            });
        }
        return links;
    } else {
        return [];
    }
};


// currently NOT returning a promise!
// TODO: decide whether it should and how to do JSON-LD
apiService.setAllLinks = function(apiDesc, ep, responseData, url) {
    return apiService.wrapInTryCatch(function(){
        // endpoint
        var json = _u.clone(responseData);

        //if http header == "application/ld+json"
        //apiService.getJsonLdLinksPromise(json, url)
        //    .then( function(jsonLdLinks) {
        //    });
        var globalLinks = apiService.getHalLinks(json, url)
            //.concat(jsonLdLinks)
            .concat(
                apiService.getPaginationLinks(ep, url),
                apiService.getRegexLinks(apiDesc, json, 1)
            );

        var setTitle = function(ec, obj) {
            if (ec && ec.titlePath.length > 0) {
                var res = JSPath.apply(ec.titlePath, obj);
                if (Object.prototype.toString.call(res) === '[object Array]'
                        && res.length === 1
                        && typeof res[0] === "string"
                        && res[0].length > 0) {
                    if (obj._links === undefined) {
                        obj._links = {};
                    }
                    if (obj._links.self === undefined) {
                        obj._links.self = {};
                    }
                    obj._links.self.title = res[0];
                }
            }
        };

        if (ep) {
            var results = [];
            var ec = apiService.getEntityClass(apiDesc, ep.resultType);
            var extrRes = apiService.extractResults(ep, json);
            // check: extrRes && Object.prototype.toString.call(extrRes) === '[object Array]'
            if (ep.cardinality === 1) {
                //singleton
                extrRes = extrRes[0] || extrRes;
                if (extrRes !== false) {
                    _u.extend(json, extrRes);
                    responseData = extrRes; //replace original object with extracted results
                }
                var entityLinks = ec ? apiService.getEntityClassLinks(ec, json, url) : [];
                globalLinks = globalLinks.concat(entityLinks);
            } else if(extrRes && extrRes instanceof Array) {
                //multiple results entities: set their links
                extrRes.forEach( function(originalResult) {
                    var result = _u.clone(originalResult);
                    var entityLinks = ec ? apiService.getEntityClassLinks(ec, result, url) : [];
                    setLinks(apiDesc, result,
                            apiService.getHalLinks(result, url)
                            .concat( entityLinks ) //must be last so custom properties take precedence
                        );
                    setTitle(ec, result);
                    results.push(result);
                });
                responseData._embedded = { "ns:results": results };
            }
        }

        //set links in global object
        _u.filter(globalLinks, function(link) {
            if (ep && ["next", "previous", "prev"].indexOf(link.rel) != -1) {
                // is next/prev link
                link.endpoint = ep._id;
            }
        });
        setLinks(apiDesc, responseData, globalLinks);
        setTitle(ec, responseData);
        return responseData;
    });
};

// returns a promise with the standardized JSON
// variables and url are optional, if url provided that will be used instead of the one in ep
apiService.query = function (apiDesc, ep, variables, url) {
    var expandedUrl = url ? apiService.buildUrl(url, variables) : apiService.endpointToUrl(ep, variables);
    return apiService.httpGet(expandedUrl, apiDesc)
        .then( function(response) {
            return apiService.setAllLinks(apiDesc, ep, response, expandedUrl);
        }, console.error);
};
apiService.unparsedQuery = function (apiDesc, ep, variables, url) {
    var expandedUrl = url ? apiService.buildUrl(url, variables) : apiService.endpointToUrl(ep, variables);
    return apiService.httpGet(expandedUrl, apiDesc);
};

// returns a promise of the filled in tree
// url is optional, default is baseURL
// progressCb is optional, called after every HTTP request with the updated tree as an argument
apiService.crawl = function(apiDesc, url, progressCb) {
    var allLinks = [];
    var globalTree = {
        url: (url ? url : apiDesc.baseURL),
        name: "Root"
    };

    //BFS using promiseWhile as a loop...
    var next = [globalTree];
    var i = 0;
    var queue = [];
    var finishIter = function() {
        i++;
        next = queue.shift();
        progressCb(globalTree);
        return globalTree;
    };
    var cleanName = function(url) {
        var uri = new URI( url.replace(new RegExp("^"+apiDesc.baseURL), '') );
        for (var key in buildParams(apiDesc) ) {
            uri.removeQuery(key)
        }
        return uri.toString();
    }
    return promiseWhile( function() {
        return (next && i<config.maxHttpIters);
    }, function() {
        var tree = next[0];
        var parnt = next[1];
        if (parnt) {
            parnt.children.push(tree);
        }
        return apiService.httpGet(tree.url, apiDesc)
            .then( function(json) {
                //HTTP success
                apiService.wrapInTryCatch( function() {
                    tree.children = [];
                    tree.response = json;

                    var richLinks = apiService.getHalLinks(json, tree.url).concat(
                        apiService.getRegexLinks(apiDesc, json)
                    );
                    var links = richLinks.map( function(link){ return link.link; } );
                    links.forEach( function(url) {
                        var child = {
                            url: url,
                            name: cleanName(url)
                        };
                        queue.push([child, tree]);
                    });

                });
                return finishIter();
            }, function(res) {
                //HTTP failure
                var err = res.error || res;
                tree.name = cleanName(tree.url);
                tree.errMsg = err.message;
                tree.statusCode = res.statusCode;
                return finishIter();
            });

    });
};

// returns a JSON object according to the Swagger 2.0 spec https://github.com/wordnik/swagger-spec/blob/master/versions/2.0.md
apiService.swagger = function(apiDesc) {
    var paths = {};
    var regex = new RegExp("^" + apiDesc.baseURL.replace(/\/$/, ''));
    apiDesc._embedded["ns:endpoints"].forEach( function(ep) {
        var path = ep.url.replace(regex, '');
        paths[path] = {
            "get": {
                "summary": ep.description,
                "operationId": ep._id,
                "responses": {
                    "default": {
                        "description": "Any response."
                    }
                },
                "parameters": ep.variables.map( function(variable){
                    return {
                        "name": variable.key,
                        "in": "path",
                        "required": true, //swagger 2.0 spec says if `in: 'path'` then `required: true`
                        "description": variable.val ? ('e.g. ' + variable.val) : undefined
                    };
                })
            }
        };
    });
    var baseURI = URI(apiDesc.baseURL);
    return {
        "swagger": "2.0",
        "info": {
            "title": apiDesc.label,
            "description": apiDesc.description || "",
            "version": apiDesc.version || "",
        },
        "host": baseURI.authority().toString(),
        "basePath": baseURI.path().toString().replace(/\/$/, ''),
        "schemes": [ baseURI.protocol().toString() ],
        "paths": paths
    };
};


// Register module
if (typeof window === 'undefined') {
    module.exports = apiService;
} else {
    //angular
    app.factory('apiService', function() {
        return apiService;
    });
}
