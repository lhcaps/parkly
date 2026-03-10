declare module 'express' {
  import * as core from 'express-serve-static-core';

  interface ExpressInstance extends core.Express {}

  function express(): ExpressInstance;

  namespace express {
    export type Request<
      P = core.ParamsDictionary,
      ResBody = any,
      ReqBody = any,
      ReqQuery = core.Query,
      Locals extends Record<string, any> = Record<string, any>,
    > = core.Request<P, ResBody, ReqBody, ReqQuery, Locals>;
    export type Response<ResBody = any, Locals extends Record<string, any> = Record<string, any>> = core.Response<ResBody, Locals>;
    export type NextFunction = core.NextFunction;
    export type Router = core.Router;
    export type Express = core.Express;
    export function Router(): core.Router;
    export function json(...args: any[]): any;
    export function urlencoded(...args: any[]): any;
    export function static(...args: any[]): any;
  }

  export = express;
}
