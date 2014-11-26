#!/usr/bin/env node

//
// This is a server designed SOLELY to perform wed testing. It serves
// two hierarchies:
//
// - One rooted at '/' (and which excludes '/forever') that uses
//   modification dates to control caching. This one is useful for
//   quickly checking modifications in development.
//
// - One rooted at '/forever' that sets files to "never" expire. This
//   one is used for automated testing. (In fact they expire 10 years
//   from now, which for the purpose of a test is "never".)
//

'use strict';
var express = require("express");
var compress = require("compression");
var serve_static = require("serve-static");
var path = require("path");
var url = require("url");
var fs = require("fs");
var Buffer = require("buffer").Buffer;
var querystring = require("querystring");
var crypto = require("crypto");
var morgan = require("morgan");

var verbose = false;

var next_arg = 2;
if (process.argv[2] === "-v") {
    verbose = true;
    next_arg++;
}

var arg = process.argv[next_arg] || "0.0.0.0:8888";
var parts = arg.split(":");
var ip = parts[0];
var port = parts[1];
var cwd = process.cwd();

// Yes, setting the expiration date at the start and never changing it
// is sloppy... but this is not meant to be a production server.
var ten_years = 315360000; // 10 years, in seconds
var expiration = new Date(Date.now() + ten_years * 1000).toUTCString();

var app = express();

app.use(compress());
app.use(serve_static(cwd));
app.use('/forever', serve_static(cwd, {
    setHeaders: function (res, path, stat) {
        res.setHeader('Cache-Control', 'private, max-age=' + ten_years);
        res.setHeader('Expires', expiration);
    }
}));
if (verbose) {
    // var log_file = fs.createWriteStream("./server.log");
    var log_file = process.stdout;
    app.use(morgan({stream: log_file}));
}

function writeResponse(response, status, data, type, headers) {
    if (verbose)
        console.log('response message:', data);

    type = type || "text/plain";

    headers = headers || {};
    headers["Content-Type"] = type;

    response.writeHead(status, headers);

    if (data) {
        if (type !== "text/plain")
            response.write(data, "binary");
        else
            response.write(data);
    }
    response.end();
}

function unlinkIfExists(path) {
    if (fs.existsSync(path))
        fs.unlinkSync(path);
}

var fail_on_save = false;
var fail_on_recover = false;
var precondition_fail_on_save = false;
var too_old_on_save = false;
var no_response_on_save = false;
var no_response_on_recover = false;

function dumpData(request, callback) {
    var uri = url.parse(request.url).pathname;
    var filename = path.join(cwd, uri);
    var chunks = [];
    request.on('data', function (chunk) {
        chunks.push(chunk.toString());
    });

    request.on('end', function() {
        var body = chunks.join('');
        var decoded = querystring.parse(body);
        var writable = fs.createWriteStream(filename, {'flags': 'a'});
        writable.write("\n***\n", function () {
            if (verbose)
                console.log('decoded body', decoded);
            writable.write(JSON.stringify(decoded));
            writable.end();
        });
        if (callback)
            callback(decoded);
    });
}

function make_paths(str) {
    return [str, "/forever" + str];
}

app.post(make_paths("/build/ajax/log.txt"), function (request, response) {
    dumpData(request);
    writeResponse(response, 200, "{}", "application/json");
});

app.post(make_paths("/build/ajax/save.txt"), function (request, response) {
    dumpData(request, function (decoded) {
        var headers = undefined;
        function success() {
            messages.push({type: 'save_successful'});
            var hash = crypto.createHash('sha1');
            hash.update(decoded.data);
            headers = {ETag: hash.digest('base64')};
        }
        var status = 200;
        var messages = [];
        switch(decoded.command) {
        case 'check':
            break;
        case 'save':
        case 'autosave':
            if (!no_response_on_save) {

                if (too_old_on_save)
                    messages.push({type: 'version_too_old_error'});

                if (precondition_fail_on_save)
                    status = 412;
                else if (fail_on_save)
                    status = 400;
                else
                    success();
            }
            break;
        case 'recover':
            if (!no_response_on_recover) {
                if (!fail_on_recover)
                    success();
                else
                    status = 400;
            }
            break;
        default:
            status = 400;
        }
        var msg = {messages: messages};
        var stringified = JSON.stringify(msg);
        writeResponse(response, status, stringified, "application/json",
                      headers);
    });
});

app.post(make_paths("/build/ajax/control"), function(request, response) {
    dumpData(request, function (decoded) {
        var status = 200;
        switch(decoded.command) {
        case 'reset':
            unlinkIfExists(path.join(cwd, "/build/ajax/log.txt"));
            unlinkIfExists(path.join(cwd, "/build/ajax/save.txt"));
            unlinkIfExists(path.join(cwd, "/build/ajax/control"));
            fail_on_save = false;
            fail_on_recover = false;
            precondition_fail_on_save = false;
            too_old_on_save = false;
            no_response_on_save = false;
            no_response_on_recover = false;
            break;
        case 'fail_on_save':
            fail_on_save = decoded.value;
            break;
        case 'precondition_fail_on_save':
            precondition_fail_on_save = decoded.value;
            break;
        case 'too_old_on_save':
            too_old_on_save = decoded.value;
            break;
        case 'fail_on_recover':
            fail_on_recover = decoded.value;
            break;
        case 'no_response_on_save':
            no_response_on_save = decoded.value;
            break;
        case 'no_response_on_recover':
            no_response_on_recover = decoded.value;
            break;
        case 'ping':
            break;
        default:
            status = 400;
        }
        writeResponse(response, status, "{}", "application/json");
    });
});

app.listen(port, ip);


console.log("http://" + ip + ":" + port);

//  LocalWords:  url querystring ajax txt json
