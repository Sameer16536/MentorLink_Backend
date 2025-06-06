import { createServer } from "http";
import { WebSocketServer } from "ws";
import * as mediasoup from "mediasoup";
import { Room } from "./websocket/room";
import { Peer } from "./websocket/peer";

const PORT = 4000;
const httpServer = createServer();

const wss = new WebSocketServer({ server: httpServer });

let worker, router: mediasoup.types.Router<mediasoup.types.AppData>;

const rooms: Map<string, Room> = new Map();

const getOrCreateRoom = (roomId: string): Room => {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId, router);
    rooms.set(roomId, room);
  }
  return room;
};

const startMediaSoup = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  console.log("MediaSoup worker created");

  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {},
      },
    ],
  });

  console.log("MediaSoup router created");
};

wss.on("connection", async (socket) => {
  const id = crypto.randomUUID();
  console.log(`New client connected: ${id}`);

  //Client sends roomId to join in first messsage
  let currentRoom: Room | null = null;
  let currentPeer: Peer | null = null;

  socket.on("message", async (message) => {
    const msg = JSON.parse(message.toString());
    const { action, data } = msg;
    console.log(`Received message from ${id}:`, data);

    switch (action) {
      case "joinRoom": {
        const { roomId, isMentor } = data;
        currentRoom = getOrCreateRoom(roomId);
        currentPeer = new Peer(id);
        currentRoom.addPeer(currentPeer);

        socket.send(
          JSON.stringify({
            action: "joinedRoom",
            data: {
              roomId: currentRoom.id,
              peerId: currentPeer.id,
            },
          })
        );
        break;
      }

      case "getRTPCapabilities": {
        socket.send(
          JSON.stringify({
            action: "rtpCapabilities",
            data: router.rtpCapabilities,
          })
        );
        break;
      }

      case "createWebRtcTransport": {
        const transport = await createTransport();
        currentPeer?.addTransport(transport);
        socket.send(
          JSON.stringify({
            action: "transportCreated",
            data: {
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
            },
          })
        );
        break;
      }

      case "connectTransport": {
        const { dtlsParameters, transportId } = data;
        const transport = currentPeer?.getTransport(transportId);
        await transport?.connect({ dtlsParameters });
        socket.send(JSON.stringify({ action: "connected" }));
        break;
      }

      case "produce": {
        const transport = currentPeer?.getTransport(data.transportId);
        const producer = await transport?.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters,
          appData: { isMentor: data.isMentor },
        });
        if (producer) {
          currentPeer?.addProducer(producer);
          socket.send(
            JSON.stringify({
              action: "produced",
              data: { id: producer.id },
            })
          );
        } else {
          socket.send(
            JSON.stringify({ action: "error", message: "Failed to produce" })
          );
        }
        break;
      }

      case "consume": {
        const consumerTransport = currentPeer?.getTransport(data.transportId);

        // Find mentor’s producer
        const mentorProducer = currentRoom
          ?.getPeers()
          .find((peer) =>
            Array.from(peer.producers.values()).some(
              (prod) => prod.appData?.isMentor
            )
          )
          ?.producers.values()
          .next().value;

        if (
          mentorProducer &&
          router.canConsume({
            producerId: mentorProducer.id,
            rtpCapabilities: data.rtpCapabilities,
          })
        ) {
          const consumer = await consumerTransport?.consume({
            producerId: mentorProducer.id,
            rtpCapabilities: data.rtpCapabilities,
            paused: false,
          });

          if (consumer) {
            currentPeer?.addConsumer(consumer);

            socket.send(
              JSON.stringify({
                action: "consumed",
                data: {
                  id: consumer.id,
                  producerId: mentorProducer.id,
                  kind: consumer.kind,
                  rtpParameters: consumer.rtpParameters,
                  type: consumer.type,
                },
              })
            );
          }
        } else {
          socket.send(
            JSON.stringify({
              action: "error",
              message: "Mentor stream not found or can't be consumed",
            })
          );
        }

        break;
      }

      case "leaveRoom": {
        if (currentRoom && currentPeer) {
          currentRoom.removePeer(currentPeer.id);
          socket.send(JSON.stringify({ action: "leftRoom" }));
          currentRoom = null;
          currentPeer = null;
        }
        break;
      }
    }
  });

  socket.on("close", () => {
    if (currentRoom && currentPeer) {
      currentRoom.removePeer(currentPeer.id);
      if (currentRoom.peers.size === 0) {
        rooms.delete(currentRoom.id);
      }
    }
  });
});

async function createTransport() {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "127.0.0.1", announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on("dtlsstatechange", (dtlsState) => {
    if (dtlsState === "closed") {
      transport.close();
    }
  });

  return transport;
}

export const startServer = async () => {
  await startMediaSoup();
  httpServer.listen(PORT, () => {
    console.log(`🚀 SFU Server listening on ws://localhost:${PORT}`);
  });
};
