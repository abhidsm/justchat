var USER = { name: "", id: "", joinId: "", joinName: "" };

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

function clearMessage(){
  $("#log").html(null);
  $('#flash').html(null);
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
    data: "userId="+USER.id,
    error: function () {
        checkPartnerExistsOrNot();
    },
    success: function (json) {
      if(json[0].data == 'left'){
        clearMessage();
        showLoad();
        connect();
      }else {
        displayMessage(json);
        longPoll();
      }
    }
  });
}

//Check whether partner exists
function checkPartnerExistsOrNot(){
  $.ajax({
    cache: false,
    dataType: 'json',
    type: "GET",
    url: "/checkPartner",
    data: "joinId="+USER.joinId,
    success: function (json) {
      if(json[0].data == 'Yes'){
          //don't flood the servers on error, wait 10 seconds before retrying
          setTimeout(longPoll, 10*1000);
      }else{
          $(window).unload();
          clearMessage();
          showConnect();
      }
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
  addMessage(USER.name, msg);
  jQuery.get("/send", {timestamp: (new Date()).getTime(), user: USER.name, text: msg, to: USER.joinId}, function (data) { }, "json");
}

//join the chat
function connect() {
  $.ajax({
    type: "GET",
    url: "/connect",
    data: "userId="+USER.id+"&userName="+USER.name,
    dataType: 'json',
    success: function (json) {
      console.log('Return data from connect: '+json.userId);
      if(json != 'wait') {
        console.log('First UserID: '+json.userId);
        USER.joinId = json.userId;
        USER.joinName = json.userName;
        $('#flash').html("<p>You have joined to chat with '"+ json.userName+"'</p>");
        showChat();
        longPoll();
      }
    }
  });
}

$(document).ready(function() {

  //submit new messages when the user hits enter if the message isnt blank
  $("#entry").keypress(function (e) {
    if (e.keyCode != 13 /* Return */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    send(msg);
    $("#entry").attr("value", ""); // clear the entry field.
  });

  //Leave the chat
  $('#leave').click(function(){
    $(window).unload();
    clearMessage();
    showConnect();
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
    
    //Assigning User details
    var randomnumber=Math.floor(Math.random()*11111);
    USER.name = user;
    USER.id = randomnumber;
    connect();
    return false;
  });

  //if we can, notify the server that we're going away.
  $(window).unload(function () {
    jQuery.get("/leave", {userId: USER.id, joinId: USER.joinId}, function (data) { }, "json");
  });


  showConnect();
});

