import { RPCMessageWithCounter } from './types';

/**
 * Reorder is a utility responsible for reording incoming messages.
 */
export class Reorder {
  /**
   * Last call we got which was in sequence..
   */
  private lastSequentialCall = -1;

  /**
   * Queue of messages to send out once reordered data comes back.
   */
  private queue: Array<RPCMessageWithCounter<any>> = [];

  /**
   * Appends a message to the reorder queue. Returns all messages which
   * are good to send out.
   */
  public append(packet: RPCMessageWithCounter<any>): Array<RPCMessageWithCounter<any>> {
    if (packet.type === 'method' && packet.method === 'ready') {
      this.lastSequentialCall = packet.counter - 1;
    }

    if (packet.counter <= this.lastSequentialCall + 1) {
      const list = [packet];
      this.lastSequentialCall = packet.counter;
      this.replayQueue(list);
      return list;
    }

    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].counter > packet.counter) {
        this.queue.splice(i, 0, packet);
        return [];
      }
    }

    this.queue.push(packet);
    return [];
  }

  private replayQueue(list: Array<RPCMessageWithCounter<any>>) {
    while (this.queue.length) {
      const next = this.queue[0];
      if (next.counter > this.lastSequentialCall + 1) {
        return;
      }

      list.push(this.queue.shift()!);
      this.lastSequentialCall = next.counter;
    }
  }
}
