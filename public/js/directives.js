'use strict';

app.directive('tree', function($compile, state) {
  return {
    restrict: 'E',
    scope: {
        tree: '='
    },
    link: function(scope, element, attributes) {
        scope.browse = function(url) {
            state.getState().then(function(state) {
                state.browseWithoutEp(url);
            });
        };
        scope.addEndpoint= function(url, id) {
            state.getState().then(function(state) {
                state.addEndpoint(url, id);
            });
        };
        var template = [
            '<p class="treeDirective">',
            '  <a ng-click="browse(tree.url)">{{tree.name}}</a> {{tree.errMsg}}',
            '  <button class="btn btn-primary btn-xs" ng-click="addEndpoint(tree.url, tree.name)">',
                 'Make Endpoint</button>',
            '</p>',
            '<ul ng-if="tree.children.length > 0">',
            '  <li ng-repeat="t in tree.children"><tree tree="t"></tree></li>',
            '</ul>'].join("");
        
        var newElement = angular.element(template);
        $compile(newElement)(scope);
        element.replaceWith(newElement); 
    }
  };
});


app.directive('collection', function(navigation) {
  //renders a navigational list that changes the url when clicked on
  return {
    restrict: 'E',
    scope: {
        collection: '=',
        defaultElement: '=', //this element is added on plus button click
        level: '=', //which navigational level this collection corresponds to as in myapp.com/#/:level0/:level1
        secondaryCollection: '=' //optional
    },
    link: function(scope, element, attributes) {
        scope.active = function(id) {
            return (navigation.pathArr()[scope.level] == id) ? "active" : "";
        };
        scope.addEl = function() {
            scope.collection.push( scope.defaultElement );
            navigation.set(3, '_').set(scope.level, scope.defaultElement._id).goNow();
        };
        scope.goLoc = function(id) {
            if (scope.active(id) === "active") {
                //toggle
                id = "_";
            }

            navigation.set(scope.level, id);
            if (scope.level != 0) {
                //everything but entityClass
                navigation.set(3, "_");
            }
            navigation.goNow();
        };

    },
    template : [
            '<div class="list-group">',
            '   <a ng-repeat="el in secondaryCollection" class="list-group-item {{active(el.name)}}" ng-click="goLoc(el.name)">',
            '       {{el.title}}',
            '   </a>',
            '</div>',
            '<div class="list-group">',
            '   <a ng-repeat="el in collection" class="list-group-item {{active(el._id)}}" ng-click="goLoc(el._id)">',
            '       {{el.label}}',
            '   </a>',
            '</div>',
            '<button ng-click="addEl()" class="btn btn-default"><span class="glyphicon glyphicon-plus"></span></button>'
        ].join("")
  };
});

app.directive('formText', function($compile, $timeout, navigation, apiService) {
  return {
    restrict: 'E',
    scope: {
        label: '@',
        placeholder: '@',
        model: '=',
        levelId: '=' //the level, if the text of this field is supposed to update a certain level in the URL
    },
    link: function(scope, element, attributes) {
        var modelStr = "model";
        if (typeof scope.levelId === "number") {
            modelStr = "m";
            scope.m = scope.model;
            //if text determines ._id, only set global model on blur
            scope.changed = function() {
                scope.m = apiService.cleanString(scope.m);
                if (scope.m === "") {
                    //_id mustn't become empty
                    scope.m = "-";
                }
                scope.model = scope.m;
                //update ID in URL
                navigation.go(scope.levelId, scope.model);
            };
        }
        var template = [
              '<div class="form-group">',
              '  <label class="col-sm-2 control-label">{{label}}</label>',
              '  <div class="col-sm-10">',
              '    <input ng-model="'+modelStr+'" type="text" class="form-control" placeholder="{{placeholder}}" ng-blur="changed()">',
              '  </div>',
              '</div>'
              ].join("")
        var newElement = angular.element(template);
        $compile(newElement)(scope);
        element.replaceWith(newElement); 
    }
  };
});

