/**
 * redis-connection-pool
 *
 * copyright 2012 - 2022 Nick Jennings (https://github.com/silverbucket)
 *
 * licensed under the MIT license.
 * See the LICENSE file for details.
 *
 * The latest version can be found here:
 *
 *   https://github.com/silverbucket/node-redis-connection-pool
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
import { createClient, RedisClientOptions, RedisClientType } from "redis";
import { createPool, Pool } from "generic-pool";
import debug from "debug";

const log = debug("redis-connection-pool");
const connectionPools = new Map();

export interface RedisConnectionPoolConfig {
  max_clients?: number;
  perform_checks?: boolean;
  redis?: RedisClientOptions;
}

type SingleCommandResult =
  | string
  | number
  | boolean
  | Buffer
  | { [x: string]: string | Buffer }
  | { key: string | Buffer; element: string | Buffer }
  | (string | Buffer)[];

/**
 * List of redis commands which have been implemented by the RedisConnectionPool class
 */
type FuncNames =
  | "HDEL"
  | "DEL"
  | "GET"
  | "HGETALL"
  | "TTL"
  | "INCR"
  | "BRPOP"
  | "HGET"
  | "BLPOP"
  | "EXPIRE"
  | "KEYS";

type IdentifierType = string;

/**
 * Function: redisConnectionPoolFactory
 *
 * A high-level redis management object. It manages a number of connections in
 * a pool, using them as needed and keeping all aspects of releasing active
 * connections internal to the object, so the user does not need to worry about
 * forgotten connections leaking memory and building up over time.
 *
 * Parameters:
 *
 *   uid - (string) - Unique identifier to retrieve an existing instance from
 *                    elsewhere in an application. If left undefined, one will
 *                    be generated automatically and available via the `uid`
 *                    property of the returned object.
 *
 *   cfg - (object) - A series of configuration parameters to be optionally
 *                    passed in and used during initialization of the object.
 *
 *
 *   cfg.max_clients - (number) - Max clients alive in the connection pool at
 *                                once. (default: 30)
 *
 *   cfg.redis - (object) - A redis config object
 *
 * Returns:
 *
 *   A RedisConnectionPool object
 */
export default async function redisConnectionPoolFactory(
  uid: IdentifierType,
  cfg: RedisConnectionPoolConfig = {}
): Promise<RedisConnectionPool> {
  let pool;
  if (!connectionPools.has(uid)) {
    pool = new RedisConnectionPool(cfg);
    connectionPools.set(uid, pool);
    await pool.init();
  } else {
    pool = connectionPools.get(uid);
  }
  return pool;
}

/**
 * RedisConnectionPool
 */
export class RedisConnectionPool {
  max_clients = 5;
  redis: RedisClientOptions;
  pool: Pool<RedisClientType>;
  // @ts-ignore
  private initializing = false;

  constructor(cfg: RedisConnectionPoolConfig = {}) {
    this.max_clients = cfg.max_clients || this.max_clients;
    this.redis = cfg.redis;
  }

  _destroy = async (c) => {
    try {
      // console.log("destroy this  pool", new Date(), this.pool)
      // await this.pool.drain()
      await this.pool.clear();
      console.log("pending", JSON.stringify(this.pool.pending), new Date());
      console.log(
        "spareResourceCapacity",
        JSON.stringify(this.pool.spareResourceCapacity)
      );
      console.log("size", JSON.stringify(this.pool.size));
      console.log("available", JSON.stringify(this.pool.available));
      // console.log("this.pool._availableObjects", this.pool._availableObjects)
      // this.pool._waitingClientsQueue.dequeue()
      // clear everything here
      // @ts-ignore
      for (let index = 0; index < this.pool._availableObjects.length; index++) {
        // @ts-ignore
        this.pool._availableObjects.shift();
      }

      // @ts-ignore
      for (const poolResource of this.pool._allObjects) {
        // console.log(poolResource);
        // @ts-ignore
        // console.log("this._resourceLoans", this.pool._resourceLoans);
        await this.pool.destroy(poolResource.obj);
      }

      // console.log(
      //   "this.pool._availableObjects after",
      //   // @ts-ignore
      //   this.pool._availableObjects
      // );
      // console.log(
      //   "this.pool.this.pool._allObjects after",
      //   // @ts-ignore
      //   this.pool._allObjects
      // );

      // console.log("destroy this  pool result", new Date(), this.pool)
      // 2022-10-13T09:06:32.815Z
    } catch (err) {
      console.log("this.pool.destroy() err", err);
      // this.pool._waitingClientsQueue.dequeue().resolve()
    }
    // try {
    //     console.log("disconect", new Date())
    //     // await c.disconnect();
    // } catch (err) {
    //     console.log("disconect", err)
    // }
    // console.log(this.pool)
  };

