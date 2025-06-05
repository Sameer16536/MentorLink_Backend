import mediasoup from "mediasoup";
import { Peer } from "./peer";

export class Room {
  id: string;
  peers: Map<string, Peer>;
  router: mediasoup.types.Router;

  constructor(id: string, router: mediasoup.types.Router) {
    this.router = router;
    this.id = id;
    this.peers = new Map<string, Peer>();
  }

  addPeer(peer: Peer) {
    this.peers.set(peer.id, peer);
  }

  getPeer(id: string) {
    return this.peers.get(id);
  }

  removePeer(id: string) {
    const peer = this.getPeer(id);
    if (peer) {
      this.peers.delete(id);
    }
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  getProducerofMentor(id: string) {
    const peer = this.getPeer(id);
    if (!peer) {
      return null;
    }
    for (const producer of peer.producers.values()) {
      if (producer.appData.isMentor) {
        return producer;
      }
    }
    return null;
  }
}
