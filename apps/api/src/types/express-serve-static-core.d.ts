declare module 'express-serve-static-core' {
  export interface ParamsDictionary {
    [key: string]: string;
  }

  export interface Query {
    [key: string]: string | string[] | undefined;
  }

  export interface Request<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = Query,
    Locals extends Record<string, any> = Record<string, any>,
  > {
    params: P;
    body: ReqBody;
    query: ReqQuery;
    method: string;
    originalUrl?: string;
    path?: string;
    auth?: {
      role: import('../server/config').AppRole;
      actorUserId?: bigint;
    };
    id?: string;
    correlationId?: string;
    log?: any;
    header(name: string): string | undefined;
    get?(name: string): string | undefined;
    on?(event: string, listener: (...args: any[]) => void): this;
  }

  export interface Response<ResBody = any, Locals extends Record<string, any> = Record<string, any>> {
    locals: Locals;
    status(code: number): this;
    json(body: any): this;
    send(body?: any): this;
    setHeader(name: string, value: any): this;
    header(name: string, value: any): this;
    write(chunk: any): any;
    end(chunk?: any): any;
    flushHeaders?(): void;
  }

  export interface NextFunction {
    (err?: any): void;
  }

  export interface Router {
    get(path: any, ...handlers: any[]): any;
    post(path: any, ...handlers: any[]): any;
    put(path: any, ...handlers: any[]): any;
    patch(path: any, ...handlers: any[]): any;
    delete(path: any, ...handlers: any[]): any;
    use(pathOrHandler: any, ...handlers: any[]): any;
  }

  export interface Express extends Router {
    (req: any, res: any): any;
    listen(...args: any[]): any;
    ready?(): Promise<void>;
    inject?(...args: any[]): Promise<any>;
    close?(): Promise<void>;
  }
}