  /**
   * Execute a redis BLPOP command
   *
   * @param key - The list key
   */
  async blpop(
    key: string
  ): Promise<{ key: string; element: SingleCommandResult }> {
    return await this.getFuncs("BLPOP", key);
  }

  /**
   * Execute a redis BRPOP command
   *
   * @param key - The list key
   */
  async brpop(
    key: string
  ): Promise<{ key: string; element: SingleCommandResult }> {
    return await this.getFuncs("BRPOP", key);
  }

  /**
   * Execute a redis DEL command
   *
   * @param key - The key of the value you wish to delete
   */
  async del(key: string): Promise<number> {
    return (await this.singleCommand("DEL", [key])) as number;
  }

  /**
   * Execute a redis EXPIRE command
   *
   * @param key - A key to assign value to
   * @param ttl - TTL in seconds
   */
  async expire(key: string, ttl: number): Promise<number> {
    return (await this.singleCommand("EXPIRE", [key, ttl])) as number;
  }

  /**
   * Execute a redis GET command
   *
   * @param key - The key of the value you wish to get
   */
  async get(key: string): Promise<string> {
    return await this.getFuncs<string>("GET", key);
  }

  /**
   * Execute a redis HDEL command
   *
   * @param key - The key of the value you wish to delete
   * @param fields - Array of additional field names to be deleted
   */
  async hdel(key: string, fields: Array<string>): Promise<number> {
    return (await this.singleCommand("HDEL", [key].concat(fields))) as number;
  }

  /**
   * Execute a redis HGET command
   *
   * @param key - The key of the hash you wish to get
   * @param field - The field name to retrieve
   */
  async hget(key: string, field: string): Promise<string> {
    return await this.getFuncs<string>("HGET", key, field);
  }

  /**
   * Execute a redis HGETALL command
   *
   * @param key - The key of the hash you wish to get
   */
  async hgetall(key: string): Promise<{ [index: string]: string }> {
    return await this.getFuncs<{ [index: string]: string }>("HGETALL", key);
  }

  /**
   * Execute a redis HSET command
   *
   * @param key - A key to assign the hash to
   * @param field - Name of the field to set
   * @param data - Value to assign to hash
   */
  async hset(key: string, field: string, data: string): Promise<number> {
    const client = await this.pool.acquire();
    const res = client.HSET(key, field, data);
    await this.pool.release(client);
    return res;
  }

  /**
   * Execute a redis INCR command
   *
   * @param key - A key whose value you wish to increment
   */
  async incr(key: string): Promise<number> {
    return await this.getFuncs<number>("INCR", key);
  }

  /**
   * Initializes the Redis connection pool, connecting to redis.
   */
  async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const that = this;
    this.pool = createPool(
      {
        create: function () {
          console.log("create");
          return new Promise(
            (async (resolve, reject) => {
              log("create");
              if (this.initializing) {
                log(
                  "Create method already called. (Redis config error? " +
                    "or maybe you forgot to await the init function?)"
                );
                throw Error(
                  "Create method already called. (Redis config error? " +
                    "or maybe you forgot to await the init function?)"
                );
              } else {
                that.initializing = true;
              }
              const client = createClient(that.redis);
              client?.on("error", function handler(err) {
                console.log("ERROR client", err);
                // throw new Error(err)
                // console.log("client create error ")
                // await client.quit()
                if (that.initializing) {
                  that.initializing = false;
                  reject(client);
                } else {
                  that._destroy(client);
                }
                // unsubscribe
                client.off("error", handler);
              });
              client?.on("ready", () => {
                log("ready");
              });
              log("connecting");
              try {
                await client.connect();
              } catch (err) {
                log("connecting err", err);
                that.initializing = false;
                that._destroy(client);
                reject(client);
                return;
              }

              that.initializing = false;
              // @ts-ignore
              resolve(client);
            }).bind(that)
          );
        },
        destroy: async (client) => {
          return new Promise(async (resolve, reject) => {
            try {
              await client.disconnect();
            } catch (error) {
              console.log("failed to destory", error);
              reject("failed to destory");
            }
            console.log("destroy callback done");
            resolve(null);
          });
        },
        // @ts-ignore
        validate: async (resource) => {
          const res = await resource.ping();
          // console.log("validdate", res);
          return res;
        },
      },
      {
        max: this.max_clients,
        min: 0,
        // evictionRunIntervalMillis: 5000,
        // idleTimeoutMillis: 1000,
        acquireTimeoutMillis: 1000,
        destroyTimeoutMillis: 1000,
        // maxWaitingClients: 0,
        // testOnBorrow: truef
      }
    );

