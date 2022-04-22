const express = require("express");
const app = express();
const WebSocket = require("ws");
const url = require("url");
const uuid = require("uuid");
const {getUserAddress} = require("./contract");

app.get("/", function (req, res) {
  res.send("ThetaMetaSpace chatserver v1.0.0 <br/>ws or wss");
});
// listen for requests :)
const server = app.listen(process.env.PORT || 8686, function () {
  console.log("Your app is listening on port " + server.address().port);
});

const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", function connection(ws) {
  ws.id = uuid.v4();
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
    let msgSplit = message.split(",");
    if (msgSplit.length > 1) {
      let command = msgSplit[0];
      switch (command) {
        case "JOIN":
          if (ws.userName == undefined) {
            let signedSplit = message.split("#");
            // JOIN,x,y,z#userName#raw#texsigned
            if (signedSplit.length == 4) {
              let joinMsg = signedSplit[0];
              let userName = signedSplit[1];
              let textToSign = signedSplit[2];
              let signText = signedSplit[3];
              let address = getUserAddress(textToSign, signText);
              console.log(`${address} (${userName}) join server`);
              wss.clients.forEach(function each(client) {
                if (
                  client !== ws &&
                  client.readyState === WebSocket.OPEN &&
                  client.lastKnownPosition != undefined
                ) {
                  ws.send(client.lastKnownPosition);
                }
                if (client.address == address) {
                  client.terminate();
                }
              });
              ws.address = address;
              ws.userName = userName;
              ws.lastKnownPosition = ws.id + "#" + ws.userName + "#" + joinMsg;
              broadcast(ws, ws.id + "#" + ws.userName + "#" + joinMsg);
            }
          } else {
            ws.send(
              "You already JOINed with userName, can't do it more, to move using move instead"
            );
          }
          break;
        case "TELEPOS":
          wss.clients.forEach(function each(client) {
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              client.lastKnownPosition != undefined
            ) {
              ws.send(client.lastKnownPosition);
            }
          });
          broadcast(ws, ws.id + "#" + ws.userName + "#" + message);
          break;
        case "MOVE":
          ws.lastKnownPosition = ws.id + "#" + ws.userName + "#" + message;
        default:
          if (ws.userName != undefined) {
            broadcast(ws, ws.id + "#" + ws.userName + "#" + message);
          } else {
            ws.send(
              "Your move can't broadcast, must send JOIN with userName to login"
            );
          }
      }
    }
  });
  ws.on("close", function () {
    broadcast(ws, ws.id + "#" + ws.userName + "#QUIT,temp");
  });
  ws.send(
    "You connected socket server, your id: " +
      ws.id +
      ", next step must send JOIN with userName to login"
  );
});
function broadcast(ws, message) {
  console.log(`${ws.userName} broadcast: ${message}`);
  wss.clients.forEach(function each(client) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
function noop() {}
function heartbeat() {
  this.isAlive = true;
}
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      console.log("Broadcast quit for " + ws.id);
      broadcast(ws, ws.id + "#Quit");
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(noop);
  });
}, 3000);

wss.on("close", function close() {
  clearInterval(interval);
});

server.on("upgrade", function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname === "/chat") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
