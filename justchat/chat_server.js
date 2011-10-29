var http = require("http"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring"),
    fs = require('fs'),
    path = require('path');

// Handles the feed push and querying.
var feed = new function () {
  var messages = [],
      callbacks = [], joinCallback = null;
  var firstUser = null;
  var firstUserName = null;


  this.appendMessage = function (json) {
    console.log('inside appendmessage ');
    // Append the new item.
    messages.push( json );

    // Log it to the console
    console.log(": " + JSON.parse(json).text + " pushed");

    // As soon as something is pushed, call the query callback
    for (var i = 0; i < callbacks.length; i++){
        console.log('Inside appendmessage. Message To:'+JSON.parse(json).to+' Receiver: '+callbacks[i].receiverId);
        if(callbacks[i].receiverId == JSON.parse(json).to){
            callbacks[i].callback([JSON.parse(json)]);  
            callbacks.splice(i,1);
        }
    }

    // Make sur we don't flood the server
    while (messages.length > ITEMS_BACKLOG)
      messages.shift();
  };

  this.query = function (since, receiverId, callback) {
    var matching = [];

    for (var i = 0; i < messages.length; i++) {
        var message = JSON.parse(messages[i]);
        console.log('Inside query. Message To:'+message.to+' Receiver: '+receiverId);
        if (message.timestamp > since && message.to == receiverId)
            matching.push(message);
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback, receiverId: receiverId });
    }
  };

  this.join = function(req, callback) {
    var userId = qs.parse(url.parse(req.url).query).userId;
    var userName = qs.parse(url.parse(req.url).query).userName;
    if(firstUser == null || firstUser == userId){
      firstUser = userId;
      firstUserName = userName;
      joinCallback = callback;
    } else {
      callback({userId:firstUser, userName: firstUserName}); 
      joinCallback({userId:userId, userName: userName});
      firstUser = null;
      firstUserName = null;
    }
  };

  this.checkPartner = function (joinId, callback) {
    console.log('inside checkPartner');

      // As soon as something is pushed, call the query callback
      for (var i = 0; i < callbacks.length; i++){
          console.log('Inside checkPartner. Check Partner:'+joinId+' User Id: '+callbacks[i].receiverId);
          if(callbacks[i].receiverId == joinId){
              callback(JSON.stringify({data: 'Yes'}));  
              return;
          }
      }
      callback(JSON.stringify({data: 'No'}));  
  };

};

var ITEMS_BACKLOG = 20;

var urlMap = {
  '/connect' : function (req, res) {
    console.log('Connect action');
    feed.join(req, function (data) {
        res.simpleJSON(200, data);
    });
  },
  '/receive' : function (req, res) {
    console.log('Receive action');
    var since = parseInt(qs.parse(url.parse(req.url).query).timestamp, 10);
    var receiverId = qs.parse(url.parse(req.url).query).userId;
    feed.query(since, receiverId, function (data) {
      res.simpleJSON(200, data);
    });
  },
  '/send' : function (req, res) {
    console.log('Send action ');
    var parameters = qs.parse(url.parse(req.url).query);
    var user = parameters.user;
    console.log('User: '+user);
    var text = parameters.text;
    console.log('Text: '+text);
    var timestamp = parameters.timestamp;
    console.log('Timestamp: '+timestamp);
    var to = parameters.to;
    console.log('To: '+to);
    feed.appendMessage(JSON.stringify({timestamp: timestamp, user: user, text: text, to: to}));
    console.log('After calling appendmessage ');
    res.simpleJSON(200, {});
  },
  '/leave' : function (req, res) {
    console.log('leave action ');
    var parameters = qs.parse(url.parse(req.url).query);
    var userId = parameters.userId;
    console.log('User: '+userId);
    var joinId = parameters.joinId;
    console.log('Join Id: '+joinId);
    feed.appendMessage(JSON.stringify({data: "left", to: joinId}));
    console.log('After calling leave');
    res.simpleJSON(200, {});
  },
  '/checkPartner' : function (req, res) {
    console.log('checkPartner action ');
    var parameters = qs.parse(url.parse(req.url).query);
    var joinId = parameters.joinId;
    console.log('Join Id: '+joinId);
    feed.checkPartner(joinId, function (data) {
      res.simpleJSON(200, data);
    });
    console.log('After calling leave');
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

