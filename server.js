'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var mongojs = require("mongojs");
var Q = require('q');
var _u = require('underscore');

var apiService = require('./apiService');
var config = require('./config');
var silkExport = require('./silkExport');

var app = express();
var db = mongojs.connect("apis", ["apis"]);

app.use( bodyParser.json() );
app.set('json spaces', 4); //prettify json
app.use('/', express.static(__dirname + '/public') );

// only used to access cached collection from external tools, like custom movie visualizer
var cors = require('cors')
app.use(cors())

var fillApiDesc = function(apiDesc) {
    apiDesc._links = {
        "self": {
            "href": config.host +"/"+ apiDesc._id +"/",
            "ns:template": config.host +"/{api}/",
            "title": apiDesc.label
        }
    };
    if (apiDesc._embedded && apiDesc._embedded["ns:endpoints"]) {
        apiDesc._embedded["ns:endpoints"].forEach( function(ep) {
            ep._links = {
                "self": {
                    "href": config.host +"/"+ apiDesc._id +"/"+ ep._id +"/",
                    "ns:template": config.host +"/{api}/{endpoint}/",
                    "title": ep.label
                }
            };
        });
    }
    return apiDesc;
};

var getColNamesPromise = function(){
    var deferred = Q.defer();
    db.getCollectionNames( function(err, colNames) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(
                _u.filter(colNames, function(name){
                    return name !== 'apis' && name.split('.')[0] !== 'system';
                })
            );
        }
    });
    return deferred.promise;
};


app.post('/silkExport/:apiId/:ecId/', function(req, res){
    db.apis.findOne( { _id: req.params.apiId }, function(err, apiDesc) {
        if (err) {
            res.send(500, err.message);
        } else if (apiDesc == null) {
            res.send(404);
        } else if ( Object.keys(req.body).length === 0 || !(req.body instanceof Array) ) {
            res.send(400, "Request body must be a JSON array.");
        } else {
            var ec = apiService.getEntityClass(apiDesc, req.params.ecId);
            silkExport.go(req.body, ec, function() {
                var json = {"status": "success"};
                res.send(json);
            }, function(err) {
                res.send(500, err.message);
            });
        }
    });
});

app.get('/swagger/:apiId', function(req, res){
    db.apis.findOne( { _id: req.params.apiId }, function(err, apiDesc) {
        if (err) {
            res.send(500, err.message);
        } else if (apiDesc == null) {
            res.send(404);
        } else {
            var json = apiService.swagger(apiDesc);
            res.send(json);
        }
    });
});

app.get('/api/', function(req, res){
    db.apis.find( function(err, docs) {
        if (err) {
            res.send(500, err.message);
        } else {
            getColNamesPromise().then( function(colNames) {
                var fillCachedCols = function(apiDesc) {
                    apiDesc._links["ns:cachedCollections"] = _u.filter(colNames, function(name){
                        return name.split('!')[0] == apiDesc._id
                    })
                    .map( function(name) {
                        var nameParts = name.split('!');
                        return {
                            "href": config.host +"/"+ nameParts[0] +"/!"+ nameParts[1] +"/",
                            "title": nameParts[1] + "Cache",
                            "name": "!"+ nameParts[1]
                        };
                    });
                    return apiDesc;
                };
                var json = {
                    "_links": {
                        "self": { "href": config.host +"/" },
                        "curies": config.curies
                    },
                    "_embedded": {
                        "ns:apis" : docs.map( _u.compose(fillCachedCols, fillApiDesc) )
                    }
                };
                json._links.curies = config.curies;
                res.send(json);
            }, function(err) {
                res.send(500, err.message);
            });
        }
    });
});

app.get('/api/:apiId/', function(req, res){
    db.apis.findOne( { _id: req.params.apiId }, function(err, apiDesc) {
        if (err) {
            res.send(500, err.message);
        } else if (apiDesc == null) {
            res.send(404);
        } else {
            var json = fillApiDesc(apiDesc);
            json._links.curies = config.curies.concat( apiService.curies(apiDesc) );
            res.send(json);
        }
    });
});
app.put('/api/:apiId', function(req, res) {
    //to move resource, PUT to old id with new id in json

    if ( Object.keys(req.body).length === 0 ) {
        res.send(400, "Request body mustn't be empty.");
        return;
    }

    var apiDesc = req.body;
    if (apiDesc._id === undefined) {
        apiDesc._id = apiService.cleanString( req.params.apiId );
    } else {
        apiDesc._id = apiService.cleanString( apiDesc._id );
    }

    //insert or update
    var resJson;
    db.apis.save(apiDesc, function(err, saved) {
        if(err || !saved) {
            res.send(500, err.message);
        } else {
           resJson = fillApiDesc(saved);
    
            //check if it's a move
            if (apiDesc._id != req.params.apiId) {
                db.apis.remove({_id: req.params.apiId }, true, function(err) {
                    if (err) {
                        res.send(500, err.message);
                    } else {
                        res.send(204);
                    }
                });
            } else {
                resJson._links.curies = config.curies.concat( apiService.curies(apiDesc) );
                res.send(resJson);
            }
        }
    });
});
app.delete('/api/:apiId', function(req, res) {
    db.apis.remove({_id: req.params.apiId}, true, function(err) {
        if(err) {
            res.send(500, err.message);
        } else {
            res.send(204);
        }
    });
});

