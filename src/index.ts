import { isThenable, identity, isFunction, isObject } from './utils';

enum States {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

interface Handler<T, U> {
  onSuccess: HandlerOnSuccess<T, U>;
  onFail: HandlerOnFail<U>;
}

type HandlerOnSuccess<T, U = any> = (value: T) => U | Thenable<U>;
type HandlerOnFail<U = any> = (reason: any) => U | Thenable<U>;
type Finally<U> = () => U | Thenable<U>;

interface Thenable<T> {
  then<U>(
    onSuccess?: HandlerOnSuccess<T, U>,
    onFail?: HandlerOnFail<U>,
  ): Thenable<U>;
  then<U>(
    onSuccess?: HandlerOnSuccess<T, U>,
    onFail?: (reason: any) => void,
  ): Thenable<U>;
}

type Resolve<R> = (value?: R | Thenable<R>) => void;
type Reject = (value?: any) => void;

class TimeoutError extends Error {
  constructor() {
    super('TIMEOUT');
  }
}

const errors = {
  TimeoutError,
};

class PQ<T> {
  private state: States = States.PENDING;
  private handlers: Handler<T, any>[] = [];
  private value: T | any;
  public static errors = errors;

  public constructor(callback: (resolve: Resolve<T>, reject: Reject) => void) {
    try {
      callback(this.resolve, this.reject);
    } catch (e) {
      this.reject(e);
    }
  }

  private resolve = (value: T) => {
    return this.setResult(value, States.RESOLVED);
  };

  private reject = (reason: any) => {
    return this.setResult(reason, States.REJECTED);
  };

  private setResult = (value: T | any, state: States) => {
    const set = () => {
      if (this.state !== States.PENDING) {
        return null;
      }

      if (isThenable(value)) {
        return (value as Thenable<T>).then(this.resolve, this.reject);
      }

      this.value = value;
      this.state = state;

      return this.executeHandlers();
    };

    setTimeout(set, 0);
  };

  private executeHandlers = () => {
    if (this.state === States.PENDING) {
      return null;
    }

    this.handlers.forEach((handler) => {
      if (this.state === States.REJECTED) {
        return handler.onFail(this.value);
      }

      return handler.onSuccess(this.value);
    });

    this.handlers = [];
  };

  private attachHandler = (handler: Handler<T, any>) => {
    this.handlers = [...this.handlers, handler];

    this.executeHandlers();
  };

  public then<U>(
    onSuccess?: HandlerOnSuccess<T, U>,
    onFail?: HandlerOnFail<U>,
  ) {
    return new PQ<U | T>((resolve, reject) => {
      return this.attachHandler({
        onSuccess: (result) => {
          if (!onSuccess) {
            return resolve(result);
          }

          try {
            return resolve(onSuccess(result));
          } catch (e) {
            return reject(e);
          }
        },
        onFail: (reason) => {
          if (!onFail) {
            return reject(reason);
          }

          try {
            return resolve(onFail(reason));
          } catch (e) {
            return reject(e);
          }
        },
      });
    });
  }

  public catch<U>(onFail: HandlerOnFail<U>) {
    return this.then<U>(identity, onFail);
  }

  // methods

  public toString() {
    return `[object PQ]`;
  }

  public finally<U>(cb: Finally<U>) {
    return new PQ<U>((resolve, reject) => {
      let val: U | any;
      let isRejected: boolean;

      return this.then(
        (value) => {
          isRejected = false;
          val = value;
          return cb();
        },
        (reason) => {
          isRejected = true;
          val = reason;
          return cb();
        },
      ).then(() => {
        if (isRejected) {
          return reject(val);
        }

        return resolve(val);
      });
    });
  }

  public spread<U>(handler: (...args: any[]) => U) {
    return this.then<U>((collection) => {
      if (Array.isArray(collection)) {
        return handler(...collection);
      }

      return handler(collection);
    });
  }

  public timeout(timeInMs: number) {
    return new PQ<T>((resolve, reject) => {
      const timeoutCb = () => {
        return reject(new PQ.errors.TimeoutError());
      };

      setTimeout(timeoutCb, timeInMs);

      return this.then(resolve);
    });
  }

  // static

  public static resolve<U = any>(value?: U | Thenable<U>) {
    return new PQ<U>((resolve) => {
      return resolve(value);
    });
  }

  public static reject<U>(reason?: any) {
    return new PQ<U>((resolve, reject) => {
      return reject(reason);
    });
  }

  public static props<U = any>(obj: object) {
    return new PQ<U>((resolve, reject) => {
      if (!isObject(obj)) {
        return reject(new TypeError('An object must be provided.'));
      }

      const resolvedObject = {};

      const keys = Object.keys(obj);
      const resolvedValues = PQ.all<string>(keys.map((key) => obj[key]));

      return resolvedValues
        .then((collection) => {
          return collection.map((value, index) => {
            resolvedObject[keys[index]] = value;
          });
        })
        .then(() => resolve(resolvedObject as U))
        .catch(reject);
    });
  }

  public static all<U = any>(collection: (U | Thenable<U>)[]) {
    return new PQ<U[]>((resolve, reject) => {
      if (!Array.isArray(collection)) {
        return reject(new TypeError('An array must be provided.'));
      }

      let counter = collection.length;
      const resolvedCollection: U[] = [];

      const tryResolve = (value: U, index: number) => {
        counter -= 1;
        resolvedCollection[index] = value;

        if (counter !== 0) {
          return null;
        }

        return resolve(resolvedCollection);
      };

      return collection.forEach((item, index) => {
        return PQ.resolve(item)
          .then((value) => {
            return tryResolve(value, index);
          })
          .catch(reject);
      });
    });
  }

  public static spread<U extends any[]>(
    collection: U,
    handler: HandlerOnSuccess<any[]>,
  ) {
    return PQ.all(collection).spread(handler);
  }

  public static any<U = any>(collection: (U | Thenable<U>)[]) {
    return new PQ<U>((resolve, reject) => {
      return collection.forEach((item) => {
        return PQ.resolve(item)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  public static delay(timeInMs: number) {
    return new PQ((resolve) => {
      return setTimeout(resolve, timeInMs);
    });
  }

  public static promisify<U = any>(
    fn: (...args: any[]) => void,
    context = null,
  ) {
    return (...args: any[]) => {
      return new PQ<U>((resolve, reject) => {
        return fn.apply(context, [
          ...args,
          (err: any, result: U) => {
            if (err) {
              return reject(err);
            }

            return resolve(result);
          },
        ]);
      });
    };
  }

  public static promisifyAll<U>(obj: any): U {
    return Object.keys(obj).reduce((result, key) => {
      let prop = obj[key];

      if (isFunction(prop)) {
        prop = PQ.promisify(prop, obj);
      }

      result[`${key}Async`] = prop;

      return result;
    }, {}) as U;
  }
}

export { PQ };
