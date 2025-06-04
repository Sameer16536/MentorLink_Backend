import { createServer } from "http";
import { WebSocketServer } from "ws";
import mediasoup from "mediasoup";

const PORT = 4000;
const httpServer = createServer();

const wss = new WebSocketServer({ server: httpServer });

let worker,
  router: mediasoup.types.Router<mediasoup.types.AppData>,
  transportPairs: { [key: string]: mediasoup.types.WebRtcTransport } = {};

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

  socket.on("message", async (message) => {
    const data = JSON.parse(message.toString());
    console.log(`Received message from ${id}:`, data);

    switch (data.action) {
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
        transportPairs[id] = transport;
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
        const { dtlsParameters } = data.data;
        const transport = transportPairs[id];
        await transport.connect({ dtlsParameters });
        socket.send(JSON.stringify({ action: "connected" }));
        break;
      }

      case "produce": {
        const { kind, rtpParameters } = data.data;
        const producer = await transportPairs[id].produce({
          kind,
          rtpParameters,
        });
        socket.send(
          JSON.stringify({
            action: "produced",
            data: { id: producer.id },
          })
        );
        break;
      }

      case "consume": {
        const { producerId, rtpCapabilities } = data.data;
        if (!router.canConsume({ producerId, rtpCapabilities })) {
          console.error("Cannot Consume");
          return;
        }
        const consumer = await transportPairs[id].consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });

        socket.send(
          JSON.stringify({
            action: "consumed",
            data: {
              id: consumer.id,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            },
          })
        );
        break;
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


