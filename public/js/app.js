'use strict';

var app = angular.module('app', ['ngRoute', 'JSONedit'], function($routeProvider) {
    $routeProvider
        .when('/:entityClassId/:apiId/:endpointId/:url*', {
            templateUrl: '/partials/explore.html',
            controller: "ExploreCtrl",
            resolve: {
                state: function(state) {
                    return state.getState();
                }
            }
        })
        .otherwise({redirectTo: '/_/_/_/_'});
});

app.factory('state', function($http) {
    var p = $http.get("/api/")
            .then( function(res) {
                return {
                    apis: res.data._embedded["ns:apis"].map( function(apiDesc){
                            apiDesc._oldId = apiDesc._id
                            return apiDesc;
                        }),
                    cachedCollections: res.data._links["ns:cachedCollections"]
                };
            });
    return {
        getState: function() {
            return p;
        }
    };
});

app.factory('cachedCollections', function($http, navigation, config) {
    var getApiId = function(){ return navigation.pathArr()[1]; };
    return {
        getCurrent: function() {
            return $http.get(config.host +"/"+ getApiId() +"/"+ navigation.pathArr()[2] +"/")
        },
        put: function(ecId, json) {
            if (ecId === undefined) {
                throw new Error("No entityClass id provided");
            }
            var id = (json._id !== undefined) ? json._id : json.id;
            if (id) {
                json._id = id;
            } else {
                throw new Error("Object has no id field");
            }
            return $http.put(config.host +"/"+ getApiId() +"/!"+ ecId +"/"+ id, json)
                .then( function(res) {
                    return res.data;
                });
        },
        delete: function(json) {
            return $http.delete(config.host +"/"+ getApiId() +"/"+ navigation.pathArr()[2] +"/"+ json._id)
        },
        update: function(json) {
            return $http.get(json._links.original.href)
                .then( function(res) {
                    var json = res.data;
                    json._links.original = angular.copy( json._links.self );
                    return json;
                });
        }
    };
});

// usage:
// either navigation.go(1, "foo");
// or navigation.set(1, "foo").set(2, "bar"); navigation.set(3, "foobar"); navigation.goNow();
app.factory('navigation', function($location, $routeParams, apiService) {
    var _pa = false;
    return {
        go: function(level, id) {
            this.set(level, id);
            this.goNow()
        },
        set: function(level, id) {
            if (!id) {
                console.warn("'"+id+"' is not a valid ID!");
                return;
            }

            if (!_pa) {
                _pa = this.pathArr();
            }
            _pa[level] = id;
            return this;
        },
        goNow: function() {
            $location.path( _pa.join("/") );
            $location.search(''); //remove all GET parameters
            _pa = false;
        },
        getPath: function() {
            var path = ['#'].concat(_pa).join("/");
            _pa = false;
            return path;
        },
        pathArr: function() {
            return [
                $routeParams.entityClassId,
                $routeParams.apiId,
                $routeParams.endpointId,
                apiService.buildUrl($routeParams.url, $location.search())
            ];
        }
    };
});

