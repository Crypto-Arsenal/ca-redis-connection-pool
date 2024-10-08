/// <reference types="node" />
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
import { RedisClientOptions, RedisClientType } from "redis";
import { Pool } from "generic-pool";
export interface RedisConnectionPoolConfig {
    max_clients?: number;
    perform_checks?: boolean;
    redis?: RedisClientOptions;
}
declare type SingleCommandResult = string | number | boolean | Buffer | {
    [x: string]: string | Buffer;
} | {
    key: string | Buffer;
    element: string | Buffer;
} | (string | Buffer)[];
declare type IdentifierType = string;
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
export default function redisConnectionPoolFactory(uid: IdentifierType, cfg?: RedisConnectionPoolConfig): Promise<RedisConnectionPool>;
/**
 * RedisConnectionPool
 */
export declare class RedisConnectionPool {
    max_clients: number;
    redis: RedisClientOptions;
    pool: Pool<RedisClientType>;
    private initializing;
    constructor(cfg?: RedisConnectionPoolConfig);
    _destroy: (c: any) => Promise<void>;
    /**
     * Execute a redis BLPOP command
     *
     * @param key - The list key
     */
    blpop(key: string): Promise<{
        key: string;
        element: SingleCommandResult;
    }>;
    /**
     * Execute a redis BRPOP command
     *
     * @param key - The list key
     */
    brpop(key: string): Promise<{
        key: string;
        element: SingleCommandResult;
    }>;
    /**
     * Execute a redis DEL command
     *
     * @param key - The key of the value you wish to delete
     */
    del(key: string): Promise<number>;
    /**
     * Execute a redis EXPIRE command
     *
     * @param key - A key to assign value to
     * @param ttl - TTL in seconds
     */
    expire(key: string, ttl: number): Promise<number>;
    /**
     * Execute a redis GET command
     *
     * @param key - The key of the value you wish to get
     */
    get(key: string): Promise<string>;
    /**
     * Execute a redis HDEL command
     *
     * @param key - The key of the value you wish to delete
     * @param fields - Array of additional field names to be deleted
     */
    hdel(key: string, fields: Array<string>): Promise<number>;
    /**
     * Execute a redis HGET command
     *
     * @param key - The key of the hash you wish to get
     * @param field - The field name to retrieve
     */
    hget(key: string, field: string): Promise<string>;
    /**
     * Execute a redis HGETALL command
     *
     * @param key - The key of the hash you wish to get
     */
    hgetall(key: string): Promise<{
        [index: string]: string;
    }>;
    /**
     * Execute a redis HSET command
     *
     * @param key - A key to assign the hash to
     * @param field - Name of the field to set
     * @param data - Value to assign to hash
     */
    hset(key: string, field: string, data: string): Promise<number>;
    /**
     * Execute a redis INCR command
     *
     * @param key - A key whose value you wish to increment
     */
    incr(key: string): Promise<number>;
    /**
     * Initializes the Redis connection pool, connecting to redis.
     */
    init(): Promise<void>;
    /**
     * Execute a redis KEYS command
     *
     * @param key - The prefix of the keys to return
     */
    keys(key: string): Promise<Array<string>>;
    /**
     * Execute a redis LPUSH command
     *
     * @param key - The list key
     * @param data - Value to assign to the list
     */
    lpush(key: string, data: string): Promise<number>;
    /**
     * Execute a redis RPUSH command
     *
     * @param key - The list key
     * @param data - Value to assign to the list
     */
    rpush(key: string, data: string): Promise<number>;
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
    sendCommand(command_name: string, args: Array<string>): Promise<SingleCommandResult>;
    /**
     * Execute a redis SET command
     *
     * @param key - A key to assign value to
     * @param data - Value to assign to key
     * @param ttl - TTL (Time to Live) in seconds
     */
    set(key: string, data: string | number, ttl?: number): Promise<string | null>;
    /**
     * Drain the pool and close all connections to Redis.
     */
    shutdown(): Promise<void>;
    /**
     * Execute a redis TTL command
     *
     * @param {string} key - A key whose TTL(time-to-expire) will be returned
     */
    ttl(key: string): Promise<number>;
    private singleCommand;
    private getFuncs;
}
export {};
