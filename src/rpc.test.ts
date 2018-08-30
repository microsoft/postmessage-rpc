import { expect } from 'chai';

import { RPCError } from './error';
import { RPC } from './rpc';
import { IMessageEvent, RPCMessage } from './types';

const delay = (duration: number = 1) => new Promise(resolve => setTimeout(resolve, duration));

describe('RPC', () => {
  let rpc: RPC;
  let messages: Array<RPCMessage<any>>;
  let sendMessage: (ev: IMessageEvent) => void;

  beforeEach(() => {
    messages = [];
    rpc = new RPC({
      target: { postMessage: (data: any) => messages.push(JSON.parse(data)) },
      receiver: {
        readMessages: callback => {
          sendMessage = event =>
            callback({ data: JSON.stringify(event.data), origin: event.origin });
          return () => undefined;
        },
      },
      origin: 'example.com',
      serviceId: 'foo',
    });
  });

  afterEach(() => {
    rpc.destroy();
  });

  const readyUp = async () => {
    const promise = new Promise(resolve => {
      rpc.expose('ready', (params: { protocolVersion: string }) => {
        expect(params.protocolVersion).to.equal('1.1');
        resolve();
      });
    });

    sendMessage({
      data: {
        type: 'method',
        method: 'ready',
        serviceID: 'foo',
        counter: 0,
        params: {
          protocolVersion: '1.1',
        },
      },
      origin: 'example.com',
    });

    await promise;

    expect(rpc.remoteVersion()).to.equal('1.1');
  };

  const expectToIgnore = (message: IMessageEvent) => {
    const previousLength = messages.length;
    message.data.counter = (rpc as any).reorder.lastSequentialCall + 1;
    sendMessage(message);
    expect(messages).to.have.lengthOf(previousLength);
  };

  it('should announce itself to the remote when created', () => {
    expect(messages).to.deep.equal([
      {
        type: 'method',
        serviceID: 'foo',
        id: 0,
        method: 'ready',
        discard: true,
        counter: 0,
        params: { protocolVersion: '1.0' },
      },
    ]);
  });

  it('should receive ready messages', async () => readyUp());

  it('should reject messages recieved from other services', async () => {
    await readyUp();
    expectToIgnore({
      data: {
        type: 'method',
        method: 'foo',
        serviceID: 'invalid service ID',
        params: { isInvalid: true },
      },
      origin: 'example.com',
    });
  });

  it('should reject messages from other origins', async () => {
    await readyUp();
    expectToIgnore({
      data: {
        type: 'method',
        method: 'foo',
        serviceID: 'foo',
        params: { isInvalid: true },
      },
      origin: 'contoso.com',
    });
  });

  it('should reject malformed messages', async () => {
    await readyUp();
    expectToIgnore({
      data: {
        foo: 'bar',
      },
      origin: 'example.com',
    });
  });

  it('should reorder messages', async () => {
    await readyUp();

    const sequence = [4, 2, 1, 3];
    const promise = new Promise(resolve => {
      let seen = 0;
      rpc.expose('foo', (params: { counter: number }) => {
        seen++;
        expect(params.counter).to.equal(seen);
        if (seen === sequence.length) {
          resolve();
        }
      });
    });

    sequence.forEach(counter => {
      sendMessage({
        data: {
          type: 'method',
          method: 'foo',
          serviceID: 'foo',
          counter,
          params: { counter },
        },
        origin: 'example.com',
      });
    });

    await promise;
  });

  it('should give successful replies to messages', async () => {
    await readyUp();

    rpc.expose<{ level: number }>('bar', data => ({ level: data.level + 1 }));

    sendMessage({
      data: {
        type: 'method',
        method: 'bar',
        serviceID: 'foo',
        counter: 1,
        id: 1,
        params: { level: 0 },
      },
      origin: 'example.com',
    });

    await delay();

    expect(messages).to.deep.include({
      type: 'reply',
      serviceID: 'foo',
      counter: 1,
      id: 1,
      result: { level: 1 },
    });
  });

  it('should bubble thrown RPC errors', async () => {
    await readyUp();

    rpc.expose('bar', () => {
      throw new RPCError(1234, 'oh no!');
    });

    sendMessage({
      data: {
        type: 'method',
        method: 'bar',
        serviceID: 'foo',
        counter: 1,
        id: 1,
        params: { level: 0 },
      },
      origin: 'example.com',
    });

    await delay();

    expect(messages).to.deep.include({
      type: 'reply',
      serviceID: 'foo',
      counter: 1,
      id: 1,
      error: { code: 1234, message: 'oh no!' },
    });
  });

  it('should send messages and get replies', async () => {
    await readyUp();

    const a = rpc.call<number>('a', { cool: true });
    const b = rpc.call<number>('b', { awesome: true });

    sendMessage({
      data: {
        type: 'reply',
        serviceID: 'foo',
        counter: 1,
        id: 2,
        result: 'second result',
      },
      origin: 'example.com',
    });

    sendMessage({
      data: {
        type: 'reply',
        serviceID: 'foo',
        counter: 2,
        id: 1,
        result: 'first result',
      },
      origin: 'example.com',
    });

    expect(await a).to.equal('first result');
    expect(await b).to.equal('second result');
  });

  it('bubbles reply errors', async () => {
    await readyUp();

    const a = rpc.call<number>('a', { cool: true });

    sendMessage({
      data: {
        type: 'reply',
        serviceID: 'foo',
        counter: 1,
        id: 1,
        error: { code: 1234, message: 'oh no!' },
      },
      origin: 'example.com',
    });

    try {
      await a;
      throw new Error('expected to throw');
    } catch (err) {
      if (!(err instanceof RPCError)) {
        throw err;
      }

      expect(err.code).to.equal(1234);
      expect(err.message).to.equal('oh no!');
    }
  });

  it('rejects unknown methods', async () => {
    await readyUp();

    sendMessage({
      data: {
        type: 'method',
        method: 'bar',
        serviceID: 'foo',
        counter: 1,
        id: 1,
      },
      origin: 'example.com',
    });

    await delay();

    expect(messages).to.deep.include({
      type: 'reply',
      serviceID: 'foo',
      counter: 1,
      id: 1,
      result: null,
      error: { code: 4003, message: 'Unknown method name' },
    });
  });
});