app.directive('formSelect', function() {
  return {
    restrict: 'E',
    scope: {
        label: '@',
        model: '=',
        options: '@',
        nullable: '='
    },
    template : [
      '<div class="form-group">',
      '  <label class="col-sm-2 control-label">{{label}}</label>',
      '  <div class="col-sm-10">',
      '    <select class="form-control" ng-model="model" ng-options="{{options}}">',
      '      <option ng-if="nullable" value=""></option>',
      '    </select>',
      '  </div>',
      '</div>'
    ].join("")
  };
});

app.directive('formObject', function() {
  return {
    restrict: 'E',
    scope: {
        label: '@',
        valPlaceholder: '@',
        model: '=',
        pagination: '='
    },
    link: function(scope, element, attrs) {
        scope.addEl = function() {
            if (!scope.model) {
                scope.model = [];
            }
            scope.model.push( { "key": "", "val": ""} );
        };
        scope.getClass = function(i) {
            if (scope.model[i].isPaginationVar) {
                return "btn btn-xs";
            } else {
                return "btn btn-xs btn-default";
            }
        };
        scope.setPagination = function(i) {
            if (scope.model[i].isPaginationVar) {
                //if already set, toggle
                delete scope.model[i].isPaginationVar;
            } else {
                //unset all others
                scope.model.forEach( function(obj) {
                    delete obj.isPaginationVar;
                });
                scope.model[i].isPaginationVar = true;
            }
        }
    },
    template: [
          '<div class="form-group">',
          '    <label class="col-sm-2 control-label">{{label}}</label>',
          '    <div class="col-sm-10">',
          '        <div class="row" ng-repeat="item in model">',
          '            <div class="col-sm-4">',
          '                <input ng-model="item.key" type="text" class="form-control" placeholder="Name">',
          '            </div>',
          '            <div class="col-sm-4">',
          '                <input ng-model="item.val" type="text" class="form-control" placeholder="{{valPlaceholder || \'Value\'}}">',
          '            </div>',
          '            <div class="col-sm-4">',
          '                <button title="If selected, this variable will be incremented in generated \'next\'-links."',
          '                     ng-show="pagination" ng-click="setPagination($index)"',
          '                     ng-class="getClass($index)">Pagination</button>',
          '                <span ng-click="model.splice($index, 1)" class="glyphicon glyphicon-trash"></span>',
          '            </div>',
          '        </div>',
          '        <button ng-click="addEl()" class="btn btn-default"><span class="glyphicon glyphicon-plus"></span></button>',
          '    </div>',
          '</div>'
          ].join("")
  };
});

app.directive('nestedFormObject', function() {
  return {
    restrict: 'E',
    scope: {
        label: '@',
        model: '='
    },
    link: function(scope, element, attrs) {
        scope.addEl = function() {
            if (!scope.model) {
                scope.model = [];
            }
            scope.model.push( { "key": "", "val": ""} );
        };
    },
    template: [
          '<div class="form-group">',
          '    <label class="col-sm-2 control-label">',
          '        {{label}}</label>',
          '    <div class="col-sm-10">',
          '        <div ng-repeat="item in model">',
          '            <div class="row">',
          '                <div class="col-sm-4">',
          '                    <input ng-model="item.key" type="text" class="form-control" placeholder="Rel (e.g. \'self\')">',
          '                </div>',
          '                <div class="col-sm-4">',
          '                    <input ng-model="item.val" type="text" class="form-control" placeholder="Link URI Template">',
          '                </div>',
          '                <div class="col-sm-3">',
          '                    <select class="form-control" ng-model="item.endpoint" ',
          '                        ng-options="e._id as e.label for (idx, e)',
          '                            in $parent.$parent.currentApiDesc()._embedded[\'ns:endpoints\']">',
          '                        <option value="">-Target Endpoint-</option>', //could add disabled-attribute
          '                    </select>',
          '                </div>',
          '                <div class="col-sm-1">',
          '                    <span ng-click="model.splice($index, 1)" class="glyphicon glyphicon-trash"></span>',
          '                </div>',
          '            </div>',
          '            <div class="row">',
          '                <div class="col-sm-12">',
          '                    <form-object label="Additional Vars" model="item.additionalVars" val-placeholder="JSPath">',
          '                    </form-object>',
          '                </div>',
          '            </div>',
          '        </div>',
          '        <button ng-click="addEl()" class="btn btn-default"><span class="glyphicon glyphicon-plus"></span></button>',
          '        <p class="help-block">You should at least add a self-link. <span ng-show="model.length > 0"><em>Link URI Template</em> will be evaluated in the context of the union of the current object/entity and the additional variables above (which you need when accessing nested properties), and there is the added variable <code>_pathX</code> where <code>X</code> is the index to access <code>currentUrl.split(\'/\')</code>. <em>Target Endpoint</em> is where you arrive when following the link.</span></p>',
          '    </div>',
          '</div>'
          ].join("")
  };
});