// if endpointId prefixed with a !, it's a cached collection
// curl 'http://localhost:3000/api/rotten/!movie?sort=release_dates.theater&direction=-1'
// curl 'http://localhost:3000/api/rotten/!movie?silkExport=1'
app.get('/api/:apiId/!:ecId/', function(req, res){
    var ecId = req.params.ecId;
    var colName = req.params.apiId +"!"+ ecId;

    var sortOpts = {};
    var sortName = req.query.sort;
    var sortDirection = req.query.direction ? parseInt(req.query.direction) : 1;
    if (sortName) {
        sortOpts[sortName] = sortDirection;
    }

    db.collection(colName).find().sort(sortOpts, function(err, docs) {
        if (err) {
            res.send(500, err.message);
        } else {
            if ( req.query.silkExport === "1" ) {
                //export to silk
                db.apis.findOne( { _id: req.params.apiId }, function(err, apiDesc) {
                    if (err) {
                        res.send(500, err.message);
                    } else if (apiDesc == null) {
                        res.send(404);
                    } else {
                        var ec = apiService.getEntityClass(apiDesc, ecId);
                        silkExport.go(docs, ec, function() {
                            var json = {"status": "success"};
                            res.send(json);
                        }, function(err) {
                            res.send(500, err.message);
                        });
                    }
                });
            } else {
                //return cached collection
                var json = {
                    "_links": {
                        "self": {
                            "href": config.host +"/"+ req.params.apiId +"/!"+ ecId +"/",
                            "title": ecId + "Cache"
                        },
                        "curies": config.curies
                    },
                    "_embedded": {
                        "ns:results" : docs
                    }
                };
                res.send(json);
            }
        }
    });
});
app.delete('/api/:apiId/!:ecId/', function(req, res){
    var colName = req.params.apiId +"!"+ req.params.ecId;
    db.collection(colName).drop( function(err) {
        if (err) {
            res.send(500, err.message);
        } else {
            res.send(204);
        }
    });
});

// get one record of a cached collection
app.get('/api/:apiId/!:epId/:recId', function(req, res){
    var colName = req.params.apiId +"!"+ req.params.epId;
    var recId = req.params.recId;
    db.collection(colName).findOne( { _id: recId }, function(err, rec) {
        if (err) {
            res.send(500, err.message);
        } else if (rec == null) {
            res.send(404);
        } else {
            res.send(rec);
        }
    });
});
app.put('/api/:apiId/!:epId/:recId', function(req, res){
    var colName = req.params.apiId +"!"+ req.params.epId;
    if ( Object.keys(req.body).length === 0 ) {
        res.send(400, "Request body mustn't be empty.");
        return;
    }
    var rec = req.body;

    //set id
    if (rec._id === undefined) {
        rec._id = apiService.cleanString( req.params.recId );
    } else {
        rec._id = apiService.cleanString( rec._id.toString() );
    }
    
    //set links
    if (rec._links === undefined) {
        rec._links = {};
    }
    if (rec._links.self === undefined) {
        rec._links.self = {};
    }
    rec._links.self.href = config.host +"/"+ req.params.apiId +"/!"+ req.params.epId +"/"+ rec._id;
    rec._links.curies = config.curies;

    //insert or update
    db.collection(colName).save(rec, function(err, saved) {
        if(err || !saved) {
            res.send(500, err.message);
        } else {
            res.send(saved);
        }
    });
});
app.delete('/api/:apiId/!:epId/:recId', function(req, res){
    var colName = req.params.apiId +"!"+ req.params.epId;
    db.collection(colName).remove({_id: req.params.recId}, true, function(err) {
        if(err) {
            res.send(500, err.message);
        } else {
            res.send(204);
        }
    });
});

// with this route you can actually make queries to the original servers using the saved API descriptions
app.get(/^\/api\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)\/(.*)$/, function(req, res){
    var apiId = req.params[0];
    var endpointId = req.params[1];
    var url = req.params[2];
    db.apis.findOne({_id: apiId }, function(err, apiDesc) {
        if (err) {
            res.send(500, err.message);
        } else if (apiDesc === null) {
            res.send(404, "API '"+ apiId +"' not found.");
        } else {
            var epId = endpointId;
            var p;
            if (epId == "_") {
                if (url === undefined) {
                    var errMsg = "endpoint and url both undefined!";
                    console.error(errMsg);
                    res.send(400, errMsg);
                    return;
                }
                p = apiService.httpGet(url, apiDesc);
            } else {
                var ep = apiService.getEp(apiDesc, epId);
                if (ep === undefined) {
                    res.send(404, "Endpoint '"+ epId +"' not found.");
                    return;
                }
                p = apiService.query(apiDesc, ep, req.query, url)
                    .then( function(json) {
                        return apiService.wrapInTryCatch( function(){
                            var hostApiEp = config.host +"/"+ apiDesc._id +"/"+ (ep ? ep._id : "_") +"/";
                            if (json._links === undefined) {
                                json._links = {};
                            }
                            var slf = json._links.self;
                            console.log(json);
                            slf.href = apiService.buildUrl(hostApiEp + (url ? url : ""), req.query);
                            slf["ns:template"] = hostApiEp +
                                    (ep && ep.variables.length > 0
                                        ? "{?"+ ep.variables.map( function(v){ return v.key; }).join(",") +"}" : "");
                            slf["ns:template-general"] = config.host +"/{api}/{endpoint}/{url || ?templateParams}";
                            if (!slf.title) {
                                slf.title = apiDesc.label;
                            }
                            json._links.curies = config.curies.concat( apiService.curies(apiDesc) );
                            return json;
                        }, function(err){
                            res.send(500, err + "\n\n" + err.stack);
                        });
                    });
            }
            p.then( function(json) {
                res.send(json);
            }, function(err) {
                res.send(500, err + "\n\n" + err.stack);
            });
        }
    });
});

app.get("*", function(req, res) {
    res.send(404, "four oh four...");
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
