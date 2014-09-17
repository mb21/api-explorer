'use strict';

/*
 *************************
 *
 *   Controllers
 * 
 *************************
 */


function ExploreCtrl($scope, $routeParams, $http, $q, apiService, navigation, cachedCollections, state, config) {

    $scope.defaultEntityClass= {
        _id: "new-entityclass",
        label: "New EntityClass",
        titlePath: "", //JSPath expression
        links: []
    },
    $scope.defaultEndpoint = {
        _id: "new-endpoint",
        label: "New Endpoint",
        url: "",
        description: "",
        variables: [],
        cardinality: 0, // 1==singelton, 0==collection
        resultType: "",
        resultsPath: "" //JSPath expression
    };
    $scope.defaultApiDesc = {
        _id: "new-api",
        label: "New API Description",
        description: "",
        version: "",
        baseURL: "",
        linksRegex: "",
        _embedded: {
            "ns:endpoints": [],
        },
        entityClasses: []
    };


    $scope.apis = state.apis;
    $scope.state = state; //to sync with recursive directives as a kind of global variable


    //APIs
    $scope.currentApiDesc = function() {
        return $scope.apis ? apiService.getApiDesc($scope.apis, $routeParams.apiId) : false;
    };
    $scope.deleteCurrentApi = function() {
        $scope.deletingApi = "loading";
        $http.delete( config.host +"/"+ $routeParams.apiId +"/")
            .then( function() {
                $scope.deletingApi = "";
                apiService.deleteApiDesc(state, "apis", $routeParams.apiId);
                navigation.go(1, "_");
            }, console.error);
    };
    $scope.saveCurrentApi = function() {
        var apiDesc = $scope.currentApiDesc();
        $scope.savingApi = "loading";
        //if resource was renamed, PUT to _oldId
        var id = apiDesc._oldId ? apiDesc._oldId : apiDesc._id;
        delete apiDesc._oldId;

        $http.put( config.host +"/"+ id +"/", apiDesc)
            .then( function() {
                $scope.savingApi = "";
                apiDesc._oldId = apiDesc._id;
            }, function(err) {
                console.error(err);
                apiDesc._oldId = apiDesc._id;
            });
    };

    //Endpoints
    $scope.currentEndpoint = function() {
        if ($scope.currentApiDesc()) {
            return apiService.getEp( $scope.currentApiDesc(), $routeParams.endpointId );
        }
    };
    $scope.deleteCurrentEndpoint = function() {
        var epId = $routeParams.endpointId;
        apiService.deleteEp( $scope.currentApiDesc(), epId);
        navigation.go(2, "_");
    };
    $scope.currentCachedCollection = function() {
        var epId = $routeParams.endpointId;
        return (epId.charAt(0) === "!") ? epId.substring(1) : false;
    };

    //url and id are both are optional
    $scope.addEndpoint = function(url, id) {
        url = url || navigation.pathArr()[3];
        var ep = $scope.defaultEndpoint;
        var eps = $scope.currentApiDesc()._embedded["ns:endpoints"]
        ep.url = url;
        if (id) {
            ep._id = apiService.cleanString(id);
        }
        eps.push(ep);
        navigation.go(2, ep._id);
    };
    $scope.isSingleton = function() {
        return $scope.currentEndpoint() && $scope.currentEndpoint().cardinality === 1;
    };

    //EntityClasses
    $scope.currentEntityClass = function() {
        if ($scope.currentApiDesc()) {
            return apiService.getEntityClass($scope.currentApiDesc(), $routeParams.entityClassId);
        }
    };
    $scope.deleteCurrentEntityClass = function() {
        apiService.deleteEntityClass($scope.currentApiDesc(), $routeParams.entityClassId);
        navigation.go(0, "_");
    };


    //Actions
    $scope.browse = function(url) {
        //strip localhost-stuffs
        if (url) {
            var matches = url.substring(config.host.length)
                .match(/^\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)\/(.*)$/);
            if (matches && matches[2] && matches[3]) {
                navigation.set(2, matches[2]).set(3, matches[3]);
                return navigation.getPath();
            }
        }
    };
    $scope.browseWithoutEp = function(url) {
        navigation.set(2, "_").set(3, url);
        navigation.goNow();
    };
    $scope.queryEndpoint = function() {
        try {
            var expandedUrl = apiService.endpointToUrl( $scope.currentEndpoint() );
            navigation.go(3, expandedUrl);
        } catch(e) {
            if (e.options) {
                alert("The URI Template is invalid: " + e.options.message);
            } else {
                console.error(e);
            }
        }
    };
    var crawl = function() {
        var ep = $scope.currentEndpoint();
        var url = ep ? apiService.endpointToUrl(ep) : null;
        apiService.crawl($scope.currentApiDesc(), url, function(tree) {
            $scope.$apply( function() {
                state.crawlCache = tree;
                $scope.tree = tree;
            });
        });
    };
    $scope.crawl= function(crawlApi) {
        delete state.crawlCache;
        delete $scope.tree;
        if (crawlApi) {
            navigation.set(2, "_");
        }
        navigation.set(3, "crawl");
        navigation.goNow();
        crawl();
    };
    
    $scope.isEndpoint = function() {
        return $routeParams.endpointId !== "_";
    };
    $scope.getServerPath = function() {
        return config.host +"/"+ navigation.pathArr().slice(1).join("/");
    };

    $scope.updateAll= function() {
        $scope.updatingAll = "loading";
        var ecId  = $scope.cachedCollectionRes._links.self.title.slice(0, -5); //remove trailing "Cache"
        var proms = $scope.cachedCollectionRes._embedded['ns:results'].map( function(json, index, arr) {
            return cachedCollections.update(json) //get updated json from API
                .then( function(json) {
                    return cachedCollections.put(ecId, json); //save to server
                }).then( function(json) {
                    arr[index] = json; //update in GUI
                    return json
                });
        });
        $q.all(proms).then( function() {
            $scope.updatingAll = "";
        });
    };

    //init or on route change
    var url = navigation.pathArr()[3];
    state.url = url;
    if (url === "crawl") {
        if (state.crawlCache) {
            $scope.tree = state.crawlCache;
        } else {
            crawl();
        }
    } else if (url != "_") {
        $scope.queryLoading = "loading"; //show loading indicator
        apiService.unparsedQuery($scope.currentApiDesc(), $scope.currentEndpoint(), null, url)
            .then(function(res) {
                var resCache = false;
                if (!resCache) {
                    resCache = res;
                }
                //setup stupid watch to recalculate links after JSPath etc. changed
                $scope.$watch("currentApiDesc()", function(newVal, oldVal) {
                    if (resCache) {
                        var res = apiService.setAllLinks( $scope.currentApiDesc(), $scope.currentEndpoint(), resCache, navigation.pathArr()[3])
                        if (res && res._links) {
                            //get rid of HAL "curies" entry that isn't an actual link
                            delete res._links.curies;
                        }
                        $scope.response = {
                            data: res
                        };
                    }
                }, true);

                $scope.$apply( function() {
                    $scope.queryLoading = "";
                });
            },
            function(res) {
                var err = res.error || res;
                if (err.type === "NotJSONError") {
                    var leave = window.confirm(
                        "This URL doesn't return JSON, do you want to navigate there instead? Unsaved changes to the API description will be lost.");
                    if (leave) {
                        window.location = url;
                    } else {
                        $scope.$apply( function() {
                            $scope.queryLoading = "";
                            $scope.errMsg = "Response wasn't JSON.";
                        });
                    }
                } else {
                    $scope.$apply( function() {
                        $scope.queryLoading = "";
                        $scope.errMsg = "Couldn't load resource. " + (err.message ? err.message+"." : "");
                        console.error(err);
                    });
                }
            });
    } else if ($routeParams.endpointId.charAt(0) === "!") {
        //download items in cached collection
        $scope.queryLoading = "loading";
        cachedCollections.getCurrent()
            .then( function(res){
                $scope.queryLoading = "";
                $scope.cachedCollectionRes = res.data;
            }, console.error);
    }


    //hack to let recursive JSON-directive access controllerScope
    state.setResults = function(path) {
        $scope.currentEndpoint().resultsPath = path;
    };
    state.browseWithoutEp = $scope.browseWithoutEp;
    state.addEndpoint = $scope.addEndpoint;

    //remember scroll position
    (function(){
        var scrollTop = 0;
        $scope.$on('$locationChangeStart', function(event) {
            scrollTop = $(".config")[0].scrollTop;
        });
        $scope.$on('$locationChangeSuccess', function(event) {
            setTimeout(function(){
                $(".config")[0].scrollTop = scrollTop;
            }, 0);
        });
    })();
}

