// adapted from https://xn--2-umb.com/09/11/miller-rabin-primality-test-for-32-bit

function mulMod (a:number, b:number, n:number) {
    // TODO: should handle overflow here eventually
    return (a * b) % n;
}

function miller_rabin(n:number, k:number) {
    if (n === k) {
        return true;
    }

    // Factor n-1 as d 2^s
    let s = 0;
    let d = n - 1;
    for (; !(d & 1); s++) {
        d >>= 1;
    }

    // x = k^d mod n using exponentiation by squaring
    // The squaring overflows for n >= 2^32
    let x = 1;
    let b = k % n;
    let e = d;
    for (; e; e >>>= 1) {
        if (e & 1) {
            x = mulMod(x, b, n);
        }
        b = mulMod(b, b, n);
    }

    // Verify k^(d 2^[0…s-1]) mod n != 1
    if (x === 1 || x === n - 1) {
        return true;
    }

    while (s-- > 1) {
        x = mulMod(x, x, n);
        if (x === 1) {
            return false;
        }
        if (x === n - 1) {
            return true;
        }
    }
    return false;
}

export function is_prime(n:number) {
    return n > 1 && (n === Math.round(n)) && ((
        n > 73 &&
        !(  n % 2 &&
            n % 3 &&
            n % 5 &&
            n % 7 &&
            n % 11 &&
            n % 13 &&
            n % 17 &&
            n % 19 &&
            n % 23 &&
            n % 29 &&
            n % 31 &&
            n % 37 &&
            n % 41 &&
            n % 43 &&
            n % 47 &&
            n % 53 &&
            n % 59 &&
            n % 61 &&
            n % 67 &&
            n % 71 &&
            n % 73))
            ? false
            :   miller_rabin(n, 2) &&
                miller_rabin(n, 7) &&
                miller_rabin(n, 61));
}
