'use strict';

/*
 * This code is forked from https://gist.github.com/bergmark/77f23bcee8103b1f6917
 *
 */

var config = require('./config.js');

var SilkApi = require("silk-api-client");
var Silk = new SilkApi(config.silkApi);

var silkExport = {
    go: function(data, ec, onFinished, onError) {
        var name = config.appName + ".silk-testing.co";

        if (!ec) {
            throw new Error("No EntityClass provided, was:", ec);
        }
        var titleArr = ec.titlePath.split(".");
        var titleColumn = (titleArr.length === 2) ? titleArr[1] : false;

        // For this simple test script, we store our API objects in these
        // global variables.
        var site, job;

        // Generates error callbacks.
        function fail (why) {
          return function (message, error, response) {
            var msg;
            if (error)
              msg = why + ": Node error: "+ error; //util.inspect(error, {showHidden: false, depth: null});
            else
              msg = why + ": HTTP error: "+ message.statusCode + " " + JSON.stringify(response);

            console.error(msg);
            onError( new Error(msg) );
          }
        }

        // 1. Log in.
        // 2. Create site (unless already created).
        // 3. Start an import job.
        // 4. Get the server's import preview data.
        // 5. Start the import job.
        // 6. After one second, check its progress.

        Silk.User.signin({ email: config.silkUser, password: config.silkPassword }, afterSignin, fail("signin"));

        function afterSignin (r) {
          console.log("Signed in as", r.name, "(" + r.email + ")");
          Silk.Site.available(name, afterAvailable, fail("available"));
        }

        function afterAvailable (r) {
          if (r) {
            console.log("Site available.")
            Silk.Site.saveByUri(name, { name: name, template: "default" }, afterSiteSave, fail("site save"));
          } else {
            console.log("Site already created.");
            afterSiteSave();
          }
        }

        function afterSiteSave () {
          console.log("Site saved. Uploading JSON");

          // Upload the json data
          site = Silk.Site.byUri(name);
          site.Import.uploadJson(data, afterJobCreation , fail("uploadJson"));
        }

        function afterJobCreation (r) {
          console.log("Created import job");
          job = site.Import.byId(r.importId);

          // r.settings contains default configuration for this import, it can be overridden.

          //// Set the collection of all pages, this accepts a string.
          r.settings.collection = ec._id;

          if (titleColumn) {
              r.settings.title = [{ column: titleColumn }];
          }

          if (data[0] && data[0]._id) {
              r.settings.uri = [{ column: "_id" }];
          }

          //r.settings.fields =
          //  // Link all the neighbors to other silk pages
          //  [ { type: "fact", tag: "Neighbor", text: { column:"neighbors" }, pageUrl: { column: "neighbors" } }

          //  // Make population a textual value
          //  , { type: "fact", tag: "Population", text: { column:"population" } }

          //  // Make flags into images
          //  , { type: "image", tag: "Flag", url : { column:"flag" } }

          //  // Free text
          //  , { type: "paragraph", text : { column : "someText" } }

          //  ];
          console.log("Saving settings");
          site.Import.saveById(r.importId, r.settings, afterSettingSaving, fail("setting saving"));
        }

        function afterSettingSaving (r) {
          console.log("Saved settings");
          job.getPreview(afterPreview, fail("preview"));
        }

        function afterPreview (r) {
          //console.log("Preview:", r);
          console.log("Preview done");
          job.start({ overrideExisting : true }, afterStart, fail("start"));
        }

        var intervalId;
        function afterStart (r) {
          console.log("Started import.");
          intervalId = setInterval(checkProgress, 1000);
        }

        function checkProgress () {
          job.getProgress(function (r) {
              //console.log("Progress:", r);
              if (r.complete) {
                  console.log("Finished import");
                  clearInterval(intervalId);
                  onFinished();
              }
          }, fail("progress"));
        }

    }
}

// Register module
if (typeof window === 'undefined') {
    module.exports = silkExport;
} else {
    //angular
    app.factory('silkExport', function() {
        return silkExport;
    });
}
