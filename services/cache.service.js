
class Cache {
    constructor(ttl = 300000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        const expirationTime = Date.now() + this.ttl;
        this.cache.set(key, { value, expirationTime });
    }

    get(key) {
        const cacheItem = this.cache.get(key);

        if (cacheItem) {
            const { value, expirationTime } = cacheItem;

            if (Date.now() > expirationTime) {
                this.cache.delete(key);
                return null;
            }
            return value;
        }
        return null;
    }

    delete(key) {
        this.cache.delete(key);
    }

    has(key) {

        if (this.cache.has(key)) {

            const cacheItem = this.cache.get(key);

            if (cacheItem) {

                const { expirationTime } = cacheItem;

                if (Date.now() > expirationTime) {
                    this.cache.delete(key);
                    return false;
                }

                return true;
            }
        }

        return false;
    }

    keys() {
        return this.cache.keys()
    }

    clear() {
        this.cache.clear();
    }
}


const globalCache = new Cache()

module.exports = { globalCache }