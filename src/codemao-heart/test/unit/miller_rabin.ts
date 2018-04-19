import { is_prime } from '../../algorithm/miller_rabin';
import { test, GenericTest } from 'ava';

const PRIME_MAX = 1000000;
function get_primes(max:number) { // get all prime number and store in prime_list
    const sieve = [];
    const primes = [];
    const list:{[num:number]:boolean} = {};
    for (let i = 2; i <= max; ++i) {
        if (!sieve[i]) {
            // i has not been marked -- it is prime
            primes.push(i);
            for (let j = i << 1; j <= max; j += i) {
                sieve[j] = true;
            }
        }
    }
    for (let i = 0; i < primes.length; i++) {
        list[primes[i]] = true;
    }
    return list;
}
const prime_list = get_primes(PRIME_MAX);

function old_prime_test (x:number) {
    return prime_list[x] === true;
}

test(async function prime_test (t:any) {
    t.plan(1);
    for (let i = 0; i < PRIME_MAX; ++i) {
        if (old_prime_test(i) !== is_prime(i)) {
            t.fail();
            return;
        }
    }
    t.pass();
});
