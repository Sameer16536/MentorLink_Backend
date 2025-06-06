import * as mediasoup from "mediasoup";
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
      peer.transports.forEach((t) => t.close());
      peer.producers.forEach((p) => p.close());
      peer.consumers.forEach((c) => c.close());
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

  closeRoom() {
    this.router.close();
  }

  getAllProducers() {
    const producers: mediasoup.types.Producer[] = [];
    for (const peer of this.peers.values()) {
      producers.push(...peer.producers.values());
    }
    return producers;
  }
  getProducersExcluding(peerId: string) {
    const producers: mediasoup.types.Producer[] = [];
    for (const peer of this.peers.values()) {
      if (peer.id !== peerId) {
        producers.push(...peer.producers.values());
      }
    }
    return producers;
  }
}
