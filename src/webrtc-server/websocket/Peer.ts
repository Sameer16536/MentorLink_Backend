import mediasoup from "mediasoup"

export class Peer{
  id: string;
  transports = new Map<string,mediasoup.types.WebRtcTransport>()
  producers = new Map<string,mediasoup.types.Producer>()
  consumers = new Map<string, mediasoup.types.Consumer>();

  constructor(id:string){
    this.id = id
  }

  addTransport(transport:mediasoup.types.WebRtcTransport){
    this.transports.set(transport.id,transport)
  }

  getTransport(id:string){
    return this.transports.get(id)
  }

  addProducer(producer:mediasoup.types.Producer){
    this.producers.set(producer.id,producer)
  }

  getProducer(id:string){
    return this.producers.get(id)
  }

  addConsumer(consumer:mediasoup.types.Consumer){
    this.consumers.set(consumer.id,consumer)
  }

  getConsumer(id:string){
    return this.consumers.get(id)
  }
}