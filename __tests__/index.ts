import { PQ } from '../src';

describe('PQ <constructor>', () => {
  test('resolves like a promise', () => {
    return new PQ<number>((resolve) => {
      setTimeout(() => {
        resolve(1);
      }, 30);
    }).then((val) => {
      expect(val).toBe(1);
    });
  });

  test('is always asynchronous', () => {
    const p = new PQ((resolve) => resolve(5));

    expect((p as any).value).not.toBe(5);
  });

  test('resolves with the expected value', () => {
    return new PQ<number>((resolve) => resolve(30)).then((val) => {
      expect(val).toBe(30);
    });
  });

  test('resolves a thenable before calling then', () => {
    return new PQ<number>((resolve) =>
      resolve(new PQ((resolve) => resolve(30))),
    ).then((val) => expect(val).toBe(30));
  });

  test('catches errors (reject)', () => {
    const error = new Error('Hello there');

    return new PQ((resolve, reject) => {
      return reject(error);
    }).catch((err: Error) => {
      expect(err).toBe(error);
    });
  });

  test('catches errors (throw)', () => {
    const error = new Error('General Kenobi!');

    return new PQ(() => {
      throw error;
    }).catch((err) => {
      expect(err).toBe(error);
    });
  });

  test('is not mutable - then returns a new promise', () => {
    const start = new PQ<number>((resolve) => resolve(20));

    return PQ.all([
      start
        .then((val) => {
          expect(val).toBe(20);
          return 30;
        })
        .then((val) => expect(val).toBe(30)),
      start.then((val) => expect(val).toBe(20)),
    ]);
  });
});

// prototype

describe('PQ.prototype.toString', () => {
  test('returns [object PQ]', () => {
    expect(new PQ<undefined>((resolve) => resolve()).toString()).toBe(
      '[object PQ]',
    );
  });
});

describe('PQ.prototype.resolve', () => {
  test('resolves a value', () => {
    return PQ.resolve(15).then((val) => expect(val).toBe(15));
  });
});

describe('PQ.prototype.reject', () => {
  test('rejects a value', () => {
    const error = new Error('Hello there');

    return PQ.reject(error).catch((err) => expect(err).toBe(error));
  });
});

describe('PQ.prototype.finally', () => {
  test('it is called regardless of the promise state', () => {
    let counter = 0;
    return PQ.resolve(15)
      .finally(() => {
        counter += 1;
      })
      .then(() => {
        return PQ.reject(15);
      })
      .then(() => {
        // wont be called
        counter = 1000;
      })
      .finally(() => {
        counter += 1;
      })
      .catch((reason) => {
        expect(reason).toBe(15);
        expect(counter).toBe(2);
      });
  });
});

describe('PQ.protoype.spread', () => {
  test('spreads arguments', () => {
    return PQ.all<number>([1, 2, 3]).spread((...args) => {
      expect(args).toEqual([1, 2, 3]);
      return 5;
    });
  });

  test('accepts normal value (non collection)', () => {
    return PQ.resolve(1).spread((one) => {
      expect(one).toBe(1);
    });
  });
});

describe('PQ.prototype.timeout', () => {
  test('rejects after given timeout', () => {
    return new PQ<number>((resolve) => {
      setTimeout(resolve, 50);
    })
      .timeout(40)
      .catch((reason) => {
        expect(reason).toBeInstanceOf(PQ.errors.TimeoutError);
      });
  });

  test('resolves before given timeout', () => {
    return new PQ<number>((resolve) => {
      setTimeout(() => resolve(500), 500);
    })
      .timeout(600)
      .then((value) => {
        expect(value).toBe(500);
      });
  });
});

// static

describe('PQ.resolve', () => {
  test('resolves a value', () => {
    return PQ.resolve(5).then((value) => {
      expect(value).toBe(5);
    });
  });
});

describe('PQ.reject', () => {
  test('rejects a value', () => {
    return PQ.reject(5).catch((value) => {
      expect(value).toBe(5);
    });
  });
});

describe('PQ.all', () => {
  test('resolves a collection of promises', () => {
    return PQ.all([PQ.resolve(1), PQ.resolve(2), 3]).then((collection) => {
      expect(collection).toEqual([1, 2, 3]);
    });
  });

  test('rejects if one item rejects', () => {
    return PQ.all([PQ.resolve(1), PQ.reject(2)]).catch((reason) => {
      expect(reason).toBe(2);
    });
  });
});

describe('PQ.any', () => {
  test('resolves the first value', () => {
    return PQ.any<number>([
      PQ.resolve(1),
      new PQ((resolve) => setTimeout(resolve, 15)),
    ]).then((val) => expect(val).toBe(1));
  });

  test('rejects if the first value rejects', () => {
    return PQ.any([
      new PQ((resolve) => setTimeout(resolve, 15)),
      PQ.reject(1),
    ]).catch((reason) => {
      expect(reason).toBe(1);
    });
  });
});

describe('PQ.props', () => {
  test('resolves object correctly', () => {
    return PQ.props<{ test: number; test2: number }>({
      test: PQ.resolve(1),
      test2: PQ.resolve(2),
    }).then((obj) => {
      return expect(obj).toEqual({ test: 1, test2: 2 });
    });
  });

  test('rejects non objects', () => {
    return PQ.props([]).catch((reason) => {
      expect(reason).toBeInstanceOf(TypeError);
    });
  });
});

describe('PQ.spread', () => {
  test('resolves and spreads collection', () => {
    return PQ.spread([PQ.resolve(1), 2, 3], (...args) => {
      expect(args).toEqual([1, 2, 3]);
    });
  });
});

describe('PQ.delay', () => {
  test('waits for the given amount of miliseconds before resolving', () => {
    return new PQ<string>((resolve) => {
      setTimeout(() => {
        resolve('timeout');
      }, 50);

      return PQ.delay(40).then(() => resolve('delay'));
    }).then((val) => {
      expect(val).toBe('delay');
    });
  });

  test('waits for the given amount of miliseconds before resolving 2', () => {
    return new PQ<string>((resolve) => {
      setTimeout(() => {
        resolve('timeout');
      }, 50);

      return PQ.delay(60).then(() => resolve('delay'));
    }).then((val) => {
      expect(val).toBe('timeout');
    });
  });
});

describe('PQ.promisify', () => {
  test('works', () => {
    const getName = (firstName, lastName, callback) => {
      return callback(null, `${firstName} ${lastName}`);
    };

    const fn = PQ.promisify<string>(getName);
    const firstName = 'Maciej';
    const lastName = 'Cieslar';

    return fn(firstName, lastName).then((value) => {
      return expect(value).toBe(`${firstName} ${lastName}`);
    });
  });
});

describe('PQ.promisifyAll', () => {
  test('promisifies a object', () => {
    const person = {
      name: 'Maciej Cieslar',
      getName(callback) {
        return callback(null, this.name);
      },
    };

    const promisifiedPerson = PQ.promisifyAll<{
      getNameAsync: () => PQ<string>;
    }>(person);

    return promisifiedPerson.getNameAsync().then((name) => {
      expect(name).toBe('Maciej Cieslar');
    });
  });
});
