// import { expect } from 'chai';

import { RPCError } from './error';
import { Action, Definition, testMarbles } from './marbles.test';

const makeReply = (id: number, counter: number, result: any) => ({
  data: {
    type: 'reply',
    serviceID: 'foo',
    counter,
    id,
    result,
  },
  origin: 'example.com',
});

const makeCall = (id: number, counter: number, method: string, params: any, discard = false) => ({
  data: {
    type: 'method',
    serviceID: 'foo',
    discard,
    method,
    counter,
    id,
    params,
  },
  origin: 'example.com',
});

const expectReady: Definition = {
  action: Action.Receive,
  object: {
    type: 'method',
    method: 'ready',
    discard: false,
    id: -1,
    serviceID: 'foo',
    counter: 0,
    params: {
      protocolVersion: '1.0',
    },
  },
};

describe('RPC', () => {
  it('says it is ready if it gets a ready reply', () =>
    testMarbles({
      rpcInstance: 'a--de',
      remoteContx: '-bc--',
      definitions: {
        a: { action: Action.IsReady, value: false },
        b: expectReady,
        c: {
          action: Action.Send,
          data: makeReply(-1, 0, {
            protocolVersion: '1.0',
          }),
        },
        d: {
          action: Action.Receive,
          subset: {
            type: 'reply',
            result: {
              protocolVersion: '1.0',
            },
          },
        },
        e: { action: Action.IsReady, value: true },
      },
    }));

  it('says it is ready if it gets a ready event later', () =>
    testMarbles({
      rpcInstance: 'a--de',
      remoteContx: '-bc--',
      definitions: {
        a: { action: Action.IsReady, value: false },
        b: expectReady,
        c: {
          action: Action.Send,
          data: makeCall(
            0,
            0,
            'ready',
            {
              protocolVersion: '1.0',
            },
            true,
          ),
        },
        d: {
          action: Action.Receive,
          subset: {
            type: 'method',
            method: 'ready',
            params: {
              protocolVersion: '1.0',
            },
          },
        },
        e: { action: Action.IsReady, value: true },
      },
    }));

  it('should reject methods from invalid service IDs', () =>
    testMarbles({
      rpcInstance: '---',
      remoteContx: 'ab-',
      definitions: {
        a: expectReady,
        b: {
          action: Action.Send,
          data: {
            data: {
              type: 'method',
              method: 'ready',
              serviceID: 'wut',
              counter: 0,
            },
            origin: 'example.com',
          },
        },
      },
    }));

  it('should reject methods from invalid origins', () =>
    testMarbles({
      rpcInstance: '---',
      remoteContx: 'ab-',
      definitions: {
        a: expectReady,
        b: {
          action: Action.Send,
          data: {
            data: {
              type: 'method',
              method: 'ready',
              serviceID: 'foo',
              counter: 0,
            },
            origin: 'wut.com',
          },
        },
      },
    }));

  it('should reject malformed messages', () =>
    testMarbles({
      rpcInstance: '---',
      remoteContx: 'ab-',
      definitions: {
        a: expectReady,
        b: {
          action: Action.Send,
          data: {
            data: {
              potato: true,
            },
            origin: 'example.com',
          },
        },
      },
    }));

  it('should make calls and receive+reorder replies', () =>
    testMarbles({
      rpcInstance: '-bcd---hij',
      remoteContx: 'a---efg--',
      definitions: {
        a: expectReady,
        b: {
          action: Action.Send,
          method: 'firstMethod',
          data: {},
        },
        c: {
          action: Action.Send,
          method: 'secondMethod',
          data: {},
        },
        d: {
          action: Action.Send,
          method: 'thirdMethod',
          data: {},
        },
        e: {
          action: Action.Send,
          data: makeReply(3, 2, 'thirdReply'),
        },
        f: {
          action: Action.Send,
          data: makeReply(2, 1, 'secondReply'),
        },
        g: {
          action: Action.Send,
          data: makeReply(1, 0, 'firstReply'),
        },
        h: {
          action: Action.Receive,
          subset: { result: 'firstReply' },
        },
        i: {
          action: Action.Receive,
          subset: { result: 'secondReply' },
        },
        j: {
          action: Action.Receive,
          subset: { result: 'thirdReply' },
        },
      },
    }));

  it('should bubble any returned rpc errors', () =>
    testMarbles({
      rpcInstance: '--c-',
      remoteContx: 'ab-d',
      handlers: {
        bar: () => {
          throw new RPCError(1234, 'oh no!');
        },
      },
      definitions: {
        a: expectReady,
        b: { action: Action.Send, data: makeCall(0, 0, 'bar', null) },
        c: {
          action: Action.Receive,
          subset: { method: 'bar' },
        },
        d: {
          action: Action.Receive,
          subset: {
            error: { code: 1234, message: 'oh no!' },
          },
        },
      },
    }));

  it('should error on unknown methods', () =>
    testMarbles({
      rpcInstance: '--c-',
      remoteContx: 'ab-d',
      definitions: {
        a: expectReady,
        b: { action: Action.Send, data: makeCall(0, 0, 'bar', null) },
        c: {
          action: Action.Receive,
          subset: { method: 'bar' },
        },
        d: {
          action: Action.Receive,
          subset: {
            error: { code: 4003, message: 'Unknown method name "bar"' },
          },
        },
      },
    }));

  it('should reset call counter when ready is received', () =>
    testMarbles({
      rpcInstance: '-b--ef--',
      remoteContx: 'a-cd--gh',
      definitions: {
        a: expectReady,
        b: {
          action: Action.Send,
          method: 'hello',
          data: true,
        },
        c: {
          action: Action.Receive,
          subset: { method: 'hello', counter: 1 },
        },
        d: {
          action: Action.Send,
          data: makeCall(-1, 0, 'ready', {
            protocolVersion: '1.0',
          }),
        },
        e: expectReady,
        f: {
          action: Action.Send,
          method: 'helloAgain',
          data: true,
        },
        g: {
          action: Action.Receive,
          subset: { type: 'reply', id: -1, counter: 0 },
        },
        h: {
          action: Action.Receive,
          subset: { type: 'method', counter: 1 },
        },
      },
    }));
});