//from http://stackoverflow.com/questions/17470790/how-to-use-a-keypress-event-in-angularjs
app.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if(event.which === 13) {
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});

app.directive('downloadLinks', function ($compile, $http, $filter, cachedCollections) {
    return {
        restrict:'E',
        scope:{
            json: '=',
            url: '=',
            ecId: '=',
            deletable: '@'
        },
        link: function (scope, element, attrs) {
            var btnClass = ' class="btn btn-default btn-xs" ';

            scope.showJson = function() {
                window.prompt("Press Cmd+C now to copy.", $filter('json')(scope.json));
            };
            scope.showUrl = function() {
                window.prompt("Press Cmd+C now to copy.", scope.url);
            };

            // for the download we cannot use ng-click but need actual href
            // that's why we have to do this ugly stuff here
            function getUrl(){
                return URL.createObjectURL(new Blob([JSON.stringify(scope.json)], {type: "application/json"}));
            }
            function getTitle() {
                var title = (scope.json._links && scope.json._links.self) ? scope.json._links.self.title : false;
                title = title ? title.replace(/\s/g, "-").replace(/[^a-zA-Z0-9-_]/g, '') : "";
                return title ? title : "download";
            }

            scope.update = function() {
                scope.updating = "loading";
                cachedCollections.update(scope.json)
                    .then( function(json) {
                        scope.json = json;
                        scope.updating = "";
                    }, console.error);
            };
            scope.save = function() {
                scope.loading = "loading";
                if (!scope.deletable && scope.json._links.self.href) {
                    //set original url on first put
                    scope.json._links.original = angular.copy( scope.json._links.self );
                }
                cachedCollections.put(scope.ecId, scope.json)
                    .then( function(json) {
                        scope.loading = "";
                        scope.json = json;
                    }, console.error);
            };
            scope.delete= function() {
                scope.deleting = "loading";
                cachedCollections.delete(scope.json)
                    .then( function() {
                        scope.deleting = "";
                        document.location.reload(); //this is a ugly hack
                    }, console.error);
            };

            var template = [
                '<ul>',
                '  <li class="downloadJson"></li>',
                '  <li><a ng-click="showJson()"', btnClass, '>Copy JSON</a></li>',
                '  <li><a ng-click="showUrl()"', btnClass, '>Copy URL</a></li>',
                scope.deletable ?
                   '<li ng-show="json._links.original"><a ng-click="update()" class="btn btn-primary btn-xs" ng-class="updating">Update</a></li>' : "",
                scope.ecId ?
                   '<li><a ng-click="save()" class="btn btn-success btn-xs" ng-class="loading">Save to Cache</a></li>' : "",
                scope.deletable ?
                   '<li><a ng-click="delete()" class="btn btn-danger btn-xs" ng-class="deleting">Remove from Cache</a></li>' : "",
                '</ul>'
            ].join("");
            var newElement = angular.element(template);
            $compile(newElement)(scope);
            element.empty().append(newElement); 

            scope.$watch("json", function(newVal){
                if (newVal) {
                    $(newElement).find(".downloadJson").html( [
                        '<a download="', getTitle(), '.json"', btnClass,
                        'href="', getUrl(), '">',
                        'Download JSON</a>'
                    ].join("") );
                }
            });
        }
    };
});
