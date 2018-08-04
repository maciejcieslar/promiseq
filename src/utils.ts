const isFunction = (func: any) => typeof func === 'function';

const isObject = (supposedObject: any) =>
  typeof supposedObject === 'object' &&
  supposedObject !== null &&
  !Array.isArray(supposedObject);

const isThenable = (obj: any) => isObject(obj) && isFunction(obj.then);

const identity = (val: any) => val;

export { isObject, isThenable, identity, isFunction };