    this.pool.on &&
      this.pool.on("factoryCreateError", (error) => {
        console.log("factoryCreateError");
        // error.disconnect()
        // @ts-ignore
        const sup = this.pool._waitingClientsQueue.dequeue();
        // console.log(error)
        // @ts-ignore
        sup.reject(error);
      });

    this.pool.on &&
      this.pool.on("factoryDestroyError", (error) => {
        console.log("factoryDestroyError", error);
        // @ts-ignore
        // this.pool._waitingClientsQueue.dequeue().reject(error);
      });
  }

  /**
   * Execute a redis KEYS command
   *
   * @param key - The prefix of the keys to return
   */
  async keys(key: string): Promise<Array<string>> {
    return (await this.singleCommand("KEYS", [key])) as Array<string>;
  }

  /**
   * Execute a redis LPUSH command
   *
   * @param key - The list key
   * @param data - Value to assign to the list
   */
  async lpush(key: string, data: string): Promise<number> {
    const client = await this.pool.acquire();
    const res = client.LPUSH(key, data);
    await this.pool.release(client);
    return res;
  }

  /**
   * Execute a redis RPUSH command
   *
   * @param key - The list key
   * @param data - Value to assign to the list
   */
  async rpush(key: string, data: string): Promise<number> {
    const client = await this.pool.acquire();
    const res = client.RPUSH(key, data);
    await this.pool.release(client);
    return res;
  }

  /**
   * Sends an explicit command to the redis server. Helpful for all the commands in redis
   * that aren't supported natively by this pool API.
   *
   * @param command_name - Name of redis command to execute
   * @param args - List of arguments for the redis command
   *
   * @example
   *
   *  sendCommand('ECHO', ['Hello Redis'] )
   *
   */
  async sendCommand(
    command_name: string,
    args: Array<string>
  ): Promise<SingleCommandResult> {
    return await this.singleCommand(command_name as FuncNames, args);
  }

  /**
   * Execute a redis SET command
   *
   * @param key - A key to assign value to
   * @param data - Value to assign to key
   * @param ttl - TTL (Time to Live) in seconds
   */
  async set(
    key: string,
    data: string | number,
    ttl: number = undefined
  ): Promise<string | null> {
    const client = await this.pool.acquire();
    const res = client.SET(key, data, { EX: ttl });
    await this.pool.release(client);
    return res;
  }

  /**
   * Drain the pool and close all connections to Redis.
   */
  async shutdown(): Promise<void> {
    await this.pool.drain();
    await this.pool.clear();
  }

  /**
   * Execute a redis TTL command
   *
   * @param {string} key - A key whose TTL(time-to-expire) will be returned
   */
  async ttl(key: string): Promise<number> {
    return await this.getFuncs<number>("TTL", key);
  }

  private async singleCommand(
    funcName: FuncNames,
    functionParams: Array<any> = []
  ): Promise<SingleCommandResult> {
    const client = await this.pool.acquire();
    const res = await client[funcName](...functionParams);
    await this.pool.release(client);
    return res;
  }

  private async getFuncs<T>(
    funcName: FuncNames,
    key: string,
    field: string | undefined = undefined
  ): Promise<T> {
    const client = await this.pool.acquire();
    try {
      let res;
      if (
        funcName === "GET" ||
        funcName === "HGETALL" ||
        funcName === "TTL" ||
        funcName === "INCR"
      ) {
        res = await client[funcName](key);
      } else if (funcName === "BLPOP" || funcName === "BRPOP") {
        res = await client[funcName](key, 0);
      } else if (funcName === "HGET") {
        res = await client.HGET(key, field);
      }
      return res;
    } catch {
      this.pool.release(client);
      await this.pool.destroy(client);
      return null;
    } finally {
      await this.pool.release(client);
      // console.log("done", this.pool)
    }
  }
}
