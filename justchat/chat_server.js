var http = require("http"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring"),
    fs = require('fs'),
    path = require('path');

// Handles the feed push and querying.
var feed = new function () {
  var messages = [],
      callbacks = [];

  this.appendMessage = function (json) {
    console.log('inside appendmessage ');
    // Append the new item.
    messages.push( json );

    // Log it to the console
    console.log(": " + JSON.parse(json) + " pushed");

    // As soon as something is pushed, call the query callback
    while (callbacks.length > 0)
      callbacks.shift().callback([JSON.parse(json)]);

    // Make sur we don't flood the server
    while (messages.length > ITEMS_BACKLOG)
      messages.shift();
  };

  this.query = function (since, callback) {
    var matching = [];

    for (var i = 0; i < messages.length; i++) {
          var message = messages[i];
          if (message.timestamp > since)
            matching.push(message);
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };
};

var ITEMS_BACKLOG = 20;

var urlMap = {
  '/receive' : function (req, res) {
      console.log('Receive action');
    var since = parseInt(qs.parse(url.parse(req.url).query).timestamp, 10);
    feed.query(since, function (data) {
      res.simpleJSON(200, data);
    });
  },
  '/send' : function (req, res) {
    console.log('Send action ');
      var user = qs.parse(url.parse(req.url).query).user;
    console.log('User: '+user);
      var text = qs.parse(url.parse(req.url).query).text;
    console.log('Text: '+text);
      var timestamp = qs.parse(url.parse(req.url).query).timestamp;
    console.log('Timestamp: '+timestamp);
    feed.appendMessage(JSON.stringify({timestamp: timestamp, user: user, text: text}));
    console.log('After calling appendmessage ');
    res.simpleJSON(200, {});
  }
};

var NOT_FOUND = "Not Found\n";

function notFound(req, res) {
  res.writeHead(404, { "Content-Type": "text/plain"
                     , "Content-Length": NOT_FOUND.length
                     });
  res.end(NOT_FOUND);
}

http.createServer(function (req, res) {

  console.log('request starting...');
    var filePath = req.url;
    if (filePath == '/')
      filePath = '/index.html';
    filePath = __dirname+filePath;
    var extname = path.extname(filePath);
    var contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }
     
    console.log('Path: '+filePath);
    path.exists(filePath, function(exists) {
     
        if (exists) {
            fs.readFile(filePath, function(error, content) {
                if (error) {
                    res.writeHead(500);
                    res.end();
                }
                else {
                    console.log('File found: '+ filePath);
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        }else {
            console.log('File not exist: '+filePath);
            // Get the url and associate the function to the handler
            // or
            // Trigger the 404
            var action = url.parse(req.url).pathname;
            var handler  = urlMap[action] || notFound;
            console.log('url parsing: '+action);
            console.log('handler: '+handler);
            var json = "";

                // We need to process the post but we need to wait until the request's body is available to get the field/value pairs.
            req.body = '';
            
            res.simpleJSON = function (code, obj) {
                var body = JSON.stringify(obj);
                res.writeHead(code, {
                                  "Content-Type": "text/json",
                                  "Content-Length": body.length
                              });
                res.end(body);
            };
            handler(req, res);
        }
                    
    });


}).listen(12197);

