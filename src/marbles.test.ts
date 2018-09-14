import { expect, use } from 'chai';
import { RPC } from './rpc';
import { IMessageEvent, RPCMessage } from './types';

// tslint:disable-next-line
use(require('chai-subset'));

/**
 * Function that returns a delay of the requested number of milliseconds.
 */
export const delay = (duration: number = 1) =>
  new Promise(resolve => setTimeout(resolve, duration));

/**
 * Action defines the assertion to run in the test definition
 */
export const enum Action {
  Send,
  Handler,
  Receive,
  IsReady,
}

/**
 * Definition is passed to the IMarbleTest to define what checks to run
 * at each point. In order:
 *
 *  1. Send a method. From the RPC, it should have a method name and body.
 *  2. Asserts that the RPC is in the ready state at the given time.
 *  3. Asserts that we receive something that matches the given subset
 *  4. Asserts that we receive something that deep equals the given object
 *  5. Asserts that we receive something, and passes the message to the test
 *     function.
 */
export type Definition =
  | { action: Action.Send; method?: string; data: any }
  | { action: Action.IsReady; value: boolean }
  | { action: Action.Receive; subset: any }
  | { action: Action.Receive; object: any }
  | { action: Action.Receive; tester: (r: RPCMessage<any>) => void };

function testMethod(charDef: string, def: Definition, message: RPCMessage<any> | undefined) {
  if (def.action !== Action.Receive) {
    return;
  }

  if (!message) {
    throw new Error(`Expected to get reply for definition ${charDef}, but we didn't`);
  }

  if ('subset' in def) {
    expect(message).to.containSubset(def.subset);
  } else if ('object' in def) {
    expect(message).to.deep.equal(def.object, `expected objects in def ${charDef} to be equal`);
  } else {
    def.tester(message);
  }
}

/**
 * Options passed into testMarbles.
 */
export interface IMarbleTest {
  /**
   * Marble test for RPC instance. E.g. `--a-b-c`. Dashes are "no ops",
   * letters match up to assertions in the `definitions` object.
   */
  rpcInstance: string;

  /**
   * Marble test for "remote window". E.g. `--a-b-c`. Dashes are "no ops",
   * letters match up to assertions in the `definitions` object.
   */
  remoteContx: string;

  /**
   * Assertions matching up to the marble test.
   */
  definitions: { [char: string]: Definition };

  /**
   * Handler methods to attach to the marbles.
   */
  handlers?: { [method: string]: (data: any) => any };
}

/**
 * rxjs-style marble sequence tests.
 */
export async function testMarbles({
  rpcInstance,
  remoteContx,
  definitions,
  handlers,
}: IMarbleTest) {
  const messagesSentToRemote: Array<RPCMessage<any>> = [];
  const messagesReceivedByRPC: Array<RPCMessage<any>> = [];

  let sendMessage: null | ((ev: IMessageEvent) => void) = null;
  let toreDown = false;
  let isReady = false;

  const rpc = new RPC({
    target: { postMessage: (data: any) => messagesSentToRemote.push(JSON.parse(data)) },
    receiver: {
      readMessages: callback => {
        sendMessage = event => callback({ data: JSON.stringify(event.data), origin: event.origin });
        return () => (toreDown = true);
      },
    },
    origin: 'example.com',
    serviceId: 'foo',
  });

  rpc.on('recvData', p => messagesReceivedByRPC.push(p));
  rpc.on('isReady', () => (isReady = true));

  while (rpcInstance.length < remoteContx.length) {
    rpcInstance += '-';
  }
  while (remoteContx.length < rpcInstance.length) {
    remoteContx += '-';
  }

  if (handlers) {
    for (const key of Object.keys(handlers)) {
      rpc.expose(key, handlers[key]);
    }
  }

  for (let i = 0; i < rpcInstance.length; i++) {
    if (rpcInstance[i] !== '-') {
      const def = definitions[rpcInstance[i]];
      if (!def) {
        throw new Error(`Unknown action ${rpcInstance[i]}`);
      }

      if (def.action === Action.Send) {
        rpc.call(def.method!, def.data, false);
      } else if (def.action === Action.Receive) {
        testMethod(rpcInstance[i], def, messagesReceivedByRPC.shift());
      } else if (def.action === Action.IsReady) {
        expect(isReady).to.equal(
          def.value,
          `expected the rpc.ready=${def.value} by ${rpcInstance[i]}, but it was not`,
        );
      }
    }

    if (remoteContx[i] !== '-') {
      const def = definitions[remoteContx[i]];
      if (!def) {
        throw new Error(`Unknown action ${remoteContx[i]}`);
      }

      if (def.action === Action.Send) {
        sendMessage!(def.data);
      } else {
        testMethod(rpcInstance[i], def, messagesSentToRemote.shift());
      }
    }

    await delay();
  }

  rpc.destroy();
  expect(toreDown).to.be.true;
}
