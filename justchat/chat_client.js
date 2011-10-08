var USER = { name: "" };

//used to keep the most recent messages visible
function scrollDown () {
  window.scrollBy(0, 100000000000000000);
  $("#entry").focus();
}

function addMessage(user, text) {
    var messageElement = $(document.createElement("table"));

  messageElement.addClass("message");

  var content = '<tr>'
              + '  <td class="user">' + user + '</td>'
              + '  <td class="msg-text">' + text  + '</td>'
              + '</tr>'
              ;
  messageElement.html(content);

  //the log is the stream that we view
  $("#log").append(messageElement);

  //always view the most recent message when it is added
  scrollDown();
}

function displayMessage(data){
    addMessage(data[0].user, data[0].text);
}

function longPoll() {
  //make another request
  $.ajax({
    cache: false,
    dataType: 'json',
    type: "GET",
    url: "/receive",
    error: function () {
      //don't flood the servers on error, wait 10 seconds before retrying
      setTimeout(longPoll, 10*1000);
    },
    success: function (json) {
      displayMessage(json);

      //if everything went well, begin another request immediately
      //the server will take a long time to respond
      //how long? well, it will wait until there is another message
      //and then it will return it to us and close the connection.
      //since the connection is closed when we get data, we longPoll again
      longPoll();
    }
  });
}

//transition the page to the loading screen
function showLoad () {
  $("#connect").hide();
  $("#loading").show();
  $("#toolbar").hide();
}

//Transition the page to the state that prompts the user for a nickname
function showConnect () {
  $("#connect").show();
  $("#loading").hide();
  $("#toolbar").hide();
  $("#user").focus();
}

//transition the page to the main chat view, putting the cursor in the textfield
function showChat () {
  $("#toolbar").show();
  $("#entry").focus();

  $("#connect").hide();
  $("#loading").hide();

  scrollDown();
}

//submit a new message to the server
function send(msg) {
    jQuery.get("/send", {timestamp: (new Date()).getTime(), user: USER.name, text: msg}, function (data) { }, "json");
}

$(document).ready(function() {

  //submit new messages when the user hits enter if the message isnt blank
  $("#entry").keypress(function (e) {
    if (e.keyCode != 13 /* Return */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    send(msg);
    $("#entry").attr("value", ""); // clear the entry field.
  });

  //try joining the chat when the user clicks the connect button
  $("#connectButton").click(function () {
    //lock the UI while waiting for a response
    showLoad();
    var user = $("#user").attr("value");

    //dont bother the backend if we fail easy validations
    if (user.length > 50) {
      alert("Name too long. 50 character max.");
      showConnect();
      return false;
    }

    //more validations
    if (/[^\w_\-^!]/.exec(user)) {
      alert("Bad character in name. Can only have letters, numbers, and '_', '-', '^', '!'");
      showConnect();
      return false;
    }
                                
    USER.name = user;
    showChat();
    return false;
  });

  //begin listening for updates right away
  //interestingly, we don't need to join a room to get its updates
  //we just don't show the chat stream to the user until we create a session
  longPoll();

  showConnect();
});

